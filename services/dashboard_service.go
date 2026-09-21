package services

import (
	"database/sql"
	"fmt"
	"time"

	"farizamart/models"
)

// DashboardService provides aggregated data for the dashboard view.
// Bound to Wails — methods are callable from the frontend.
type DashboardService struct {
	db *sql.DB
}

// NewDashboardService creates a new DashboardService instance.
func NewDashboardService(db *sql.DB) *DashboardService {
	return &DashboardService{db: db}
}

// GetDashboardData returns all data needed for the dashboard:
// today's stats, monthly revenue, and top 5 products.
func (s *DashboardService) GetDashboardData() (models.DashboardData, error) {
	var data models.DashboardData
	today := time.Now().Format("2006-01-02")
	now := time.Now()
	monthStart := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location()).Format("2006-01-02")
	monthEnd := time.Date(now.Year(), now.Month()+1, 0, 0, 0, 0, 0, now.Location()).Format("2006-01-02")

	// Today's revenue & transaction count
	err := s.db.QueryRow(`
		SELECT COALESCE(SUM(total_amount), 0), COUNT(*)
		FROM transactions
		WHERE SUBSTR(created_at, 1, 10) = ? AND is_void = 0
	`, today).Scan(&data.TodayRevenue, &data.TodayTransactions)
	if err != nil {
		return data, fmt.Errorf("failed to get today's stats: %w", err)
	}

	// Today's items sold
	err = s.db.QueryRow(`
		SELECT COALESCE(SUM(ti.qty), 0)
		FROM transaction_items ti
		JOIN transactions t ON ti.transaction_id = t.id
		WHERE SUBSTR(t.created_at, 1, 10) = ? AND t.is_void = 0
	`, today).Scan(&data.TodayItemsSold)
	if err != nil {
		return data, fmt.Errorf("failed to get today's items sold: %w", err)
	}

	// Monthly revenue
	err = s.db.QueryRow(`
		SELECT COALESCE(SUM(total_amount), 0)
		FROM transactions
		WHERE SUBSTR(created_at, 1, 10) >= ? AND SUBSTR(created_at, 1, 10) <= ? AND is_void = 0
	`, monthStart, monthEnd).Scan(&data.MonthlyRevenue)
	if err != nil {
		return data, fmt.Errorf("failed to get monthly revenue: %w", err)
	}

	// Monthly daily sales data (for chart)
	monthlyData, err := s.GetMonthlySalesData(now.Year(), int(now.Month()))
	if err != nil {
		return data, err
	}
	data.MonthlyData = monthlyData

	// Top 5 products this month
	topProducts, err := s.getTopProducts(monthStart, monthEnd, 5)
	if err != nil {
		return data, err
	}
	data.TopProducts = topProducts

	return data, nil
}

// GetMonthlySalesData returns daily sales data for a given year/month (for charts).
func (s *DashboardService) GetMonthlySalesData(year, month int) ([]models.DailySales, error) {
	startDate := fmt.Sprintf("%04d-%02d-01", year, month)
	// Last day of the month
	lastDay := time.Date(year, time.Month(month+1), 0, 0, 0, 0, 0, time.UTC)
	endDate := lastDay.Format("2006-01-02")

	rows, err := s.db.Query(`
		SELECT SUBSTR(created_at, 1, 10) as sale_date,
			COALESCE(SUM(total_amount), 0) as revenue,
			COUNT(*) as count
		FROM transactions
		WHERE SUBSTR(created_at, 1, 10) >= ? AND SUBSTR(created_at, 1, 10) <= ? AND is_void = 0
		GROUP BY SUBSTR(created_at, 1, 10)
		ORDER BY sale_date ASC
	`, startDate, endDate)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	// Build a map of existing data
	salesMap := make(map[string]models.DailySales)
	for rows.Next() {
		var ds models.DailySales
		if err := rows.Scan(&ds.Date, &ds.Revenue, &ds.Count); err != nil {
			return nil, err
		}
		salesMap[ds.Date] = ds
	}

	// Fill in all days of the month (including days with no sales)
	var result []models.DailySales
	daysInMonth := lastDay.Day()
	for d := 1; d <= daysInMonth; d++ {
		dateStr := fmt.Sprintf("%04d-%02d-%02d", year, month, d)
		if ds, ok := salesMap[dateStr]; ok {
			result = append(result, ds)
		} else {
			result = append(result, models.DailySales{Date: dateStr, Revenue: 0, Count: 0})
		}
	}

	return result, rows.Err()
}

// getTopProducts returns the top N selling products within a date range.
func (s *DashboardService) getTopProducts(startDate, endDate string, limit int) ([]models.TopProduct, error) {
	rows, err := s.db.Query(`
		SELECT ti.product_id, ti.product_name, SUM(ti.qty) as total_qty, SUM(ti.subtotal) as total_amount
		FROM transaction_items ti
		JOIN transactions t ON ti.transaction_id = t.id
		WHERE SUBSTR(t.created_at, 1, 10) >= ? AND SUBSTR(t.created_at, 1, 10) <= ? AND t.is_void = 0
		GROUP BY ti.product_id, ti.product_name
		ORDER BY total_qty DESC
		LIMIT ?
	`, startDate, endDate, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var products []models.TopProduct
	for rows.Next() {
		var p models.TopProduct
		if err := rows.Scan(&p.ProductID, &p.ProductName, &p.TotalQty, &p.TotalAmount); err != nil {
			return nil, err
		}
		products = append(products, p)
	}
	return products, rows.Err()
}
