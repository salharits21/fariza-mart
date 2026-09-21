import React, { useState, useEffect, useCallback } from 'react';
import * as EmployeeService from '../../bindings/farizamart/services/employeeservice';
import { User as UserModel, CreateStaffRequest, UpdateStaffRequest } from '../../bindings/farizamart/models/models';
import { Plus, Edit, Trash2, Key, Search, RefreshCw, AlertCircle, User } from '../components/Icons';
import { Modal } from '../components/Modal';
import { useToast } from '../components/Toast';

export const StaffView: React.FC = () => {
  const [staffList, setStaffList] = useState<UserModel[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isResetOpen, setIsResetOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<UserModel | null>(null);

  // Form states
  const [createUsername, setCreateUsername] = useState('');
  const [createDisplayName, setCreateDisplayName] = useState('');
  const [createPassword, setCreatePassword] = useState('');

  const [editDisplayName, setEditDisplayName] = useState('');
  const [resetPassword, setResetPassword] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const { showToast } = useToast();

  const loadStaff = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await EmployeeService.GetStaffList();
      setStaffList(data || []);
    } catch (err: any) {
      setError(err?.message || 'Gagal memuat daftar staf');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStaff();
  }, [loadStaff]);

  // Create Staff
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createUsername.trim() || !createPassword) {
      showToast('Username dan password wajib diisi', 'warning');
      return;
    }
    if (createPassword.length < 6) {
      showToast('Password minimal 6 karakter', 'warning');
      return;
    }

    setSubmitting(true);
    try {
      const req: CreateStaffRequest = {
        username: createUsername.trim(),
        display_name: createDisplayName.trim() || createUsername.trim(),
        password: createPassword,
      };
      await EmployeeService.CreateStaff(req);
      showToast('Akun staf berhasil dibuat!', 'success');
      setIsCreateOpen(false);
      setCreateUsername('');
      setCreateDisplayName('');
      setCreatePassword('');
      loadStaff();
    } catch (err: any) {
      showToast(err?.message || 'Gagal membuat akun staf', 'danger');
    } finally {
      setSubmitting(false);
    }
  };

  // Edit Staff
  const openEdit = (staff: UserModel) => {
    setSelectedStaff(staff);
    setEditDisplayName(staff.display_name || '');
    setIsEditOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStaff) return;
    if (!editDisplayName.trim()) {
      showToast('Nama tampilan wajib diisi', 'warning');
      return;
    }

    setSubmitting(true);
    try {
      const req: UpdateStaffRequest = {
        id: selectedStaff.id,
        display_name: editDisplayName.trim(),
      };
      await EmployeeService.UpdateStaff(req);
      showToast('Data staf berhasil diperbarui!', 'success');
      setIsEditOpen(false);
      loadStaff();
    } catch (err: any) {
      showToast(err?.message || 'Gagal memperbarui staf', 'danger');
    } finally {
      setSubmitting(false);
    }
  };

  // Reset Password
  const openReset = (staff: UserModel) => {
    setSelectedStaff(staff);
    setResetPassword('');
    setIsResetOpen(true);
  };

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStaff) return;
    if (resetPassword.length < 6) {
      showToast('Password baru minimal 6 karakter', 'warning');
      return;
    }

    setSubmitting(true);
    try {
      await EmployeeService.ResetStaffPassword(selectedStaff.id, resetPassword);
      showToast(`Password untuk ${selectedStaff.display_name || selectedStaff.username} berhasil direset!`, 'success');
      setIsResetOpen(false);
    } catch (err: any) {
      showToast(err?.message || 'Gagal reset password', 'danger');
    } finally {
      setSubmitting(false);
    }
  };

  // Delete Staff
  const openDelete = (staff: UserModel) => {
    setSelectedStaff(staff);
    setIsDeleteOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!selectedStaff) return;

    setSubmitting(true);
    try {
      await EmployeeService.DeleteStaff(selectedStaff.id);
      showToast('Akun staf berhasil dihapus!', 'success');
      setIsDeleteOpen(false);
      loadStaff();
    } catch (err: any) {
      showToast(err?.message || 'Gagal menghapus akun staf', 'danger');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredStaff = staffList.filter((s) => {
    const q = searchTerm.toLowerCase();
    return s.username.toLowerCase().includes(q) || (s.display_name || '').toLowerCase().includes(q);
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header & Controls */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--text-main)' }}>
            Kelola Akun Staf / Karyawan
          </h2>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            Kelola akun login kasir/karyawan toko, nama tampilan di struk, dan reset kata sandi.
          </p>
        </div>

        <button className="btn btn-primary" onClick={() => setIsCreateOpen(true)}>
          <Plus size={18} />
          <span>Tambah Karyawan Baru</span>
        </button>
      </div>

      {error && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '12px 16px',
            backgroundColor: 'var(--danger-bg)',
            color: 'var(--danger)',
            border: '1px solid var(--danger-border)',
            borderRadius: 'var(--radius-md)',
            fontSize: '0.88rem',
          }}
        >
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="card" style={{ padding: '16px 20px' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(240px, 1fr) auto',
            gap: '14px',
            alignItems: 'center',
          }}
        >
          {/* Search Box */}
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
              <Search size={17} />
            </span>
            <input
              className="form-control"
              style={{ paddingLeft: '38px' }}
              type="text"
              placeholder="Cari nama kasir atau username..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Refresh Button */}
          <button className="btn btn-secondary btn-sm" onClick={loadStaff} disabled={loading} title="Muat ulang">
            <RefreshCw size={15} />
          </button>
        </div>
      </div>

      {/* Summary of Filtered Data */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 18px',
          backgroundColor: '#ffffff',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border)',
          fontSize: '0.85rem',
        }}
      >
        <span>
          Total Akun Karyawan: <strong>{staffList.length}</strong> orang
        </span>
        {searchTerm && (
          <span style={{ color: 'var(--text-muted)' }}>
            Hasil pencarian: <strong>{filteredStaff.length}</strong> akun
          </span>
        )}
      </div>

      {/* Staff Table */}
      <div className="table-container">
        <table className="custom-table">
          <thead>
            <tr>
              <th style={{ width: '50px' }}>No</th>
              <th>Username</th>
              <th>Nama Tampilan / Kasir</th>
              <th>Role</th>
              <th>Tanggal Terdaftar</th>
              <th style={{ textAlign: 'right' }}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                  Memuat data akun staf...
                </td>
              </tr>
            ) : filteredStaff.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                  {searchTerm
                    ? 'Tidak ada akun karyawan yang cocok dengan pencarian.'
                    : 'Belum ada akun karyawan. Klik "Tambah Karyawan Baru" untuk mendaftarkan kasir.'}
                </td>
              </tr>
            ) : (
              filteredStaff.map((staff, idx) => (
                <tr key={staff.id}>
                  <td style={{ color: 'var(--text-light)', fontWeight: 600 }}>#{idx + 1}</td>
                  <td style={{ fontWeight: 600, color: 'var(--primary)' }}>@{staff.username}</td>
                  <td style={{ fontWeight: 600 }}>{staff.display_name || staff.username}</td>
                  <td>
                    <span className="badge badge-blue">
                      <User size={12} />
                      Karyawan
                    </span>
                  </td>
                  <td style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                    {staff.created_at
                      ? new Date(staff.created_at).toLocaleDateString('id-ID', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })
                      : '-'}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: '6px' }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => openEdit(staff)}
                        title="Edit Nama Kasir"
                      >
                        <Edit size={14} />
                        <span>Edit</span>
                      </button>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => openReset(staff)}
                        title="Reset Password Karyawan"
                        style={{ color: '#d97706' }}
                      >
                        <Key size={14} />
                        <span>Reset Sandi</span>
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => openDelete(staff)}
                        title="Hapus Akun Karyawan"
                      >
                        <Trash2 size={14} />
                        <span>Hapus</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Tambah Karyawan */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Tambah Akun Karyawan Baru"
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setIsCreateOpen(false)} disabled={submitting}>
              Batal
            </button>
            <button type="submit" form="create-staff-form" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Menyimpan...' : 'Buat Akun'}
            </button>
          </>
        }
      >
        <form id="create-staff-form" onSubmit={handleCreateSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="create-user">
              Username <span style={{ color: 'var(--danger)' }}>*</span>
            </label>
            <input
              id="create-user"
              type="text"
              className="form-control"
              placeholder="Contoh: kasir1"
              value={createUsername}
              onChange={(e) => setCreateUsername(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="create-name">
              Nama Tampilan (Kasir)
            </label>
            <input
              id="create-name"
              type="text"
              className="form-control"
              placeholder="Contoh: Yoga / Nurdian"
              value={createDisplayName}
              onChange={(e) => setCreateDisplayName(e.target.value)}
            />
            <small style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
              Nama ini akan dicetak pada struk belanja dan riwayat transaksi.
            </small>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="create-pwd">
              Password Awal <span style={{ color: 'var(--danger)' }}>*</span>
            </label>
            <input
              id="create-pwd"
              type="password"
              className="form-control"
              placeholder="Minimal 6 karakter"
              value={createPassword}
              onChange={(e) => setCreatePassword(e.target.value)}
              required
            />
          </div>
        </form>
      </Modal>

      {/* Modal Edit Nama Karyawan */}
      <Modal
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        title={`Edit Data Kasir: @${selectedStaff?.username}`}
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setIsEditOpen(false)} disabled={submitting}>
              Batal
            </button>
            <button type="submit" form="edit-staff-form" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Menyimpan...' : 'Simpan Perubahan'}
            </button>
          </>
        }
      >
        <form id="edit-staff-form" onSubmit={handleEditSubmit}>
          <div className="form-group">
            <label className="form-label">Username</label>
            <input type="text" className="form-control" value={selectedStaff?.username || ''} disabled style={{ backgroundColor: 'var(--bg-subtle)' }} />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="edit-name">
              Nama Tampilan / Kasir <span style={{ color: 'var(--danger)' }}>*</span>
            </label>
            <input
              id="edit-name"
              type="text"
              className="form-control"
              value={editDisplayName}
              onChange={(e) => setEditDisplayName(e.target.value)}
              required
              autoFocus
            />
          </div>
        </form>
      </Modal>

      {/* Modal Reset Password */}
      <Modal
        isOpen={isResetOpen}
        onClose={() => setIsResetOpen(false)}
        title={`Reset Password: ${selectedStaff?.display_name || selectedStaff?.username}`}
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setIsResetOpen(false)} disabled={submitting}>
              Batal
            </button>
            <button type="submit" form="reset-pwd-form" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Menyimpan...' : 'Reset Password'}
            </button>
          </>
        }
      >
        <form id="reset-pwd-form" onSubmit={handleResetSubmit}>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
            Karyawan tidak dapat mengubah password secara mandiri. Masukkan password baru untuk akun ini:
          </p>
          <div className="form-group">
            <label className="form-label" htmlFor="reset-new-pwd">
              Password Baru (min. 6 karakter) <span style={{ color: 'var(--danger)' }}>*</span>
            </label>
            <input
              id="reset-new-pwd"
              type="password"
              className="form-control"
              placeholder="Masukkan password baru"
              value={resetPassword}
              onChange={(e) => setResetPassword(e.target.value)}
              required
              autoFocus
            />
          </div>
        </form>
      </Modal>

      {/* Modal Konfirmasi Hapus */}
      <Modal
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        title="Hapus Akun Karyawan"
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setIsDeleteOpen(false)} disabled={submitting}>
              Batal
            </button>
            <button type="button" className="btn btn-danger" onClick={handleDeleteConfirm} disabled={submitting}>
              {submitting ? 'Menghapus...' : 'Ya, Hapus Akun'}
            </button>
          </>
        }
      >
        <div style={{ padding: '8px 0' }}>
          <p style={{ marginBottom: '12px', color: 'var(--text-main)' }}>
            Apakah Anda yakin ingin menghapus akun karyawan <strong>{selectedStaff?.display_name || selectedStaff?.username}</strong>?
          </p>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            Akun ini tidak akan dapat login lagi. Riwayat transaksi sebelumnya yang dibuat oleh karyawan ini tetap tersimpan aman di database.
          </p>
        </div>
      </Modal>
    </div>
  );
};
