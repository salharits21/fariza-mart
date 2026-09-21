package main

import (
	"embed"
	"log"

	"farizamart/services"

	"github.com/wailsapp/wails/v3/pkg/application"
)

// Wails uses Go's `embed` package to embed the frontend files into the binary.
// Any files in the frontend/dist folder will be embedded into the binary and
// made available to the frontend.
// See https://pkg.go.dev/embed for more information.

//go:embed all:frontend/dist
var assets embed.FS

// main function serves as the application's entry point.
// It initializes the database, creates all services, and starts the Wails application.
func main() {
	// Initialize database
	dbPath, err := GetDBPath()
	if err != nil {
		log.Fatal("Failed to determine database path:", err)
	}

	db, err := InitDB(dbPath)
	if err != nil {
		log.Fatal("Failed to initialize database:", err)
	}
	defer db.Close()

	// Create service instances
	authService := services.NewAuthService(db)
	productService := services.NewProductService(db)
	transactionService := services.NewTransactionService(db, authService)
	employeeService := services.NewEmployeeService(db)
	dashboardService := services.NewDashboardService(db)
	reportService := services.NewReportService(db)
	stockWithdrawalService := services.NewStockWithdrawalService(db, authService)

	// Create a new Wails application
	app := application.New(application.Options{
		Name:        "Fariza Mart - POS",
		Description: "Sistem Point of Sale untuk Fariza Mart",
		Services: []application.Service{
			application.NewService(authService),
			application.NewService(productService),
			application.NewService(transactionService),
			application.NewService(employeeService),
			application.NewService(dashboardService),
			application.NewService(reportService),
			application.NewService(stockWithdrawalService),
		},
		Assets: application.AssetOptions{
			Handler: application.AssetFileServerFS(assets),
		},
		Mac: application.MacOptions{
			ApplicationShouldTerminateAfterLastWindowClosed: true,
		},
	})

	// Create the main window
	app.Window.NewWithOptions(application.WebviewWindowOptions{
		Title:  "Fariza Mart - POS",
		Width:  1280,
		Height: 800,
		Mac: application.MacWindow{
			InvisibleTitleBarHeight: 50,
			Backdrop:                application.MacBackdropTranslucent,
			TitleBar:                application.MacTitleBarHiddenInset,
		},
		BackgroundColour: application.NewRGB(255, 255, 255),
		URL:              "/",
	})

	// Run the application. This blocks until the application has been exited.
	if err := app.Run(); err != nil {
		log.Fatal(err)
	}
}
