import React, { useEffect, useState } from 'react';
import * as ProductService from '../../bindings/farizamart/services/productservice';
import { Product } from '../../bindings/farizamart/models/models';
import { Plus, Search, Edit, Trash2, RefreshCw, AlertCircle } from '../components/Icons';
import { Modal } from '../components/Modal';
import { useToast } from '../components/Toast';

export const ProductsView: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('active');

  // Modals state
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);

  // Form fields
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState('');
  const [formSellPrice, setFormSellPrice] = useState<number | ''>('');
  const [formCostPrice, setFormCostPrice] = useState<number | ''>('');
  const [formStock, setFormStock] = useState<number | ''>('');
  const [formUnit, setFormUnit] = useState('pcs');
  const [formIsActive, setFormIsActive] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const { showToast } = useToast();

  const loadData = async () => {
    setLoading(true);
    try {
      const [prods, cats] = await Promise.all([
        ProductService.GetProducts(searchTerm, selectedCategory, selectedStatus),
        ProductService.GetCategories(),
      ]);
      setProducts(prods || []);
      setCategories(cats || []);
    } catch (err: any) {
      showToast(err?.message || 'Gagal memuat produk', 'danger');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      loadData();
    }, 250);
    return () => clearTimeout(delayDebounce);
  }, [searchTerm, selectedCategory, selectedStatus]);

  const openCreateModal = () => {
    setEditingProduct(null);
    setFormName('');
    setFormCategory('');
    setFormSellPrice('');
    setFormCostPrice('');
    setFormStock('');
    setFormUnit('pcs');
    setFormIsActive(true);
    setIsFormModalOpen(true);
  };

  const openEditModal = (prod: Product) => {
    setEditingProduct(prod);
    setFormName(prod.name);
    setFormCategory(prod.category || '');
    setFormSellPrice(prod.sell_price);
    setFormCostPrice(prod.cost_price || '');
    setFormStock(prod.stock);
    setFormUnit(prod.unit || 'pcs');
    setFormIsActive(prod.is_active);
    setIsFormModalOpen(true);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      showToast('Nama produk wajib diisi', 'warning');
      return;
    }
    if (!formSellPrice || Number(formSellPrice) <= 0) {
      showToast('Harga jual harus lebih dari 0', 'warning');
      return;
    }
    if (formStock === '' || Number(formStock) < 0) {
      showToast('Stok tidak boleh negatif', 'warning');
      return;
    }

    setSubmitting(true);
    try {
      const payload: Product = {
        id: editingProduct ? editingProduct.id : 0,
        name: formName.trim(),
        category: formCategory.trim(),
        sell_price: Number(formSellPrice),
        cost_price: Number(formCostPrice) || 0,
        stock: Number(formStock),
        unit: formUnit.trim() || 'pcs',
        is_active: formIsActive,
        created_at: editingProduct ? editingProduct.created_at : '',
        updated_at: '',
      };

      if (editingProduct) {
        await ProductService.UpdateProduct(payload);
        showToast(`Produk "${payload.name}" berhasil diperbarui`, 'success');
      } else {
        await ProductService.CreateProduct(payload);
        showToast(`Produk "${payload.name}" berhasil ditambahkan`, 'success');
      }

      setIsFormModalOpen(false);
      loadData();
    } catch (err: any) {
      showToast(err?.message || 'Gagal menyimpan produk', 'danger');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteProduct = async () => {
    if (!productToDelete) return;
    setSubmitting(true);
    try {
      await ProductService.DeleteProduct(productToDelete.id);
      showToast(`Produk "${productToDelete.name}" telah dinonaktifkan`, 'success');
      setIsDeleteModalOpen(false);
      setProductToDelete(null);
      loadData();
    } catch (err: any) {
      showToast(err?.message || 'Gagal menghapus produk', 'danger');
    } finally {
      setSubmitting(false);
    }
  };

  const formatRupiah = (val: number) => {
    return 'Rp ' + Math.round(val).toLocaleString('id-ID');
  };

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
            Katalog & Manajemen Produk
          </h2>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            Kelola inventaris barang toko Fariza Mart, harga jual, dan persediaan stok.
          </p>
        </div>

        <button className="btn btn-primary" onClick={openCreateModal}>
          <Plus size={18} />
          <span>Tambah Produk Baru</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="card" style={{ padding: '16px 20px' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(220px, 2fr) minmax(160px, 1fr) minmax(140px, 1fr) auto',
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
              placeholder="Cari nama produk..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Category Filter */}
          <div>
            <select
              className="form-control"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
            >
              <option value="">Semua Kategori</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <select
              className="form-control"
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
            >
              <option value="">Semua Status</option>
              <option value="active">Aktif Saja</option>
              <option value="inactive">Nonaktif</option>
            </select>
          </div>

          {/* Refresh Button */}
          <button className="btn btn-secondary btn-sm" onClick={loadData} title="Muat ulang">
            <RefreshCw size={15} />
          </button>
        </div>
      </div>

      {/* Product Table */}
      <div className="table-container">
        <table className="custom-table">
          <thead>
            <tr>
              <th style={{ width: '50px' }}>ID</th>
              <th>Nama Produk</th>
              <th>Kategori</th>
              <th>Harga Jual</th>
              <th>Harga Modal</th>
              <th>Stok</th>
              <th>Satuan</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={9} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                  Memuat data produk...
                </td>
              </tr>
            ) : products.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                  Tidak ada produk yang cocok dengan pencarian / filter.
                </td>
              </tr>
            ) : (
              products.map((p) => {
                const isLowStock = p.stock <= 10;
                return (
                  <tr key={p.id}>
                    <td style={{ color: 'var(--text-light)', fontWeight: 600 }}>#{p.id}</td>
                    <td style={{ fontWeight: 600 }}>{p.name}</td>
                    <td>
                      <span className="badge badge-gray">{p.category || 'Umum'}</span>
                    </td>
                    <td style={{ fontWeight: 600, color: 'var(--primary)' }}>
                      {formatRupiah(p.sell_price)}
                    </td>
                    <td style={{ color: 'var(--text-muted)' }}>
                      {p.cost_price ? formatRupiah(p.cost_price) : '-'}
                    </td>
                    <td>
                      <span
                        className={`badge ${
                          p.stock === 0
                            ? 'badge-danger'
                            : isLowStock
                            ? 'badge-warning'
                            : 'badge-success'
                        }`}
                      >
                        {p.stock === 0 ? 'Habis (0)' : `${p.stock} ${isLowStock ? '⚠️ Menipis' : ''}`}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-muted)' }}>{p.unit || 'pcs'}</td>
                    <td>
                      <span className={`badge ${p.is_active ? 'badge-blue' : 'badge-danger'}`}>
                        {p.is_active ? 'Aktif' : 'Nonaktif'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '6px' }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => openEditModal(p)}
                          title="Edit Produk"
                        >
                          <Edit size={14} />
                          <span>Edit</span>
                        </button>
                        {p.is_active && (
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => {
                              setProductToDelete(p);
                              setIsDeleteModalOpen(true);
                            }}
                            title="Hapus Produk"
                            style={{ color: 'var(--danger)' }}
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Form Modal (Create / Edit) */}
      <Modal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        title={editingProduct ? 'Edit Data Produk' : 'Tambah Produk Baru'}
        footer={
          <>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setIsFormModalOpen(false)}
              disabled={submitting}
            >
              Batal
            </button>
            <button
              type="submit"
              form="product-form"
              className="btn btn-primary"
              disabled={submitting}
            >
              {submitting ? 'Menyimpan...' : editingProduct ? 'Simpan Perubahan' : 'Tambah Produk'}
            </button>
          </>
        }
      >
        <form id="product-form" onSubmit={handleSaveProduct}>
          <div className="form-group">
            <label className="form-label" htmlFor="prod-name">
              Nama Produk <span style={{ color: 'var(--danger)' }}>*</span>
            </label>
            <input
              id="prod-name"
              className="form-control"
              type="text"
              placeholder="Contoh: Minyak Goreng 1L"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="prod-cat">
              Kategori
            </label>
            <input
              id="prod-cat"
              className="form-control"
              type="text"
              placeholder="Contoh: Sembako, Minuman, Snack"
              value={formCategory}
              onChange={(e) => setFormCategory(e.target.value)}
              list="cat-suggestions"
            />
            <datalist id="cat-suggestions">
              {categories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div className="form-group">
              <label className="form-label" htmlFor="prod-sell">
                Harga Jual (Rp) <span style={{ color: 'var(--danger)' }}>*</span>
              </label>
              <input
                id="prod-sell"
                className="form-control"
                type="number"
                min="1"
                placeholder="15000"
                value={formSellPrice}
                onChange={(e) => setFormSellPrice(e.target.value ? Number(e.target.value) : '')}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="prod-cost">
                Harga Modal (Rp) <span style={{ color: 'var(--text-light)' }}>(opsional)</span>
              </label>
              <input
                id="prod-cost"
                className="form-control"
                type="number"
                min="0"
                placeholder="12000"
                value={formCostPrice}
                onChange={(e) => setFormCostPrice(e.target.value ? Number(e.target.value) : '')}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div className="form-group">
              <label className="form-label" htmlFor="prod-stock">
                Jumlah Stok <span style={{ color: 'var(--danger)' }}>*</span>
              </label>
              <input
                id="prod-stock"
                className="form-control"
                type="number"
                min="0"
                placeholder="50"
                value={formStock}
                onChange={(e) => setFormStock(e.target.value ? Number(e.target.value) : '')}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="prod-unit">
                Satuan Barang
              </label>
              <input
                id="prod-unit"
                className="form-control"
                type="text"
                placeholder="pcs, kg, botol, box"
                value={formUnit}
                onChange={(e) => setFormUnit(e.target.value)}
              />
            </div>
          </div>

          {editingProduct && (
            <div className="form-group" style={{ marginTop: '8px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={formIsActive}
                  onChange={(e) => setFormIsActive(e.target.checked)}
                />
                <span className="form-label" style={{ marginBottom: 0 }}>
                  Status Produk Aktif (Bisa dijual di kasir)
                </span>
              </label>
            </div>
          )}
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Konfirmasi Hapus Produk"
        footer={
          <>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setIsDeleteModalOpen(false)}
              disabled={submitting}
            >
              Batal
            </button>
            <button
              type="button"
              className="btn btn-danger"
              onClick={handleDeleteProduct}
              disabled={submitting}
            >
              {submitting ? 'Menonaktifkan...' : 'Ya, Nonaktifkan Produk'}
            </button>
          </>
        }
      >
        <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
          <div style={{ color: 'var(--danger)', marginTop: '2px' }}>
            <AlertCircle size={24} />
          </div>
          <div>
            <p style={{ fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px' }}>
              Apakah Anda yakin ingin menghapus produk "{productToDelete?.name}"?
            </p>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Produk akan dinonaktifkan (soft-delete) agar riwayat transaksi sebelumnya tetap aman dan
              tidak rusak. Produk ini tidak akan muncul lagi di halaman kasir.
            </p>
          </div>
        </div>
      </Modal>
    </div>
  );
};
