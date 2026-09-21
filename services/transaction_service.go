package services

import (
	"database/sql"
	"errors"
	"fmt"
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

// GetTransactions returns a list of transactions with optional filters.
// startDate and endDate should be in "YYYY-MM-DD" format.
// employeeFilter: username or display name, or "" for all.
func (s *TransactionService) GetTransactions(startDate, endDate, employeeFilter string) ([]models.Transaction, error) {
	query := `SELECT t.id, t.transaction_code, t.employee_id, 
		COALESCE(NULLIF(u.display_name, ''), u.username, 'Karyawan') AS employee_name, 
		t.total_amount, t.payment_method, t.note, t.is_void, t.void_reason, t.created_at
		FROM transactions t
		LEFT JOIN users u ON t.employee_id = u.id
		WHERE 1=1`
	var args []interface{}

	if startDate != "" {
		query += " AND SUBSTR(t.created_at, 1, 10) >= ?"
		args = append(args, startDate)
	}
	if endDate != "" {
		query += " AND SUBSTR(t.created_at, 1, 10) <= ?"
		args = append(args, endDate)
	}
	if employeeFilter != "" {
		query += " AND (u.username = ? OR u.display_name = ?)"
		args = append(args, employeeFilter, employeeFilter)
	}

	query += " ORDER BY t.created_at DESC"

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
