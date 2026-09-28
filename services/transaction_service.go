package services

import (
	"database/sql"
	"encoding/csv"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	"farizamart/models"
)

// TransactionService handles creating, listing, and voiding transactions.
// Bound to Wails — methods are callable from the frontend.
type TransactionService struct {
	db   *sql.DB
	auth *AuthService
}

// NewTransactionService creates a new TransactionService instance.
func NewTransactionService(db *sql.DB, auth *AuthService) *TransactionService {
	return &TransactionService{db: db, auth: auth}
}

// generateTransactionCode creates a unique transaction code in format TRX-YYYYMMDD-XXXX.
func (s *TransactionService) generateTransactionCode() (string, error) {
	today := time.Now().Format("20060102")
	prefix := "TRX-" + today + "-"

	var count int
	err := s.db.QueryRow(
		"SELECT COUNT(*) FROM transactions WHERE transaction_code LIKE ?",
		prefix+"%",
	).Scan(&count)
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("%s%04d", prefix, count+1), nil
}

// CreateTransaction creates a new transaction with items.
// Uses the currently logged-in user as the employee handling the transaction.
func (s *TransactionService) CreateTransaction(req models.CreateTransactionRequest) (models.Transaction, error) {
	var result models.Transaction

	currentUser, err := s.auth.GetCurrentUser()
	if err != nil || currentUser == nil {
		return result, errors.New("pengguna belum login")
	}

	if len(req.Items) == 0 {
		return result, errors.New("minimal 1 item harus ditambahkan")
	}
	for _, item := range req.Items {
		if item.Qty <= 0 {
			return result, errors.New("jumlah item harus lebih dari 0")
		}
	}

	employeeID := currentUser.ID
	employeeName := currentUser.DisplayName
	if employeeName == "" {
		employeeName = currentUser.Username
	}

	// Generate transaction code
	txCode, err := s.generateTransactionCode()
	if err != nil {
		return result, fmt.Errorf("gagal membuat kode transaksi: %w", err)
	}

	// Begin DB transaction
	tx, err := s.db.Begin()
	if err != nil {
		return result, err
	}
	defer tx.Rollback()

	now := time.Now().Format("2006-01-02 15:04:05")
	var totalAmount float64
	var items []models.TransactionItem

	// Process each cart item
	for _, cartItem := range req.Items {
		// Get product details and verify stock
		var productName string
		var sellPrice float64
		var stock int
		err := tx.QueryRow(
			"SELECT name, sell_price, stock FROM products WHERE id = ? AND is_active = 1",
			cartItem.ProductID,
		).Scan(&productName, &sellPrice, &stock)
		if err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				return result, fmt.Errorf("produk dengan ID %d tidak ditemukan atau tidak aktif", cartItem.ProductID)
			}
			return result, err
		}

		if stock < cartItem.Qty {
			return result, fmt.Errorf("stok produk '%s' tidak cukup (tersedia: %d, diminta: %d)", productName, stock, cartItem.Qty)
		}

		subtotal := sellPrice * float64(cartItem.Qty)
		totalAmount += subtotal

		items = append(items, models.TransactionItem{
			ProductID:   cartItem.ProductID,
			ProductName: productName,
			Qty:         cartItem.Qty,
			UnitPrice:   sellPrice,
			Subtotal:    subtotal,
		})

		// Decrease stock
		_, err = tx.Exec("UPDATE products SET stock = stock - ?, updated_at = ? WHERE id = ?",
			cartItem.Qty, now, cartItem.ProductID)
		if err != nil {
			return result, fmt.Errorf("gagal mengurangi stok: %w", err)
		}
	}

	// Insert transaction
	res, err := tx.Exec(
		`INSERT INTO transactions (transaction_code, employee_id, total_amount, payment_method, note, created_at)
		VALUES (?, ?, ?, ?, ?, ?)`,
		txCode, employeeID, totalAmount, req.PaymentMethod, req.Note, now,
	)
	if err != nil {
		return result, fmt.Errorf("gagal menyimpan transaksi: %w", err)
	}

	txID, _ := res.LastInsertId()

	// Insert transaction items
	for i, item := range items {
		itemRes, err := tx.Exec(
			`INSERT INTO transaction_items (transaction_id, product_id, product_name, qty, unit_price, subtotal)
			VALUES (?, ?, ?, ?, ?, ?)`,
			txID, item.ProductID, item.ProductName, item.Qty, item.UnitPrice, item.Subtotal,
		)
		if err != nil {
			return result, fmt.Errorf("gagal menyimpan item transaksi: %w", err)
		}
		items[i].ID, _ = itemRes.LastInsertId()
		items[i].TransactionID = txID
	}

	// Commit
	if err := tx.Commit(); err != nil {
		return result, fmt.Errorf("gagal commit transaksi: %w", err)
	}

	// Build result
	result.ID = txID
	result.TransactionCode = txCode
	result.EmployeeID = employeeID
	result.EmployeeName = employeeName
	result.TotalAmount = totalAmount
	result.PaymentMethod = req.PaymentMethod
	result.Note = req.Note
	result.CreatedAt, _ = time.Parse("2006-01-02 15:04:05", now)
	result.Items = items

	return result, nil
}

// buildTransactionFilter returns the WHERE clause and args shared by
// transaction listing/backup queries. Empty filters mean "all".
func buildTransactionFilter(startDate, endDate, employeeFilter string) (string, []interface{}) {
	where := ` WHERE 1=1`
	var args []interface{}

	if startDate != "" {
		where += " AND SUBSTR(t.created_at, 1, 10) >= ?"
		args = append(args, startDate)
	}
	if endDate != "" {
		where += " AND SUBSTR(t.created_at, 1, 10) <= ?"
		args = append(args, endDate)
	}
	if employeeFilter != "" {
		where += " AND (u.username = ? OR u.display_name = ?)"
		args = append(args, employeeFilter, employeeFilter)
	}
	return where, args
}

// GetTransactions returns a list of transactions with optional filters.
// startDate and endDate should be in "YYYY-MM-DD" format.
// employeeFilter: username or display name, or "" for all.
func (s *TransactionService) GetTransactions(startDate, endDate, employeeFilter string) ([]models.Transaction, error) {
	query := `SELECT t.id, t.transaction_code, t.employee_id, 
		COALESCE(NULLIF(u.display_name, ''), u.username, 'Karyawan') AS employee_name, 
		t.total_amount, t.payment_method, t.note, t.is_void, t.void_reason, t.created_at
		FROM transactions t
		LEFT JOIN users u ON t.employee_id = u.id`
	where, args := buildTransactionFilter(startDate, endDate, employeeFilter)
	query += where + " ORDER BY t.created_at DESC"

	rows, err := s.db.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var transactions []models.Transaction
	for rows.Next() {
		var t models.Transaction
		var createdAt string
		if err := rows.Scan(&t.ID, &t.TransactionCode, &t.EmployeeID, &t.EmployeeName,
			&t.TotalAmount, &t.PaymentMethod, &t.Note, &t.IsVoid, &t.VoidReason, &createdAt); err != nil {
			return nil, err
		}
		t.CreatedAt = parseDBTime(createdAt)
		transactions = append(transactions, t)
	}
	return transactions, rows.Err()
}

// GetTransactionByID returns a single transaction with its items.
func (s *TransactionService) GetTransactionByID(id int64) (models.Transaction, error) {
	var t models.Transaction
	var createdAt string

	err := s.db.QueryRow(
		`SELECT t.id, t.transaction_code, t.employee_id, 
		COALESCE(NULLIF(u.display_name, ''), u.username, 'Karyawan') AS employee_name, 
		t.total_amount, t.payment_method, t.note, t.is_void, t.void_reason, t.created_at
		FROM transactions t
		LEFT JOIN users u ON t.employee_id = u.id
		WHERE t.id = ?`, id,
	).Scan(&t.ID, &t.TransactionCode, &t.EmployeeID, &t.EmployeeName,
		&t.TotalAmount, &t.PaymentMethod, &t.Note, &t.IsVoid, &t.VoidReason, &createdAt)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return t, fmt.Errorf("transaksi dengan ID %d tidak ditemukan", id)
		}
		return t, err
	}
	t.CreatedAt = parseDBTime(createdAt)

	// Load items
	rows, err := s.db.Query(
		`SELECT id, transaction_id, product_id, product_name, qty, unit_price, subtotal
		FROM transaction_items WHERE transaction_id = ?`, id,
	)
	if err != nil {
		return t, err
	}
	defer rows.Close()

	for rows.Next() {
		var item models.TransactionItem
		if err := rows.Scan(&item.ID, &item.TransactionID, &item.ProductID,
			&item.ProductName, &item.Qty, &item.UnitPrice, &item.Subtotal); err != nil {
			return t, err
		}
		t.Items = append(t.Items, item)
	}

	return t, rows.Err()
}

// VoidTransaction marks a transaction as void and restores product stock.
func (s *TransactionService) VoidTransaction(id int64, reason string) error {
	if reason == "" {
		return errors.New("alasan pembatalan wajib diisi")
	}

	// Check if transaction exists and is not already void
	var isVoid bool
	err := s.db.QueryRow("SELECT is_void FROM transactions WHERE id = ?", id).Scan(&isVoid)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return fmt.Errorf("transaksi dengan ID %d tidak ditemukan", id)
		}
		return err
	}
	if isVoid {
		return errors.New("transaksi ini sudah dibatalkan sebelumnya")
	}

	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	now := time.Now().Format("2006-01-02 15:04:05")

	// Mark as void
	_, err = tx.Exec(
		"UPDATE transactions SET is_void = 1, void_reason = ? WHERE id = ?",
		reason, id,
	)
	if err != nil {
		return err
	}

	// Restore stock for each item
	rows, err := tx.Query(
		"SELECT product_id, qty FROM transaction_items WHERE transaction_id = ?", id,
	)
	if err != nil {
		return err
	}
	defer rows.Close()

	type stockRestore struct {
		productID int64
		qty       int
	}
	var restores []stockRestore
	for rows.Next() {
		var sr stockRestore
		if err := rows.Scan(&sr.productID, &sr.qty); err != nil {
			return err
		}
		restores = append(restores, sr)
	}
	rows.Close()

	for _, sr := range restores {
		_, err = tx.Exec("UPDATE products SET stock = stock + ?, updated_at = ? WHERE id = ?",
			sr.qty, now, sr.productID)
		if err != nil {
			return err
		}
	}

	return tx.Commit()
}

// csvCell escapes one CSV field for an Excel-friendly file:
// it guards against formula injection and quotes delimiters/quotes/newlines.
func csvCell(s string) string {
	if s == "" {
		return s
	}
	switch s[0] {
	case '=', '+', '-', '@', '\t', '\r':
		s = "'" + s
	}
	if strings.ContainsAny(s, ";\",\n\r") {
		s = `"` + strings.ReplaceAll(s, `"`, `""`) + `"`
	}
	return s
}

// ExportTransactionsCSV exports transactions (one row per item line) as
// CSV text for backup. Filters match GetTransactions; empty means all.
// The file is ';' separated with a UTF-8 BOM so Microsoft Excel (id-ID
// locale) opens it correctly. Numbers are written raw so Excel can sum them.
func (s *TransactionService) ExportTransactionsCSV(startDate, endDate, employeeFilter string) (string, error) {
	query := `SELECT t.id, t.transaction_code, t.employee_id,
		COALESCE(NULLIF(u.display_name, ''), u.username, 'Karyawan') AS employee_name,
		t.total_amount, t.payment_method, t.note, t.is_void, t.void_reason, t.created_at
		FROM transactions t
		LEFT JOIN users u ON t.employee_id = u.id`
	where, args := buildTransactionFilter(startDate, endDate, employeeFilter)
	query += where + " ORDER BY t.created_at ASC, t.id ASC"

	rows, err := s.db.Query(query, args...)
	if err != nil {
		return "", err
	}

	type txEntry struct {
		tx        models.Transaction
		createdAt time.Time
	}
	var list []txEntry
	for rows.Next() {
		var t models.Transaction
		var createdAt string
		if err := rows.Scan(&t.ID, &t.TransactionCode, &t.EmployeeID, &t.EmployeeName,
			&t.TotalAmount, &t.PaymentMethod, &t.Note, &t.IsVoid, &t.VoidReason, &createdAt); err != nil {
			rows.Close()
			return "", err
		}
		list = append(list, txEntry{tx: t, createdAt: parseDBTime(createdAt)})
	}
	if err := rows.Err(); err != nil {
		rows.Close()
		return "", err
	}
	rows.Close()

	itemStmt, err := s.db.Prepare(
		`SELECT product_name, qty, unit_price, subtotal
		FROM transaction_items WHERE transaction_id = ? ORDER BY id ASC`)
	if err != nil {
		return "", err
	}
	defer itemStmt.Close()

	var sb strings.Builder
	// UTF-8 BOM so Excel does not mangle Indonesian text
	sb.WriteString("\ufeff")
	sb.WriteString("Kode Transaksi;Tanggal;Waktu;Kasir;Metode Bayar;Status;Alasan Void;Nama Barang;Qty;Harga Satuan;Subtotal;Total Transaksi;Catatan\r\n")

	num := func(v float64) string {
		return strconv.FormatFloat(v, 'f', -1, 64)
	}

	for _, entry := range list {
		t := entry.tx
		status := "Sukses"
		if t.IsVoid {
			status = "Dibatalkan (Void)"
		}

		// Transaction-level cells, repeated on every item row of this tx
		base := []string{
			t.TransactionCode,
			entry.createdAt.Format("2006-01-02"),
			entry.createdAt.Format("15:04:05"),
			t.EmployeeName,
			t.PaymentMethod,
			status,
			t.VoidReason,
		}
		tail := []string{num(t.TotalAmount), t.Note}

		itemRows, err := itemStmt.Query(t.ID)
		if err != nil {
			return "", err
		}

		wroteItem := false
		for itemRows.Next() {
			var productName string
			var qty int
			var unitPrice, subtotal float64
			if err := itemRows.Scan(&productName, &qty, &unitPrice, &subtotal); err != nil {
				itemRows.Close()
				return "", err
			}
			cells := append(append(append([]string{}, base...),
				productName,
				strconv.Itoa(qty),
				num(unitPrice),
				num(subtotal),
			), tail...)
			writeCSVRow(&sb, cells)
			wroteItem = true
		}
		if err := itemRows.Err(); err != nil {
			itemRows.Close()
			return "", err
		}
		itemRows.Close()

		// Defensive: never drop a transaction, even without items
		if !wroteItem {
			cells := append(append(append([]string{}, base...), "", "", "", ""), tail...)
			writeCSVRow(&sb, cells)
		}
	}

	return sb.String(), nil
}

// writeCSVRow writes one ';' separated CSV line terminated with CRLF.
func writeCSVRow(sb *strings.Builder, cells []string) {
	for i, c := range cells {
		if i > 0 {
			sb.WriteByte(';')
		}
		sb.WriteString(csvCell(c))
	}
	sb.WriteString("\r\n")
}

// importTxGroup is one transaction reconstructed from CSV rows.
type importTxGroup struct {
	code         string
	date         string
	time         string
	employeeName string
	payment      string
	isVoid       bool
	voidReason   string
	total        float64
	note         string
	items        []models.TransactionItem
}

// parseImportNumber parses numbers written by ExportTransactionsCSV (plain,
// no separators) and tolerates id-ID thousand separators ("15.000")
// and surrounding whitespace. Our export never writes decimals.
func parseImportNumber(s string) (float64, error) {
	clean := strings.ReplaceAll(strings.TrimSpace(s), ".", "")
	clean = strings.ReplaceAll(clean, ",", "")
	if clean == "" {
		return 0, errors.New("angka kosong")
	}
	return strconv.ParseFloat(clean, 64)
}

// ImportTransactionsCSV restores transactions from a CSV backup file created
// by ExportTransactionsCSV. The frontend reads the file as text and passes
// its content here.
//
// Safety rules (by design):
//   - Existing transaction codes are SKIPPED (import is idempotent —
//     re-importing the same file never duplicates data).
//   - Stock is NOT touched: import restores historical records only,
//     current stock stays as-is.
//   - Only admins may import (checked when a session exists).
//   - Cashier names are matched to users by display name/username;
//     unknown names fall back to the importing admin.
func (s *TransactionService) ImportTransactionsCSV(csvText string) (models.ImportTransactionsResult, error) {
	var result models.ImportTransactionsResult

	if s.auth != nil {
		if user, err := s.auth.GetCurrentUser(); err == nil && user != nil && user.Role != "admin" {
			return result, errors.New("hanya admin yang dapat mengimpor transaksi")
		}
	}

	text := strings.TrimPrefix(csvText, "\ufeff")
	if strings.TrimSpace(text) == "" {
		return result, errors.New("file backup kosong")
	}

	r := csv.NewReader(strings.NewReader(text))
	r.Comma = ';'
	r.FieldsPerRecord = -1
	r.TrimLeadingSpace = true
	records, err := r.ReadAll()
	if err != nil {
		return result, fmt.Errorf("gagal membaca file CSV: %w", err)
	}
	if len(records) < 1 || len(records[0]) < 1 || strings.TrimSpace(records[0][0]) != "Kode Transaksi" {
		return result, errors.New("format file tidak dikenali (bukan backup transaksi Fariza Mart)")
	}

	// Group item rows by transaction code, preserving file order.
	var order []string
	groups := make(map[string]*importTxGroup)
	droppedErrors := 0
	addError := func(format string, args ...interface{}) {
		if len(result.Errors) < 20 {
			result.Errors = append(result.Errors, fmt.Sprintf(format, args...))
		} else {
			droppedErrors++
		}
	}

	for i, rec := range records[1:] {
		lineNo := i + 2 // 1-based incl. header
		blank := true
		for _, f := range rec {
			if strings.TrimSpace(f) != "" {
				blank = false
				break
			}
		}
		if blank {
			continue
		}
		if len(rec) != 13 {
			addError("baris %d: jumlah kolom harus 13, ditemukan %d — dilewati", lineNo, len(rec))
			continue
		}
		for j := range rec {
			rec[j] = strings.TrimSpace(rec[j])
		}
		code := rec[0]
		if code == "" {
			addError("baris %d: kode transaksi kosong — dilewati", lineNo)
			continue
		}

		qty := 0
		unitPrice := 0.0
		subtotal := 0.0
		// Rows with an empty product name carry only transaction-level data
		// (e.g. a transaction without items) — no item numbers to parse.
		if rec[7] != "" {
			var err error
			if qty, err = strconv.Atoi(strings.ReplaceAll(rec[8], ".", "")); err != nil || qty < 0 {
				addError("baris %d (%s): qty tidak valid %q — dilewati", lineNo, code, rec[8])
				continue
			}
			if unitPrice, err = parseImportNumber(rec[9]); err != nil || unitPrice < 0 {
				addError("baris %d (%s): harga satuan tidak valid %q — dilewati", lineNo, code, rec[9])
				continue
			}
			if subtotal, err = parseImportNumber(rec[10]); err != nil || subtotal < 0 {
				addError("baris %d (%s): subtotal tidak valid %q — dilewati", lineNo, code, rec[10])
				continue
			}
		}

		g, ok := groups[code]
		if !ok {
			if _, err := time.Parse("2006-01-02", rec[1]); err != nil {
				addError("baris %d (%s): tanggal tidak valid %q — dilewati", lineNo, code, rec[1])
				continue
			}
			if _, err := time.Parse("15:04:05", rec[2]); err != nil {
				addError("baris %d (%s): waktu tidak valid %q — dilewati", lineNo, code, rec[2])
				continue
			}
			total, err := parseImportNumber(rec[11])
			if err != nil || total < 0 {
				addError("baris %d (%s): total tidak valid %q — dilewati", lineNo, code, rec[11])
				continue
			}
			g = &importTxGroup{
				code:         code,
				date:         rec[1],
				time:         rec[2],
				employeeName: rec[3],
				payment:      rec[4],
				isVoid:       strings.HasPrefix(rec[5], "Dibatalkan"),
				voidReason:   rec[6],
				total:        total,
				note:         rec[12],
			}
			groups[code] = g
			order = append(order, code)
		}

		// Item cells may be empty (transaction without items) — skip those.
		if rec[7] == "" {
			continue
		}
		g.items = append(g.items, models.TransactionItem{
			ProductName: rec[7],
			Qty:         qty,
			UnitPrice:   unitPrice,
			Subtotal:    subtotal,
		})
	}

	for _, code := range order {
		g := groups[code]

		var exists int
		if err := s.db.QueryRow(
			"SELECT COUNT(*) FROM transactions WHERE transaction_code = ?", code,
		).Scan(&exists); err != nil {
			addError("%s: gagal memeriksa duplikat: %v — dilewati", code, err)
			continue
		}
		if exists > 0 {
			result.Skipped++
			continue
		}

		employeeID, err := s.resolveImportEmployee(g.employeeName)
		if err != nil {
			addError("%s: %v — dilewati", code, err)
			continue
		}

		createdAt := g.date + " " + g.time
		isVoid := 0
		if g.isVoid {
			isVoid = 1
		}

		dbTx, err := s.db.Begin()
		if err != nil {
			addError("%s: gagal memulai penyimpanan: %v — dilewati", code, err)
			continue
		}

		res, err := dbTx.Exec(
			`INSERT INTO transactions (transaction_code, employee_id, total_amount, payment_method, note, is_void, void_reason, created_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
			code, employeeID, g.total, g.payment, g.note, isVoid, g.voidReason, createdAt,
		)
		if err != nil {
			dbTx.Rollback()
			addError("%s: gagal menyimpan: %v — dilewati", code, err)
			continue
		}
		txID, _ := res.LastInsertId()

		failed := false
		for _, item := range g.items {
			if _, err := dbTx.Exec(
				`INSERT INTO transaction_items (transaction_id, product_id, product_name, qty, unit_price, subtotal)
				VALUES (?, 0, ?, ?, ?, ?)`,
				txID, item.ProductName, item.Qty, item.UnitPrice, item.Subtotal,
			); err != nil {
				addError("%s: gagal menyimpan item %q: %v — dilewati", code, item.ProductName, err)
				failed = true
				break
			}
		}
		if failed {
			dbTx.Rollback()
			continue
		}
		if err := dbTx.Commit(); err != nil {
			addError("%s: gagal commit: %v — dilewati", code, err)
			continue
		}
		result.Imported++
	}

	if droppedErrors > 0 {
		result.Errors = append(result.Errors,
			fmt.Sprintf("…dan %d error lainnya (ditampilkan 20 pertama)", droppedErrors))
	}

	return result, nil
}

// resolveImportEmployee maps a cashier name from the backup file to a user
// id: display name → username → current session user → first admin →
// first user. Import never creates accounts.
func (s *TransactionService) resolveImportEmployee(name string) (int64, error) {
	if name != "" {
		var id int64
		err := s.db.QueryRow(
			`SELECT id FROM users WHERE display_name = ? OR username = ?
			ORDER BY CASE WHEN display_name = ? THEN 0 ELSE 1 END LIMIT 1`,
			name, name, name,
		).Scan(&id)
		if err == nil {
			return id, nil
		}
		if !errors.Is(err, sql.ErrNoRows) {
			return 0, fmt.Errorf("gagal mencari kasir %q: %w", name, err)
		}
	}

	if s.auth != nil {
		if user, err := s.auth.GetCurrentUser(); err == nil && user != nil {
			return user.ID, nil
		}
	}

	var id int64
	err := s.db.QueryRow(
		`SELECT id FROM users ORDER BY CASE WHEN role = 'admin' THEN 0 ELSE 1 END, id ASC LIMIT 1`,
	).Scan(&id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return 0, fmt.Errorf("kasir %q tidak ditemukan dan belum ada akun pengguna", name)
		}
		return 0, fmt.Errorf("gagal mencari pengguna fallback: %w", err)
	}
	return id, nil
}
