package services

import (
	"database/sql"
	"errors"
	"fmt"
	"time"

	"farizamart/models"
)

// StockWithdrawalService handles stock withdrawals when owner/staff takes items from store.
// Bound to Wails — methods are callable from the frontend.
type StockWithdrawalService struct {
	db   *sql.DB
	auth *AuthService
}

// NewStockWithdrawalService creates a new StockWithdrawalService instance.
func NewStockWithdrawalService(db *sql.DB, auth *AuthService) *StockWithdrawalService {
	return &StockWithdrawalService{db: db, auth: auth}
}

// CreateWithdrawal records a new stock withdrawal and decreases product inventory.
func (s *StockWithdrawalService) CreateWithdrawal(req models.CreateWithdrawalRequest) (*models.StockWithdrawal, error) {
	currentUser, err := s.auth.GetCurrentUser()
	if err != nil || currentUser == nil {
		return nil, errors.New("pengguna belum login")
	}

	if req.ProductID <= 0 {
		return nil, errors.New("produk wajib dipilih")
	}
	if req.Qty <= 0 {
		return nil, errors.New("jumlah pengambilan harus lebih dari 0")
	}

	tx, err := s.db.Begin()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	// Check product and stock
	var productName string
	var currentStock int
	err = tx.QueryRow("SELECT name, stock FROM products WHERE id = ? AND is_active = 1", req.ProductID).
		Scan(&productName, &currentStock)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errors.New("produk tidak ditemukan atau tidak aktif")
		}
		return nil, err
	}

	if currentStock < req.Qty {
		return nil, fmt.Errorf("stok produk '%s' tidak cukup (tersedia: %d, diambil: %d)", productName, currentStock, req.Qty)
	}

	now := time.Now().Format("2006-01-02 15:04:05")

	// Deduct stock
	_, err = tx.Exec("UPDATE products SET stock = stock - ?, updated_at = ? WHERE id = ?", req.Qty, now, req.ProductID)
	if err != nil {
		return nil, fmt.Errorf("gagal memperbarui stok: %w", err)
	}

	// Insert withdrawal record
	res, err := tx.Exec(`
		INSERT INTO stock_withdrawals (product_id, product_name, qty, reason, withdrawn_by, created_at)
		VALUES (?, ?, ?, ?, ?, ?)
	`, req.ProductID, productName, req.Qty, req.Reason, currentUser.ID, now)
	if err != nil {
		return nil, fmt.Errorf("gagal mencatat pengambilan stok: %w", err)
	}

	id, err := res.LastInsertId()
	if err != nil {
		return nil, err
	}

	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("gagal commit transaksi: %w", err)
	}

	withdrawnByName := currentUser.DisplayName
	if withdrawnByName == "" {
		withdrawnByName = currentUser.Username
	}

	return &models.StockWithdrawal{
		ID:              id,
		ProductID:       req.ProductID,
		ProductName:     productName,
		Qty:             req.Qty,
		Reason:          req.Reason,
		WithdrawnBy:     currentUser.ID,
		WithdrawnByName: withdrawnByName,
		CreatedAt:       now,
	}, nil
}

// GetWithdrawals returns history of stock withdrawals with optional date filtering.
func (s *StockWithdrawalService) GetWithdrawals(startDate, endDate string) ([]models.StockWithdrawal, error) {
	query := `
		SELECT w.id, w.product_id, w.product_name, w.qty, w.reason, w.withdrawn_by,
		       COALESCE(NULLIF(u.display_name, ''), u.username, 'Pengguna') AS withdrawn_by_name,
		       w.created_at
		FROM stock_withdrawals w
		LEFT JOIN users u ON w.withdrawn_by = u.id
		WHERE 1=1
	`
	var args []interface{}

	if startDate != "" {
		query += " AND SUBSTR(w.created_at, 1, 10) >= ?"
		args = append(args, startDate)
	}
	if endDate != "" {
		query += " AND SUBSTR(w.created_at, 1, 10) <= ?"
		args = append(args, endDate)
	}

	query += " ORDER BY w.created_at DESC"

	rows, err := s.db.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var withdrawals []models.StockWithdrawal
	for rows.Next() {
		var w models.StockWithdrawal
		if err := rows.Scan(&w.ID, &w.ProductID, &w.ProductName, &w.Qty, &w.Reason, &w.WithdrawnBy, &w.WithdrawnByName, &w.CreatedAt); err != nil {
			return nil, err
		}
		withdrawals = append(withdrawals, w)
	}

	return withdrawals, rows.Err()
}
