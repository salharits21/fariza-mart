import React, { useState } from 'react';
import { Store, Lock, User, AlertCircle } from '../components/Icons';
import * as AuthService from '../../bindings/farizamart/services/authservice';
import { UserSession } from '../../bindings/farizamart/models/models';
import { useToast } from '../components/Toast';

interface LoginViewProps {
  onLoginSuccess: (session: UserSession) => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const { showToast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setErrorMessage('Username dan password wajib diisi');
      return;
    }

    setLoading(true);
    setErrorMessage('');
    try {
      const session = await AuthService.Login(username.trim(), password);
      if (session) {
        showToast(`Selamat datang, ${session.display_name || session.username}!`, 'success');
        onLoginSuccess(session);
      } else {
        setErrorMessage('Username atau password salah.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Username atau password salah');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        minHeight: '100vh',
        width: '100vw',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--bg-app)',
        padding: '24px',
      }}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '420px',
          padding: '36px 32px',
          boxShadow: 'var(--shadow-xl)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div
            style={{
              width: '56px',
              height: '56px',
              background: 'linear-gradient(135deg, var(--primary), var(--accent))',
              color: '#ffffff',
              borderRadius: 'var(--radius-lg)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
              boxShadow: '0 8px 16px rgba(37, 99, 235, 0.25)',
            }}
          >
            <Store size={30} />
          </div>
          <h2 style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--text-main)' }}>
            Fariza Mart
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            Sistem Kasir & Dokumentasi Transaksi (Offline)
          </p>
        </div>

        {errorMessage && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '10px 14px',
              backgroundColor: 'var(--danger-bg)',
              color: 'var(--danger)',
              border: '1px solid var(--danger-border)',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.85rem',
              marginBottom: '20px',
            }}
          >
            <AlertCircle size={18} />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label className="form-label" htmlFor="username">
              Username
            </label>
            <div style={{ position: 'relative' }}>
              <span
                style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-light)',
                  display: 'flex',
                }}
              >
                <User size={18} />
              </span>
              <input
                id="username"
                className="form-control"
                style={{ paddingLeft: '40px' }}
                type="text"
                placeholder="Masukkan username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoFocus
              />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '24px' }}>
            <label className="form-label" htmlFor="password">
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <span
                style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-light)',
                  display: 'flex',
                }}
              >
                <Lock size={18} />
              </span>
              <input
                id="password"
                className="form-control"
                style={{ paddingLeft: '40px' }}
                type="password"
                placeholder="Masukkan password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-lg"
            style={{ width: '100%', display: 'flex', gap: '8px' }}
            disabled={loading}
          >
            {loading ? 'Memproses...' : 'Masuk ke Aplikasi'}
          </button>
        </form>
      </div>
    </div>
  );
};
