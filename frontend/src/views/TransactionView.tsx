import React, { useEffect, useState } from 'react';
import * as ProductService from '../../bindings/farizamart/services/productservice';
import * as TransactionService from '../../bindings/farizamart/services/transactionservice';
import { Product, Transaction, CreateTransactionRequest, UserSession } from '../../bindings/farizamart/models/models';
import {
  Plus,
  Search,
  ShoppingCart,
  Trash2,
  Printer,
  User,
} from '../components/Icons';
import { Modal } from '../components/Modal';
import { useToast } from '../components/Toast';

interface CartItemState {
  product: Product;
  qty: number;
}

interface TransactionViewProps {
  currentUser: UserSession | null;
}

export const TransactionView: React.FC<TransactionViewProps> = ({ currentUser }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');

  // Cart State
  const [cart, setCart] = useState<CartItemState[]>([]);
  const [paymentMethod, setPaymentMethod] = useState('Tunai');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Success Receipt Modal
  const [completedTx, setCompletedTx] = useState<Transaction | null>(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  // Thermal paper width: 80mm default (also supports 58mm portable printers)
  const [receiptWidth, setReceiptWidth] = useState<'80mm' | '58mm'>('80mm');

  const { showToast } = useToast();

  const loadData = async () => {
    setLoading(true);
    try {
      const [prods, cats] = await Promise.all([
        ProductService.GetProducts('', '', 'active'),
        ProductService.GetCategories(),
      ]);
      setProducts(prods || []);
      setCategories(cats || []);
    } catch (err: any) {
      showToast(err?.message || 'Gagal memuat data kasir', 'danger');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const addToCart = (product: Product) => {
    if (product.stock <= 0) {
      showToast(`Stok "${product.name}" habis`, 'warning');
      return;
    }

    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        if (existing.qty >= product.stock) {
          showToast(`Stok maksimal "${product.name}" tercapai (${product.stock})`, 'warning');
          return prev;
        }
        return prev.map((item) =>
          item.product.id === product.id ? { ...item, qty: item.qty + 1 } : item
        );
      } else {
        return [...prev, { product, qty: 1 }];
      }
    });
  };

  const updateCartQty = (productId: number, newQty: number) => {
    if (newQty <= 0) {
      removeFromCart(productId);
      return;
    }

    setCart((prev) =>
      prev.map((item) => {
        if (item.product.id === productId) {
          if (newQty > item.product.stock) {
            showToast(`Stok maksimal "${item.product.name}" adalah ${item.product.stock}`, 'warning');
            return { ...item, qty: item.product.stock };
          }
          return { ...item, qty: newQty };
        }
        return item;
      })
    );
  };

  const removeFromCart = (productId: number) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const clearCart = () => {
    setCart([]);
    setNote('');
  };

  const totalAmount = cart.reduce(
    (sum, item) => sum + item.product.sell_price * item.qty,
    0
  );

  const totalItemsCount = cart.reduce((sum, item) => sum + item.qty, 0);

  const handleCheckout = async () => {
    if (cart.length === 0) {
      showToast('Keranjang belanja masih kosong', 'warning');
      return;
    }

    setSubmitting(true);
    try {
      const req: CreateTransactionRequest = {
        payment_method: paymentMethod,
        note: note.trim(),
        items: cart.map((item) => ({
          product_id: item.product.id,
          qty: item.qty,
        })),
      };

      const result = await TransactionService.CreateTransaction(req);
      setCompletedTx(result);
      setIsReceiptModalOpen(true);
      showToast(`Transaksi ${result.transaction_code} berhasil disimpan!`, 'success');
      clearCart();
      // Reload products to update stock in catalog
      loadData();
    } catch (err: any) {
      showToast(err?.message || 'Gagal menyimpan transaksi', 'danger');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredProducts = products.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCat = !selectedCategory || p.category === selectedCategory;
    return matchesSearch && matchesCat;
  });

  const formatRupiah = (val: number) => {
    return 'Rp ' + Math.round(val).toLocaleString('id-ID');
  };

  const handlePrintReceipt = () => {
    // Tag body so @media print CSS only shows the thermal receipt.
    // Thermal printers: use 80mm default, 58mm for portable printers.
    const cls = receiptWidth === '58mm' ? 'printing-receipt-58mm' : 'printing-receipt-80mm';
    document.body.classList.add('printing-receipt', cls);
    // Give the browser a tick to apply print CSS, then print.
    setTimeout(() => {
      window.print();
      setTimeout(() => {
        document.body.classList.remove('printing-receipt', cls);
      }, 500);
    }, 50);
  };

  const cashierName = currentUser?.display_name || currentUser?.username || 'Kasir';

  return (
    <div className="pos-layout">
      {/* Left Panel: Product Catalog */}
      <div className="pos-catalog">
        <div className="catalog-filter-bar">
          {/* Search Box */}
          <div style={{ position: 'relative', flex: 1 }}>
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
              placeholder="Cari produk untuk kasir..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Category Pills */}
        <div className="category-pills">
          <button
            className={`cat-pill ${selectedCategory === '' ? 'active' : ''}`}
            onClick={() => setSelectedCategory('')}
          >
            Semua Produk
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              className={`cat-pill ${selectedCategory === cat ? 'active' : ''}`}
              onClick={() => setSelectedCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Product Cards Grid */}
        <div className="pos-product-grid">
          {loading ? (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
              Memuat katalog kasir...
            </div>
          ) : filteredProducts.length === 0 ? (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
              Tidak ada produk aktif yang ditemukan.
            </div>
          ) : (
            filteredProducts.map((p) => {
              const inCartItem = cart.find((item) => item.product.id === p.id);
              const remainingStock = p.stock - (inCartItem ? inCartItem.qty : 0);
              const isOutOfStock = remainingStock <= 0;

              return (
                <div
                  key={p.id}
                  className={`pos-product-card ${isOutOfStock ? 'out-of-stock' : ''}`}
                  onClick={() => !isOutOfStock && addToCart(p)}
                  title={p.name}
                >
                  <div className="pos-card-top">
                    <div className="pos-card-name">{p.name}</div>
                    {inCartItem && <span className="pos-card-qty">×{inCartItem.qty}</span>}
                  </div>
                  <div className="pos-card-cat">
                    {p.category || 'Umum'} • Stok: <strong>{remainingStock}</strong> {p.unit || 'pcs'}
                  </div>

                  <div className="pos-card-foot">
                    <div className="pos-card-price">{formatRupiah(p.sell_price)}</div>
                    <span className="pos-card-add">
                      <Plus size={12} />
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Right Panel: Active Cart & Checkout */}
      <div className="pos-cart-panel">
        <div className="cart-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShoppingCart size={19} color="var(--primary)" />
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)' }}>
              Keranjang ({totalItemsCount})
            </h3>
          </div>
          {cart.length > 0 && (
            <button
              className="btn btn-ghost btn-sm"
              onClick={clearCart}
              style={{ color: 'var(--danger)', fontSize: '0.75rem' }}
            >
              Kosongkan
            </button>
          )}
        </div>

        {/* Cart Item List */}
        <div className="cart-items-list">
          {cart.length === 0 ? (
            <div
              style={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-light)',
                gap: '8px',
                padding: '40px 20px',
              }}
            >
              <ShoppingCart size={36} />
              <p style={{ fontSize: '0.88rem' }}>Keranjang masih kosong</p>
              <p style={{ fontSize: '0.75rem', textAlign: 'center' }}>
                Klik produk di katalog kiri untuk menambahkan ke struk
              </p>
            </div>
          ) : (
            cart.map((item) => (
              <div key={item.product.id} className="cart-item">
                <div className="cart-item-meta">
                  <div className="cart-item-title">{item.product.name}</div>
                  <div className="cart-item-price">
                    {formatRupiah(item.product.sell_price)} / {item.product.unit || 'pcs'}
                  </div>
                </div>

                <div className="cart-qty-ctrl">
                  <button
                    className="cart-qty-btn"
                    onClick={() => updateCartQty(item.product.id, item.qty - 1)}
                  >
                    -
                  </button>
                  <span className="cart-qty-num">{item.qty}</span>
                  <button
                    className="cart-qty-btn"
                    onClick={() => updateCartQty(item.product.id, item.qty + 1)}
                  >
                    +
                  </button>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => removeFromCart(item.product.id)}
                    style={{ color: 'var(--danger)', padding: '2px 4px', marginLeft: '4px' }}
                    title="Hapus"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Checkout Form & Summary */}
        <div className="cart-summary">
          {/* Cashier indicator - auto assigned to logged-in user */}
          <div
            style={{
              padding: '8px 12px',
              backgroundColor: 'var(--bg-subtle)',
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '10px',
              fontSize: '0.82rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)' }}>
              <User size={15} style={{ color: 'var(--primary)' }} />
              <span>Kasir:</span>
            </div>
            <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>{cashierName}</span>
          </div>

          {/* Payment Method Selector */}
          <div className="form-group" style={{ marginBottom: '8px' }}>
            <label className="form-label" style={{ fontSize: '0.78rem' }}>
              Metode Pembayaran
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
              {['Tunai', 'Transfer', 'QRIS'].map((method) => (
                <button
                  key={method}
                  type="button"
                  onClick={() => setPaymentMethod(method)}
                  style={{
                    padding: '6px',
                    borderRadius: 'var(--radius-sm)',
                    border: `1px solid ${paymentMethod === method ? 'var(--primary)' : 'var(--border)'}`,
                    backgroundColor: paymentMethod === method ? 'var(--primary-light)' : '#ffffff',
                    color: paymentMethod === method ? 'var(--primary)' : 'var(--text-muted)',
                    fontWeight: paymentMethod === method ? 600 : 500,
                    fontSize: '0.78rem',
                    cursor: 'pointer',
                  }}
                >
                  {method}
                </button>
              ))}
            </div>
          </div>

          {/* Optional Note */}
          <div className="form-group" style={{ marginBottom: '8px' }}>
            <input
              className="form-control"
              style={{ fontSize: '0.8rem', padding: '6px 10px' }}
              type="text"
              placeholder="Catatan transaksi (opsional)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          {/* Total Calculation */}
          <div className="cart-row">
            <span>Jumlah Item</span>
            <span>{totalItemsCount} pcs</span>
          </div>

          <div className="cart-row total">
            <span>Total Bayar</span>
            <span style={{ color: 'var(--primary)' }}>{formatRupiah(totalAmount)}</span>
          </div>

          {/* Checkout Button */}
          <button
            className="btn btn-primary btn-lg"
            style={{ width: '100%', marginTop: '4px' }}
            onClick={handleCheckout}
            disabled={cart.length === 0 || submitting}
          >
            {submitting ? 'Menyimpan Transaksi...' : `Bayar ${formatRupiah(totalAmount)}`}
          </button>
        </div>
      </div>

      {/* Transaction Receipt Modal */}
      <Modal
        isOpen={isReceiptModalOpen}
        onClose={() => setIsReceiptModalOpen(false)}
        title="Struk Penjualan (Thermal)"
        footer={
          <>
            {/* Paper size toggle for thermal printers */}
            <div style={{ display: 'flex', gap: '6px', marginRight: 'auto' }}>
              {(['80mm', '58mm'] as const).map((w) => (
                <button
                  key={w}
                  type="button"
                  onClick={() => setReceiptWidth(w)}
                  style={{
                    padding: '6px 10px',
                    borderRadius: '6px',
                    border: `1px solid ${receiptWidth === w ? 'var(--primary)' : 'var(--border)'}`,
                    backgroundColor: receiptWidth === w ? 'var(--primary-light)' : '#fff',
                    color: receiptWidth === w ? 'var(--primary)' : 'var(--text-muted)',
                    fontSize: '0.75rem',
                    fontWeight: receiptWidth === w ? 700 : 500,
                    cursor: 'pointer',
                  }}
                  title={w === '80mm' ? 'Printer thermal kasir standar' : 'Printer thermal portable'}
                >
                  {w}
                </button>
              ))}
            </div>
            <button className="btn btn-secondary" onClick={handlePrintReceipt}>
              <Printer size={16} />
              <span>Cetak Struk</span>
            </button>
            <button className="btn btn-primary" onClick={() => setIsReceiptModalOpen(false)}>
              Selesai & Transaksi Baru
            </button>
          </>
        }
      >
        {completedTx && (
          <div
            id="printable-receipt"
            className={`thermal-receipt ${receiptWidth === '58mm' ? 'thermal-58' : 'thermal-80'}`}
          >
            <div className="thermal-center thermal-store">FARIZA MART</div>
            <div className="thermal-center thermal-sub">Sistem POS Kasir Offline</div>
            <div className="thermal-divider" />

            <div className="thermal-row">
              <span>No. Nota</span>
              <span className="thermal-bold">{completedTx.transaction_code}</span>
            </div>
            <div className="thermal-row">
              <span>Waktu</span>
              <span>{new Date(completedTx.created_at).toLocaleString('id-ID')}</span>
            </div>
            <div className="thermal-row">
              <span>Kasir</span>
              <span className="thermal-bold">{completedTx.employee_name}</span>
            </div>
            <div className="thermal-row">
              <span>Bayar</span>
              <span>{completedTx.payment_method}</span>
            </div>

            <div className="thermal-divider" />

            <div className="thermal-items">
              {completedTx.items?.map((item) => (
                <div key={item.id} className="thermal-item">
                  <div className="thermal-item-name">{item.product_name}</div>
                  <div className="thermal-item-line">
                    <span>
                      {item.qty} x {formatRupiah(item.unit_price)}
                    </span>
                    <span className="thermal-bold">{formatRupiah(item.subtotal)}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="thermal-divider" />

            <div className="thermal-row thermal-total">
              <span>TOTAL</span>
              <span>{formatRupiah(completedTx.total_amount)}</span>
            </div>

            {completedTx.note && <div className="thermal-note">Catatan: {completedTx.note}</div>}

            <div className="thermal-center thermal-thanks">
              Terima Kasih Telah Berbelanja
              <br />
              di Fariza Mart!
            </div>
            <div className="thermal-center thermal-cut">- - - ✂ - - -</div>
          </div>
        )}
      </Modal>
    </div>
  );
};
