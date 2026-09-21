package services

import (
	"bytes"
	"database/sql"
	"fmt"
	"time"

	"farizamart/models"

	"github.com/go-pdf/fpdf"
)

// ReportService generates daily PDF reports.
// Bound to Wails — methods are callable from the frontend.
type ReportService struct {
	db *sql.DB
}

// NewReportService creates a new ReportService instance.
func NewReportService(db *sql.DB) *ReportService {
	return &ReportService{db: db}
}

// parseDBTime parses timestamps from SQLite which can be in RFC3339 or standard SQL format.
func parseDBTime(s string) time.Time {
	formats := []string{
		time.RFC3339,
		"2006-01-02T15:04:05",
		"2006-01-02 15:04:05",
		"2006-01-02",
	}
	for _, f := range formats {
		if t, err := time.Parse(f, s); err == nil {
			return t
		}
	}
	return time.Now()
}

// GetDailyReportData gathers all data needed for the daily report.
// Bound to Wails — callable from frontend to display on-screen report.
func (s *ReportService) GetDailyReportData(date string) (models.DailyReportData, error) {
	var data models.DailyReportData
	data.ReportDate = date
	data.PrintedAt = time.Now().Format("02/01/2006 15:04:05")

	// Summary: total revenue, transaction count, items sold
	err := s.db.QueryRow(`
		SELECT COALESCE(SUM(total_amount), 0), COUNT(*)
		FROM transactions
		WHERE SUBSTR(created_at, 1, 10) = ? AND is_void = 0
	`, date).Scan(&data.TotalRevenue, &data.TotalTransactions)
	if err != nil {
		return data, err
	}

	err = s.db.QueryRow(`
		SELECT COALESCE(SUM(ti.qty), 0)
		FROM transaction_items ti
		JOIN transactions t ON ti.transaction_id = t.id
		WHERE SUBSTR(t.created_at, 1, 10) = ? AND t.is_void = 0
	`, date).Scan(&data.TotalItemsSold)
	if err != nil {
		return data, err
	}

	// Stock report: all active products with qty sold today
	rows, err := s.db.Query(`
		SELECT p.name, p.unit, 
			COALESCE((
				SELECT SUM(ti.qty)
				FROM transaction_items ti
				JOIN transactions t ON ti.transaction_id = t.id
				WHERE ti.product_id = p.id AND SUBSTR(t.created_at, 1, 10) = ? AND t.is_void = 0
			), 0) as sold_today,
			p.stock
		FROM products p
		WHERE p.is_active = 1
		ORDER BY p.name ASC
	`, date)
	if err != nil {
		return data, err
	}
	defer rows.Close()

	for rows.Next() {
		var item models.StockReportItem
		if err := rows.Scan(&item.ProductName, &item.Unit, &item.SoldToday, &item.CurrentStock); err != nil {
			return data, err
		}
		data.StockReport = append(data.StockReport, item)
	}

	// Transactions by user / employee
	empRows, err := s.db.Query(`
		SELECT id, COALESCE(NULLIF(display_name, ''), username, 'Karyawan') as name 
		FROM users 
		ORDER BY role ASC, id ASC
	`)
	if err != nil {
		return data, err
	}
	defer empRows.Close()

	type empInfo struct {
		id   int64
		name string
	}
	var employees []empInfo
	for empRows.Next() {
		var e empInfo
		if err := empRows.Scan(&e.id, &e.name); err != nil {
			return data, err
		}
		employees = append(employees, e)
	}

	for _, emp := range employees {
		et := models.EmployeeTransactions{
			EmployeeName: emp.name,
		}

		txRows, err := s.db.Query(`
			SELECT t.id, t.transaction_code, t.employee_id, ?, t.total_amount,
				t.payment_method, t.note, t.is_void, t.void_reason, t.created_at
			FROM transactions t
			WHERE t.employee_id = ? AND SUBSTR(t.created_at, 1, 10) = ? AND t.is_void = 0
			ORDER BY t.created_at ASC
		`, emp.name, emp.id, date)
		if err != nil {
			return data, err
		}

		for txRows.Next() {
			var t models.Transaction
			var createdAt string
			if err := txRows.Scan(&t.ID, &t.TransactionCode, &t.EmployeeID, &t.EmployeeName,
				&t.TotalAmount, &t.PaymentMethod, &t.Note, &t.IsVoid, &t.VoidReason, &createdAt); err != nil {
				txRows.Close()
				return data, err
			}
			t.CreatedAt = parseDBTime(createdAt)

			// Load items
			itemRows, err := s.db.Query(`
				SELECT id, transaction_id, product_id, product_name, qty, unit_price, subtotal
				FROM transaction_items WHERE transaction_id = ?
			`, t.ID)
			if err != nil {
				txRows.Close()
				return data, err
			}
			for itemRows.Next() {
				var item models.TransactionItem
				if err := itemRows.Scan(&item.ID, &item.TransactionID, &item.ProductID,
					&item.ProductName, &item.Qty, &item.UnitPrice, &item.Subtotal); err != nil {
					itemRows.Close()
					txRows.Close()
					return data, err
				}
				t.Items = append(t.Items, item)
				et.ItemsSold += item.Qty
			}
			itemRows.Close()

			et.Transactions = append(et.Transactions, t)
			et.SubtotalAmount += t.TotalAmount
			et.TransactionCount++
		}
		txRows.Close()

		data.ByEmployee = append(data.ByEmployee, et)
	}

	return data, nil
}

// GenerateDailyReport generates a daily PDF report and returns it as bytes.
// date should be in "YYYY-MM-DD" format.
func (s *ReportService) GenerateDailyReport(date string) ([]byte, error) {
	data, err := s.GetDailyReportData(date)
	if err != nil {
		return nil, fmt.Errorf("gagal mengambil data laporan: %w", err)
	}

	pdf := fpdf.New("P", "mm", "A4", "")
	pdf.SetAutoPageBreak(true, 15)

	// ==================== Page 1: Header + Summary + Stock Report ====================
	pdf.AddPage()

	// Header
	pdf.SetFont("Arial", "B", 18)
	pdf.CellFormat(0, 10, "Fariza Mart", "", 1, "C", false, 0, "")
	pdf.SetFont("Arial", "", 10)
	pdf.CellFormat(0, 6, "Laporan Harian", "", 1, "C", false, 0, "")
	pdf.Ln(4)

	// Report date & print time
	pdf.SetFont("Arial", "", 9)
	parsedDate, _ := time.Parse("2006-01-02", date)
	pdf.CellFormat(0, 5, fmt.Sprintf("Tanggal: %s", parsedDate.Format("02 Januari 2006")), "", 1, "L", false, 0, "")
	pdf.CellFormat(0, 5, fmt.Sprintf("Dicetak: %s", data.PrintedAt), "", 1, "L", false, 0, "")
	pdf.Ln(4)

	// Separator line
	pdf.SetDrawColor(41, 98, 235) // Blue
	pdf.SetLineWidth(0.5)
	pdf.Line(10, pdf.GetY(), 200, pdf.GetY())
	pdf.Ln(6)

	// ==================== Summary Cards ====================
	pdf.SetFont("Arial", "B", 12)
	pdf.CellFormat(0, 8, "Ringkasan", "", 1, "L", false, 0, "")
	pdf.Ln(2)

	pdf.SetFont("Arial", "", 10)
	colW := 60.0
	pdf.CellFormat(colW, 6, fmt.Sprintf("Total Omzet: Rp %s", formatCurrency(data.TotalRevenue)), "", 0, "L", false, 0, "")
	pdf.CellFormat(colW, 6, fmt.Sprintf("Jumlah Transaksi: %d", data.TotalTransactions), "", 0, "L", false, 0, "")
	pdf.CellFormat(colW, 6, fmt.Sprintf("Item Terjual: %d", data.TotalItemsSold), "", 1, "L", false, 0, "")
	pdf.Ln(6)

	// ==================== Stock Report Table ====================
	pdf.SetFont("Arial", "B", 12)
	pdf.CellFormat(0, 8, "Laporan Stok", "", 1, "L", false, 0, "")
	pdf.Ln(2)

	// Table header
	pdf.SetFont("Arial", "B", 9)
	pdf.SetFillColor(41, 98, 235) // Blue
	pdf.SetTextColor(255, 255, 255)
	pdf.CellFormat(10, 7, "No", "1", 0, "C", true, 0, "")
	pdf.CellFormat(70, 7, "Nama Produk", "1", 0, "L", true, 0, "")
	pdf.CellFormat(25, 7, "Satuan", "1", 0, "C", true, 0, "")
	pdf.CellFormat(35, 7, "Terjual Hari Ini", "1", 0, "C", true, 0, "")
	pdf.CellFormat(35, 7, "Stok Saat Ini", "1", 0, "C", true, 0, "")
	pdf.Ln(-1)

	// Table body
	pdf.SetFont("Arial", "", 9)
	pdf.SetTextColor(0, 0, 0)
	for i, item := range data.StockReport {
		if pdf.GetY() > 265 {
			pdf.AddPage()
		}
		fillColor := i%2 == 0
		if fillColor {
			pdf.SetFillColor(240, 245, 255) // Light blue
		}
		pdf.CellFormat(10, 6, fmt.Sprintf("%d", i+1), "1", 0, "C", fillColor, 0, "")
		pdf.CellFormat(70, 6, item.ProductName, "1", 0, "L", fillColor, 0, "")
		pdf.CellFormat(25, 6, item.Unit, "1", 0, "C", fillColor, 0, "")
		pdf.CellFormat(35, 6, fmt.Sprintf("%d", item.SoldToday), "1", 0, "C", fillColor, 0, "")
		pdf.CellFormat(35, 6, fmt.Sprintf("%d", item.CurrentStock), "1", 0, "C", fillColor, 0, "")
		pdf.Ln(-1)
	}

	if len(data.StockReport) == 0 {
		pdf.SetFont("Arial", "I", 9)
		pdf.CellFormat(175, 6, "Tidak ada data produk", "1", 1, "C", false, 0, "")
	}

	// ==================== Transactions by Employee ====================
	for _, empData := range data.ByEmployee {
		pdf.Ln(8)
		if pdf.GetY() > 240 {
			pdf.AddPage()
		}

		// Employee section header
		pdf.SetFont("Arial", "B", 12)
		pdf.SetTextColor(41, 98, 235)
		pdf.CellFormat(0, 8, fmt.Sprintf("Transaksi - %s", empData.EmployeeName), "", 1, "L", false, 0, "")
		pdf.SetTextColor(0, 0, 0)

		pdf.SetFont("Arial", "", 9)
		pdf.CellFormat(0, 5, fmt.Sprintf("Jumlah Transaksi: %d  |  Total Omzet: Rp %s  |  Item Terjual: %d",
			empData.TransactionCount, formatCurrency(empData.SubtotalAmount), empData.ItemsSold), "", 1, "L", false, 0, "")
		pdf.Ln(3)

		if len(empData.Transactions) == 0 {
			pdf.SetFont("Arial", "I", 9)
			pdf.CellFormat(0, 5, "Tidak ada transaksi", "", 1, "L", false, 0, "")
			continue
		}

		for _, tx := range empData.Transactions {
			if pdf.GetY() > 250 {
				pdf.AddPage()
			}

			// Transaction header
			pdf.SetFont("Arial", "B", 9)
			pdf.SetFillColor(230, 235, 245)
			pdf.CellFormat(0, 6, fmt.Sprintf("%s  |  %s  |  %s  |  Rp %s",
				tx.TransactionCode,
				tx.CreatedAt.Format("15:04:05"),
				tx.PaymentMethod,
				formatCurrency(tx.TotalAmount),
			), "1", 1, "L", true, 0, "")

			// Transaction items
			pdf.SetFont("Arial", "", 8)
			for _, item := range tx.Items {
				if pdf.GetY() > 270 {
					pdf.AddPage()
				}
				pdf.CellFormat(10, 5, "", "", 0, "L", false, 0, "")
				pdf.CellFormat(70, 5, item.ProductName, "", 0, "L", false, 0, "")
				pdf.CellFormat(30, 5, fmt.Sprintf("%d x Rp %s", item.Qty, formatCurrency(item.UnitPrice)), "", 0, "L", false, 0, "")
				pdf.CellFormat(40, 5, fmt.Sprintf("= Rp %s", formatCurrency(item.Subtotal)), "", 1, "R", false, 0, "")
			}
			pdf.Ln(2)
		}
	}

	// ==================== Footer: Grand Total ====================
	pdf.Ln(6)
	if pdf.GetY() > 260 {
		pdf.AddPage()
	}

	pdf.SetDrawColor(41, 98, 235)
	pdf.SetLineWidth(0.5)
	pdf.Line(10, pdf.GetY(), 200, pdf.GetY())
	pdf.Ln(4)

	pdf.SetFont("Arial", "B", 11)
	pdf.CellFormat(0, 7, fmt.Sprintf("TOTAL KESELURUHAN: Rp %s", formatCurrency(data.TotalRevenue)), "", 1, "R", false, 0, "")
	pdf.SetFont("Arial", "", 9)
	pdf.CellFormat(0, 5, fmt.Sprintf("Total Transaksi: %d  |  Total Item Terjual: %d",
		data.TotalTransactions, data.TotalItemsSold), "", 1, "R", false, 0, "")

	// Output to bytes
	var buf bytes.Buffer
	if err := pdf.Output(&buf); err != nil {
		return nil, fmt.Errorf("gagal menghasilkan PDF: %w", err)
	}

	return buf.Bytes(), nil
}

// SaveDailyReport generates the daily report PDF and saves it to the given file path.
// The frontend should use Wails' native save dialog to get filePath from the user.
func (s *ReportService) SaveDailyReport(date, filePath string) error {
	data, err := s.GetDailyReportData(date)
	if err != nil {
		return fmt.Errorf("gagal mengambil data laporan: %w", err)
	}

	pdf := s.buildPDF(data, date)

	if err := pdf.OutputFileAndClose(filePath); err != nil {
		return fmt.Errorf("gagal menyimpan PDF: %w", err)
	}

	return nil
}

// buildPDF creates the PDF document (reusable for both GenerateDailyReport and SaveDailyReport).
func (s *ReportService) buildPDF(data models.DailyReportData, date string) *fpdf.Fpdf {
	pdf := fpdf.New("P", "mm", "A4", "")
	pdf.SetAutoPageBreak(true, 15)
	pdf.AddPage()

	// Header
	pdf.SetFont("Arial", "B", 18)
	pdf.CellFormat(0, 10, "Fariza Mart", "", 1, "C", false, 0, "")
	pdf.SetFont("Arial", "", 10)
	pdf.CellFormat(0, 6, "Laporan Harian", "", 1, "C", false, 0, "")
	pdf.Ln(4)

	parsedDate, _ := time.Parse("2006-01-02", date)
	pdf.SetFont("Arial", "", 9)
	pdf.CellFormat(0, 5, fmt.Sprintf("Tanggal: %s", parsedDate.Format("02 Januari 2006")), "", 1, "L", false, 0, "")
	pdf.CellFormat(0, 5, fmt.Sprintf("Dicetak: %s", data.PrintedAt), "", 1, "L", false, 0, "")
	pdf.Ln(4)

	pdf.SetDrawColor(41, 98, 235)
	pdf.SetLineWidth(0.5)
	pdf.Line(10, pdf.GetY(), 200, pdf.GetY())
	pdf.Ln(6)

	// Summary
	pdf.SetFont("Arial", "B", 12)
	pdf.CellFormat(0, 8, "Ringkasan", "", 1, "L", false, 0, "")
	pdf.Ln(2)

	pdf.SetFont("Arial", "", 10)
	colW := 60.0
	pdf.CellFormat(colW, 6, fmt.Sprintf("Total Omzet: Rp %s", formatCurrency(data.TotalRevenue)), "", 0, "L", false, 0, "")
	pdf.CellFormat(colW, 6, fmt.Sprintf("Jumlah Transaksi: %d", data.TotalTransactions), "", 0, "L", false, 0, "")
	pdf.CellFormat(colW, 6, fmt.Sprintf("Item Terjual: %d", data.TotalItemsSold), "", 1, "L", false, 0, "")
	pdf.Ln(6)

	// Stock table
	pdf.SetFont("Arial", "B", 12)
	pdf.CellFormat(0, 8, "Laporan Stok", "", 1, "L", false, 0, "")
	pdf.Ln(2)

	pdf.SetFont("Arial", "B", 9)
	pdf.SetFillColor(41, 98, 235)
	pdf.SetTextColor(255, 255, 255)
	pdf.CellFormat(10, 7, "No", "1", 0, "C", true, 0, "")
	pdf.CellFormat(70, 7, "Nama Produk", "1", 0, "L", true, 0, "")
	pdf.CellFormat(25, 7, "Satuan", "1", 0, "C", true, 0, "")
	pdf.CellFormat(35, 7, "Terjual Hari Ini", "1", 0, "C", true, 0, "")
	pdf.CellFormat(35, 7, "Stok Saat Ini", "1", 0, "C", true, 0, "")
	pdf.Ln(-1)

	pdf.SetFont("Arial", "", 9)
	pdf.SetTextColor(0, 0, 0)
	for i, item := range data.StockReport {
		if pdf.GetY() > 265 {
			pdf.AddPage()
		}
		fill := i%2 == 0
		if fill {
			pdf.SetFillColor(240, 245, 255)
		}
		pdf.CellFormat(10, 6, fmt.Sprintf("%d", i+1), "1", 0, "C", fill, 0, "")
		pdf.CellFormat(70, 6, item.ProductName, "1", 0, "L", fill, 0, "")
		pdf.CellFormat(25, 6, item.Unit, "1", 0, "C", fill, 0, "")
		pdf.CellFormat(35, 6, fmt.Sprintf("%d", item.SoldToday), "1", 0, "C", fill, 0, "")
		pdf.CellFormat(35, 6, fmt.Sprintf("%d", item.CurrentStock), "1", 0, "C", fill, 0, "")
		pdf.Ln(-1)
	}

	if len(data.StockReport) == 0 {
		pdf.SetFont("Arial", "I", 9)
		pdf.CellFormat(175, 6, "Tidak ada data produk", "1", 1, "C", false, 0, "")
	}

	// Employee sections
	for _, empData := range data.ByEmployee {
		pdf.Ln(8)
		if pdf.GetY() > 240 {
			pdf.AddPage()
		}

		pdf.SetFont("Arial", "B", 12)
		pdf.SetTextColor(41, 98, 235)
		pdf.CellFormat(0, 8, fmt.Sprintf("Transaksi - %s", empData.EmployeeName), "", 1, "L", false, 0, "")
		pdf.SetTextColor(0, 0, 0)

		pdf.SetFont("Arial", "", 9)
		pdf.CellFormat(0, 5, fmt.Sprintf("Jumlah Transaksi: %d  |  Total Omzet: Rp %s  |  Item Terjual: %d",
			empData.TransactionCount, formatCurrency(empData.SubtotalAmount), empData.ItemsSold), "", 1, "L", false, 0, "")
		pdf.Ln(3)

		if len(empData.Transactions) == 0 {
			pdf.SetFont("Arial", "I", 9)
			pdf.CellFormat(0, 5, "Tidak ada transaksi", "", 1, "L", false, 0, "")
			continue
		}

		for _, tx := range empData.Transactions {
			if pdf.GetY() > 250 {
				pdf.AddPage()
			}
			pdf.SetFont("Arial", "B", 9)
			pdf.SetFillColor(230, 235, 245)
			pdf.CellFormat(0, 6, fmt.Sprintf("%s  |  %s  |  %s  |  Rp %s",
				tx.TransactionCode, tx.CreatedAt.Format("15:04:05"), tx.PaymentMethod,
				formatCurrency(tx.TotalAmount),
			), "1", 1, "L", true, 0, "")

			pdf.SetFont("Arial", "", 8)
			for _, item := range tx.Items {
				if pdf.GetY() > 270 {
					pdf.AddPage()
				}
				pdf.CellFormat(10, 5, "", "", 0, "L", false, 0, "")
				pdf.CellFormat(70, 5, item.ProductName, "", 0, "L", false, 0, "")
				pdf.CellFormat(30, 5, fmt.Sprintf("%d x Rp %s", item.Qty, formatCurrency(item.UnitPrice)), "", 0, "L", false, 0, "")
				pdf.CellFormat(40, 5, fmt.Sprintf("= Rp %s", formatCurrency(item.Subtotal)), "", 1, "R", false, 0, "")
			}
			pdf.Ln(2)
		}
	}

	// Footer
	pdf.Ln(6)
	if pdf.GetY() > 260 {
		pdf.AddPage()
	}
	pdf.SetDrawColor(41, 98, 235)
	pdf.SetLineWidth(0.5)
	pdf.Line(10, pdf.GetY(), 200, pdf.GetY())
	pdf.Ln(4)

	pdf.SetFont("Arial", "B", 11)
	pdf.CellFormat(0, 7, fmt.Sprintf("TOTAL KESELURUHAN: Rp %s", formatCurrency(data.TotalRevenue)), "", 1, "R", false, 0, "")
	pdf.SetFont("Arial", "", 9)
	pdf.CellFormat(0, 5, fmt.Sprintf("Total Transaksi: %d  |  Total Item Terjual: %d",
		data.TotalTransactions, data.TotalItemsSold), "", 1, "R", false, 0, "")

	return pdf
}

// formatCurrency formats a float64 as Indonesian currency string (e.g., 1.500.000).
func formatCurrency(amount float64) string {
	// Convert to integer for display (no decimals for Rupiah)
	intAmount := int64(amount)
	if intAmount == 0 {
		return "0"
	}

	// Format with dot separator
	negative := false
	if intAmount < 0 {
		negative = true
		intAmount = -intAmount
	}

	str := fmt.Sprintf("%d", intAmount)
	n := len(str)
	if n <= 3 {
		if negative {
			return "-" + str
		}
		return str
	}

	// Insert dots every 3 digits from the right
	var result []byte
	for i, ch := range str {
		if i > 0 && (n-i)%3 == 0 {
			result = append(result, '.')
		}
		result = append(result, byte(ch))
	}

	if negative {
		return "-" + string(result)
	}
	return string(result)
}
