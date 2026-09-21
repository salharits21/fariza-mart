package services

import (
	"database/sql"
	"errors"
	"farizamart/models"
	"time"

	"golang.org/x/crypto/bcrypt"
)

// EmployeeService provides staff account management (admin CRUD).
// Bound to Wails — methods are callable from the frontend.
type EmployeeService struct {
	db *sql.DB
}

// NewEmployeeService creates a new EmployeeService instance.
func NewEmployeeService(db *sql.DB) *EmployeeService {
	return &EmployeeService{db: db}
}

// GetStaffList returns all employee accounts.
func (s *EmployeeService) GetStaffList() ([]models.User, error) {
	rows, err := s.db.Query(`
		SELECT id, username, role, display_name, created_at 
		FROM users 
		WHERE role = 'employee' 
		ORDER BY id DESC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var staffList []models.User
	for rows.Next() {
		var u models.User
		var createdAtStr string
		if err := rows.Scan(&u.ID, &u.Username, &u.Role, &u.DisplayName, &createdAtStr); err != nil {
			return nil, err
		}
		if t, err := time.Parse(time.RFC3339, createdAtStr); err == nil {
			u.CreatedAt = t
		} else if t, err := time.Parse("2006-01-02 15:04:05", createdAtStr); err == nil {
			u.CreatedAt = t
		}
		staffList = append(staffList, u)
	}
	return staffList, rows.Err()
}

// CreateStaff creates a new employee account.
func (s *EmployeeService) CreateStaff(req models.CreateStaffRequest) (*models.User, error) {
	if req.Username == "" || req.Password == "" {
		return nil, errors.New("username dan password wajib diisi")
	}
	if len(req.Password) < 6 {
		return nil, errors.New("password minimal 6 karakter")
	}
	if req.DisplayName == "" {
		req.DisplayName = req.Username
	}

	var existingCount int
	err := s.db.QueryRow("SELECT COUNT(*) FROM users WHERE username = ?", req.Username).Scan(&existingCount)
	if err != nil {
		return nil, err
	}
	if existingCount > 0 {
		return nil, errors.New("username sudah digunakan")
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}

	res, err := s.db.Exec(`
		INSERT INTO users (username, password_hash, role, display_name) 
		VALUES (?, ?, 'employee', ?)
	`, req.Username, string(hash), req.DisplayName)
	if err != nil {
		return nil, err
	}

	id, err := res.LastInsertId()
	if err != nil {
		return nil, err
	}

	return &models.User{
		ID:          id,
		Username:    req.Username,
		Role:        "employee",
		DisplayName: req.DisplayName,
		CreatedAt:   time.Now(),
	}, nil
}

// UpdateStaff updates an employee's display name.
func (s *EmployeeService) UpdateStaff(req models.UpdateStaffRequest) error {
	if req.ID <= 0 {
		return errors.New("ID karyawan tidak valid")
	}
	if req.DisplayName == "" {
		return errors.New("nama tampilan wajib diisi")
	}

	res, err := s.db.Exec(`
		UPDATE users SET display_name = ? WHERE id = ? AND role = 'employee'
	`, req.DisplayName, req.ID)
	if err != nil {
		return err
	}
	affected, _ := res.RowsAffected()
	if affected == 0 {
		return errors.New("karyawan tidak ditemukan")
	}
	return nil
}

// ResetStaffPassword allows admin to set a new password for an employee.
func (s *EmployeeService) ResetStaffPassword(id int64, newPassword string) error {
	if id <= 0 {
		return errors.New("ID karyawan tidak valid")
	}
	if len(newPassword) < 6 {
		return errors.New("password baru minimal 6 karakter")
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		return err
	}

	res, err := s.db.Exec(`
		UPDATE users SET password_hash = ? WHERE id = ? AND role = 'employee'
	`, string(hash), id)
	if err != nil {
		return err
	}
	affected, _ := res.RowsAffected()
	if affected == 0 {
		return errors.New("karyawan tidak ditemukan")
	}
	return nil
}

// DeleteStaff removes an employee account. Admin accounts cannot be deleted here.
func (s *EmployeeService) DeleteStaff(id int64) error {
	if id <= 0 {
		return errors.New("ID karyawan tidak valid")
	}

	res, err := s.db.Exec("DELETE FROM users WHERE id = ? AND role = 'employee'", id)
	if err != nil {
		return err
	}
	affected, _ := res.RowsAffected()
	if affected == 0 {
		return errors.New("karyawan tidak ditemukan")
	}
	return nil
}

// GetAllUsersForFilter returns all active accounts (admin & employees) for filtering in history view.
func (s *EmployeeService) GetAllUsersForFilter() ([]models.UserSession, error) {
	rows, err := s.db.Query("SELECT id, username, role, display_name FROM users ORDER BY role ASC, display_name ASC")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []models.UserSession
	for rows.Next() {
		var u models.UserSession
		if err := rows.Scan(&u.ID, &u.Username, &u.Role, &u.DisplayName); err != nil {
			return nil, err
		}
		list = append(list, u)
	}
	return list, rows.Err()
}
