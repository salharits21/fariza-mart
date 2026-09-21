package services

import (
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"

	"farizamart/models"
)

// ProductService handles CRUD operations for products.
// Bound to Wails — methods are callable from the frontend.
type ProductService struct {
	db *sql.DB
}

// NewProductService creates a new ProductService instance.
func NewProductService(db *sql.DB) *ProductService {
	return &ProductService{db: db}
}

// GetProducts returns a filtered list of products.
// search: filters by product name (partial match).
// category: filters by exact category (empty = all).
// status: "active", "inactive", or "" (all).
func (s *ProductService) GetProducts(search, category, status string) ([]models.Product, error) {
	query := `SELECT id, name, category, sell_price, cost_price, stock, unit, is_active, created_at, updated_at
		FROM products WHERE 1=1`
	var args []interface{}

	if search != "" {
		query += " AND name LIKE ?"
		args = append(args, "%"+search+"%")
	}
	if category != "" {
		query += " AND category = ?"
		args = append(args, category)
	}
	switch strings.ToLower(status) {
	case "active":
		query += " AND is_active = 1"
	case "inactive":
		query += " AND is_active = 0"
	}

	query += " ORDER BY name ASC"

	rows, err := s.db.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var products []models.Product
	for rows.Next() {
		var p models.Product
		var createdAt, updatedAt string
		if err := rows.Scan(&p.ID, &p.Name, &p.Category, &p.SellPrice, &p.CostPrice,
			&p.Stock, &p.Unit, &p.IsActive, &createdAt, &updatedAt); err != nil {
			return nil, err
		}
		p.CreatedAt = createdAt
		p.UpdatedAt = updatedAt
		products = append(products, p)
	}
	return products, rows.Err()
}

// GetProductByID returns a single product by its ID.
func (s *ProductService) GetProductByID(id int64) (models.Product, error) {
	var p models.Product
	var createdAt, updatedAt string
	err := s.db.QueryRow(
		`SELECT id, name, category, sell_price, cost_price, stock, unit, is_active, created_at, updated_at
		FROM products WHERE id = ?`, id,
	).Scan(&p.ID, &p.Name, &p.Category, &p.SellPrice, &p.CostPrice,
		&p.Stock, &p.Unit, &p.IsActive, &createdAt, &updatedAt)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return p, fmt.Errorf("produk dengan ID %d tidak ditemukan", id)
		}
		return p, err
	}
	p.CreatedAt = createdAt
	p.UpdatedAt = updatedAt
	return p, nil
}

// CreateProduct inserts a new product into the database.
func (s *ProductService) CreateProduct(p models.Product) (models.Product, error) {
	if p.Name == "" {
		return p, errors.New("nama produk wajib diisi")
	}
	if p.SellPrice <= 0 {
		return p, errors.New("harga jual harus lebih dari 0")
	}
	if p.Stock < 0 {
		return p, errors.New("stok tidak boleh negatif")
	}
	if p.Unit == "" {
		p.Unit = "pcs"
	}

	now := time.Now().Format("2006-01-02 15:04:05")
	result, err := s.db.Exec(
		`INSERT INTO products (name, category, sell_price, cost_price, stock, unit, is_active, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`,
		p.Name, p.Category, p.SellPrice, p.CostPrice, p.Stock, p.Unit, now, now,
	)
	if err != nil {
		return p, fmt.Errorf("gagal menambahkan produk: %w", err)
	}

	p.ID, _ = result.LastInsertId()
	p.IsActive = true
	p.CreatedAt = now
	p.UpdatedAt = now
	return p, nil
}

// UpdateProduct updates an existing product.
func (s *ProductService) UpdateProduct(p models.Product) error {
	if p.ID == 0 {
		return errors.New("ID produk tidak valid")
	}
	if p.Name == "" {
		return errors.New("nama produk wajib diisi")
	}
	if p.SellPrice <= 0 {
		return errors.New("harga jual harus lebih dari 0")
	}
	if p.Stock < 0 {
		return errors.New("stok tidak boleh negatif")
	}
	if p.Unit == "" {
		p.Unit = "pcs"
	}

	now := time.Now().Format("2006-01-02 15:04:05")
	result, err := s.db.Exec(
		`UPDATE products SET name=?, category=?, sell_price=?, cost_price=?, stock=?, unit=?, is_active=?, updated_at=?
		WHERE id=?`,
		p.Name, p.Category, p.SellPrice, p.CostPrice, p.Stock, p.Unit, p.IsActive, now, p.ID,
	)
	if err != nil {
		return fmt.Errorf("gagal mengupdate produk: %w", err)
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		return fmt.Errorf("produk dengan ID %d tidak ditemukan", p.ID)
	}
	return nil
}

// DeleteProduct performs a soft-delete by setting is_active = false.
func (s *ProductService) DeleteProduct(id int64) error {
	now := time.Now().Format("2006-01-02 15:04:05")
	result, err := s.db.Exec(
		"UPDATE products SET is_active = 0, updated_at = ? WHERE id = ?", now, id,
	)
	if err != nil {
		return fmt.Errorf("gagal menghapus produk: %w", err)
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		return fmt.Errorf("produk dengan ID %d tidak ditemukan", id)
	}
	return nil
}

// GetCategories returns a list of unique product categories.
func (s *ProductService) GetCategories() ([]string, error) {
	rows, err := s.db.Query(
		"SELECT DISTINCT category FROM products WHERE category != '' ORDER BY category ASC",
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var categories []string
	for rows.Next() {
		var cat string
		if err := rows.Scan(&cat); err != nil {
			return nil, err
		}
		categories = append(categories, cat)
	}
	return categories, rows.Err()
}
