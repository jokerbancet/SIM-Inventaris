import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link, useLocation, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './AuthContext';
import { 
  LayoutDashboard, 
  Package, 
  History, 
  Tags, 
  MapPin,
  LogOut, 
  Menu, 
  X, 
  User as UserIcon,
  Users as UsersIcon,
  ChevronRight,
  ChevronDown,
  AlertTriangle,
  Activity,
  Database
} from 'lucide-react';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import Inventory from './components/Inventory';
import Borrowings from './components/Borrowings';
import Categories from './components/Categories';
import Locations from './components/Locations';
import Damages from './components/Damages';
import Logs from './components/Logs';
import Users from './components/Users';
import { motion, AnimatePresence } from 'motion/react';

const ProtectedRoute: React.FC<{ children: React.ReactNode; adminOnly?: boolean }> = ({ children, adminOnly }) => {
  const { isAuthenticated, user } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (adminOnly && user?.role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

interface MenuItem {
  name: string;
  path: string;
  icon: any;
  adminOnly?: boolean;
}

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, logout } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(window.innerWidth > 1024);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const [isDataMasterOpen, setIsDataMasterOpen] = React.useState(true);
  const location = useLocation();
  const navigate = useNavigate();

  // Close sidebar on mobile route change
  React.useEffect(() => {
    if (window.innerWidth < 1024) {
      setIsMobileMenuOpen(false);
    }
  }, [location.pathname]);

  const menuItems: MenuItem[] = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
  ];

  const dataMasterItems: MenuItem[] = [
    { name: 'Data Inventaris', path: '/inventory', icon: Package },
    { name: 'Data Peminjaman', path: '/borrowings', icon: History },
    { name: 'Data Kerusakan', path: '/damages', icon: AlertTriangle },
    { name: 'Master Kategori', path: '/categories', icon: Tags, adminOnly: true },
    { name: 'Master Lokasi', path: '/locations', icon: MapPin, adminOnly: true },
  ];

  const otherItems: MenuItem[] = [
    { name: 'Kelola User', path: '/users', icon: UsersIcon, adminOnly: true },
    { name: 'Log Aktivitas', path: '/logs', icon: Activity, adminOnly: true },
  ];

  const allItems = [...menuItems, ...dataMasterItems, ...otherItems];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col lg:flex-row relative">
      {/* Mobile Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsMobileMenuOpen(false)}
            className="fixed inset-0 bg-slate-900/50 z-40 lg:hidden backdrop-blur-sm"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside 
        className={`bg-white border-r border-slate-200 transition-all duration-300 flex flex-col fixed inset-y-0 left-0 z-50 lg:relative ${
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        } ${
          isSidebarOpen ? 'w-64' : 'w-20'
        }`}
      >
        <div className="p-6 flex items-center justify-between border-b border-slate-100 h-[73px]">
          {(isSidebarOpen || isMobileMenuOpen) && (
            <span className="font-bold text-xl text-indigo-600 truncate">SIM Inventaris</span>
          )}
          <button 
            onClick={() => {
              if (window.innerWidth < 1024) {
                setIsMobileMenuOpen(false);
              } else {
                setIsSidebarOpen(!isSidebarOpen);
              }
            }}
            className="p-1 hover:bg-slate-100 rounded-md text-slate-500"
          >
            {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {menuItems.map((item) => {
            if (item.adminOnly && user?.role !== 'admin') return null;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center p-3 rounded-lg transition-colors ${
                  isActive 
                    ? 'bg-indigo-50 text-indigo-600' 
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <item.icon size={20} className="shrink-0" />
                {isSidebarOpen && <span className="ml-3 font-medium">{item.name}</span>}
                {isActive && isSidebarOpen && (
                  <ChevronRight size={16} className="ml-auto" />
                )}
              </Link>
            );
          })}

          {/* Data Master Dropdown */}
          <div className="space-y-1">
            <button
              onClick={() => isSidebarOpen ? setIsDataMasterOpen(!isDataMasterOpen) : setIsSidebarOpen(true)}
              className={`w-full flex items-center p-3 rounded-lg transition-colors text-slate-600 hover:bg-slate-50 ${
                !isSidebarOpen && 'justify-center'
              }`}
            >
              <Database size={20} className="shrink-0" />
              {isSidebarOpen && (
                <>
                  <span className="ml-3 font-medium">Data Master</span>
                  <ChevronDown 
                    size={16} 
                    className={`ml-auto transition-transform ${isDataMasterOpen ? 'rotate-180' : ''}`} 
                  />
                </>
              )}
            </button>
            
            {isSidebarOpen && isDataMasterOpen && (
              <div className="ml-4 pl-4 border-l border-slate-100 space-y-1">
                {dataMasterItems.map((item) => {
                  if (item.adminOnly && user?.role !== 'admin') return null;
                  const isActive = location.pathname === item.path;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={`flex items-center p-2 rounded-lg transition-colors text-sm ${
                        isActive 
                          ? 'bg-indigo-50 text-indigo-600 font-semibold' 
                          : 'text-slate-500 hover:bg-slate-50'
                      }`}
                    >
                      <item.icon size={16} className="shrink-0" />
                      <span className="ml-3">{item.name}</span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {otherItems.map((item) => {
            if (item.adminOnly && user?.role !== 'admin') return null;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center p-3 rounded-lg transition-colors ${
                  isActive 
                    ? 'bg-indigo-50 text-indigo-600' 
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <item.icon size={20} className="shrink-0" />
                {isSidebarOpen && <span className="ml-3 font-medium">{item.name}</span>}
                {isActive && isSidebarOpen && (
                  <ChevronRight size={16} className="ml-auto" />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-100">
          <div className={`flex items-center ${isSidebarOpen ? 'px-2' : 'justify-center'}`}>
            <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
              <UserIcon size={20} />
            </div>
            {isSidebarOpen && (
              <div className="ml-3 overflow-hidden">
                <p className="text-sm font-semibold text-slate-900 truncate">{user?.name}</p>
                <p className="text-xs text-slate-500 capitalize">{user?.role}</p>
              </div>
            )}
          </div>
          <button
            onClick={handleLogout}
            className={`mt-4 w-full flex items-center p-3 rounded-lg text-red-600 hover:bg-red-50 transition-colors ${
              !isSidebarOpen && 'justify-center'
            }`}
          >
            <LogOut size={20} className="shrink-0" />
            {isSidebarOpen && <span className="ml-3 font-medium">Keluar</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto lg:h-screen w-full">
        <header className="bg-white border-b border-slate-200 px-4 py-3 sticky top-0 z-10 flex items-center justify-between h-[73px]">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="p-2 hover:bg-slate-100 rounded-md text-slate-500 lg:hidden"
            >
              <Menu size={20} />
            </button>
            <h1 className="text-lg font-bold text-slate-800 truncate max-w-[150px] sm:max-w-none">
              {allItems.find(i => i.path === location.pathname)?.name || 'Halaman'}
            </h1>
          </div>
          <div className="text-sm text-slate-500 hidden sm:block">
            {new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
        </header>
        <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
};

const AppContent: React.FC = () => {
  const { isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-500 font-medium animate-pulse">Memuat aplikasi...</p>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={
          <ProtectedRoute>
            <Layout><Dashboard /></Layout>
          </ProtectedRoute>
        } />
        <Route path="/inventory" element={
          <ProtectedRoute>
            <Layout><Inventory /></Layout>
          </ProtectedRoute>
        } />
        <Route path="/borrowings" element={
          <ProtectedRoute>
            <Layout><Borrowings /></Layout>
          </ProtectedRoute>
        } />
        <Route path="/damages" element={
          <ProtectedRoute>
            <Layout><Damages /></Layout>
          </ProtectedRoute>
        } />
        <Route path="/categories" element={
          <ProtectedRoute adminOnly>
            <Layout><Categories /></Layout>
          </ProtectedRoute>
        } />
        <Route path="/locations" element={
          <ProtectedRoute adminOnly>
            <Layout><Locations /></Layout>
          </ProtectedRoute>
        } />
        <Route path="/logs" element={
          <ProtectedRoute adminOnly>
            <Layout><Logs /></Layout>
          </ProtectedRoute>
        } />
        <Route path="/users" element={
          <ProtectedRoute adminOnly>
            <Layout><Users /></Layout>
          </ProtectedRoute>
        } />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
