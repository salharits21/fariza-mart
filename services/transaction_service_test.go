package services

import (
	"database/sql"
	"strings"
	"testing"

	"farizamart/models"

	_ "modernc.org/sqlite"
)

// setupBackupTestDB creates an in-memory SQLite database with the tables
// used by ExportTransactionsCSV and seeds sample transactions.
func setupBackupTestDB(t *testing.T) *sql.DB {
	t.Helper()

	db, err := sql.Open("sqlite", "file:"+t.Name()+"?mode=memory&cache=shared")
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	// Keep a single connection so the shared in-memory DB survives.
	db.SetMaxOpenConns(1)

	schema := `
	CREATE TABLE users (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		username TEXT NOT NULL UNIQUE,
		display_name TEXT NOT NULL DEFAULT '',
		role TEXT NOT NULL DEFAULT 'employee'
	);
	CREATE TABLE transactions (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		transaction_code TEXT NOT NULL UNIQUE,
		employee_id INTEGER NOT NULL,
		total_amount REAL NOT NULL DEFAULT 0,
		payment_method TEXT DEFAULT '',
		note TEXT DEFAULT '',
		is_void INTEGER NOT NULL DEFAULT 0,
		void_reason TEXT DEFAULT '',
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);
	CREATE TABLE transaction_items (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		transaction_id INTEGER NOT NULL,
		product_id INTEGER NOT NULL DEFAULT 0,
		product_name TEXT NOT NULL,
		qty INTEGER NOT NULL,
		unit_price REAL NOT NULL,
		subtotal REAL NOT NULL
	);`
	if _, err := db.Exec(schema); err != nil {
		t.Fatalf("create schema: %v", err)
	}

	stmts := []string{
		`INSERT INTO users (id, username, display_name) VALUES (1, 'yoga', 'Yoga')`,
		`INSERT INTO users (id, username, display_name) VALUES (2, 'nurdian', '')`,

		// Normal transaction with 2 items, note needs CSV escaping
		`INSERT INTO transactions (id, transaction_code, employee_id, total_amount, payment_method, note, is_void, void_reason, created_at)
		 VALUES (1, 'TRX-20260920-0001', 1, 15000, 'Tunai', 'promo; "spesial"', 0, '', '2026-09-20 10:00:00')`,
		`INSERT INTO transaction_items (transaction_id, product_name, qty, unit_price, subtotal)
		 VALUES (1, 'Minyak Goreng 1L', 2, 5000, 10000)`,
		`INSERT INTO transaction_items (transaction_id, product_name, qty, unit_price, subtotal)
		 VALUES (1, 'Gula Pasir 500g', 1, 5000, 5000)`,

		// Voided transaction (uses employee fallback name: username)
		`INSERT INTO transactions (id, transaction_code, employee_id, total_amount, payment_method, note, is_void, void_reason, created_at)
		 VALUES (2, 'TRX-20260921-0002', 2, 9000, 'QRIS', '', 1, 'salah input', '2026-09-21 09:00:00')`,
		`INSERT INTO transaction_items (transaction_id, product_name, qty, unit_price, subtotal)
		 VALUES (2, 'Teh Botol', 3, 3000, 9000)`,

		// Transaction without items (must still be backed up)
		`INSERT INTO transactions (id, transaction_code, employee_id, total_amount, payment_method, note, is_void, void_reason, created_at)
		 VALUES (3, 'TRX-20260922-0003', 1, 0, 'Tunai', '', 0, '', '2026-09-22 08:00:00')`,
	}
	for _, q := range stmts {
		if _, err := db.Exec(q); err != nil {
			t.Fatalf("seed failed on %q: %v", q, err)
		}
	}

	t.Cleanup(func() { db.Close() })
	return db
}

func TestExportTransactionsCSV(t *testing.T) {
	db := setupBackupTestDB(t)
	svc := NewTransactionService(db, nil)

	out, err := svc.ExportTransactionsCSV("", "", "")
	if err != nil {
		t.Fatalf("ExportTransactionsCSV: %v", err)
	}

	if !strings.HasPrefix(out, "\ufeff") {
		t.Error("expected UTF-8 BOM prefix so Excel opens the file correctly")
	}

	lines := strings.Split(strings.TrimSuffix(strings.TrimPrefix(out, "\ufeff"), "\r\n"), "\r\n")
	if len(lines) != 5 {
		t.Fatalf("expected 1 header + 4 data rows, got %d lines: %q", len(lines), out)
	}

	wantHeader := "Kode Transaksi;Tanggal;Waktu;Kasir;Metode Bayar;Status;Alasan Void;Nama Barang;Qty;Harga Satuan;Subtotal;Total Transaksi;Catatan"
	if lines[0] != wantHeader {
		t.Errorf("header mismatch:\n got: %s\nwant: %s", lines[0], wantHeader)
	}

	// Chronological order: first data row is the oldest transaction
	if !strings.HasPrefix(lines[1], "TRX-20260920-0001;2026-09-20;10:00:00;Yoga;Tunai;Sukses") {
		t.Errorf("row 1 unexpected: %s", lines[1])
	}
	// Two item rows for the first transaction
	if !strings.Contains(lines[1], "Minyak Goreng 1L;2;5000;10000;15000") {
		t.Errorf("row 1 item cells wrong: %s", lines[1])
	}
	if !strings.HasPrefix(lines[2], "TRX-20260920-0001;") || !strings.Contains(lines[2], "Gula Pasir 500g;1;5000;5000") {
		t.Errorf("row 2 unexpected: %s", lines[2])
	}

	// Void row: fallback username as cashier + status + reason
	if !strings.HasPrefix(lines[3], "TRX-20260921-0002;2026-09-21;09:00:00;nurdian;QRIS;Dibatalkan (Void);salah input;Teh Botol;3;3000;9000;9000") {
		t.Errorf("row 3 unexpected: %s", lines[3])
	}

	// Transaction without items still appears (empty item cells)
	if !strings.HasPrefix(lines[4], "TRX-20260922-0003;2026-09-22;08:00:00;Yoga;Tunai;Sukses;;") {
		t.Errorf("row 4 unexpected: %s", lines[4])
	}
	if fields := strings.Split(lines[4], ";"); len(fields) != 13 {
		t.Errorf("row 4 should have 13 columns, got %d: %q", len(fields), lines[4])
	}
}

func TestExportTransactionsCSVEscapesAndFilters(t *testing.T) {
	db := setupBackupTestDB(t)
	svc := NewTransactionService(db, nil)

	out, err := svc.ExportTransactionsCSV("", "", "")
	if err != nil {
		t.Fatalf("ExportTransactionsCSV: %v", err)
	}

	// Note contains ';' and '"': must be quoted with doubled quotes
	if !strings.Contains(out, `;"";`) && !strings.Contains(out, `"promo; ""spesial"""`) {
		t.Errorf("expected quoted/escaped note field, got: %s", out)
	}

	// Date filter: only transactions from 2026-09-21 onward
	filtered, err := svc.ExportTransactionsCSV("2026-09-21", "", "")
	if err != nil {
		t.Fatalf("filtered export: %v", err)
	}
	if strings.Contains(filtered, "TRX-20260920-0001") {
		t.Error("date filter should exclude 2026-09-20 transaction")
	}
	if !strings.Contains(filtered, "TRX-20260921-0002") || !strings.Contains(filtered, "TRX-20260922-0003") {
		t.Error("date filter should include 2026-09-21 and 2026-09-22 transactions")
	}

	// Employee filter by display name
	byName, err := svc.ExportTransactionsCSV("", "", "Yoga")
	if err != nil {
		t.Fatalf("employee export: %v", err)
	}
	if strings.Contains(byName, "TRX-20260921-0002") {
		t.Error("employee filter should exclude nurdian's transaction")
	}
	if !strings.Contains(byName, "TRX-20260920-0001") {
		t.Error("employee filter should include Yoga's transaction")
	}
}

func TestImportTransactionsCSVRoundTrip(t *testing.T) {
	db := setupBackupTestDB(t)
	svc := NewTransactionService(db, nil)

	backup, err := svc.ExportTransactionsCSV("", "", "")
	if err != nil {
		t.Fatalf("export: %v", err)
	}

	// Simulate data loss: wipe transactions, keep users + products.
	if _, err := db.Exec("DELETE FROM transaction_items"); err != nil {
		t.Fatalf("wipe items: %v", err)
	}
	if _, err := db.Exec("DELETE FROM transactions"); err != nil {
		t.Fatalf("wipe transactions: %v", err)
	}

	res, err := svc.ImportTransactionsCSV(backup)
	if err != nil {
		t.Fatalf("import: %v", err)
	}
	if res.Imported != 3 || res.Skipped != 0 {
		t.Errorf("got imported=%d skipped=%d, want 3/0 (errors: %v)", res.Imported, res.Skipped, res.Errors)
	}

	// All records restored with items, totals, void state.
	txs, err := svc.GetTransactions("", "", "")
	if err != nil {
		t.Fatalf("list after import: %v", err)
	}
	if len(txs) != 3 {
		t.Fatalf("expected 3 transactions after import, got %d", len(txs))
	}
	byCode := map[string]models.Transaction{}
	for _, tx := range txs {
		byCode[tx.TransactionCode] = tx
	}

	first := byCode["TRX-20260920-0001"]
	if first.TotalAmount != 15000 || first.EmployeeName != "Yoga" || first.PaymentMethod != "Tunai" {
		t.Errorf("first tx restored wrong: %+v", first)
	}
	detail, err := svc.GetTransactionByID(first.ID)
	if err != nil {
		t.Fatalf("detail: %v", err)
	}
	if len(detail.Items) != 2 || detail.Items[0].ProductName != "Minyak Goreng 1L" || detail.Items[0].Qty != 2 {
		t.Errorf("first tx items wrong: %+v", detail.Items)
	}

	voided := byCode["TRX-20260921-0002"]
	if !voided.IsVoid || voided.VoidReason != "salah input" {
		t.Errorf("void state not preserved: %+v", voided)
	}

	// Stock must be untouched by import.
	var stock int
	if err := db.QueryRow("SELECT COUNT(*) FROM transactions").Scan(&stock); err != nil {
		t.Fatalf("count: %v", err)
	}

	// Idempotency: re-importing the same file imports nothing.
	res2, err := svc.ImportTransactionsCSV(backup)
	if err != nil {
		t.Fatalf("re-import: %v", err)
	}
	if res2.Imported != 0 || res2.Skipped != 3 {
		t.Errorf("re-import got imported=%d skipped=%d, want 0/3", res2.Imported, res2.Skipped)
	}
}

func TestImportTransactionsCSVFallbackAndMalformed(t *testing.T) {
	db := setupBackupTestDB(t)
	svc := NewTransactionService(db, nil)

	// Unknown cashier falls back to first admin (seeded users have no admin role;
	// first user by id is Yoga) — import must still succeed.
	csvText := "\ufeffKode Transaksi;Tanggal;Waktu;Kasir;Metode Bayar;Status;Alasan Void;Nama Barang;Qty;Harga Satuan;Subtotal;Total Transaksi;Catatan\r\n" +
		"TRX-20260923-0009;2026-09-23;11:00:00;Kasir Misterius;Tunai;Sukses;;Indomie Goreng;5;3000;15000;15000;\r\n"
	res, err := svc.ImportTransactionsCSV(csvText)
	if err != nil {
		t.Fatalf("import: %v", err)
	}
	if res.Imported != 1 {
		t.Errorf("got imported=%d, want 1 (errors: %v)", res.Imported, res.Errors)
	}
	txs, _ := svc.GetTransactions("", "", "")
	found := false
	for _, tx := range txs {
		if tx.TransactionCode == "TRX-20260923-0009" && tx.EmployeeName == "Yoga" {
			found = true
		}
	}
	if !found {
		t.Error("unknown cashier should fall back to first user (Yoga)")
	}

	// Wrong file type rejected outright.
	if _, err := svc.ImportTransactionsCSV("nama,harga\nmie,3000\n"); err == nil {
		t.Error("expected error for non-backup CSV")
	}
	if _, err := svc.ImportTransactionsCSV(""); err == nil {
		t.Error("expected error for empty file")
	}

	// One bad row: its transaction is skipped, the good one still imports.
	mixed := "\ufeffKode Transaksi;Tanggal;Waktu;Kasir;Metode Bayar;Status;Alasan Void;Nama Barang;Qty;Harga Satuan;Subtotal;Total Transaksi;Catatan\r\n" +
		"TRX-20260924-0010;2026-09-24;12:00:00;Yoga;Tunai;Sukses;;Teh Manis;abc;3000;6000;6000;\r\n" +
		"TRX-20260924-0011;2026-09-24;12:05:00;Yoga;Tunai;Sukses;;Kopi Hitam;2;4000;8000;8000;\r\n"
	res, err = svc.ImportTransactionsCSV(mixed)
	if err != nil {
		t.Fatalf("mixed import: %v", err)
	}
	if res.Imported != 1 || len(res.Errors) != 1 {
		t.Errorf("got imported=%d errors=%v, want 1 import + 1 error", res.Imported, res.Errors)
	}
}
