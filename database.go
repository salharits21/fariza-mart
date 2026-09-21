package main

import (
	"database/sql"
	"fmt"
	"log"
	"os"
	"path/filepath"

	_ "modernc.org/sqlite"
)

const schema = `
CREATE TABLE IF NOT EXISTS users (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	username TEXT NOT NULL UNIQUE,
	password_hash TEXT NOT NULL,
	role TEXT NOT NULL DEFAULT 'employee',
	display_name TEXT NOT NULL DEFAULT '',
	created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS products (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	name TEXT NOT NULL,
	category TEXT DEFAULT '',
	sell_price REAL NOT NULL DEFAULT 0,
	cost_price REAL DEFAULT 0,
	stock INTEGER NOT NULL DEFAULT 0,
	unit TEXT DEFAULT 'pcs',
	is_active INTEGER NOT NULL DEFAULT 1,
	created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
	updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS transactions (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	transaction_code TEXT NOT NULL UNIQUE,
	employee_id INTEGER NOT NULL,
	total_amount REAL NOT NULL DEFAULT 0,
	payment_method TEXT DEFAULT '',
	note TEXT DEFAULT '',
	is_void INTEGER NOT NULL DEFAULT 0,
	void_reason TEXT DEFAULT '',
	created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (employee_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS transaction_items (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	transaction_id INTEGER NOT NULL,
	product_id INTEGER NOT NULL,
	product_name TEXT NOT NULL,
	qty INTEGER NOT NULL,
	unit_price REAL NOT NULL,
	subtotal REAL NOT NULL,
	FOREIGN KEY (transaction_id) REFERENCES transactions(id),
	FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE TABLE IF NOT EXISTS stock_withdrawals (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	product_id INTEGER NOT NULL,
	product_name TEXT NOT NULL,
	qty INTEGER NOT NULL,
	reason TEXT DEFAULT '',
	withdrawn_by INTEGER NOT NULL,
	created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (product_id) REFERENCES products(id),
	FOREIGN KEY (withdrawn_by) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_transactions_employee_id ON transactions(employee_id);
CREATE INDEX IF NOT EXISTS idx_transaction_items_transaction_id ON transaction_items(transaction_id);
CREATE INDEX IF NOT EXISTS idx_products_is_active ON products(is_active);
CREATE INDEX IF NOT EXISTS idx_stock_withdrawals_created_at ON stock_withdrawals(created_at);
CREATE INDEX IF NOT EXISTS idx_stock_withdrawals_product_id ON stock_withdrawals(product_id);
`

// GetDBPath returns the path to the SQLite database file.
// It stores the DB in the user's config directory under "farizamart/data.db".
func GetDBPath() (string, error) {
	configDir, err := os.UserConfigDir()
	if err != nil {
		return "", fmt.Errorf("failed to get user config dir: %w", err)
	}
	appDir := filepath.Join(configDir, "farizamart")
	if err := os.MkdirAll(appDir, 0755); err != nil {
		return "", fmt.Errorf("failed to create app data dir: %w", err)
	}
	return filepath.Join(appDir, "data.db"), nil
}

// InitDB initializes the SQLite database: creates the file, runs migrations,
// and applies any necessary schema upgrades.
func InitDB(dbPath string) (*sql.DB, error) {
	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %w", err)
	}

	// Enable WAL mode for better concurrent read performance
	if _, err := db.Exec("PRAGMA journal_mode=WAL"); err != nil {
		return nil, fmt.Errorf("failed to set WAL mode: %w", err)
	}

	// Enable foreign keys
	if _, err := db.Exec("PRAGMA foreign_keys=ON"); err != nil {
		return nil, fmt.Errorf("failed to enable foreign keys: %w", err)
	}

	// Migrate from old schema if needed (before running new schema)
	if err := migrateDB(db); err != nil {
		return nil, fmt.Errorf("failed to migrate database: %w", err)
	}

	// Run schema migration (CREATE IF NOT EXISTS is safe to re-run)
	if _, err := db.Exec(schema); err != nil {
		return nil, fmt.Errorf("failed to run schema migration: %w", err)
	}

	log.Println("[DB] Database initialized successfully at:", dbPath)
	return db, nil
}

// migrateDB handles migration from the old schema to the new one.
// It checks if the old `employees` table exists and migrates data to `users`.
// It also adds new columns to `users` if they don't exist yet.
func migrateDB(db *sql.DB) error {
	// Check if the old employees table exists
	var employeesTableExists int
	err := db.QueryRow(`SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='employees'`).Scan(&employeesTableExists)
	if err != nil {
		return err
	}

	// Check if users table exists
	var usersTableExists int
	err = db.QueryRow(`SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='users'`).Scan(&usersTableExists)
	if err != nil {
		return err
	}

	if usersTableExists > 0 {
		// Check if role column exists in users table
		var hasRoleColumn bool
		rows, err := db.Query("PRAGMA table_info(users)")
		if err != nil {
			return err
		}
		defer rows.Close()
		for rows.Next() {
			var cid int
			var name, colType string
			var notNull int
			var dfltValue sql.NullString
			var pk int
			if err := rows.Scan(&cid, &name, &colType, &notNull, &dfltValue, &pk); err != nil {
				return err
			}
			if name == "role" {
				hasRoleColumn = true
			}
		}

		// Add missing columns if needed
		if !hasRoleColumn {
			log.Println("[DB] Migrating: Adding 'role' and 'display_name' columns to users table")
			if _, err := db.Exec(`ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'admin'`); err != nil {
				return fmt.Errorf("failed to add role column: %w", err)
			}
			if _, err := db.Exec(`ALTER TABLE users ADD COLUMN display_name TEXT NOT NULL DEFAULT ''`); err != nil {
				return fmt.Errorf("failed to add display_name column: %w", err)
			}
			// Set display_name for existing admin users based on username
			if _, err := db.Exec(`UPDATE users SET display_name = username WHERE display_name = ''`); err != nil {
				return fmt.Errorf("failed to set display_name: %w", err)
			}
			log.Println("[DB] Migration complete: users table updated with role and display_name")
		}
	}

	// If old employees table exists, we can drop it after migration
	// The employees data was just names like "Nurdian", "Yoga" — they didn't have login credentials
	// The admin will need to recreate employee accounts through the new staff management UI
	if employeesTableExists > 0 {
		log.Println("[DB] Old 'employees' table found. It will be kept for backward compatibility but is no longer used.")
		// We don't drop it to avoid breaking old FK references in transactions
		// The new schema joins transactions with users instead of employees
	}

	return nil
}
