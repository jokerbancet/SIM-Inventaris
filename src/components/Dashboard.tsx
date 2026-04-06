import React, { useEffect, useState } from 'react';
import { useAuth } from '../AuthContext';
import { 
  Package, 
  Tags, 
  AlertTriangle, 
  TrendingUp, 
  ArrowUpRight, 
  ArrowDownRight,
  Clock,
  History,
  Wrench,
  Download,
  FileText,
  Table as TableIcon,
  Calendar
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
  Legend
} from 'recharts';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { id } from 'date-fns/locale';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

interface Stats {
  totalItems: number;
  totalCategories: number;
  lowStockItems: number;
  activeBorrowings: number;
  totalDamages: number;
  activeRepairs: number;
  recentBorrowings: any[];
  categoryDistribution: { name: string; count: number }[];
  analytics: {
    mostBorrowed: { name: string; count: number }[];
    avgDuration: number;
  };
}

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export default function Dashboard() {
  const { token } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [exportMonth, setExportMonth] = useState(format(new Date(), 'MM'));
  const [exportYear, setExportYear] = useState(format(new Date(), 'yyyy'));
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async (type: 'pdf' | 'excel') => {
    setIsExporting(true);
    try {
      const response = await fetch(`/api/reports/export?month=${exportMonth}&year=${exportYear}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      
      if (type === 'pdf') {
        const doc = new jsPDF();
        doc.setFontSize(18);
        doc.text(`Laporan Inventaris - ${exportMonth}/${exportYear}`, 14, 22);
        
        doc.setFontSize(14);
        doc.text('Data Peminjaman', 14, 35);
        
        const borrowData = data.borrowings.map((b: any) => [
          format(new Date(b.created_at), 'dd/MM/yyyy'),
          b.borrower_name,
          b.items.map((i: any) => `${i.item_name} (${i.quantity} ${i.unit})`).join(', '),
          b.status === 'borrowed' ? 'Dipinjam' : 'Kembali'
        ]);
        
        autoTable(doc, {
          startY: 40,
          head: [['Tanggal', 'Peminjam', 'Barang', 'Status']],
          body: borrowData,
        });
        
        const finalY = (doc as any).lastAutoTable.finalY || 40;
        doc.text('Data Kerusakan', 14, finalY + 15);
        
        const damageData = data.damages.map((d: any) => [
          format(new Date(d.damage_date), 'dd/MM/yyyy'),
          d.item_name,
          d.quantity,
          d.cause,
          d.status
        ]);
        
        autoTable(doc, {
          startY: finalY + 20,
          head: [['Tanggal', 'Barang', 'Qty', 'Penyebab', 'Status']],
          body: damageData,
        });
        
        doc.save(`Laporan_Inventaris_${exportMonth}_${exportYear}.pdf`);
      } else {
        const wb = XLSX.utils.book_new();
        
        const borrowWS = XLSX.utils.json_to_sheet(data.borrowings.map((b: any) => ({
          Tanggal: format(new Date(b.created_at), 'dd/MM/yyyy'),
          Peminjam: b.borrower_name,
          Telepon: b.borrower_phone,
          Barang: b.items.map((i: any) => `${i.item_name} (${i.quantity} ${i.unit})`).join(', '),
          Status: b.status === 'borrowed' ? 'Dipinjam' : 'Kembali'
        })));
        XLSX.utils.book_append_sheet(wb, borrowWS, "Peminjaman");
        
        const damageWS = XLSX.utils.json_to_sheet(data.damages.map((d: any) => ({
          Tanggal: format(new Date(d.damage_date), 'dd/MM/yyyy'),
          Barang: d.item_name,
          Lokasi: d.location_name,
          Jumlah: d.quantity,
          Penyebab: d.cause,
          Status: d.status
        })));
        XLSX.utils.book_append_sheet(wb, damageWS, "Kerusakan");
        
        XLSX.writeFile(wb, `Laporan_Inventaris_${exportMonth}_${exportYear}.xlsx`);
      }
    } catch (err) {
      console.error(err);
      alert('Gagal mengekspor laporan');
    } finally {
      setIsExporting(false);
    }
  };

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch('/api/dashboard/stats', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        setStats(data);
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
  }, [token]);

  if (isLoading || !stats) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-pulse">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="h-32 bg-white rounded-2xl border border-slate-100 shadow-sm"></div>
        ))}
      </div>
    );
  }

  const statCards = [
    { label: 'Total Barang', value: stats.totalItems, icon: Package, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Kategori', value: stats.totalCategories, icon: Tags, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { label: 'Stok Menipis', value: stats.lowStockItems, icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'Peminjaman Aktif', value: stats.activeBorrowings, icon: History, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Barang Rusak', value: stats.totalDamages, icon: AlertTriangle, color: 'text-rose-600', bg: 'bg-rose-50' },
    { label: 'Dalam Perbaikan', value: stats.activeRepairs, icon: Wrench, color: 'text-orange-600', bg: 'bg-orange-50' },
    { label: 'Rata-rata Pinjam', value: `${stats.analytics.avgDuration} hari`, icon: Clock, color: 'text-purple-600', bg: 'bg-purple-50' },
  ];

  return (
    <div className="space-y-8">
      {/* Export Section */}
      <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
            <Download size={20} />
          </div>
          <div>
            <h3 className="font-bold text-slate-800">Laporan Bulanan</h3>
            <p className="text-xs text-slate-500">Unduh data peminjaman dan kerusakan barang</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <select 
            value={exportMonth}
            onChange={(e) => setExportMonth(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {['01','02','03','04','05','06','07','08','09','10','11','12'].map(m => (
              <option key={m} value={m}>{format(new Date(2024, parseInt(m)-1), 'MMMM', { locale: id })}</option>
            ))}
          </select>
          <select 
            value={exportYear}
            onChange={(e) => setExportYear(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {[2024, 2025, 2026].map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <button 
            onClick={() => handleExport('pdf')}
            disabled={isExporting}
            className="flex items-center gap-2 bg-rose-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-rose-700 transition-colors disabled:opacity-50"
          >
            <FileText size={18} />
            PDF
          </button>
          <button 
            onClick={() => handleExport('excel')}
            disabled={isExporting}
            className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50"
          >
            <TableIcon size={18} />
            Excel
          </button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-6">
        {statCards.map((card, i) => (
          <div key={i} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className={`p-3 rounded-xl ${card.bg} ${card.color}`}>
                <card.icon size={24} />
              </div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{card.label}</span>
            </div>
            <div className="flex items-end justify-between">
              <h3 className="text-3xl font-bold text-slate-800">{card.value}</h3>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Activity */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-50 flex items-center justify-between">
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
              <Clock size={20} className="text-indigo-600" />
              Peminjaman Terbaru
            </h3>
            <button className="text-sm text-indigo-600 font-medium hover:underline">Lihat Semua</button>
          </div>
          <div className="divide-y divide-slate-50">
            {stats.recentBorrowings.length > 0 ? (
              stats.recentBorrowings.map((b, i) => (
                <div key={i} className="p-4 hover:bg-slate-50 transition-colors flex items-center gap-4">
                  <div className={`p-2 rounded-lg shrink-0 ${
                    b.status === 'borrowed' ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'
                  }`}>
                    {b.status === 'borrowed' ? <ArrowDownRight size={20} /> : <ArrowUpRight size={20} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{b.item_name}</p>
                    <p className="text-xs text-slate-500">
                      Peminjam: {b.borrower_name} • {b.quantity} unit
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-medium text-slate-400">
                      {format(new Date(b.created_at), 'HH:mm', { locale: id })}
                    </p>
                    <p className="text-[10px] text-slate-400">
                      {format(new Date(b.created_at), 'dd MMM', { locale: id })}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-12 text-center text-slate-400">Belum ada peminjaman</div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Most Borrowed Chart */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
            <TrendingUp size={20} className="text-indigo-600" />
            Barang Paling Sering Dipinjam
          </h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.analytics.mostBorrowed} layout="vertical" margin={{ left: 40 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" hide />
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  axisLine={false} 
                  tickLine={false} 
                  width={100}
                  style={{ fontSize: '12px', fontWeight: 500 }}
                />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="count" fill="#6366f1" radius={[0, 4, 4, 0]} barSize={24} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Category Distribution Pie Chart */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
            <Tags size={20} className="text-indigo-600" />
            Distribusi Kategori
          </h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stats.categoryDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={80}
                  outerRadius={110}
                  paddingAngle={5}
                  dataKey="count"
                >
                  {stats.categoryDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '20px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
