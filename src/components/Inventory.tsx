import React, { useEffect, useState } from 'react';
import { useAuth } from '../AuthContext';
import { 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  MoreVertical, 
  ArrowUpRight, 
  ArrowDownRight,
  Filter,
  X,
  Check,
  Loader2,
  AlertCircle,
  Image as ImageIcon,
  ChevronDown,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  AlertTriangle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';

interface ItemStock {
  location_id: number;
  location_name: string;
  quantity: number;
}

interface Item {
  id: number;
  code: string;
  name: string;
  category_id: number;
  category_name: string;
  stock: ItemStock[];
  total_quantity: number;
  unit: string;
  description: string;
  image?: string;
  status: string;
  updated_at: string;
}

interface Category {
  id: number;
  name: string;
  code: string;
}

interface Location {
  id: number;
  name: string;
}

export default function Inventory() {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<Item[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedLocation, setSelectedLocation] = useState<string>('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [selectedItems, setSelectedItems] = useState<number[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBorrowModalOpen, setIsBorrowModalOpen] = useState(false);
  const [borrowCart, setBorrowCart] = useState<{ item: Item; location_id: string; quantity: number; initial_condition: string; initial_image: string }[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [borrowFormData, setBorrowFormData] = useState({
    borrower_name: '',
    borrower_phone: '',
    start_date: new Date().toISOString().slice(0, 16),
    due_date: '',
    quantity: 1,
    initial_condition: '',
    initial_image: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    category_id: '',
    stock: [] as { location_id: string; quantity: number }[],
    unit: 'Unit',
    min_stock: 0,
    description: '',
    image: '',
    status: 'Tersedia'
  });

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const fetchItems = async () => {
    try {
      const response = await fetch('/api/items', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setItems(data);
    } catch (err) { console.error(err); }
  };

  const fetchCategories = async () => {
    try {
      const response = await fetch('/api/categories', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setCategories(data);
    } catch (err) { console.error(err); }
  };

  const fetchLocations = async () => {
    try {
      const response = await fetch('/api/locations', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setLocations(data);
    } catch (err) { console.error(err); }
  };

  useEffect(() => {
    Promise.all([fetchItems(), fetchCategories(), fetchLocations()]).finally(() => setIsLoading(false));
  }, [token]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedCategory, selectedLocation]);

  const handleCategoryChange = async (categoryId: string) => {
    setFormData(prev => ({ ...prev, category_id: categoryId }));
    
    if (categoryId && !editingItem) {
      try {
        const response = await fetch(`/api/categories/${categoryId}/next-code`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        if (data.nextCode) {
          setFormData(prev => ({ ...prev, code: data.nextCode }));
        }
      } catch (err) {
        console.error("Failed to fetch next code:", err);
      }
    }
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    const url = editingItem ? `/api/items/${editingItem.id}` : '/api/items';
    const method = editingItem ? 'PUT' : 'POST';

    try {
      const response = await fetch(url, {
        method,
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        setIsModalOpen(false);
        setEditingItem(null);
        setFormData({ code: '', name: '', category_id: '', stock: [], unit: 'Unit', min_stock: 0, description: '', image: '', status: 'Tersedia' });
        fetchItems();
      } else {
        const data = await response.json();
        alert(data.message || 'Gagal menyimpan barang');
      }
    } catch (err) { 
      console.error(err); 
      alert('Terjadi kesalahan koneksi');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteItem = async (id: number) => {
    if (!confirm('Hapus barang ini?')) return;
    try {
      const response = await fetch(`/api/items/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok) {
        fetchItems();
      } else {
        alert(data.message || 'Gagal menghapus barang');
      }
    } catch (err) { 
      console.error(err); 
      alert('Terjadi kesalahan koneksi');
    }
  };

  const handleBulkDelete = async () => {
    if (selectedItems.length === 0) return;
    if (!confirm(`Hapus ${selectedItems.length} barang terpilih?`)) return;

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/items/bulk-delete', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ ids: selectedItems })
      });
      const data = await response.json();
      
      if (response.ok) {
        if (data.failed.length > 0) {
          const failedList = data.failed.map((f: any) => `- ${f.name}: ${f.reason}`).join('\n');
          alert(`Berhasil menghapus ${data.success.length} barang.\n\n${data.failed.length} barang gagal dihapus:\n${failedList}`);
        } else {
          alert(`Berhasil menghapus ${data.success.length} barang.`);
        }
        setSelectedItems([]);
        fetchItems();
      } else {
        alert(data.message || 'Gagal menghapus barang terpilih');
      }
    } catch (err) { 
      console.error(err); 
      alert('Terjadi kesalahan koneksi');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData({ ...formData, image: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const toggleSelectItem = (id: number) => {
    setSelectedItems(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedItems.length === filteredItems.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems(filteredItems.map(i => i.id));
    }
  };

  const filteredItems = items
    .filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.category_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.stock?.some(s => s.location_name?.toLowerCase().includes(searchTerm.toLowerCase())) ||
        item.code?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesCategory = selectedCategory === '' || item.category_id.toString() === selectedCategory;
      const matchesLocation = selectedLocation === '' || item.stock?.some(s => s.location_id.toString() === selectedLocation);
      
      return matchesSearch && matchesCategory && matchesLocation;
    })
    .sort((a, b) => {
      if (sortOrder === 'asc') {
        return a.name.localeCompare(b.name);
      } else {
        return b.name.localeCompare(a.name);
      }
    });

  const totalPages = Math.ceil(filteredItems.length / itemsPerPage);
  const paginatedItems = filteredItems.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleBorrow = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (borrowCart.length === 0) {
      alert('Daftar pinjam masih kosong');
      return;
    }

    if (!borrowFormData.borrower_name.trim()) {
      alert('Nama peminjam harus diisi');
      return;
    }

    if (!borrowFormData.start_date) {
      alert('Tanggal mulai pinjam harus diisi');
      return;
    }

    // Validate each item in cart
    for (const cartItem of borrowCart) {
      if (!cartItem.location_id) {
        alert(`Lokasi penempatan untuk ${cartItem.item.name} harus dipilih`);
        return;
      }
      if (cartItem.quantity <= 0) {
        alert(`Jumlah pinjam untuk ${cartItem.item.name} harus lebih dari 0`);
        return;
      }
      const stockAtLocation = cartItem.item.stock.find(s => s.location_id.toString() === cartItem.location_id);
      if (!stockAtLocation || cartItem.quantity > stockAtLocation.quantity) {
        alert(`Jumlah pinjam untuk ${cartItem.item.name} melebihi stok yang tersedia di lokasi terpilih`);
        return;
      }
      if (!cartItem.initial_condition.trim()) {
        alert(`Kondisi awal untuk ${cartItem.item.name} harus diisi`);
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/borrowings', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          borrower_name: borrowFormData.borrower_name,
          borrower_phone: borrowFormData.borrower_phone,
          start_date: borrowFormData.start_date,
          due_date: borrowFormData.due_date,
          items: borrowCart.map(c => ({
            item_id: c.item.id,
            location_id: parseInt(c.location_id),
            quantity: c.quantity,
            initial_condition: c.initial_condition,
            initial_image: c.initial_image
          }))
        })
      });

      const data = await response.json();

      if (response.ok) {
        setIsCartOpen(false);
        setBorrowCart([]);
        setBorrowFormData({
          borrower_name: '',
          borrower_phone: '',
          start_date: new Date().toISOString().slice(0, 16),
          due_date: '',
          quantity: 1,
          initial_condition: '',
          initial_image: ''
        });
        fetchItems();
        alert('Peminjaman berhasil dicatat');
      } else {
        alert(data.message || 'Gagal mencatat peminjaman');
      }
    } catch (err) { 
      console.error(err); 
      alert('Terjadi kesalahan koneksi atau server');
    }
    finally { setIsSubmitting(false); }
  };

  const addToCart = (item: Item) => {
    if (item.status !== 'Tersedia') {
      alert(`Barang tidak dapat dipinjam karena status: ${item.status}`);
      return;
    }
    if (item.total_quantity <= 0) {
      alert('Stok barang ini habis dan tidak bisa dipinjam');
      return;
    }
    const existing = borrowCart.find(c => c.item.id === item.id);
    if (existing) {
      alert('Barang sudah ada di daftar pinjam');
      return;
    }

    // Default to the first location that has stock
    const defaultLocation = item.stock.find(s => s.quantity > 0);

    setBorrowCart([...borrowCart, { 
      item, 
      location_id: defaultLocation ? defaultLocation.location_id.toString() : '',
      quantity: 1, 
      initial_condition: 'Kondisi Baik', 
      initial_image: '' 
    }]);
    setIsCartOpen(true);
  };

  const removeFromCart = (itemId: number) => {
    setBorrowCart(borrowCart.filter(c => c.item.id !== itemId));
  };

  const updateCartItem = (itemId: number, updates: any) => {
    setBorrowCart(borrowCart.map(c => c.item.id === itemId ? { ...c, ...updates } : c));
  };

  const handleCartImageUpload = (itemId: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        updateCartItem(itemId, { initial_image: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Cari barang..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
            />
          </div>
          <div className="flex items-center gap-2">
            {selectedItems.length > 0 && user?.role === 'admin' && (
              <button
                onClick={handleBulkDelete}
                disabled={isSubmitting}
                className="bg-rose-50 text-rose-600 hover:bg-rose-100 px-4 py-2 rounded-xl font-semibold flex items-center gap-2 transition-colors border border-rose-100"
              >
                <Trash2 size={18} />
                Hapus ({selectedItems.length})
              </button>
            )}
            {user?.role === 'admin' && (
              <button
                onClick={() => {
                  setEditingItem(null);
                  setFormData({ code: '', name: '', category_id: '', stock: [], unit: 'Unit', min_stock: 0, description: '', image: '', status: 'Tersedia' });
                  setIsModalOpen(true);
                }}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl font-semibold flex items-center gap-2 transition-colors shadow-sm"
              >
                <Plus size={20} />
                Tambah Barang
              </button>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 p-4 bg-white rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex items-center gap-2 text-slate-500 text-sm font-medium mr-2">
            <Filter size={16} />
            Filter:
          </div>
          
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
          >
            <option value="">Semua Kategori</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>

          <select
            value={selectedLocation}
            onChange={(e) => setSelectedLocation(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
          >
            <option value="">Semua Lokasi</option>
            {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>

          <div className="h-6 w-px bg-slate-200 mx-1" />

          <button
            onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
            className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm hover:bg-slate-100 transition-all"
          >
            <ArrowUpDown size={14} />
            Nama: {sortOrder === 'asc' ? 'A-Z' : 'Z-A'}
          </button>
        </div>
      </div>

      {/* Inventory Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                {user?.role === 'admin' && (
                  <th className="pl-6 py-4 w-10">
                    <input
                      type="checkbox"
                      checked={selectedItems.length === filteredItems.length && filteredItems.length > 0}
                      onChange={toggleSelectAll}
                      className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                  </th>
                )}
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Kode</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Barang</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Kategori</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-center">Stok</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Penempatan</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {isLoading ? (
                [1, 2, 3, 4, 5].map(i => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={user?.role === 'admin' ? 8 : 7} className="px-6 py-6"><div className="h-4 bg-slate-100 rounded w-full"></div></td>
                  </tr>
                ))
              ) : paginatedItems.length > 0 ? (
                paginatedItems.map((item) => (
                  <tr key={item.id} className={`hover:bg-slate-50/50 transition-colors group ${selectedItems.includes(item.id) ? 'bg-indigo-50/30' : ''}`}>
                    {user?.role === 'admin' && (
                      <td className="pl-6 py-4">
                        <input
                          type="checkbox"
                          checked={selectedItems.includes(item.id)}
                          onChange={() => toggleSelectItem(item.id)}
                          className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                      </td>
                    )}
                    <td className="px-6 py-4">
                      <span className="text-xs font-mono font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded">
                        {item.code || '-'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-slate-100 flex-shrink-0 overflow-hidden border border-slate-200">
                          {item.image ? (
                            <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-300">
                              <ImageIcon size={20} />
                            </div>
                          )}
                        </div>
                        <div>
                          <div className="font-semibold text-slate-800">{item.name}</div>
                          <div className="text-xs text-slate-400 truncate max-w-[200px]">{item.description || 'Tidak ada deskripsi'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-50 text-indigo-600 border border-indigo-100">
                        {item.category_name || 'Lain-lain'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className={`font-bold ${item.total_quantity === 0 ? 'text-slate-300' : item.total_quantity < 5 ? 'text-rose-600' : 'text-slate-700'}`}>
                          {item.total_quantity}
                        </span>
                        <span className="text-xs text-slate-400 font-medium">{item.unit}</span>
                        {item.total_quantity === 0 ? (
                          <span className="px-2 py-0.5 bg-rose-100 text-rose-600 text-[10px] font-bold rounded-md uppercase tracking-wider">Habis</span>
                        ) : item.total_quantity < 5 && (
                          <AlertCircle size={14} className="text-rose-500" />
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        {item.stock && item.stock.length > 0 ? (
                          item.stock.map((s, i) => (
                            <div key={i} className="flex items-center justify-between gap-4 text-[11px] bg-slate-50 px-2 py-1 rounded border border-slate-100">
                              <span className="text-slate-500 truncate max-w-[100px]">{s.location_name}</span>
                              <span className="font-bold text-indigo-600">{s.quantity}</span>
                            </div>
                          ))
                        ) : (
                          <span className="text-slate-400 italic text-xs">-</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                        item.status === 'Tersedia' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                        item.status === 'Dipinjam' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                        item.status === 'Rusak' ? 'bg-rose-50 text-rose-600 border-rose-100' :
                        'bg-slate-50 text-slate-600 border-slate-100'
                      }`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => addToCart(item)}
                          disabled={item.total_quantity <= 0}
                          className={`px-3 py-1.5 rounded-lg transition-colors text-xs font-bold flex items-center gap-1 ${
                            item.total_quantity <= 0 
                              ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
                              : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'
                          }`}
                          title={item.total_quantity <= 0 ? "Stok Habis" : "Pinjam Barang"}
                        >
                          <Plus size={14} />
                          Pinjam
                        </button>
                        <button
                          onClick={() => navigate(`/damages?report=${item.id}`)}
                          disabled={item.total_quantity <= 0}
                          className={`p-2 rounded-lg transition-colors ${
                            item.total_quantity <= 0 
                              ? 'text-slate-300 cursor-not-allowed' 
                              : 'text-rose-500 hover:bg-rose-50'
                          }`}
                          title="Lapor Kerusakan"
                        >
                          <AlertTriangle size={18} />
                        </button>
                        {user?.role === 'admin' && (
                          <>
                            <button
                              onClick={() => {
                                setEditingItem(item);
                                setFormData({
                                  code: item.code || '',
                                  name: item.name,
                                  category_id: item.category_id?.toString() || '',
                                  stock: item.stock.map(s => ({ 
                                    location_id: s.location_id.toString(), 
                                    quantity: s.quantity 
                                  })),
                                  unit: item.unit,
                                  min_stock: 0,
                                  description: item.description || '',
                                  image: item.image || '',
                                  status: item.status || 'Tersedia'
                                });
                                setIsModalOpen(true);
                              }}
                              className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                              title="Edit"
                            >
                              <Edit2 size={18} />
                            </button>
                            <button
                              onClick={() => handleDeleteItem(item.id)}
                              className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                              title="Hapus"
                            >
                              <Trash2 size={18} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={user?.role === 'admin' ? 8 : 7} className="px-6 py-12 text-center text-slate-400">
                    Tidak ada barang ditemukan
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between bg-white">
            <div className="text-sm text-slate-500">
              Menampilkan <span className="font-semibold text-slate-700">{(currentPage - 1) * itemsPerPage + 1}</span> sampai <span className="font-semibold text-slate-700">{Math.min(currentPage * itemsPerPage, filteredItems.length)}</span> dari <span className="font-semibold text-slate-700">{filteredItems.length}</span> barang
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft size={20} />
              </button>
              <div className="flex items-center gap-1">
                {[...Array(totalPages)].map((_, i) => (
                  <button
                    key={i + 1}
                    onClick={() => setCurrentPage(i + 1)}
                    className={`w-10 h-10 rounded-lg text-sm font-semibold transition-all ${
                      currentPage === i + 1
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200'
                        : 'text-slate-600 hover:bg-slate-50 border border-transparent hover:border-slate-200'
                    }`}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight size={20} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Item Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-xl font-bold text-slate-800">
                  {editingItem ? 'Edit Barang' : 'Tambah Barang Baru'}
                </h3>
                <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                  <X size={24} />
                </button>
              </div>
              <form onSubmit={handleSaveItem} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Foto Barang</label>
                    <div className="flex items-center gap-4">
                      <div className="w-24 h-24 rounded-xl bg-slate-50 border-2 border-dashed border-slate-200 flex items-center justify-center overflow-hidden relative group">
                        {formData.image ? (
                          <>
                            <img src={formData.image} alt="Preview" className="w-full h-full object-cover" />
                            <button 
                              type="button"
                              onClick={() => setFormData({...formData, image: ''})}
                              className="absolute inset-0 bg-black/40 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                            >
                              <X size={20} />
                            </button>
                          </>
                        ) : (
                          <ImageIcon className="text-slate-300" size={32} />
                        )}
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleImageUpload}
                          className="absolute inset-0 opacity-0 cursor-pointer"
                        />
                      </div>
                      <div className="flex-1">
                        <p className="text-xs text-slate-500 mb-2">Klik kotak untuk upload foto barang. Gunakan gambar yang jelas.</p>
                        <button 
                          type="button"
                          className="text-xs font-bold text-indigo-600 hover:text-indigo-700"
                          onClick={() => document.querySelector<HTMLInputElement>('input[type="file"]')?.click()}
                        >
                          Pilih File
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="col-span-2">
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-sm font-medium text-slate-700">Kode Barang</label>
                      {!editingItem && formData.category_id && (
                        <button 
                          type="button"
                          onClick={() => handleCategoryChange(formData.category_id)}
                          className="text-[10px] font-bold text-indigo-600 hover:text-indigo-700"
                        >
                          Regenerate
                        </button>
                      )}
                    </div>
                    <input
                      type="text"
                      placeholder="Pilih kategori untuk generate kode..."
                      value={formData.code}
                      readOnly
                      className="w-full px-4 py-2 border border-slate-200 rounded-xl bg-slate-50 text-slate-500 cursor-not-allowed outline-none transition-all"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Nama Barang</label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={e => setFormData({...formData, name: e.target.value})}
                      className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Kategori</label>
                    <select
                      required
                      value={formData.category_id}
                      onChange={e => handleCategoryChange(e.target.value)}
                      className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    >
                      <option value="">Pilih Kategori</option>
                      {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Satuan</label>
                    <input
                      type="text"
                      required
                      placeholder="Pcs, Box, Unit..."
                      value={formData.unit}
                      onChange={e => setFormData({...formData, unit: e.target.value})}
                      className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                    <select
                      required
                      value={formData.status}
                      onChange={e => setFormData({...formData, status: e.target.value})}
                      className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    >
                      <option value="Tersedia">Tersedia</option>
                      <option value="Dipinjam">Dipinjam</option>
                      <option value="Rusak">Rusak</option>
                      <option value="Sedang Maintenance">Sedang Maintenance</option>
                    </select>
                  </div>

                  {/* Stock Distribution Section */}
                  <div className="col-span-2 space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="block text-sm font-medium text-slate-700">Penempatan Stok</label>
                      <button
                        type="button"
                        onClick={() => setFormData({
                          ...formData,
                          stock: [...formData.stock, { location_id: '', quantity: 0 }]
                        })}
                        className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                      >
                        <Plus size={14} /> Tambah Lokasi
                      </button>
                    </div>
                    
                    {formData.stock.map((s, index) => (
                      <div key={index} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <div className="flex-1">
                          <select
                            required
                            value={s.location_id}
                            onChange={e => {
                              const newStock = [...formData.stock];
                              newStock[index].location_id = e.target.value;
                              setFormData({ ...formData, stock: newStock });
                            }}
                            className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-sm"
                          >
                            <option value="">Pilih Lokasi</option>
                            {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                          </select>
                        </div>
                        <div className="w-24">
                          <input
                            type="number"
                            required
                            min="0"
                            value={s.quantity}
                            onChange={e => {
                              const newStock = [...formData.stock];
                              newStock[index].quantity = parseInt(e.target.value) || 0;
                              setFormData({ ...formData, stock: newStock });
                            }}
                            className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-sm"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const newStock = formData.stock.filter((_, i) => i !== index);
                            setFormData({ ...formData, stock: newStock });
                          }}
                          className="p-1.5 text-slate-400 hover:text-rose-600 transition-colors"
                        >
                          <X size={18} />
                        </button>
                      </div>
                    ))}
                    
                    {formData.stock.length === 0 && (
                      <p className="text-xs text-slate-400 text-center py-4 border-2 border-dashed border-slate-100 rounded-xl">
                        Belum ada lokasi penempatan. Klik "Tambah Lokasi" untuk mulai.
                      </p>
                    )}
                  </div>

                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Deskripsi</label>
                    <textarea
                      rows={3}
                      value={formData.description}
                      onChange={e => setFormData({...formData, description: e.target.value})}
                      className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all resize-none"
                    />
                  </div>
                </div>
                <div className="pt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 px-4 py-2 border border-slate-200 text-slate-600 font-semibold rounded-xl hover:bg-slate-50 transition-colors"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-colors shadow-sm"
                  >
                    Simpan
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Borrow Cart Modal */}
      <AnimatePresence>
        {isCartOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-indigo-600 text-white">
                <div>
                  <h3 className="text-xl font-bold">Daftar Pinjam Barang</h3>
                  <p className="text-indigo-100 text-sm">{borrowCart.length} barang dipilih</p>
                </div>
                <button onClick={() => setIsCartOpen(false)} className="text-white/60 hover:text-white">
                  <X size={24} />
                </button>
              </div>
              
              <form onSubmit={handleBorrow} noValidate className="flex-1 overflow-hidden flex flex-col">
                <div className="p-6 space-y-6 overflow-y-auto flex-1">
                  {/* Borrower Info */}
                  <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <div className="col-span-2 md:col-span-1">
                      <label className="block text-sm font-semibold text-slate-700 mb-1">Nama Peminjam</label>
                      <input
                        type="text"
                        className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                        placeholder="Nama lengkap..."
                        value={borrowFormData.borrower_name}
                        onChange={(e) => setBorrowFormData({ ...borrowFormData, borrower_name: e.target.value })}
                      />
                    </div>
                    <div className="col-span-2 md:col-span-1">
                      <label className="block text-sm font-semibold text-slate-700 mb-1">No. WhatsApp</label>
                      <input
                        type="tel"
                        className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                        placeholder="Contoh: 08123456789"
                        value={borrowFormData.borrower_phone}
                        onChange={(e) => setBorrowFormData({ ...borrowFormData, borrower_phone: e.target.value })}
                      />
                    </div>
                    <div className="col-span-2 md:col-span-1">
                      <label className="block text-sm font-semibold text-slate-700 mb-1">Waktu Pinjam</label>
                      <input
                        type="datetime-local"
                        className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                        value={borrowFormData.start_date}
                        onChange={(e) => setBorrowFormData({ ...borrowFormData, start_date: e.target.value })}
                      />
                    </div>
                    <div className="col-span-2 md:col-span-1">
                      <label className="block text-sm font-semibold text-slate-700 mb-1">Batas Kembali (Opsional)</label>
                      <input
                        type="datetime-local"
                        className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                        value={borrowFormData.due_date}
                        onChange={(e) => setBorrowFormData({ ...borrowFormData, due_date: e.target.value })}
                      />
                    </div>
                  </div>

                  {/* Items List */}
                  <div className="space-y-4">
                    <h4 className="font-bold text-slate-800 flex items-center gap-2">
                      <Filter size={18} className="text-indigo-600" />
                      Detail Barang
                    </h4>
                    {borrowCart.map((cartItem, index) => (
                      <div key={cartItem.item.id} className="p-4 border border-slate-100 rounded-2xl bg-white shadow-sm space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center font-bold text-xs">
                              {index + 1}
                            </div>
                            <div>
                              <div className="font-bold text-slate-800">{cartItem.item.name}</div>
                              <div className="text-xs text-slate-400">Total Stok: {cartItem.item.total_quantity} {cartItem.item.unit}</div>
                            </div>
                          </div>
                          <button 
                            type="button"
                            onClick={() => removeFromCart(cartItem.item.id)}
                            className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="col-span-2">
                            <label className="block text-xs font-semibold text-slate-500 mb-1">Ambil Dari Lokasi</label>
                            <select
                              className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                              value={cartItem.location_id}
                              onChange={(e) => updateCartItem(cartItem.item.id, { location_id: e.target.value })}
                            >
                              <option value="">Pilih Lokasi</option>
                              {cartItem.item.stock.map(s => (
                                <option key={s.location_id} value={s.location_id} disabled={s.quantity <= 0}>
                                  {s.location_name} (Tersedia: {s.quantity})
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-slate-500 mb-1">Jumlah Pinjam</label>
                            <input
                              type="number"
                              className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                              value={cartItem.quantity}
                              min="1"
                              max={cartItem.item.stock.find(s => s.location_id.toString() === cartItem.location_id)?.quantity || 0}
                              onChange={(e) => updateCartItem(cartItem.item.id, { quantity: parseInt(e.target.value) || 0 })}
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-slate-500 mb-1">Kondisi Awal</label>
                            <input
                              type="text"
                              className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                              placeholder="Kondisi barang..."
                              value={cartItem.initial_condition}
                              onChange={(e) => updateCartItem(cartItem.item.id, { initial_condition: e.target.value })}
                            />
                          </div>
                          <div className="col-span-2">
                            <label className="block text-xs font-semibold text-slate-500 mb-1">Gambar Kondisi Awal</label>
                            <div className="flex items-center gap-4">
                              <div className="relative flex-1">
                                <input
                                  type="file"
                                  accept="image/*"
                                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                  onChange={(e) => handleCartImageUpload(cartItem.item.id, e)}
                                />
                                <div className="px-4 py-2 border-2 border-dashed border-slate-200 rounded-xl text-center text-xs text-slate-500 hover:border-indigo-400 transition-colors">
                                  {cartItem.initial_image ? 'Gambar Terpilih' : 'Klik untuk upload gambar'}
                                </div>
                              </div>
                              {cartItem.initial_image && (
                                <img src={cartItem.initial_image} alt="Preview" className="w-12 h-12 rounded-lg object-cover border border-slate-200" />
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-6 border-t border-slate-100 bg-slate-50 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIsCartOpen(false)}
                    className="flex-1 px-4 py-3 border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-white transition-colors"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || borrowCart.length === 0}
                    className="flex-[2] px-4 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-indigo-200"
                  >
                    {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : 'Konfirmasi Peminjaman'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Floating Cart Button */}
      {borrowCart.length > 0 && !isCartOpen && (
        <motion.button
          initial={{ scale: 0, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          onClick={() => setIsCartOpen(true)}
          className="fixed bottom-8 right-8 z-40 bg-indigo-600 text-white p-4 rounded-2xl shadow-2xl flex items-center gap-3 hover:bg-indigo-700 transition-all group"
        >
          <div className="relative">
            <ArrowUpRight size={24} />
            <span className="absolute -top-2 -right-2 bg-rose-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center border-2 border-indigo-600">
              {borrowCart.length}
            </span>
          </div>
          <span className="font-bold pr-2">Lanjutkan Pinjam</span>
        </motion.button>
      )}
    </div>
  );
}
