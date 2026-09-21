import React, { useEffect, useState } from 'react';
import * as ReportService from '../../bindings/farizamart/services/reportservice';
import { DailyReportData } from '../../bindings/farizamart/models/models';
import {
  Calendar,
  Download,
  RefreshCw,
  User,
  Check,
  TrendingUp,
  Package,
  Receipt,
} from '../components/Icons';
import { useToast } from '../components/Toast';

const getTodayLocalDate = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const ReportsView: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState<string>(getTodayLocalDate());
  const [reportData, setReportData] = useState<DailyReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const { showToast } = useToast();

  const loadReportData = async () => {
    setLoading(true);
    try {
      const data = await ReportService.GetDailyReportData(selectedDate);
      setReportData(data);
    } catch (err: any) {
      showToast(err?.message || 'Gagal memuat data laporan', 'danger');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReportData();
  }, [selectedDate]);

  const handleDownloadPDF = async () => {
    setDownloading(true);
    try {
      const base64OrRaw = await ReportService.GenerateDailyReport(selectedDate);
      if (!base64OrRaw) {
        throw new Error('Data PDF kosong');
      }

      let blob: Blob;
      try {
        const binaryStr = atob(base64OrRaw);
        const len = binaryStr.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }
        blob = new Blob([bytes], { type: 'application/pdf' });
      } catch {
        const bytes = new Uint8Array(base64OrRaw.length);
        for (let i = 0; i < base64OrRaw.length; i++) {
          bytes[i] = base64OrRaw.charCodeAt(i);
        }
        blob = new Blob([bytes], { type: 'application/pdf' });
      }

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Laporan-FarizaMart-${selectedDate}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      showToast(`Laporan PDF tanggal ${selectedDate} berhasil diunduh!`, 'success');
    } catch (err: any) {
      showToast(err?.message || 'Gagal membuat laporan PDF', 'danger');
    } finally {
      setDownloading(false);
    }
  };

  const formatRupiah = (val: number) => {
    return 'Rp ' + Math.round(val).toLocaleString('id-ID');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header */}
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
            Laporan Penjualan Harian
          </h2>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            Rekap transaksi harian dan export dokumen laporan resmi dalam format PDF.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            className="btn btn-primary"
            onClick={handleDownloadPDF}
            disabled={downloading || loading}
          >
            <Download size={17} />
            <span>{downloading ? 'Membuat PDF...' : 'Download Laporan PDF'}</span>
          </button>
        </div>
      </div>

      {/* Date Picker Bar */}
      <div className="card" style={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Calendar size={18} color="var(--primary)" />
            <label style={{ fontSize: '0.88rem', fontWeight: 600 }}>Pilih Tanggal Laporan:</label>
            <input
              type="date"
              className="form-control"
              style={{ width: 'auto' }}
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
          </div>

          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setSelectedDate(getTodayLocalDate())}
          >
            Hari Ini
          </button>

          <button
            className="btn btn-ghost btn-sm"
            onClick={loadReportData}
            disabled={loading}
            title="Muat Ulang"
          >
            <RefreshCw size={15} />
          </button>
        </div>
      </div>

      {/* Preview Summary Cards */}
      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-icon blue">
            <TrendingUp size={24} />
          </div>
          <div>
            <div className="stat-label">Total Omzet Harian</div>
            <div className="stat-value">
              {loading ? '...' : formatRupiah(reportData?.total_revenue || 0)}
            </div>
            <div className="stat-sub">Tanggal: {selectedDate}</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon green">
            <Check size={24} />
          </div>
          <div>
            <div className="stat-label">Jumlah Transaksi</div>
            <div className="stat-value">
              {loading ? '...' : `${reportData?.total_transactions || 0} struk`}
            </div>
            <div className="stat-sub">Total transaksi berhasil</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon purple">
            <Package size={24} />
          </div>
          <div>
            <div className="stat-label">Total Item Terjual</div>
            <div className="stat-value">
              {loading ? '...' : `${reportData?.total_items_sold || 0} pcs`}
            </div>
            <div className="stat-sub">Barang keluar hari ini</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon amber">
            <Receipt size={24} />
          </div>
          <div>
            <div className="stat-label">Waktu Cetak / Data</div>
            <div className="stat-value" style={{ fontSize: '1.05rem' }}>
              {reportData?.printed_at || '-'}
            </div>
            <div className="stat-sub">Format data resmi</div>
          </div>
        </div>
      </div>

      {/* Stock Report Table */}
      <div className="card">
        <div className="card-header">
          <div>
            <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Package size={18} color="var(--primary)" />
              <span>A. Laporan Stok Barang ({selectedDate})</span>
            </h3>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Daftar stok produk aktif, penjualan hari ini, dan sisa stok saat ini
            </p>
          </div>
        </div>

        <div className="table-container">
          <table className="custom-table">
            <thead>
              <tr>
                <th style={{ width: '50px' }}>No</th>
                <th>Nama Produk</th>
                <th style={{ textAlign: 'center' }}>Satuan</th>
                <th style={{ textAlign: 'center' }}>Terjual Hari Ini</th>
                <th style={{ textAlign: 'center' }}>Stok Saat Ini</th>
              </tr>
            </thead>
            <tbody>
              {!reportData?.stock_report || reportData.stock_report.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                    Tidak ada data produk.
                  </td>
                </tr>
              ) : (
                reportData.stock_report.map((item, idx) => (
                  <tr key={item.product_name}>
                    <td style={{ color: 'var(--text-light)', fontWeight: 600 }}>{idx + 1}</td>
                    <td style={{ fontWeight: 600 }}>{item.product_name}</td>
                    <td style={{ textAlign: 'center', color: 'var(--text-muted)' }}>{item.unit}</td>
                    <td style={{ textAlign: 'center' }}>
                      <span className={`badge ${item.sold_today > 0 ? 'badge-blue' : 'badge-gray'}`}>
                        {item.sold_today}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span className={`badge ${item.current_stock <= 10 ? 'badge-warning' : 'badge-success'}`}>
                        {item.current_stock}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Transactions by Employee Sections */}
      <div>
        <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '14px' }}>
          B. Riwayat Transaksi per Karyawan
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px' }}>
          {reportData?.by_employee?.map((emp) => (
            <div key={emp.employee_name} className="card">
              <div className="card-header" style={{ borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
                <div>
                  <h4 style={{ fontSize: '1.05rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary)' }}>
                    <User size={18} />
                    <span>Transaksi — {emp.employee_name}</span>
                  </h4>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    {emp.transaction_count} transaksi • {emp.items_sold} item terjual
                  </p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Subtotal Omzet:</span>
                  <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--primary)' }}>
                    {formatRupiah(emp.subtotal_amount)}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '14px', maxHeight: '420px', overflowY: 'auto' }}>
                {!emp.transactions || emp.transactions.length === 0 ? (
                  <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-light)', fontSize: '0.85rem' }}>
                    Tidak ada transaksi oleh {emp.employee_name} pada tanggal ini.
                  </div>
                ) : (
                  emp.transactions.map((tx) => (
                    <div
                      key={tx.id}
                      style={{
                        padding: '12px 14px',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-md)',
                        backgroundColor: '#fafbfc',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <span style={{ fontWeight: 700, fontFamily: 'monospace', fontSize: '0.9rem' }}>
                            {tx.transaction_code}
                          </span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '8px' }}>
                            {new Date(tx.created_at).toLocaleTimeString('id-ID')}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span className="badge badge-gray">{tx.payment_method || 'Tunai'}</span>
                          <span style={{ fontWeight: 800, color: 'var(--primary)' }}>
                            {formatRupiah(tx.total_amount)}
                          </span>
                        </div>
                      </div>

                      {/* Line items list */}
                      {tx.items && tx.items.length > 0 && (
                        <div
                          style={{
                            borderTop: '1px dashed var(--border)',
                            paddingTop: '6px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '4px',
                            fontSize: '0.78rem',
                            color: 'var(--text-muted)',
                          }}
                        >
                          {tx.items.map((it) => (
                            <div key={it.id} style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span>• {it.product_name} ({it.qty}x)</span>
                              <span>{formatRupiah(it.subtotal)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
