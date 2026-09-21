import React, { useState } from 'react';
import * as AuthService from '../../bindings/farizamart/services/authservice';
import { Modal } from '../components/Modal';
import { useToast } from '../components/Toast';

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({ isOpen, onClose }) => {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { showToast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!oldPassword) {
      showToast('Password lama wajib diisi', 'warning');
      return;
    }
    if (newPassword.length < 6) {
      showToast('Password baru minimal 6 karakter', 'warning');
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast('Konfirmasi password tidak cocok', 'warning');
      return;
    }

    setSubmitting(true);
    try {
      await AuthService.ChangePassword(oldPassword, newPassword);
      showToast('Password admin berhasil diubah!', 'success');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      onClose();
    } catch (err: any) {
      showToast(err?.message || 'Gagal mengubah password', 'danger');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Ubah Password Admin"
      footer={
        <>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
            disabled={submitting}
          >
            Batal
          </button>
          <button
            type="submit"
            form="change-password-form"
            className="btn btn-primary"
            disabled={submitting}
          >
            {submitting ? 'Menyimpan...' : 'Simpan Password Baru'}
          </button>
        </>
      }
    >
      <form id="change-password-form" onSubmit={handleSubmit}>
        <div className="form-group">
          <label className="form-label" htmlFor="old-pass">
            Password Saat Ini
          </label>
          <input
            id="old-pass"
            type="password"
            className="form-control"
            placeholder="Masukkan password lama"
            value={oldPassword}
            onChange={(e) => setOldPassword(e.target.value)}
            required
            autoFocus
          />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="new-pass">
            Password Baru (min. 6 karakter)
          </label>
          <input
            id="new-pass"
            type="password"
            className="form-control"
            placeholder="Masukkan password baru"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
          />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="confirm-pass">
            Konfirmasi Password Baru
          </label>
          <input
            id="confirm-pass"
            type="password"
            className="form-control"
            placeholder="Ulangi password baru"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />
        </div>
      </form>
    </Modal>
  );
};
