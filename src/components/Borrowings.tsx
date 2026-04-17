import React, { useEffect, useState } from 'react';
import { useAuth } from '../AuthContext';
import { 
  Search, 
  Calendar, 
  User, 
  CheckCircle2, 
  Clock, 
  Image as ImageIcon,
  X,
  Upload,
  Loader2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  Phone,
  Edit2,
  Plus,
  Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

interface BorrowingItem {
  id: number;
  borrowing_id: number;
  item_id: number;
  item_name: string;
  unit: string;
  quantity: number;
  initial_condition: string;
  initial_image: string | null;
  final_condition: string | null;
  return_image: string | null;
  return_date: string | null;
  status: 'borrowed' | 'returned';
}

interface Borrowing {
  id: number;
  user_id: number;
  recorder_name: string;
  borrower_name: string;
  borrower_phone: string | null;
  start_date: string;
  due_date: string | null;
  status: 'borrowed' | 'returned';
  created_at: string;
  items: BorrowingItem[];
}

export default function Borrowings() {
  const { token } = useAuth();
  const [borrowings, setBorrowings] = useState<Borrowing[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedBorrowing, setSelectedBorrowing] = useState<Borrowing | null>(null);
  const [allItems, setAllItems] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [editFormData, setEditFormData] = useState({
    borrower_name: '',
    borrower_phone: '',
    start_date: '',
    due_date: '',
    items: [] as any[]
  });
  const [returnFormData, setReturnFormData] = useState<{
    items: {
      borrowing_item_id: number;
      final_condition: string;
      return_image: string;
      selected: boolean;
    }[]
  }>({ items: [] });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [viewImage, setViewImage] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  const fetchBorrowings = async () => {
    try {
      const response = await fetch('/api/borrowings', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setBorrowings(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchInventoryData = async () => {
    try {
      const [itemsRes, locationsRes] = await Promise.all([
        fetch('/api/items', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/locations', { headers: { 'Authorization': `Bearer ${token}` } })
      ]);
      const itemsData = await itemsRes.json();
      const locationsData = await locationsRes.json();
      setAllItems(itemsData);
      setLocations(locationsData);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchBorrowings();
    fetchInventoryData();
  }, [token]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, itemId: number) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setReturnFormData(prev => ({
          ...prev,
          items: prev.items.map(item => 
            item.borrowing_item_id === itemId 
              ? { ...item, return_image: reader.result as string } 
              : item
          )
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBorrowing) return;

    const selectedItems = returnFormData.items.filter(i => i.selected);
    if (selectedItems.length === 0) {
      alert('Pilih minimal satu barang untuk dikembalikan');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/borrowings/${selectedBorrowing.id}/return`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ items: selectedItems })
      });

      if (response.ok) {
        setIsReturnModalOpen(false);
        setSelectedBorrowing(null);
        fetchBorrowings();
        alert('Barang berhasil dikembalikan');
      } else {
        const error = await response.json();
        alert(error.message || 'Gagal mengembalikan barang');
      }
    } catch (err) {
      console.error(err);
      alert('Terjadi kesalahan saat menghubungi server');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateBorrowing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBorrowing) return;

    if (editFormData.items.length === 0) {
      alert('Minimal satu barang harus dipinjam');
      return;
    }

    // Validation
    for (const item of editFormData.items) {
      if (!item.location_id || item.quantity <= 0) {
        alert('Lengkapi data barang (lokasi dan jumlah)');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/borrowings/${selectedBorrowing.id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(editFormData)
      });

      if (response.ok) {
        setIsEditModalOpen(false);
        setSelectedBorrowing(null);
        fetchBorrowings();
        alert('Peminjaman berhasil diperbarui');
      } else {
        const error = await response.json();
        alert(error.message || 'Gagal memperbarui peminjaman');
      }
    } catch (err) {
      console.error(err);
      alert('Terjadi kesalahan saat menghubungi server');
    } finally {
      setIsSubmitting(false);
    }
  };

  const sendWhatsAppReminder = (borrowing: Borrowing) => {
    if (!borrowing.borrower_phone) {
      alert('Nomor WhatsApp tidak tersedia');
      return;
    }

    const itemsList = borrowing.items.map(i => `- ${i.item_name} (${i.quantity} ${i.unit})`).join('\n');
    const dueDateStr = borrowing.due_date 
      ? format(new Date(borrowing.due_date), 'dd MMMM yyyy HH:mm', { locale: id })
      : 'Segera';

    const message = `Halo ${borrowing.borrower_name},\n\nKami ingin mengingatkan mengenai peminjaman barang inventaris berikut:\n${itemsList}\n\nBatas waktu pengembalian: *${dueDateStr}*.\n\nMohon segera dikembalikan jika sudah selesai digunakan. Terima kasih!`;
    
    // Clean phone number (remove non-digits, handle 0 -> 62)
    let phone = borrowing.borrower_phone.replace(/\D/g, '');
    if (phone.startsWith('0')) {
      phone = '62' + phone.substring(1);
    } else if (!phone.startsWith('62')) {
      phone = '62' + phone;
    }

    const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  const isOverdue = (dueDate: string | null) => {
    if (!dueDate) return false;
    return new Date(dueDate) < new Date();
  };

  const filteredBorrowings = borrowings.filter(b => 
    b.borrower_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    b.items.some(i => i.item_name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const totalPages = Math.ceil(filteredBorrowings.length / itemsPerPage);
  const paginatedBorrowings = filteredBorrowings.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-indigo-600" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative flex-1 w-full sm:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Cari barang atau peminjam..."
            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Peminjam</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Daftar Barang</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Waktu Pinjam</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {paginatedBorrowings.map((borrowing) => (
                <tr key={borrowing.id} className={`hover:bg-slate-50/50 transition-colors ${
                  borrowing.status === 'borrowed' && isOverdue(borrowing.due_date) ? 'bg-rose-50/30' : ''
                }`}>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 mb-1">
                      <User size={16} className="text-indigo-600" />
                      <span className="font-bold text-slate-900">{borrowing.borrower_name}</span>
                    </div>
                    {borrowing.borrower_phone && (
                      <div className="flex items-center gap-1 text-[10px] text-slate-500">
                        <Phone size={10} />
                        {borrowing.borrower_phone}
                      </div>
                    )}
                    <div className="text-[10px] text-slate-400">Dicatat oleh: {borrowing.recorder_name}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="space-y-1">
                      {borrowing.items.map(item => (
                        <div key={item.id} className="flex items-center gap-2 text-xs">
                          <span className={`w-2 h-2 rounded-full ${item.status === 'returned' ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
                          <span className="text-slate-700 font-medium">{item.item_name}</span>
                          <span className="text-slate-400">({item.quantity} {item.unit})</span>
                        </div>
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-slate-700 font-medium">
                      {format(new Date(borrowing.start_date), 'dd MMM yyyy HH:mm', { locale: id })}
                    </div>
                    {borrowing.due_date && (
                      <div className={`text-[10px] font-bold mt-1 flex items-center gap-1 ${
                        borrowing.status === 'borrowed' && isOverdue(borrowing.due_date) ? 'text-rose-600' : 'text-slate-400'
                      }`}>
                        <Clock size={10} />
                        Batas: {format(new Date(borrowing.due_date), 'dd MMM HH:mm', { locale: id })}
                        {borrowing.status === 'borrowed' && isOverdue(borrowing.due_date) && ' (Terlambat)'}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                      borrowing.status === 'borrowed' 
                        ? (isOverdue(borrowing.due_date) ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700')
                        : 'bg-emerald-100 text-emerald-700'
                    }`}>
                      {borrowing.status === 'borrowed' 
                        ? (isOverdue(borrowing.due_date) ? 'Terlambat' : 'Aktif') 
                        : 'Selesai'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {borrowing.status === 'borrowed' && (
                        <button
                          onClick={() => {
                            setSelectedBorrowing(borrowing);
                            setEditFormData({
                              borrower_name: borrowing.borrower_name,
                              borrower_phone: borrowing.borrower_phone || '',
                              start_date: borrowing.start_date.slice(0, 16),
                              due_date: borrowing.due_date ? borrowing.due_date.slice(0, 16) : '',
                              items: borrowing.items.map(i => ({
                                id: i.id,
                                item_id: i.item_id,
                                item_name: i.item_name,
                                location_id: i.location_id.toString(),
                                quantity: i.quantity,
                                unit: i.unit,
                                initial_condition: i.initial_condition,
                                initial_image: i.initial_image
                              }))
                            });
                            setIsEditModalOpen(true);
                          }}
                          className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                          title="Edit Peminjaman"
                        >
                          <Edit2 size={18} />
                        </button>
                      )}
                      {borrowing.status === 'borrowed' && borrowing.borrower_phone && (
                        <button
                          onClick={() => sendWhatsAppReminder(borrowing)}
                          className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                          title="Kirim Pengingat WhatsApp"
                        >
                          <MessageSquare size={18} />
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setSelectedBorrowing(borrowing);
                          setReturnFormData({
                            items: borrowing.items.map(item => ({
                              borrowing_item_id: item.id,
                              final_condition: 'Kondisi Baik',
                              return_image: '',
                              selected: item.status === 'borrowed'
                            }))
                          });
                          setIsReturnModalOpen(true);
                        }}
                        disabled={borrowing.status === 'returned'}
                        className={`p-2 rounded-lg transition-colors ${
                          borrowing.status === 'returned'
                            ? 'text-slate-300 cursor-not-allowed'
                            : 'text-indigo-600 hover:bg-indigo-50'
                        }`}
                        title="Kembalikan Barang"
                      >
                        <CheckCircle2 size={18} />
                      </button>
                      <button
                        onClick={() => {
                          setSelectedBorrowing(borrowing);
                          setIsDetailModalOpen(true);
                        }}
                        className="p-2 text-slate-400 hover:bg-slate-100 rounded-lg transition-colors"
                        title="Detail"
                      >
                        <Clock size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {paginatedBorrowings.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                    Tidak ada data peminjaman ditemukan.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-4 sm:px-6 py-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between bg-white gap-4">
            <div className="text-xs sm:text-sm text-slate-500 text-center sm:text-left">
              Menampilkan <span className="font-semibold text-slate-700">{(currentPage - 1) * itemsPerPage + 1}</span> - <span className="font-semibold text-slate-700">{Math.min(currentPage * itemsPerPage, filteredBorrowings.length)}</span> dari <span className="font-semibold text-slate-700">{filteredBorrowings.length}</span>
            </div>
            <div className="flex items-center gap-1 sm:gap-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="p-1.5 sm:p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors"
              >
                <ChevronLeft size={18} className="sm:w-5 sm:h-5" />
              </button>
              <div className="flex items-center gap-1">
                {[...Array(totalPages)].map((_, i) => (
                  <button
                    key={i + 1}
                    onClick={() => setCurrentPage(i + 1)}
                    className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
                      currentPage === i + 1
                        ? 'bg-indigo-600 text-white shadow-md'
                        : 'text-slate-600 hover:bg-slate-50 border border-transparent'
                    }`}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="p-1.5 sm:p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors"
              >
                <ChevronRight size={18} className="sm:w-5 sm:h-5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Edit Borrowing Modal */}
      <AnimatePresence>
        {isEditModalOpen && selectedBorrowing && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-indigo-600 text-white">
                <h3 className="text-xl font-bold">Edit Peminjaman</h3>
                <button onClick={() => setIsEditModalOpen(false)} className="text-white/60 hover:text-white">
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleUpdateBorrowing} className="flex-1 overflow-hidden flex flex-col">
                <div className="p-6 space-y-6 overflow-y-auto flex-1">
                  <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <div className="col-span-2 md:col-span-1">
                      <label className="block text-sm font-semibold text-slate-700 mb-1">Nama Peminjam</label>
                      <input
                        type="text"
                        className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                        value={editFormData.borrower_name}
                        onChange={(e) => setEditFormData({ ...editFormData, borrower_name: e.target.value })}
                        required
                      />
                    </div>
                    <div className="col-span-2 md:col-span-1">
                      <label className="block text-sm font-semibold text-slate-700 mb-1">No. WhatsApp</label>
                      <input
                        type="tel"
                        className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                        value={editFormData.borrower_phone}
                        onChange={(e) => setEditFormData({ ...editFormData, borrower_phone: e.target.value })}
                      />
                    </div>
                    <div className="col-span-2 md:col-span-1">
                      <label className="block text-sm font-semibold text-slate-700 mb-1">Waktu Pinjam</label>
                      <input
                        type="datetime-local"
                        className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                        value={editFormData.start_date}
                        onChange={(e) => setEditFormData({ ...editFormData, start_date: e.target.value })}
                        required
                      />
                    </div>
                    <div className="col-span-2 md:col-span-1">
                      <label className="block text-sm font-semibold text-slate-700 mb-1">Batas Kembali</label>
                      <input
                        type="datetime-local"
                        className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                        value={editFormData.due_date}
                        onChange={(e) => setEditFormData({ ...editFormData, due_date: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-slate-800">Daftar Barang</h4>
                      <button
                        type="button"
                        onClick={() => {
                          const newItem = {
                            item_id: '',
                            location_id: '',
                            quantity: 1,
                            initial_condition: 'Kondisi Baik',
                            initial_image: ''
                          };
                          setEditFormData({ ...editFormData, items: [...editFormData.items, newItem] });
                        }}
                        className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                      >
                        <Plus size={14} /> Tambah Barang
                      </button>
                    </div>

                    {editFormData.items.map((item, index) => (
                      <div key={index} className="p-4 border border-slate-100 rounded-2xl bg-white shadow-sm space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <select
                              className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                              value={item.item_id}
                              onChange={(e) => {
                                const selectedItem = allItems.find(i => i.id.toString() === e.target.value);
                                const newItems = [...editFormData.items];
                                newItems[index] = {
                                  ...newItems[index],
                                  item_id: e.target.value,
                                  item_name: selectedItem?.name,
                                  unit: selectedItem?.unit,
                                  location_id: selectedItem?.stock?.[0]?.location_id?.toString() || ''
                                };
                                setEditFormData({ ...editFormData, items: newItems });
                              }}
                              disabled={!!item.id} // Disable selection for existing items
                            >
                              <option value="">Pilih Barang</option>
                              {allItems.map(i => (
                                <option key={i.id} value={i.id}>{i.name} ({i.total_quantity} {i.unit})</option>
                              ))}
                            </select>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              const newItems = editFormData.items.filter((_, i) => i !== index);
                              setEditFormData({ ...editFormData, items: newItems });
                            }}
                            className="ml-2 p-2 text-slate-400 hover:text-rose-600"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-semibold text-slate-500 mb-1">Lokasi</label>
                            <select
                              className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                              value={item.location_id}
                              onChange={(e) => {
                                const newItems = [...editFormData.items];
                                newItems[index].location_id = e.target.value;
                                setEditFormData({ ...editFormData, items: newItems });
                              }}
                              disabled={!!item.id} // Disable location change for existing items to keep stock logic simple
                            >
                              <option value="">Pilih Lokasi</option>
                              {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-slate-500 mb-1">Jumlah</label>
                            <input
                              type="number"
                              className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                              value={item.quantity}
                              min="1"
                              onChange={(e) => {
                                const newItems = [...editFormData.items];
                                newItems[index].quantity = parseInt(e.target.value) || 0;
                                setEditFormData({ ...editFormData, items: newItems });
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-6 border-t border-slate-100 bg-slate-50 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIsEditModalOpen(false)}
                    className="flex-1 px-4 py-3 border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-white transition-colors"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-[2] px-4 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-indigo-200"
                  >
                    {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : 'Simpan Perubahan'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Return Modal */}
      <AnimatePresence>
        {isReturnModalOpen && selectedBorrowing && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-emerald-600 text-white">
                <div>
                  <h3 className="text-xl font-bold">Kembalikan Barang</h3>
                  <p className="text-emerald-100 text-sm">Peminjam: {selectedBorrowing.borrower_name}</p>
                </div>
                <button onClick={() => setIsReturnModalOpen(false)} className="text-white/60 hover:text-white">
                  <X size={24} />
                </button>
              </div>
              <form onSubmit={handleReturn} className="flex-1 overflow-hidden flex flex-col">
                <div className="p-6 space-y-6 overflow-y-auto flex-1">
                  <p className="text-sm text-slate-500">Pilih barang yang ingin dikembalikan dan isi kondisinya.</p>
                  
                  <div className="space-y-4">
                    {selectedBorrowing.items.map((item) => {
                      const formData = returnFormData.items.find(i => i.borrowing_item_id === item.id);
                      if (!formData) return null;

                      return (
                        <div key={item.id} className={`p-4 border rounded-2xl transition-all ${
                          formData.selected ? 'border-emerald-200 bg-emerald-50/30' : 'border-slate-100 bg-slate-50/50 opacity-60'
                        }`}>
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                              <input 
                                type="checkbox"
                                disabled={item.status === 'returned'}
                                checked={formData.selected}
                                onChange={(e) => setReturnFormData({
                                  ...returnFormData,
                                  items: returnFormData.items.map(i => i.borrowing_item_id === item.id ? { ...i, selected: e.target.checked } : i)
                                })}
                                className="w-5 h-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                              />
                              <div>
                                <div className="font-bold text-slate-800">{item.item_name}</div>
                                <div className="text-xs text-slate-500">{item.quantity} {item.unit} • {item.status === 'returned' ? 'Sudah Kembali' : 'Belum Kembali'}</div>
                              </div>
                            </div>
                          </div>

                          {formData.selected && item.status === 'borrowed' && (
                            <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-emerald-100">
                              <div className="col-span-2">
                                <label className="block text-xs font-semibold text-slate-500 mb-1">Kondisi Akhir</label>
                                <textarea
                                  required
                                  rows={2}
                                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm resize-none"
                                  placeholder="Kondisi barang saat kembali..."
                                  value={formData.final_condition}
                                  onChange={(e) => setReturnFormData({
                                    ...returnFormData,
                                    items: returnFormData.items.map(i => i.borrowing_item_id === item.id ? { ...i, final_condition: e.target.value } : i)
                                  })}
                                />
                              </div>
                              <div className="col-span-2">
                                <label className="block text-xs font-semibold text-slate-500 mb-1">Gambar Kondisi Kembali</label>
                                <div className="flex items-center gap-4">
                                  <div className="relative flex-1">
                                    <input
                                      type="file"
                                      accept="image/*"
                                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                      onChange={(e) => handleImageUpload(e, item.id)}
                                    />
                                    <div className="px-4 py-2 border-2 border-dashed border-slate-200 rounded-xl text-center text-xs text-slate-500 hover:border-emerald-400 transition-colors">
                                      {formData.return_image ? 'Gambar Terpilih' : 'Klik untuk upload gambar'}
                                    </div>
                                  </div>
                                  {formData.return_image && (
                                    <img src={formData.return_image} alt="Preview" className="w-12 h-12 rounded-lg object-cover border border-slate-200" />
                                  )}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="p-6 border-t border-slate-100 bg-slate-50 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIsReturnModalOpen(false)}
                    className="flex-1 px-4 py-3 border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-white transition-colors"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || !returnFormData.items.some(i => i.selected)}
                    className="flex-[2] px-4 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-emerald-200"
                  >
                    {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : 'Simpan Pengembalian'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Detail Modal */}
      <AnimatePresence>
        {isDetailModalOpen && selectedBorrowing && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-800 text-white">
                <div>
                  <h3 className="text-xl font-bold">Detail Peminjaman</h3>
                  <p className="text-slate-300 text-sm">ID: #{selectedBorrowing.id} • {selectedBorrowing.borrower_name}</p>
                </div>
                <button onClick={() => setIsDetailModalOpen(false)} className="text-white/60 hover:text-white">
                  <X size={24} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-8">
                {/* Header Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Peminjam</label>
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2 text-slate-700 font-semibold">
                        <User size={16} className="text-indigo-500" />
                        {selectedBorrowing.borrower_name}
                      </div>
                      {selectedBorrowing.borrower_phone && (
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          <Phone size={12} className="text-slate-400" />
                          {selectedBorrowing.borrower_phone}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Waktu Pinjam</label>
                    <div className="flex items-center gap-2 text-slate-700 font-semibold">
                      <Calendar size={16} className="text-indigo-500" />
                      {format(new Date(selectedBorrowing.start_date), 'dd MMM yyyy HH:mm', { locale: id })}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Batas Kembali</label>
                    <div className={`flex items-center gap-2 font-semibold ${
                      selectedBorrowing.status === 'borrowed' && isOverdue(selectedBorrowing.due_date) ? 'text-rose-600' : 'text-slate-700'
                    }`}>
                      <Clock size={16} className={selectedBorrowing.status === 'borrowed' && isOverdue(selectedBorrowing.due_date) ? 'text-rose-500' : 'text-indigo-500'} />
                      {selectedBorrowing.due_date 
                        ? format(new Date(selectedBorrowing.due_date), 'dd MMM yyyy HH:mm', { locale: id })
                        : 'Tidak ditentukan'}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Petugas</label>
                    <div className="flex items-center gap-2 text-slate-700 font-semibold">
                      <CheckCircle2 size={16} className="text-indigo-500" />
                      {selectedBorrowing.recorder_name}
                    </div>
                  </div>
                </div>

                {/* Items Detail */}
                <div className="space-y-4">
                  <h4 className="font-bold text-slate-800 border-b border-slate-100 pb-2">Daftar Barang</h4>
                  <div className="space-y-6">
                    {selectedBorrowing.items.map((item, idx) => (
                      <div key={item.id} className="bg-slate-50 rounded-2xl p-5 border border-slate-100 space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className="w-6 h-6 bg-white border border-slate-200 rounded-full flex items-center justify-center text-xs font-bold text-slate-500">
                              {idx + 1}
                            </span>
                            <span className="font-bold text-slate-800">{item.item_name}</span>
                            <span className="text-xs bg-white px-2 py-0.5 rounded-md border border-slate-200 text-slate-500 font-medium">
                              {item.quantity} {item.unit}
                            </span>
                          </div>
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            item.status === 'returned' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                          }`}>
                            {item.status === 'returned' ? 'Dikembalikan' : 'Dipinjam'}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {/* Initial Condition */}
                          <div className="space-y-3">
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Kondisi Awal</div>
                            <div className="p-3 bg-white rounded-xl border border-slate-200 text-sm text-slate-600 italic">
                              "{item.initial_condition}"
                            </div>
                            {item.initial_image ? (
                              <div 
                                className="relative aspect-video rounded-xl overflow-hidden border border-slate-200 cursor-pointer group"
                                onClick={() => setViewImage(item.initial_image)}
                              >
                                <img src={item.initial_image} alt="Initial" className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-slate-900/0 group-hover:bg-slate-900/20 transition-colors flex items-center justify-center">
                                  <ImageIcon className="text-white opacity-0 group-hover:opacity-100 transition-opacity" size={24} />
                                </div>
                              </div>
                            ) : (
                              <div className="aspect-video rounded-xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400 text-xs">
                                <ImageIcon size={20} className="mb-1 opacity-20" />
                                Tidak ada foto
                              </div>
                            )}
                          </div>

                          {/* Return Condition */}
                          <div className="space-y-3">
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Kondisi Kembali</div>
                            {item.status === 'returned' ? (
                              <>
                                <div className="p-3 bg-white rounded-xl border border-slate-200 text-sm text-slate-600 italic">
                                  "{item.final_condition}"
                                </div>
                                <div className="text-[10px] text-emerald-600 font-medium">
                                  Kembali pada: {item.return_date ? format(new Date(item.return_date), 'dd MMM yyyy HH:mm', { locale: id }) : '-'}
                                </div>
                                {item.return_image ? (
                                  <div 
                                    className="relative aspect-video rounded-xl overflow-hidden border border-slate-200 cursor-pointer group"
                                    onClick={() => setViewImage(item.return_image)}
                                  >
                                    <img src={item.return_image} alt="Return" className="w-full h-full object-cover" />
                                    <div className="absolute inset-0 bg-slate-900/0 group-hover:bg-slate-900/20 transition-colors flex items-center justify-center">
                                      <ImageIcon className="text-white opacity-0 group-hover:opacity-100 transition-opacity" size={24} />
                                    </div>
                                  </div>
                                ) : (
                                  <div className="aspect-video rounded-xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400 text-xs">
                                    <ImageIcon size={20} className="mb-1 opacity-20" />
                                    Tidak ada foto
                                  </div>
                                )}
                              </>
                            ) : (
                              <div className="aspect-video rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 text-xs italic">
                                Belum dikembalikan
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="p-6 border-t border-slate-100 bg-slate-50">
                <button
                  onClick={() => setIsDetailModalOpen(false)}
                  className="w-full px-4 py-3 bg-slate-800 text-white font-bold rounded-xl hover:bg-slate-900 transition-colors"
                >
                  Tutup
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Image Viewer Modal */}
      <AnimatePresence>
        {viewImage && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/90 backdrop-blur-sm">
            <div className="relative max-w-4xl w-full flex flex-col items-center">
              <button 
                onClick={() => setViewImage(null)}
                className="absolute -top-12 right-0 text-white hover:text-slate-300 transition-colors"
              >
                <X size={32} />
              </button>
              <img src={viewImage} alt="Full view" className="max-h-[80vh] w-auto rounded-xl shadow-2xl" />
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
