import React, { useState, useEffect } from 'react';
import { 
  AlertTriangle, 
  Plus, 
  Search, 
  Trash2, 
  Wrench, 
  CheckCircle2, 
  XCircle, 
  Clock,
  Filter,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  Calendar
} from 'lucide-react';
import { useAuth } from '../AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import { useSearchParams } from 'react-router-dom';

interface DamageRecord {
  id: number;
  item_id: number;
  item_name: string;
  item_unit: string;
  location_id: number;
  location_name: string;
  quantity: number;
  cause: string;
  damage_date: string;
  status: 'damaged' | 'under_repair' | 'repaired' | 'discarded';
  image?: string;
  created_at: string;
}

interface Item {
  id: number;
  name: string;
  unit: string;
  stock: { location_id: number; location_name: string; quantity: number }[];
}

interface Location {
  id: number;
  name: string;
}

const Damages: React.FC = () => {
  const { token, user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [damages, setDamages] = useState<DamageRecord[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  
  // Item search in modal
  const [itemSearchQuery, setItemSearchQuery] = useState('');
  const [isItemDropdownOpen, setIsItemDropdownOpen] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const [formData, setFormData] = useState({
    item_id: '',
    location_id: '',
    quantity: 1,
    cause: '',
    damage_date: new Date().toISOString().split('T')[0],
    status: 'damaged',
    image: ''
  });

  useEffect(() => {
    if (token) {
      fetchDamages();
      fetchItems();
      fetchLocations();
    }
  }, [token]);

  useEffect(() => {
    const reportItemId = searchParams.get('report');
    if (reportItemId && items.length > 0) {
      const item = items.find(i => i.id.toString() === reportItemId);
      if (item) {
        setFormData(prev => ({ ...prev, item_id: reportItemId }));
        setItemSearchQuery(item.name);
        setIsModalOpen(true);
      }
      // Clear the param after opening
      setSearchParams({});
    }
  }, [searchParams, items]);

  const fetchDamages = async () => {
    try {
      const response = await fetch('/api/damages', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setDamages(data);
      }
    } catch (err) {
      console.error('Error fetching damages:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchItems = async () => {
    try {
      const response = await fetch('/api/items', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setItems(data);
      }
    } catch (err) {
      console.error('Error fetching items:', err);
    }
  };

  const fetchLocations = async () => {
    try {
      const response = await fetch('/api/locations', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setLocations(data);
      }
    } catch (err) {
      console.error('Error fetching locations:', err);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, image: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveDamage = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/damages', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        setIsModalOpen(false);
        setFormData({
          item_id: '',
          location_id: '',
          quantity: 1,
          cause: '',
          damage_date: new Date().toISOString().split('T')[0],
          status: 'damaged',
          image: ''
        });
        setItemSearchQuery('');
        fetchDamages();
      } else {
        const data = await response.json();
        alert(data.message || 'Gagal menyimpan data kerusakan');
      }
    } catch (err) {
      console.error(err);
      alert('Terjadi kesalahan koneksi');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateStatus = async (id: number, newStatus: string) => {
    try {
      const response = await fetch(`/api/damages/${id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus })
      });

      if (response.ok) {
        fetchDamages();
      } else {
        const data = await response.json();
        alert(data.message || 'Gagal memperbarui status');
      }
    } catch (err) {
      console.error(err);
      alert('Terjadi kesalahan koneksi');
    }
  };

  const handleDeleteDamage = async (id: number) => {
    if (!confirm('Hapus catatan kerusakan ini? Stok akan dikembalikan jika status belum diperbaiki/dibuang.')) return;
    try {
      const response = await fetch(`/api/damages/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        fetchDamages();
      } else {
        const data = await response.json();
        alert(data.message || 'Gagal menghapus data');
      }
    } catch (err) {
      console.error(err);
      alert('Terjadi kesalahan koneksi');
    }
  };

  const filteredDamages = damages.filter(d => {
    const matchesSearch = d.item_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         d.cause.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === '' || d.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalPages = Math.ceil(filteredDamages.length / itemsPerPage);
  const paginatedDamages = filteredDamages.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'damaged':
        return <span className="px-2 py-1 bg-rose-100 text-rose-700 rounded-full text-xs font-medium flex items-center gap-1 w-fit"><AlertTriangle size={12} /> Rusak</span>;
      case 'under_repair':
        return <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-medium flex items-center gap-1 w-fit"><Wrench size={12} /> Perbaikan</span>;
      case 'repaired':
        return <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-medium flex items-center gap-1 w-fit"><CheckCircle2 size={12} /> Selesai</span>;
      case 'discarded':
        return <span className="px-2 py-1 bg-slate-100 text-slate-700 rounded-full text-xs font-medium flex items-center gap-1 w-fit"><XCircle size={12} /> Dibuang</span>;
      default:
        return null;
    }
  };

  const selectedItem = items.find(i => i.id.toString() === formData.item_id);

  const filteredItemsForSelect = items.filter(item => 
    item.name.toLowerCase().includes(itemSearchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Cari barang atau detail..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
          />
        </div>
        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-sm"
          >
            <option value="">Semua Status</option>
            <option value="damaged">Rusak</option>
            <option value="under_repair">Perbaikan</option>
            <option value="repaired">Selesai</option>
            <option value="discarded">Dibuang</option>
          </select>
          <button
            onClick={() => {
              setFormData({
                item_id: '',
                location_id: '',
                quantity: 1,
                cause: '',
                damage_date: new Date().toISOString().split('T')[0],
                status: 'damaged',
                image: ''
              });
              setItemSearchQuery('');
              setIsModalOpen(true);
            }}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl font-semibold flex items-center gap-2 transition-colors shadow-sm"
          >
            <Plus size={20} />
            Lapor Kerusakan
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="p-4 font-semibold text-slate-600 text-sm">Foto</th>
                <th className="p-4 font-semibold text-slate-600 text-sm">Barang</th>
                <th className="p-4 font-semibold text-slate-600 text-sm">Lokasi</th>
                <th className="p-4 font-semibold text-slate-600 text-sm">Jumlah</th>
                <th className="p-4 font-semibold text-slate-600 text-sm">Detail Kerusakan</th>
                <th className="p-4 font-semibold text-slate-600 text-sm">Tanggal</th>
                <th className="p-4 font-semibold text-slate-600 text-sm">Status</th>
                <th className="p-4 font-semibold text-slate-600 text-sm text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400">Memuat data...</td>
                </tr>
              ) : paginatedDamages.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400">Tidak ada data kerusakan</td>
                </tr>
              ) : (
                paginatedDamages.map((damage) => (
                  <tr key={damage.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="p-4">
                      <div className="w-12 h-12 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center">
                        {damage.image ? (
                          <img src={damage.image} alt={damage.item_name} className="w-full h-full object-cover" />
                        ) : (
                          <AlertTriangle size={20} className="text-slate-300" />
                        )}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="font-medium text-slate-800">{damage.item_name}</div>
                    </td>
                    <td className="p-4 text-slate-600 text-sm">{damage.location_name}</td>
                    <td className="p-4 text-slate-600 text-sm">{damage.quantity} {damage.item_unit}</td>
                    <td className="p-4 text-slate-600 text-sm max-w-xs truncate">{damage.cause}</td>
                    <td className="p-4 text-slate-600 text-sm">
                      {new Date(damage.damage_date).toLocaleDateString('id-ID')}
                    </td>
                    <td className="p-4">{getStatusBadge(damage.status)}</td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <select
                          className="text-xs border border-slate-200 rounded-lg p-1 outline-none focus:ring-1 focus:ring-indigo-500"
                          value={damage.status}
                          onChange={(e) => handleUpdateStatus(damage.id, e.target.value)}
                        >
                          <option value="damaged">Rusak</option>
                          <option value="under_repair">Perbaikan</option>
                          <option value="repaired">Selesai</option>
                          <option value="discarded">Dibuang</option>
                        </select>
                        <button
                          onClick={() => handleDeleteDamage(damage.id)}
                          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
            <p className="text-sm text-slate-500">
              Menampilkan {(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, filteredDamages.length)} dari {filteredDamages.length} data
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="p-2 border border-slate-200 rounded-lg hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft size={18} />
              </button>
              {[...Array(totalPages)].map((_, i) => (
                <button
                  key={i + 1}
                  onClick={() => setCurrentPage(i + 1)}
                  className={`w-10 h-10 rounded-lg text-sm font-medium transition-colors ${
                    currentPage === i + 1 
                      ? 'bg-indigo-600 text-white shadow-sm' 
                      : 'border border-slate-200 hover:bg-white text-slate-600'
                  }`}
                >
                  {i + 1}
                </button>
              ))}
              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="p-2 border border-slate-200 rounded-lg hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal Lapor Kerusakan */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <h2 className="text-xl font-bold text-slate-800">Lapor Kerusakan</h2>
                <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                  <XCircle size={24} />
                </button>
              </div>

              <form onSubmit={handleSaveDamage} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
                <div className="relative">
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Pilih Barang</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input
                      type="text"
                      placeholder="Ketik nama barang..."
                      className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                      value={itemSearchQuery}
                      onChange={(e) => {
                        setItemSearchQuery(e.target.value);
                        setIsItemDropdownOpen(true);
                      }}
                      onFocus={() => setIsItemDropdownOpen(true)}
                    />
                  </div>
                  
                  {isItemDropdownOpen && itemSearchQuery && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                      {filteredItemsForSelect.length > 0 ? (
                        filteredItemsForSelect.map(item => (
                          <button
                            key={item.id}
                            type="button"
                            className="w-full text-left px-4 py-2 hover:bg-slate-50 transition-colors text-sm"
                            onClick={() => {
                              setFormData({ ...formData, item_id: item.id.toString(), location_id: '' });
                              setItemSearchQuery(item.name);
                              setIsItemDropdownOpen(false);
                            }}
                          >
                            {item.name}
                          </button>
                        ))
                      ) : (
                        <div className="px-4 py-2 text-sm text-slate-400">Barang tidak ditemukan</div>
                      )}
                    </div>
                  )}
                </div>

                {selectedItem && (
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Lokasi Kejadian</label>
                    <select
                      required
                      className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                      value={formData.location_id}
                      onChange={(e) => setFormData({ ...formData, location_id: e.target.value })}
                    >
                      <option value="">Pilih Lokasi</option>
                      {selectedItem.stock.map(s => (
                        <option key={s.location_id} value={s.location_id}>
                          {s.location_name} (Tersedia: {s.quantity})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Jumlah</label>
                    <input
                      type="number"
                      required
                      min="1"
                      className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                      value={formData.quantity}
                      onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 1 })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Tanggal</label>
                    <input
                      type="date"
                      required
                      className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                      value={formData.damage_date}
                      onChange={(e) => setFormData({ ...formData, damage_date: e.target.value })}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Foto Kerusakan</label>
                  <div className="mt-1 flex items-center gap-4">
                    <div className="w-20 h-20 rounded-xl bg-slate-50 border-2 border-dashed border-slate-200 flex items-center justify-center overflow-hidden">
                      {formData.image ? (
                        <img src={formData.image} alt="Preview" className="w-full h-full object-cover" />
                      ) : (
                        <Plus className="text-slate-300" />
                      )}
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange}
                      className="text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Detail Kerusakan (Apa yang rusak?)</label>
                  <textarea
                    required
                    rows={3}
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                    placeholder="Jelaskan detail kerusakan yang terjadi..."
                    value={formData.cause}
                    onChange={(e) => setFormData({ ...formData, cause: e.target.value })}
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 px-4 py-2 border border-slate-200 text-slate-600 rounded-xl font-semibold hover:bg-slate-50 transition-colors"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-md"
                  >
                    {isSubmitting ? 'Menyimpan...' : 'Simpan Laporan'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Damages;
