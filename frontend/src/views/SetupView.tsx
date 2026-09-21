import React, { useState } from 'react';
import { Lock, User, AlertCircle, ShieldAlert, Check } from '../components/Icons';
import * as AuthService from '../../bindings/farizamart/services/authservice';
import { UserSession } from '../../bindings/farizamart/models/models';
import { useToast } from '../components/Toast';

interface SetupViewProps {
  onSetupSuccess: (session: UserSession) => void;
}

export const SetupView: React.FC<SetupViewProps> = ({ onSetupSuccess }) => {
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const { showToast } = useToast();

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) {
      setErrorMessage('Username administrator wajib diisi');
      return;
    }
    if (!password) {
      setErrorMessage('Password wajib diisi');
      return;
    }
    if (password.length < 6) {
      setErrorMessage('Password minimal 6 karakter');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage('Konfirmasi password tidak cocok');
      return;
    }

    setLoading(true);
    setErrorMessage('');
    try {
      const session = await AuthService.SetupAdmin(
        username.trim(),
        password,
        displayName.trim() || username.trim()
      );
      if (session) {
        showToast('Akun Administrator berhasil dibuat! Selamat datang di Fariza Mart.', 'success');
        onSetupSuccess(session);
      } else {
        setErrorMessage('Gagal membuat akun administrator');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Gagal membuat akun administrator');
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
          maxWidth: '460px',
          padding: '36px 32px',
          boxShadow: 'var(--shadow-xl)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div
            style={{
              width: '56px',
              height: '56px',
              background: 'linear-gradient(135deg, var(--primary), #4f46e5)',
              color: '#ffffff',
              borderRadius: 'var(--radius-lg)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
              boxShadow: '0 8px 16px rgba(37, 99, 235, 0.25)',
            }}
          >
            <ShieldAlert size={30} />
          </div>
          <h2 style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--text-main)' }}>
            Setup Akun Administrator
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '6px', lineHeight: 1.5 }}>
            Selamat datang di <strong>Fariza Mart POS</strong>! Buat akun Administrator utama untuk mengelola aplikasi.
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

        <form onSubmit={handleSetup}>
          <div className="form-group">
            <label className="form-label" htmlFor="setup-username">
              Username Admin <span style={{ color: 'var(--danger)' }}>*</span>
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
                id="setup-username"
                className="form-control"
                style={{ paddingLeft: '40px' }}
                type="text"
                placeholder="Contoh: owner atau admin"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoFocus
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="setup-displayname">
              Nama Lengkap / Tampilan
            </label>
            <input
              id="setup-displayname"
              className="form-control"
              type="text"
              placeholder="Contoh: Fariza (Owner)"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="setup-password">
              Password Admin <span style={{ color: 'var(--danger)' }}>*</span>
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
                id="setup-password"
                className="form-control"
                style={{ paddingLeft: '40px' }}
                type="password"
                placeholder="Minimal 6 karakter"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '24px' }}>
            <label className="form-label" htmlFor="setup-confirm">
              Konfirmasi Password <span style={{ color: 'var(--danger)' }}>*</span>
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
                id="setup-confirm"
                className="form-control"
                style={{ paddingLeft: '40px' }}
                type="password"
                placeholder="Ulangi password di atas"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-lg"
            style={{ width: '100%', display: 'flex', gap: '8px' }}
            disabled={loading}
          >
            <Check size={18} />
            <span>{loading ? 'Menyimpan...' : 'Selesaikan Pendaftaran Admin'}</span>
          </button>
        </form>
      </div>
    </div>
  );
};
