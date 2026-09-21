import React, { useState, useEffect, useCallback } from 'react';
import * as StockWithdrawalService from '../../bindings/farizamart/services/stockwithdrawalservice';
import * as ProductService from '../../bindings/farizamart/services/productservice';
import { StockWithdrawal, Product, CreateWithdrawalRequest } from '../../bindings/farizamart/models/models';
import { Plus, Search, Calendar, RefreshCw, AlertCircle, User, Check } from '../components/Icons';
import { Modal } from '../components/Modal';
import { useToast } from '../components/Toast';

export const StockWithdrawalView: React.FC = () => {
  const [withdrawals, setWithdrawals] = useState<StockWithdrawal[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Create Modal
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<number>(0);
  const [qty, setQty] = useState<number>(1);
  const [reason, setReason] = useState<string>('');

  const { showToast } = useToast();

  const loadProducts = useCallback(async () => {
    try {
      const prods = await ProductService.GetProducts('', '', 'active');
      setProducts(prods || []);
    } catch (err: any) {
      console.error('Failed to load products:', err);
    }
  }, []);

  const loadWithdrawals = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await StockWithdrawalService.GetWithdrawals(startDate, endDate);
      setWithdrawals(list || []);
    } catch (err: any) {
      setError(err?.message || 'Gagal memuat data pengambilan stok');
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  useEffect(() => {
    loadWithdrawals();
  }, [loadWithdrawals]);

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

  const clearFilters = () => {
    setStartDate('');
    setEndDate('');
    setSearchTerm('');
  };

  const selectedProduct = products.find((p) => p.id === selectedProductId);

  const handleOpenCreate = () => {
    setSelectedProductId(0);
    setQty(1);
    setReason('');
    loadProducts();
    setIsCreateOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductId) {
      showToast('Silakan pilih produk yang diambil', 'warning');
      return;
    }
    if (qty <= 0) {
      showToast('Jumlah pengambilan harus lebih dari 0', 'warning');
      return;
    }
    if (selectedProduct && qty > selectedProduct.stock) {
      showToast(`Stok tidak mencukupi (tersedia: ${selectedProduct.stock})`, 'warning');
      return;
    }

    setSubmitting(true);
    try {
      const req: CreateWithdrawalRequest = {
        product_id: selectedProductId,
        qty: qty,
        reason: reason.trim(),
      };
      await StockWithdrawalService.CreateWithdrawal(req);
      showToast('Pengambilan stok berhasil dicatat!', 'success');
      setIsCreateOpen(false);
      loadProducts();
      loadWithdrawals();
    } catch (err: any) {
      showToast(err?.message || 'Gagal mencatat pengambilan stok', 'danger');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredWithdrawals = withdrawals.filter((w) => {
    const q = searchTerm.toLowerCase();
    return (
      w.product_name.toLowerCase().includes(q) ||
      (w.reason || '').toLowerCase().includes(q) ||
      (w.withdrawn_by_name || '').toLowerCase().includes(q)
    );
  });

  const totalQtyWithdrawn = filteredWithdrawals.reduce((sum, w) => sum + w.qty, 0);

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
            Pengambilan Stok (Owner / Toko)
          </h2>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            Pencatatan produk toko yang diambil untuk konsumsi pribadi owner atau keperluan operasional toko.
          </p>
        </div>

        <button className="btn btn-primary" onClick={handleOpenCreate}>
          <Plus size={18} />
          <span>Catat Pengambilan Stok</span>
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
            gridTemplateColumns: 'minmax(220px, 2fr) minmax(140px, 1fr) minmax(140px, 1fr) auto',
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
              placeholder="Cari nama produk, keterangan, atau pencatat..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Start Date */}
          <div>
            <input
              className="form-control"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              title="Dari Tanggal"
            />
          </div>

          {/* End Date */}
          <div>
            <input
              className="form-control"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              title="Sampai Tanggal"
            />
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-secondary btn-sm" onClick={setFilterToday} title="Filter Hari Ini">
              Hari Ini
            </button>
            <button className="btn btn-secondary btn-sm" onClick={setFilterThisMonth} title="Filter Bulan Ini">
              Bulan Ini
            </button>
            {(startDate || endDate || searchTerm) && (
              <button className="btn btn-ghost btn-sm" onClick={clearFilters} title="Reset Filter">
                Reset
              </button>
            )}
            <button className="btn btn-secondary btn-sm" onClick={loadWithdrawals} disabled={loading} title="Muat ulang">
              <RefreshCw size={15} />
            </button>
          </div>
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
          Menampilkan <strong>{filteredWithdrawals.length}</strong> catatan pengambilan stok
        </span>
        <span>
          Total Barang Keluar:{' '}
          <strong style={{ color: 'var(--danger)', fontSize: '0.95rem' }}>
            -{totalQtyWithdrawn} item
          </strong>
        </span>
      </div>

      {/* Table Container */}
      <div className="table-container">
        <table className="custom-table">
          <thead>
            <tr>
              <th style={{ width: '50px' }}>No</th>
              <th style={{ width: '180px' }}>Tanggal & Waktu</th>
              <th>Nama Produk</th>
              <th style={{ width: '120px', textAlign: 'center' }}>Jumlah Diambil</th>
              <th>Alasan / Keterangan</th>
              <th style={{ width: '170px' }}>Dicatat Oleh</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                  Memuat riwayat pengambilan stok...
                </td>
              </tr>
            ) : filteredWithdrawals.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                  {searchTerm || startDate || endDate
                    ? 'Tidak ada riwayat pengambilan yang cocok dengan filter.'
                    : 'Belum ada riwayat pengambilan stok. Klik "Catat Pengambilan Stok" untuk menambahkan.'}
                </td>
              </tr>
            ) : (
              filteredWithdrawals.map((w, idx) => (
                <tr key={w.id}>
                  <td style={{ color: 'var(--text-light)', fontWeight: 600 }}>#{idx + 1}</td>
                  <td style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Calendar size={13} style={{ color: 'var(--text-light)' }} />
                      <span>{w.created_at}</span>
                    </div>
                  </td>
                  <td style={{ fontWeight: 600 }}>{w.product_name}</td>
                  <td style={{ textAlign: 'center' }}>
                    <span className="badge badge-danger" style={{ fontWeight: 700 }}>
                      -{w.qty}
                    </span>
                  </td>
                  <td>
                    {w.reason ? (
                      <span>{w.reason}</span>
                    ) : (
                      <span style={{ color: 'var(--text-light)', fontStyle: 'italic' }}>Tanpa keterangan</span>
                    )}
                  </td>
                  <td>
                    <span className="badge badge-blue">
                      <User size={12} />
                      {w.withdrawn_by_name}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Catat Pengambilan Stok */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Catat Pengambilan Stok Produk"
        footer={
          <>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setIsCreateOpen(false)}
              disabled={submitting}
            >
              Batal
            </button>
            <button
              type="submit"
              form="create-withdrawal-form"
              className="btn btn-primary"
              disabled={submitting || !selectedProductId || (selectedProduct ? selectedProduct.stock <= 0 : true)}
            >
              <Check size={18} />
              <span>{submitting ? 'Menyimpan...' : 'Simpan Pengambilan'}</span>
            </button>
          </>
        }
      >
        <form id="create-withdrawal-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="modal-select-product">
              Pilih Produk Toko <span style={{ color: 'var(--danger)' }}>*</span>
            </label>
            <select
              id="modal-select-product"
              className="form-control"
              value={selectedProductId}
              onChange={(e) => {
                setSelectedProductId(Number(e.target.value));
                setQty(1);
              }}
              required
              autoFocus
            >
              <option value={0}>-- Pilih Produk --</option>
              {products.map((p) => (
                <option key={p.id} value={p.id} disabled={p.stock <= 0}>
                  {p.name} {p.stock <= 0 ? '(Stok Habis)' : `(Tersedia: ${p.stock} ${p.unit})`}
                </option>
              ))}
            </select>
          </div>

          {selectedProduct && (
            <div
              style={{
                padding: '12px 16px',
                backgroundColor: 'var(--bg-subtle)',
                borderRadius: 'var(--radius-md)',
                marginBottom: '16px',
                fontSize: '0.85rem',
                border: '1px solid var(--border)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Stok Saat Ini:</span>
                <span
                  style={{
                    fontWeight: 700,
                    color: selectedProduct.stock > 0 ? 'var(--primary)' : 'var(--danger)',
                  }}
                >
                  {selectedProduct.stock} {selectedProduct.unit || 'pcs'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Kategori Produk:</span>
                <span style={{ fontWeight: 600 }}>{selectedProduct.category || 'Umum'}</span>
              </div>
            </div>
          )}

          <div className="form-group">
            <label className="form-label" htmlFor="modal-withdraw-qty">
              Jumlah Diambil <span style={{ color: 'var(--danger)' }}>*</span>
            </label>
            <input
              id="modal-withdraw-qty"
              type="number"
              min="1"
              max={selectedProduct ? selectedProduct.stock : undefined}
              className="form-control"
              value={qty}
              onChange={(e) => setQty(Math.max(1, parseInt(e.target.value) || 1))}
              required
            />
            {selectedProduct && selectedProduct.stock > 0 && (
              <small style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                Maksimal: {selectedProduct.stock} {selectedProduct.unit || 'pcs'}
              </small>
            )}
          </div>

          <div className="form-group" style={{ marginBottom: '8px' }}>
            <label className="form-label" htmlFor="modal-withdraw-reason">
              Alasan / Keterangan Pengambilan
            </label>
            <textarea
              id="modal-withdraw-reason"
              className="form-control"
              rows={3}
              placeholder="Contoh: Diambil owner untuk konsumsi pribadi"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
        </form>
      </Modal>
    </div>
  );
};
