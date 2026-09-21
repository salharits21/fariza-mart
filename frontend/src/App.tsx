import React, { useState, useEffect, useCallback } from 'react';
import * as AuthService from '../bindings/farizamart/services/authservice';
import { UserSession } from '../bindings/farizamart/models/models';
import { Sidebar, TabType } from './components/Sidebar';
import { ToastProvider, useToast } from './components/Toast';
import { SetupView } from './views/SetupView';
import { LoginView } from './views/LoginView';
import { DashboardView } from './views/DashboardView';
import { TransactionView } from './views/TransactionView';
import { ProductsView } from './views/ProductsView';
import { HistoryView } from './views/HistoryView';
import { ReportsView } from './views/ReportsView';
import { StaffView } from './views/StaffView';
import { StockWithdrawalView } from './views/StockWithdrawalView';
import { ChangePasswordModal } from './views/ChangePasswordModal';
import { Calendar } from './components/Icons';

const MainAppContent: React.FC = () => {
  const [isSetupRequired, setIsSetupRequired] = useState<boolean | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [currentUser, setCurrentUser] = useState<UserSession | null>(null);
  const [currentTab, setCurrentTab] = useState<TabType>('pos');
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState<string>('');

  const { showToast } = useToast();

  const checkAuthState = useCallback(async () => {
    try {
      const setupNeeded = await AuthService.IsSetupRequired();
      setIsSetupRequired(setupNeeded);
      if (setupNeeded) {
        setIsLoggedIn(false);
        return;
      }

      const loggedIn = await AuthService.IsLoggedIn();
      setIsLoggedIn(loggedIn);
      if (loggedIn) {
        const user = await AuthService.GetCurrentUser();
        setCurrentUser(user);
        if (user?.role === 'admin') {
          setCurrentTab('dashboard');
        } else {
          setCurrentTab('pos');
        }
      } else {
        setCurrentUser(null);
      }
    } catch (err) {
      console.error('Failed to check auth/setup state:', err);
      setIsSetupRequired(false);
      setIsLoggedIn(false);
    }
  }, []);

  useEffect(() => {
    checkAuthState();

    // Real-time Indonesian Clock
    const updateTime = () => {
      const now = new Date();
      const formatted =
        now.toLocaleDateString('id-ID', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        }) +
        ' ' +
        now.toLocaleTimeString('id-ID');
      setCurrentTime(formatted);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [checkAuthState]);

  const handleSetupSuccess = (session: UserSession) => {
    setIsSetupRequired(false);
    setCurrentUser(session);
    setIsLoggedIn(true);
    setCurrentTab('dashboard');
  };

  const handleLoginSuccess = (session: UserSession) => {
    setCurrentUser(session);
    setIsLoggedIn(true);
    if (session.role === 'admin') {
      setCurrentTab('dashboard');
    } else {
      setCurrentTab('pos');
    }
  };

  const handleLogout = async () => {
    try {
      await AuthService.Logout();
      setIsLoggedIn(false);
      setCurrentUser(null);
      showToast('Anda telah logout dari aplikasi', 'info');
    } catch (err: any) {
      console.error('Logout error:', err);
      setIsLoggedIn(false);
      setCurrentUser(null);
    }
  };

  if (isSetupRequired === null || isLoggedIn === null) {
    return (
      <div
        style={{
          display: 'flex',
          height: '100vh',
          width: '100vw',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'var(--bg-app)',
          color: 'var(--text-muted)',
          fontSize: '0.95rem',
        }}
      >
        Memuat Fariza Mart POS...
      </div>
    );
  }

  // First-time administrator setup
  if (isSetupRequired) {
    return <SetupView onSetupSuccess={handleSetupSuccess} />;
  }

  // Login view
  if (!isLoggedIn) {
    return <LoginView onLoginSuccess={handleLoginSuccess} />;
  }

  const isAdmin = currentUser?.role === 'admin';

  // Guard tab access for non-admin
  const effectiveTab: TabType =
    !isAdmin && (currentTab === 'dashboard' || currentTab === 'products' || currentTab === 'staff')
      ? 'pos'
      : currentTab;

  const getPageTitle = () => {
    switch (effectiveTab) {
      case 'dashboard':
        return 'Dashboard Penjualan';
      case 'pos':
        return 'Kasir & Input Transaksi';
      case 'products':
        return 'Katalog Produk Toko';
      case 'history':
        return 'Riwayat Transaksi';
      case 'withdrawals':
        return 'Pengambilan Stok Produk';
      case 'reports':
        return 'Laporan Harian (PDF)';
      case 'staff':
        return 'Kelola Akun Staf / Karyawan';
      default:
        return 'Fariza Mart';
    }
  };

  return (
    <div className="app-container">
      <Sidebar
        currentTab={effectiveTab}
        currentUser={currentUser}
        onSelectTab={setCurrentTab}
        onOpenPasswordModal={() => setIsPasswordModalOpen(true)}
        onLogout={handleLogout}
      />

      <div className="main-wrapper">
        <header className="top-navbar">
          <h2 className="navbar-page-title">{getPageTitle()}</h2>
          <div className="navbar-actions">
            <div className="time-chip">
              <Calendar size={15} />
              <span>{currentTime}</span>
            </div>
          </div>
        </header>

        <main className="page-content">
          {effectiveTab === 'dashboard' && <DashboardView onNavigate={setCurrentTab} />}
          {effectiveTab === 'pos' && <TransactionView currentUser={currentUser} />}
          {effectiveTab === 'products' && <ProductsView />}
          {effectiveTab === 'history' && <HistoryView currentUser={currentUser} />}
          {effectiveTab === 'withdrawals' && <StockWithdrawalView />}
          {effectiveTab === 'reports' && <ReportsView />}
          {effectiveTab === 'staff' && <StaffView />}
        </main>
      </div>

      {isAdmin && (
        <ChangePasswordModal
          isOpen={isPasswordModalOpen}
          onClose={() => setIsPasswordModalOpen(false)}
        />
      )}
    </div>
  );
};

export function App() {
  return (
    <ToastProvider>
      <MainAppContent />
    </ToastProvider>
  );
}

export default App;
