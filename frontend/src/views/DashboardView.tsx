import React, { useEffect, useState } from 'react';
import * as DashboardService from '../../bindings/farizamart/services/dashboardservice';
import { DashboardData } from '../../bindings/farizamart/models/models';
import {
  TrendingUp,
  ShoppingCart,
  Package,
  Receipt,
  ArrowUpRight,
  RefreshCw,
  FileText,
} from '../components/Icons';
import { TabType } from '../components/Sidebar';

interface DashboardViewProps {
  onNavigate: (tab: TabType) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ onNavigate }) => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeBarIndex, setActiveBarIndex] = useState<number | null>(null);

  const fetchDashboard = async () => {
    setLoading(true);
    try {
      const res = await DashboardService.GetDashboardData();
      setData(res);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  const formatRupiah = (val: number) => {
    return 'Rp ' + Math.round(val).toLocaleString('id-ID');
  };

  const monthlySales = data?.monthly_data || [];
  const maxRevenue = Math.max(...monthlySales.map((d) => d.revenue), 1000);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Top Banner with Quick Actions */}
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
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-main)' }}>
            Ringkasan Toko Fariza Mart
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Pantau penjualan harian, tren bulanan, dan produk terlaris toko Anda.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn btn-secondary btn-sm" onClick={fetchDashboard} disabled={loading}>
            <RefreshCw size={15} className={loading ? 'spinning' : ''} />
            <span>Refresh</span>
          </button>
          <button className="btn btn-secondary" onClick={() => onNavigate('reports')}>
            <FileText size={16} />
            <span>Laporan Harian</span>
          </button>
          <button className="btn btn-primary" onClick={() => onNavigate('pos')}>
            <ShoppingCart size={16} />
            <span>+ Transaksi Baru</span>
          </button>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-icon blue">
            <TrendingUp size={24} />
          </div>
          <div>
            <div className="stat-label">Omzet Hari Ini</div>
            <div className="stat-value">
              {loading ? '...' : formatRupiah(data?.today_revenue || 0)}
            </div>
            <div className="stat-sub">Total transaksi hari berjalan</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon green">
            <Receipt size={24} />
          </div>
          <div>
            <div className="stat-label">Transaksi Hari Ini</div>
            <div className="stat-value">{loading ? '...' : data?.today_transactions || 0}</div>
            <div className="stat-sub">Struk / nota tersimpan</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon purple">
            <Package size={24} />
          </div>
          <div>
            <div className="stat-label">Item Terjual Hari Ini</div>
            <div className="stat-value">{loading ? '...' : data?.today_items_sold || 0}</div>
            <div className="stat-sub">Produk keluar hari ini</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon amber">
            <ArrowUpRight size={24} />
          </div>
          <div>
            <div className="stat-label">Omzet Bulan Ini</div>
            <div className="stat-value">
              {loading ? '...' : formatRupiah(data?.monthly_revenue || 0)}
            </div>
            <div className="stat-sub">Akumulasi bulan berjalan</div>
          </div>
        </div>
      </div>

      {/* Charts & Top Products Layout */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1.2fr)',
          gap: '24px',
        }}
      >
        {/* Sales Chart Card */}
        <div className="card">
          <div className="card-header">
            <div>
              <h3 className="card-title">Grafik Penjualan Harian Bulan Ini</h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Pergerakan omzet toko per tanggal dalam bulan ini
              </p>
            </div>
          </div>

          <div style={{ position: 'relative', marginTop: '16px' }}>
            {monthlySales.length === 0 ? (
              <div
                style={{
                  height: '240px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--text-light)',
                }}
              >
                Belum ada data penjualan bulan ini
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {/* Visual Chart Bars */}
                <div
                  style={{
                    height: '220px',
                    display: 'flex',
                    alignItems: 'flex-end',
                    gap: '4px',
                    paddingBottom: '24px',
                    borderBottom: '1px solid var(--border)',
                    position: 'relative',
                  }}
                >
                  {monthlySales.map((item, idx) => {
                    const heightPercent = maxRevenue > 0 ? (item.revenue / maxRevenue) * 100 : 0;
                    const dateDay = item.date.split('-')[2];
                    const isHovered = activeBarIndex === idx;

                    return (
                      <div
                        key={item.date}
                        style={{
                          flex: 1,
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          height: '100%',
                          justifyContent: 'flex-end',
                          position: 'relative',
                        }}
                        onMouseEnter={() => setActiveBarIndex(idx)}
                        onMouseLeave={() => setActiveBarIndex(null)}
                      >
                        {/* Tooltip */}
                        {isHovered && (
                          <div
                            style={{
                              position: 'absolute',
                              bottom: `calc(${Math.max(heightPercent, 10)}% + 12px)`,
                              backgroundColor: '#0f172a',
                              color: '#ffffff',
                              padding: '6px 10px',
                              borderRadius: '6px',
                              fontSize: '0.72rem',
                              whiteSpace: 'nowrap',
                              zIndex: 10,
                              boxShadow: 'var(--shadow-md)',
                              pointerEvents: 'none',
                              textAlign: 'center',
                            }}
                          >
                            <div style={{ fontWeight: 600 }}>Tgl {dateDay}</div>
                            <div>{formatRupiah(item.revenue)}</div>
                            <div style={{ color: '#94a3b8' }}>{item.count} transaksi</div>
                          </div>
                        )}

                        {/* Bar */}
                        <div
                          style={{
                            width: '100%',
                            minHeight: item.revenue > 0 ? '6px' : '2px',
                            height: `${heightPercent}%`,
                            backgroundColor:
                              item.revenue > 0
                                ? isHovered
                                  ? 'var(--primary-hover)'
                                  : 'var(--primary)'
                                : '#e2e8f0',
                            borderRadius: '4px 4px 0 0',
                            transition: 'all 0.2s ease',
                          }}
                        />

                        {/* Date Label */}
                        <span
                          style={{
                            position: 'absolute',
                            bottom: '4px',
                            fontSize: '0.65rem',
                            color: isHovered ? 'var(--primary)' : 'var(--text-light)',
                            fontWeight: isHovered ? 700 : 500,
                          }}
                        >
                          {Number(dateDay) % 3 === 1 || monthlySales.length <= 15 ? dateDay : ''}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Top 5 Products Leaderboard */}
        <div className="card">
          <div className="card-header">
            <div>
              <h3 className="card-title">Top 5 Produk Terlaris</h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Berdasarkan jumlah unit terjual bulan ini
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '12px' }}>
            {!data?.top_products || data.top_products.length === 0 ? (
              <div
                style={{
                  padding: '40px 20px',
                  textAlign: 'center',
                  color: 'var(--text-light)',
                  fontSize: '0.85rem',
                }}
              >
                Belum ada transaksi di bulan ini
              </div>
            ) : (
              data.top_products.map((prod, idx) => (
                <div
                  key={prod.product_id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--bg-subtle)',
                    border: '1px solid var(--border)',
                  }}
                >
                  <div
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: 'var(--radius-full)',
                      backgroundColor:
                        idx === 0 ? '#fef3c7' : idx === 1 ? '#f1f5f9' : idx === 2 ? '#ffedd5' : '#e2e8f0',
                      color:
                        idx === 0 ? '#b45309' : idx === 1 ? '#475569' : idx === 2 ? '#c2410c' : '#64748b',
                      fontWeight: 700,
                      fontSize: '0.82rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    #{idx + 1}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: '0.88rem',
                        fontWeight: 600,
                        color: 'var(--text-main)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {prod.product_name}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Total Omzet: {formatRupiah(prod.total_amount)}
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <span className="badge badge-blue">{prod.total_qty} terjual</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
