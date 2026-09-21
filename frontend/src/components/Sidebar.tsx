import React from 'react';
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  History,
  FileText,
  LogOut,
  Key,
  Store,
  Users,
  PackageMinus,
} from './Icons';
import { UserSession } from '../../bindings/farizamart/models/models';

export type TabType =
  | 'dashboard'
  | 'pos'
  | 'products'
  | 'history'
  | 'withdrawals'
  | 'reports'
  | 'staff';

interface SidebarProps {
  currentTab: TabType;
  currentUser: UserSession | null;
  onSelectTab: (tab: TabType) => void;
  onOpenPasswordModal: () => void;
  onLogout: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  currentUser,
  onSelectTab,
  onOpenPasswordModal,
  onLogout,
}) => {
  const isAdmin = currentUser?.role === 'admin';

  const allNavItems = [
    { id: 'dashboard' as TabType, label: 'Dashboard', icon: LayoutDashboard, adminOnly: true },
    { id: 'pos' as TabType, label: 'Kasir / Transaksi', icon: ShoppingCart, adminOnly: false },
    { id: 'products' as TabType, label: 'Katalog Produk', icon: Package, adminOnly: true },
    { id: 'history' as TabType, label: 'Riwayat Transaksi', icon: History, adminOnly: false },
    { id: 'withdrawals' as TabType, label: 'Pengambilan Stok', icon: PackageMinus, adminOnly: false },
    { id: 'reports' as TabType, label: 'Laporan Harian', icon: FileText, adminOnly: false },
    { id: 'staff' as TabType, label: 'Kelola Staf', icon: Users, adminOnly: true },
  ];

  const visibleNavItems = allNavItems.filter((item) => (isAdmin ? true : !item.adminOnly));

  const displayName = currentUser?.display_name || currentUser?.username || 'Pengguna';
  const roleLabel = isAdmin ? 'Administrator' : 'Karyawan';
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-logo-icon">
          <Store size={22} />
        </div>
        <div>
          <h1 className="sidebar-brand-title">Fariza Mart</h1>
          <span className="sidebar-brand-badge">Sistem POS Offline</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        {visibleNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              className={`nav-item ${isActive ? 'active' : ''}`}
              onClick={() => onSelectTab(item.id)}
            >
              <Icon size={19} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <div className="user-profile-chip">
          <div className="user-avatar">{initial}</div>
          <div className="user-meta">
            <div className="user-name">{displayName}</div>
            <div className="user-role">{roleLabel}</div>
          </div>
        </div>

        {isAdmin && (
          <button
            className="sidebar-action-btn"
            onClick={onOpenPasswordModal}
            title="Ubah Password Admin"
          >
            <Key size={15} />
            <span>Ganti Password</span>
          </button>
        )}

        <button
          className="sidebar-action-btn logout"
          onClick={onLogout}
          title="Keluar dari Aplikasi"
        >
          <LogOut size={15} />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
};
