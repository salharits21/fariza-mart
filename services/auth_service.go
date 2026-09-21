package services

import (
	"database/sql"
	"errors"
	"farizamart/models"
	"sync"

	"golang.org/x/crypto/bcrypt"
)

// AuthService handles user authentication (login/logout/session/setup).
// Bound to Wails — methods are callable from the frontend.
type AuthService struct {
	db          *sql.DB
	currentUser *models.UserSession
	mu          sync.Mutex
}

// NewAuthService creates a new AuthService instance.
func NewAuthService(db *sql.DB) *AuthService {
	return &AuthService{db: db}
}

// IsSetupRequired checks if an admin account exists in the database.
// If no admin user is found, setup is required.
func (s *AuthService) IsSetupRequired() (bool, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	var count int
	err := s.db.QueryRow("SELECT COUNT(*) FROM users WHERE role = 'admin'").Scan(&count)
	if err != nil {
		return false, err
	}
	return count == 0, nil
}

// SetupAdmin registers the first admin account when the app is launched for the first time.
func (s *AuthService) SetupAdmin(username, password, displayName string) (*models.UserSession, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if username == "" || password == "" {
		return nil, errors.New("username dan password wajib diisi")
	}
	if len(password) < 6 {
		return nil, errors.New("password minimal 6 karakter")
	}
	if displayName == "" {
		displayName = username
	}

	var count int
	if err := s.db.QueryRow("SELECT COUNT(*) FROM users WHERE role = 'admin'").Scan(&count); err != nil {
		return nil, err
	}
	if count > 0 {
		return nil, errors.New("admin sudah terdaftar di sistem")
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}

	res, err := s.db.Exec(
		"INSERT INTO users (username, password_hash, role, display_name) VALUES (?, ?, 'admin', ?)",
		username, string(hash), displayName,
	)
	if err != nil {
		return nil, err
	}

	id, err := res.LastInsertId()
	if err != nil {
		return nil, err
	}

	session := &models.UserSession{
		ID:          id,
		Username:    username,
		Role:        "admin",
		DisplayName: displayName,
	}
	s.currentUser = session
	return session, nil
}

// Login validates credentials and establishes an in-memory session.
func (s *AuthService) Login(username, password string) (*models.UserSession, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if username == "" || password == "" {
		return nil, errors.New("username dan password wajib diisi")
	}

	var (
		id           int64
		storedUser   string
		passwordHash string
		role         string
		displayName  string
	)

	err := s.db.QueryRow(
		"SELECT id, username, password_hash, role, display_name FROM users WHERE username = ?",
		username,
	).Scan(&id, &storedUser, &passwordHash, &role, &displayName)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errors.New("username atau password salah")
		}
		return nil, err
	}

	if err := bcrypt.CompareHashAndPassword([]byte(passwordHash), []byte(password)); err != nil {
		return nil, errors.New("username atau password salah")
	}

	session := &models.UserSession{
		ID:          id,
		Username:    storedUser,
		Role:        role,
		DisplayName: displayName,
	}
	s.currentUser = session
	return session, nil
}

// Logout clears the current in-memory user session.
func (s *AuthService) Logout() {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.currentUser = nil
}

// GetCurrentUser returns the currently logged in user session.
func (s *AuthService) GetCurrentUser() (*models.UserSession, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.currentUser == nil {
		return nil, errors.New("belum ada user yang login")
	}
	return s.currentUser, nil
}

// IsLoggedIn returns whether a user is currently logged in.
func (s *AuthService) IsLoggedIn() bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.currentUser != nil
}

// ChangePassword changes the admin password. Only users with role 'admin' can change password.
func (s *AuthService) ChangePassword(oldPassword, newPassword string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.currentUser == nil {
		return errors.New("anda harus login terlebih dahulu")
	}
	if s.currentUser.Role != "admin" {
		return errors.New("hanya admin yang dapat mengubah password")
	}

	if newPassword == "" {
		return errors.New("password baru tidak boleh kosong")
	}
	if len(newPassword) < 6 {
		return errors.New("password baru minimal 6 karakter")
	}

	var hash string
	err := s.db.QueryRow("SELECT password_hash FROM users WHERE id = ?", s.currentUser.ID).Scan(&hash)
	if err != nil {
		return err
	}
	if err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(oldPassword)); err != nil {
		return errors.New("password lama salah")
	}

	newHash, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	_, err = s.db.Exec("UPDATE users SET password_hash = ? WHERE id = ?", string(newHash), s.currentUser.ID)
	return err
}
