package models

import "time"

// ==================== Entity Models ====================

// User represents a user account (admin or employee)
type User struct {
	ID           int64     `json:"id"`
	Username     string    `json:"username"`
	PasswordHash string    `json:"-"` // never expose to frontend
	Role         string    `json:"role"`         // "admin" or "employee"
	DisplayName  string    `json:"display_name"` // human-readable name shown in UI
	CreatedAt    time.Time `json:"created_at"`
}

// UserSession represents the logged-in user's session data sent to the frontend
type UserSession struct {
	ID          int64  `json:"id"`
	Username    string `json:"username"`
	Role        string `json:"role"`
	DisplayName string `json:"display_name"`
}

// Product represents a product in the store inventory
type Product struct {
	ID        int64   `json:"id"`
	Name      string  `json:"name"`
	Category  string  `json:"category"`
	SellPrice float64 `json:"sell_price"`
	CostPrice float64 `json:"cost_price"`
	Stock     int     `json:"stock"`
	Unit      string  `json:"unit"`
	IsActive  bool    `json:"is_active"`
	CreatedAt string  `json:"created_at"`
	UpdatedAt string  `json:"updated_at"`
}

// Transaction represents a sales transaction
type Transaction struct {
	ID              int64             `json:"id"`
	TransactionCode string           `json:"transaction_code"`
	EmployeeID      int64            `json:"employee_id"`
	EmployeeName    string           `json:"employee_name"`
	TotalAmount     float64          `json:"total_amount"`
	PaymentMethod   string           `json:"payment_method"`
	Note            string           `json:"note"`
	IsVoid          bool             `json:"is_void"`
	VoidReason      string           `json:"void_reason"`
	CreatedAt       time.Time        `json:"created_at"`
	Items           []TransactionItem `json:"items,omitempty"`
}

// TransactionItem represents a line item within a transaction
type TransactionItem struct {
	ID            int64   `json:"id"`
	TransactionID int64   `json:"transaction_id"`
	ProductID     int64   `json:"product_id"`
	ProductName   string  `json:"product_name"`
	Qty           int     `json:"qty"`
	UnitPrice     float64 `json:"unit_price"`
	Subtotal      float64 `json:"subtotal"`
}

// StockWithdrawal represents a stock withdrawal record (owner takes product from store)
type StockWithdrawal struct {
	ID              int64  `json:"id"`
	ProductID       int64  `json:"product_id"`
	ProductName     string `json:"product_name"`
	Qty             int    `json:"qty"`
	Reason          string `json:"reason"`
	WithdrawnBy     int64  `json:"withdrawn_by"`
	WithdrawnByName string `json:"withdrawn_by_name"`
	CreatedAt       string `json:"created_at"`
}

// ==================== Request/Response DTOs ====================

// CartItem is used when creating a new transaction
type CartItem struct {
	ProductID int64 `json:"product_id"`
	Qty       int   `json:"qty"`
}

// CreateTransactionRequest is the input for creating a new transaction.
// EmployeeID is no longer provided by the caller — it is taken from the logged-in session.
type CreateTransactionRequest struct {
	PaymentMethod string     `json:"payment_method"`
	Note          string     `json:"note"`
	Items         []CartItem `json:"items"`
}

// CreateStaffRequest is the input for creating a new employee account
type CreateStaffRequest struct {
	Username    string `json:"username"`
	Password    string `json:"password"`
	DisplayName string `json:"display_name"`
}

// UpdateStaffRequest is the input for updating an employee account
type UpdateStaffRequest struct {
	ID          int64  `json:"id"`
	DisplayName string `json:"display_name"`
}

// CreateWithdrawalRequest is the input for creating a stock withdrawal
type CreateWithdrawalRequest struct {
	ProductID int64  `json:"product_id"`
	Qty       int    `json:"qty"`
	Reason    string `json:"reason"`
}

// ==================== Dashboard DTOs ====================

// DashboardData holds all data for the dashboard view
type DashboardData struct {
	TodayRevenue      float64        `json:"today_revenue"`
	TodayTransactions int            `json:"today_transactions"`
	TodayItemsSold    int            `json:"today_items_sold"`
	MonthlyRevenue    float64        `json:"monthly_revenue"`
	MonthlyData       []DailySales   `json:"monthly_data"`
	TopProducts       []TopProduct   `json:"top_products"`
}

// DailySales represents sales data for a single day (used in charts)
type DailySales struct {
	Date    string  `json:"date"`
	Revenue float64 `json:"revenue"`
	Count   int     `json:"count"`
}

// TopProduct represents a top-selling product
type TopProduct struct {
	ProductID   int64   `json:"product_id"`
	ProductName string  `json:"product_name"`
	TotalQty    int     `json:"total_qty"`
	TotalAmount float64 `json:"total_amount"`
}

// ==================== Report DTOs ====================

// DailyReportData holds all data needed to generate the daily PDF report
type DailyReportData struct {
	ReportDate       string                    `json:"report_date"`
	PrintedAt        string                    `json:"printed_at"`
	TotalRevenue     float64                   `json:"total_revenue"`
	TotalTransactions int                      `json:"total_transactions"`
	TotalItemsSold   int                       `json:"total_items_sold"`
	StockReport      []StockReportItem         `json:"stock_report"`
	ByEmployee       []EmployeeTransactions    `json:"by_employee"`
}

// StockReportItem represents a product's stock status in the daily report
type StockReportItem struct {
	ProductName string `json:"product_name"`
	Unit        string `json:"unit"`
	SoldToday   int    `json:"sold_today"`
	CurrentStock int   `json:"current_stock"`
}

// EmployeeTransactions groups transactions by employee for the report
type EmployeeTransactions struct {
	EmployeeName    string        `json:"employee_name"`
	Transactions    []Transaction `json:"transactions"`
	SubtotalAmount  float64       `json:"subtotal_amount"`
	TransactionCount int          `json:"transaction_count"`
	ItemsSold       int           `json:"items_sold"`
}
