import React, { useEffect, useState, useCallback } from 'react';
import * as TransactionService from '../../bindings/farizamart/services/transactionservice';
import * as EmployeeService from '../../bindings/farizamart/services/employeeservice';
import { Transaction, UserSession } from '../../bindings/farizamart/models/models';
import {
  User,
  RefreshCw,
  Eye,
  ShieldAlert,
  AlertCircle,
} from '../components/Icons';
import { Modal } from '../components/Modal';
import { useToast } from '../components/Toast';

interface HistoryViewProps {
  currentUser: UserSession | null;
}

export const HistoryView: React.FC<HistoryViewProps> = ({ currentUser }) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [usersFilterList, setUsersFilterList] = useState<UserSession[]>([]);
  const [loading, setLoading] = useState(true);

  const isAdmin = currentUser?.role === 'admin';
  const myName = currentUser?.display_name || currentUser?.username || '';

  // Filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedUserFilter, setSelectedUserFilter] = useState('');

  // Modals
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isVoidModalOpen, setIsVoidModalOpen] = useState(false);
  const [voidReason, setVoidReason] = useState('');
  const [submittingVoid, setSubmittingVoid] = useState(false);

  const { showToast } = useToast();

  const loadFilterUsers = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const list = await EmployeeService.GetAllUsersForFilter();
      setUsersFilterList(list || []);
    } catch (err: any) {
      console.error('Failed to load user filter options:', err);
    }
  }, [isAdmin]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // If employee, force filter to their own name
      const effectiveUserFilter = isAdmin ? selectedUserFilter : myName;
      const txs = await TransactionService.GetTransactions(startDate, endDate, effectiveUserFilter);
      setTransactions(txs || []);
    } catch (err: any) {
      showToast(err?.message || 'Gagal memuat riwayat transaksi', 'danger');
    } finally {
      setLoading(false);
    }
  }, [isAdmin, selectedUserFilter, myName, startDate, endDate, showToast]);

  useEffect(() => {
    loadFilterUsers();
  }, [loadFilterUsers]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const getTodayLocalDate = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const setFilterToday = () => {
    const today = getTodayLocalDate();
    setStartDate(today);
    setEndDate(today);
  };

  const setFilterThisMonth = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const firstDay = `${year}-${month}-01`;
    const lastDayNum = new Date(year, now.getMonth() + 1, 0).getDate();
    const lastDay = `${year}-${month}-${String(lastDayNum).padStart(2, '0')}`;
    setStartDate(firstDay);
    setEndDate(lastDay);
  };

  const clearDateFilters = () => {
    setStartDate('');
    setEndDate('');
    setSelectedUserFilter('');
  };

  const openDetail = async (id: number) => {
    try {
      const tx = await TransactionService.GetTransactionByID(id);
      setSelectedTx(tx);
      setIsDetailModalOpen(true);
    } catch (err: any) {
      showToast(err?.message || 'Gagal memuat detail transaksi', 'danger');
    }
  };

  const handleVoid = async () => {
    if (!selectedTx) return;
    if (!voidReason.trim()) {
      showToast('Alasan pembatalan wajib diisi', 'warning');
      return;
    }

    setSubmittingVoid(true);
    try {
      await TransactionService.VoidTransaction(selectedTx.id, voidReason.trim());
      showToast(`Transaksi ${selectedTx.transaction_code} berhasil dibatalkan & stok dikembalikan`, 'success');
      setIsVoidModalOpen(false);
      setIsDetailModalOpen(false);
      setVoidReason('');
      loadData();
    } catch (err: any) {
      showToast(err?.message || 'Gagal membatalkan transaksi', 'danger');
    } finally {
      setSubmittingVoid(false);
    }
  };

  const formatRupiah = (val: number) => {
    return 'Rp ' + Math.round(val).toLocaleString('id-ID');
  };

  const totalFilteredAmount = transactions
    .filter((t) => !t.is_void)
    .reduce((sum, t) => sum + t.total_amount, 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Page Header */}
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
            Riwayat Transaksi Penjualan
          </h2>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            {isAdmin
              ? 'Daftar seluruh transaksi yang pernah dilakukan di Fariza Mart.'
              : 'Daftar transaksi kasir yang Anda layani.'}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-secondary btn-sm" onClick={setFilterToday}>
            Hari Ini
          </button>
          <button className="btn btn-secondary btn-sm" onClick={setFilterThisMonth}>
            Bulan Ini
          </button>
          <button className="btn btn-ghost btn-sm" onClick={clearDateFilters}>
            Reset Filter
          </button>
        </div>
      </div>

      {/* Filter Bar Card */}
      <div className="card" style={{ padding: '16px 20px' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: isAdmin
              ? 'repeat(auto-fit, minmax(180px, 1fr)) auto'
              : 'repeat(auto-fit, minmax(180px, 1fr)) auto',
            gap: '14px',
            alignItems: 'flex-end',
          }}
        >
          {/* Start Date */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" style={{ fontSize: '0.78rem' }}>
              Dari Tanggal
            </label>
            <input
              className="form-control"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>

          {/* End Date */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" style={{ fontSize: '0.78rem' }}>
              Sampai Tanggal
            </label>
            <input
              className="form-control"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>

          {/* Employee Filter - Admin Only */}
          {isAdmin ? (
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontSize: '0.78rem' }}>
                Karyawan / Kasir
              </label>
              <select
                className="form-control"
                value={selectedUserFilter}
                onChange={(e) => setSelectedUserFilter(e.target.value)}
              >
                <option value="">Semua Kasir</option>
                {usersFilterList.map((u) => {
                  const label = u.display_name || u.username;
                  return (
                    <option key={u.id} value={label}>
                      {label} ({u.role === 'admin' ? 'Admin' : 'Karyawan'})
                    </option>
                  );
                })}
              </select>
            </div>
          ) : (
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontSize: '0.78rem' }}>
                Kasir
              </label>
              <input
                className="form-control"
                type="text"
                value={myName}
                disabled
                style={{ backgroundColor: 'var(--bg-subtle)' }}
              />
            </div>
          )}

          {/* Refresh Button */}
          <button className="btn btn-secondary" onClick={loadData} title="Refresh">
            <RefreshCw size={16} />
            <span>Muat Ulang</span>
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
          Menampilkan <strong>{transactions.length}</strong> transaksi
        </span>
        <span>
          Total Omzet Valid:{' '}
          <strong style={{ color: 'var(--primary)', fontSize: '1rem' }}>
            {formatRupiah(totalFilteredAmount)}
          </strong>
        </span>
      </div>

      {/* Transactions Table */}
      <div className="table-container">
        <table className="custom-table">
          <thead>
            <tr>
              <th>Kode Transaksi</th>
              <th>Tanggal & Waktu</th>
              <th>Kasir</th>
              <th>Metode Bayar</th>
              <th>Total Transaksi</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                  Memuat riwayat transaksi...
                </td>
              </tr>
            ) : transactions.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                  Tidak ada transaksi yang ditemukan untuk filter yang dipilih.
                </td>
              </tr>
            ) : (
              transactions.map((tx) => (
                <tr key={tx.id} style={{ opacity: tx.is_void ? 0.65 : 1 }}>
                  <td style={{ fontWeight: 700, fontFamily: 'monospace' }}>
                    {tx.transaction_code}
                  </td>
                  <td>{new Date(tx.created_at).toLocaleString('id-ID')}</td>
                  <td>
                    <span className="badge badge-blue">
                      <User size={12} />
                      {tx.employee_name}
                    </span>
                  </td>
                  <td>
                    <span className="badge badge-gray">{tx.payment_method || 'Tunai'}</span>
                  </td>
                  <td style={{ fontWeight: 700, color: tx.is_void ? 'var(--text-muted)' : 'var(--primary)' }}>
                    {formatRupiah(tx.total_amount)}
                  </td>
                  <td>
                    {tx.is_void ? (
                      <span className="badge badge-danger" title={`Alasan: ${tx.void_reason}`}>
                        Dibatalkan (Void)
                      </span>
                    ) : (
                      <span className="badge badge-success">Sukses</span>
                    )}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => openDetail(tx.id)}
                    >
                      <Eye size={14} />
                      <span>Rincian</span>
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Detail Transaction Modal */}
      <Modal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        title={`Rincian Transaksi - ${selectedTx?.transaction_code}`}
        size="lg"
        footer={
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
            <div>
              {selectedTx && !selectedTx.is_void && (
                <button
                  className="btn btn-danger"
                  onClick={() => setIsVoidModalOpen(true)}
                >
                  <ShieldAlert size={16} />
                  <span>Batalkan Transaksi (Void)</span>
                </button>
              )}
            </div>
            <button className="btn btn-secondary" onClick={() => setIsDetailModalOpen(false)}>
              Tutup
            </button>
          </div>
        }
      >
        {selectedTx && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {selectedTx.is_void && (
              <div
                style={{
                  padding: '12px 16px',
                  backgroundColor: 'var(--danger-bg)',
                  border: '1px solid var(--danger-border)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--danger)',
                  fontSize: '0.88rem',
                }}
              >
                <strong>⚠️ Transaksi ini telah dibatalkan (VOID):</strong>
                <div style={{ marginTop: '4px' }}>Alasan: {selectedTx.void_reason}</div>
              </div>
            )}

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: '12px',
                padding: '12px',
                backgroundColor: 'var(--bg-subtle)',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.82rem',
              }}
            >
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Kasir:</span>
                <div style={{ fontWeight: 700 }}>{selectedTx.employee_name}</div>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Waktu:</span>
                <div style={{ fontWeight: 600 }}>
                  {new Date(selectedTx.created_at).toLocaleString('id-ID')}
                </div>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Metode Bayar:</span>
                <div style={{ fontWeight: 600 }}>{selectedTx.payment_method}</div>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Total:</span>
                <div style={{ fontWeight: 800, color: 'var(--primary)', fontSize: '0.95rem' }}>
                  {formatRupiah(selectedTx.total_amount)}
                </div>
              </div>
            </div>

            {selectedTx.note && (
              <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                <strong>Catatan:</strong> {selectedTx.note}
              </div>
            )}

            <h4 style={{ fontSize: '0.92rem', fontWeight: 700, marginTop: '8px' }}>
              Daftar Barang yang Dibeli
            </h4>

            <div className="table-container">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Nama Barang</th>
                    <th>Harga Satuan</th>
                    <th style={{ textAlign: 'center' }}>Qty</th>
                    <th style={{ textAlign: 'right' }}>Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedTx.items?.map((item) => (
                    <tr key={item.id}>
                      <td style={{ fontWeight: 600 }}>{item.product_name}</td>
                      <td>{formatRupiah(item.unit_price)}</td>
                      <td style={{ textAlign: 'center', fontWeight: 600 }}>{item.qty}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--primary)' }}>
                        {formatRupiah(item.subtotal)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Modal>

      {/* Void Modal */}
      <Modal
        isOpen={isVoidModalOpen}
        onClose={() => setIsVoidModalOpen(false)}
        title={`Batalkan Transaksi ${selectedTx?.transaction_code}`}
        footer={
          <>
            <button
              className="btn btn-secondary"
              onClick={() => setIsVoidModalOpen(false)}
              disabled={submittingVoid}
            >
              Kembali
            </button>
            <button
              className="btn btn-danger"
              onClick={handleVoid}
              disabled={submittingVoid || !voidReason.trim()}
            >
              {submittingVoid ? 'Memproses...' : 'Konfirmasi Batalkan (Void)'}
            </button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
            <div style={{ color: 'var(--danger)', marginTop: '2px' }}>
              <AlertCircle size={24} />
            </div>
            <div>
              <p style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                Apakah Anda yakin ingin membatalkan transaksi ini?
              </p>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                Seluruh barang dalam transaksi ini akan otomatis dikembalikan ke stok inventaris toko.
                Transaksi yang telah dibatalkan tidak akan dihitung dalam laporan omzet.
              </p>
            </div>
          </div>

          <div className="form-group" style={{ marginTop: '8px' }}>
            <label className="form-label" htmlFor="void-reason">
              Alasan Pembatalan <span style={{ color: 'var(--danger)' }}>*</span>
            </label>
            <textarea
              id="void-reason"
              className="form-control"
              rows={3}
              placeholder="Contoh: Pembeli keliru memilih varian / salah input transaksi"
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
              required
            />
          </div>
        </div>
      </Modal>
    </div>
  );
};
