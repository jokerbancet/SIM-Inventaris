import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let _supabase: any = null;
const supabase = new Proxy({} as any, {
  get(target, prop) {
    if (prop === "then") return undefined;
    if (!_supabase) {
      const url = process.env.SUPABASE_URL;
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!url || !key) {
        throw new Error("Supabase environment variables are missing. Please configure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the application settings.");
      }
      _supabase = createClient(url, key);
    }
    return _supabase[prop];
  }
});

const JWT_SECRET = process.env.JWT_SECRET || "super-secret-key";

// Helper for logging
const logActivity = async (user_id: number, action: string, details: string) => {
  try {
    await supabase.from("activity_logs").insert([{ user_id, action, details }]);
  } catch (e) {
    console.error("Failed to log activity:", e);
  }
};

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json({ limit: '100mb' }));
  app.use(express.urlencoded({ limit: '100mb', extended: true }));

  // Request Logging Middleware
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
  });

  // Auth Middleware
  const authenticateToken = async (req: any, res: any, next: any) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.sendStatus(401);

    try {
      // 1. Try Supabase Auth first
      const { data: { user: sbUser }, error: sbError } = await supabase.auth.getUser(token);
      
      if (!sbError && sbUser) {
        // Sync with our users table
        let { data: user, error: userError } = await supabase
          .from("users")
          .select("*")
          .eq("username", sbUser.email)
          .single();

        const adminEmails = ['admin@admin.com', 'donymaulanaXRPL1@gmail.com'];
        const shouldBeAdmin = adminEmails.includes(sbUser.email || '');

        if (!user) {
          // Create user if not exists
          const { data: newUser, error: createError } = await supabase
            .from("users")
            .insert([{
              username: sbUser.email,
              name: sbUser.user_metadata?.full_name || sbUser.email?.split('@')[0] || 'User',
              role: shouldBeAdmin ? 'admin' : 'user', 
              password: 'auth-managed'
            }])
            .select()
            .single();
          
          if (createError) throw createError;
          user = newUser;
        } else if (shouldBeAdmin && user.role !== 'admin') {
          // Force upgrade to admin if in whitelist
          const { data: updatedUser, error: updateError } = await supabase
            .from("users")
            .update({ role: 'admin' })
            .eq("id", user.id)
            .select()
            .single();
          
          if (!updateError) user = updatedUser;
        }

        req.user = user;
        return next();
      }

      // 2. Fallback to local JWT (if any)
      jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
      });
    } catch (e) {
      console.error("Auth middleware error:", e);
      res.sendStatus(403);
    }
  };

  const isAdmin = (req: any, res: any, next: any) => {
    if (req.user.role !== 'admin') return res.status(403).json({ message: "Admin access required" });
    next();
  };

  // API Routes
  app.post("/api/login", async (req, res) => {
    const { username, password } = req.body;
    
    try {
      // 1. Sign in with Supabase Auth (using username/email)
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: username, // Assuming username is treated as email
        password: password
      });

      if (authError) {
        // Fallback or specific error
        console.error("Supabase Auth failed:", authError.message);
        return res.status(401).json({ message: "Username atau password salah" });
      }

      const sbUser = authData.user;
      if (!sbUser) return res.status(401).json({ message: "User tidak ditemukan" });

      // 2. Sync with local users table
      let { data: user, error: userError } = await supabase
        .from("users")
        .select("*")
        .eq("username", sbUser.email)
        .single();

      const adminEmails = ['admin@admin.com', 'donymaulanaXRPL1@gmail.com'];
      const shouldBeAdmin = adminEmails.includes(sbUser.email || '');

      if (!user) {
        // Create user in table if missing (first time login)
        const { data: newUser, error: createError } = await supabase
          .from("users")
          .insert([{
            username: sbUser.email,
            name: sbUser.user_metadata?.full_name || sbUser.email?.split('@')[0] || 'User',
            role: shouldBeAdmin ? 'admin' : 'user',
            password: 'auth-managed'
          }])
          .select()
          .single();
        
        if (createError) throw createError;
        user = newUser;
      } else if (shouldBeAdmin && user.role !== 'admin') {
        // Force upgrade to admin if in whitelist
        const { data: updatedUser, error: updateError } = await supabase
          .from("users")
          .update({ role: 'admin' })
          .eq("id", user.id)
          .select()
          .single();
        
        if (!updateError) user = updatedUser;
      }

      const token = authData.session?.access_token;
      
      res.json({ 
        token, 
        user: { 
          id: user.id, 
          username: user.username, 
          role: user.role, 
          name: user.name 
        } 
      });
    } catch (e: any) {
      console.error("Login error:", e);
      res.status(500).json({ message: "Terjadi kesalahan sistem" });
    }
  });

  // Categories
  app.get("/api/categories", authenticateToken, async (req, res) => {
    const { data, error } = await supabase.from("categories").select("*");
    if (error) return res.status(500).json({ message: error.message });
    res.json(data);
  });

  app.post("/api/categories", authenticateToken, isAdmin, async (req, res) => {
    const { name, code } = req.body;
    const { data, error } = await supabase
      .from("categories")
      .insert([{ name, code: code || null }])
      .select()
      .single();

    if (error) {
      console.error("Create category failed:", error);
      return res.status(400).json({ message: error.message || "Category already exists" });
    }

    await logActivity((req as any).user.id, "CREATE_CATEGORY", `Menambah kategori: ${name}`);
    res.json(data);
  });

  app.put("/api/categories/:id", authenticateToken, isAdmin, async (req, res) => {
    const { id } = req.params;
    const { name, code } = req.body;
    const { data, error } = await supabase
      .from("categories")
      .update({ name, code: code || null })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Update category failed:", error);
      return res.status(400).json({ message: error.message || "Update failed" });
    }

    await logActivity((req as any).user.id, "UPDATE_CATEGORY", `Update kategori: ${name}`);
    res.json(data);
  });

  app.delete("/api/categories/:id", authenticateToken, isAdmin, async (req, res) => {
    const { id } = req.params;
    try {
      const { data: category } = await supabase.from("categories").select("name").eq("id", id).single();
      const { error } = await supabase.from("categories").delete().eq("id", id);
      
      if (error) throw error;

      await logActivity((req as any).user.id, "DELETE_CATEGORY", `Menghapus kategori: ${category?.name}`);
      res.json({ message: "Category deleted" });
    } catch (e: any) {
      res.status(400).json({ message: e.message || "Delete failed" });
    }
  });

  app.get("/api/categories/:id/next-code", authenticateToken, async (req, res) => {
    const { id } = req.params;
    try {
      const { data: category, error: catError } = await supabase.from("categories").select("code").eq("id", id).single();
      
      if (catError || !category || !category.code) {
        return res.json({ nextCode: "" });
      }
      
      const { data: items, error: itemsError } = await supabase
        .from("items")
        .select("code")
        .eq("category_id", id); // Postgres ilike is filtered in app here or use filter

      if (itemsError) throw itemsError;
      
      let maxNum = 0;
      (items || []).filter(item => item.code.startsWith(`${category.code}-`)).forEach(item => {
        const parts = item.code.split('-');
        const num = parseInt(parts[parts.length - 1]);
        if (!isNaN(num) && num > maxNum) {
          maxNum = num;
        }
      });
      
      const nextCode = `${category.code}-${(maxNum + 1).toString().padStart(4, '0')}`;
      res.json({ nextCode });
    } catch (e) {
      res.status(500).json({ message: "Failed to generate code" });
    }
  });

  // Locations
  app.get("/api/locations", authenticateToken, async (req, res) => {
    const { data, error } = await supabase.from("locations").select("*");
    if (error) return res.status(500).json({ message: error.message });
    res.json(data);
  });

  app.post("/api/locations", authenticateToken, isAdmin, async (req, res) => {
    const { name } = req.body;
    const { data, error } = await supabase.from("locations").insert([{ name }]).select().single();
    if (error) return res.status(400).json({ message: error.message });
    await logActivity((req as any).user.id, "CREATE_LOCATION", `Menambah lokasi: ${name}`);
    res.json(data);
  });

  // Items
  app.get("/api/items", authenticateToken, async (req, res) => {
    try {
      // Fetch items with category names
      const { data: items, error: itemsError } = await supabase
        .from("items")
        .select(`
          *,
          categories (name)
        `);

      if (itemsError) throw itemsError;

      // Fetch all stocks with location names
      const { data: stocks, error: stocksError } = await supabase
        .from("item_stock")
        .select(`
          *,
          locations (name)
        `);

      if (stocksError) throw stocksError;

      const itemsWithStock = items.map(item => {
        const itemStocks = (stocks || [])
          .filter(s => s.item_id === item.id)
          .map(s => ({
            ...s,
            location_name: (s as any).locations?.name
          }));
          
        return {
          ...item,
          category_name: (item as any).categories?.name,
          stock: itemStocks,
          total_quantity: itemStocks.reduce((sum, s) => sum + s.quantity, 0)
        };
      });

      res.json(itemsWithStock);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.post("/api/items", authenticateToken, isAdmin, async (req: any, res) => {
    const { code, name, category_id, stock, unit, description, image, status } = req.body;
    const user_id = req.user.id;
    
    try {
      // 1. Insert Item
      const { data: item, error: itemError } = await supabase
        .from("items")
        .insert([{ 
          code: code || null, 
          name, 
          category_id: category_id ? parseInt(category_id) : null, 
          unit, 
          description, 
          image, 
          status: status || 'Tersedia' 
        }])
        .select()
        .single();
      
      if (itemError) {
        console.error("Item insertion error:", itemError);
        throw itemError;
      }
      
      if (!item) {
        throw new Error("Gagal membuat item: Data tidak dikembalikan setelah insert");
      }

      const itemId = item.id;
      
      // 2. Insert Stock (Batch)
      if (stock && Array.isArray(stock) && stock.length > 0) {
        const stockData = stock
          .filter(s => s.location_id && s.quantity >= 0)
          .map(s => ({
            item_id: itemId,
            location_id: parseInt(s.location_id.toString()),
            quantity: parseInt(s.quantity.toString())
          }));
        
        if (stockData.length > 0) {
          const { error: stockError } = await supabase.from("item_stock").insert(stockData);
          if (stockError) {
            console.error("Stock insertion error:", stockError);
            throw stockError;
          }
        }
      }

      await logActivity(user_id, "CREATE_ITEM", `Menambahkan barang: ${name} (${code || 'Tanpa Kode'})`);
      res.json({ id: itemId });
    } catch (e: any) {
      console.error("Create item finally failed with error:", e);
      
      // Handle Supabase specific error objects
      const errorMessage = e.message || e.details || (typeof e === 'string' ? e : "Terjadi kesalahan internal");
      
      if (errorMessage.includes('items_code_key')) {
        return res.status(400).json({ message: "Kode barang sudah digunakan" });
      }
      
      res.status(500).json({ 
        message: errorMessage,
        error: e // Include original error for debugging if needed (will be stringified in JSON)
      });
    }
  });

  app.put("/api/items/:id", authenticateToken, isAdmin, async (req: any, res) => {
    const { name, category_id, stock, unit, description, image, status } = req.body;
    const itemId = parseInt(req.params.id);
    const user_id = req.user.id;
    
    try {
      // 1. Update Item
      const { data: item, error: updateError } = await supabase
        .from("items")
        .update({ 
          name, 
          category_id: category_id ? parseInt(category_id) : null, 
          unit, 
          description, 
          image, 
          status: status || 'Tersedia', 
          updated_at: new Date().toISOString() 
        })
        .eq("id", itemId)
        .select("code")
        .single();
      
      if (updateError) throw updateError;
      
      // 2. Refresh Stock (Delete then Insert)
      const { error: deleteError } = await supabase.from("item_stock").delete().eq("item_id", itemId);
      if (deleteError) throw deleteError;
      
      if (stock && Array.isArray(stock) && stock.length > 0) {
        const stockData = stock
          .filter(s => s.location_id && s.quantity >= 0)
          .map(s => ({
            item_id: itemId,
            location_id: parseInt(s.location_id),
            quantity: parseInt(s.quantity)
          }));
        
        if (stockData.length > 0) {
          const { error: stockError } = await supabase.from("item_stock").insert(stockData);
          if (stockError) throw stockError;
        }
      }

      await logActivity(user_id, "UPDATE_ITEM", `Memperbarui barang: ${name} (${item?.code})`);
      res.json({ success: true });
    } catch (e: any) {
      console.error("Update item failed:", e);
      res.status(500).json({ message: e.message });
    }
  });

  app.delete("/api/items/:id", authenticateToken, isAdmin, async (req: any, res) => {
    const id = parseInt(req.params.id);
    const user_id = req.user.id;
    
    try {
      // Check for references
      const [borrowingCheck, transactionCheck] = await Promise.all([
        supabase.from("borrowing_items").select("*", { count: 'exact', head: true }).eq("item_id", id),
        supabase.from("transactions").select("*", { count: 'exact', head: true }).eq("item_id", id)
      ]);

      if (borrowingCheck.count && borrowingCheck.count > 0) {
        return res.status(400).json({ message: "Barang tidak bisa dihapus karena sudah pernah dipinjam" });
      }
      if (transactionCheck.count && transactionCheck.count > 0) {
        return res.status(400).json({ message: "Barang tidak bisa dihapus karena memiliki riwayat transaksi" });
      }

      const { data: item } = await supabase.from("items").select("name, code").eq("id", id).single();
      const { error } = await supabase.from("items").delete().eq("id", id);
      
      if (error) throw error;

      await logActivity(user_id, "DELETE_ITEM", `Menghapus barang: ${item?.name} (${item?.code})`);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.post("/api/items/bulk-delete", authenticateToken, isAdmin, async (req, res) => {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids)) {
      return res.status(400).json({ message: "Invalid IDs" });
    }

    const results = {
      success: [] as number[],
      failed: [] as { id: number, name: string, reason: string }[]
    };

    try {
      for (const id of ids) {
        const itemId = parseInt(id);
        const { data: item } = await supabase.from("items").select("name").eq("id", itemId).single();
        if (!item) continue;

        // Check for references
        const [borrowingCheck, transactionCheck] = await Promise.all([
          supabase.from("borrowing_items").select("*", { count: 'exact', head: true }).eq("item_id", itemId),
          supabase.from("transactions").select("*", { count: 'exact', head: true }).eq("item_id", itemId)
        ]);

        if (borrowingCheck.count && borrowingCheck.count > 0) {
          results.failed.push({ id: itemId, name: item.name, reason: "Sudah pernah dipinjam" });
          continue;
        }

        if (transactionCheck.count && transactionCheck.count > 0) {
          results.failed.push({ id: itemId, name: item.name, reason: "Memiliki riwayat transaksi" });
          continue;
        }

        const { error: deleteError } = await supabase.from("items").delete().eq("id", itemId);
        if (deleteError) {
          results.failed.push({ id: itemId, name: item.name, reason: deleteError.message });
        } else {
          results.success.push(itemId);
        }
      }
      res.json(results);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // Borrowings
  app.get("/api/borrowings", authenticateToken, async (req, res) => {
    try {
      const { data: borrowings, error } = await supabase
        .from("borrowings")
        .select(`
          *,
          recorder:users!borrowings_user_id_fkey (name),
          borrowing_items (
            *,
            items (name, unit, code),
            locations (name)
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const formatted = (borrowings || []).map(b => ({
        ...b,
        recorder_name: (b as any).recorder?.name,
        items: (b.borrowing_items || []).map((bi: any) => ({
          ...bi,
          item_name: bi.items?.name,
          item_unit: bi.items?.unit,
          item_code: bi.items?.code,
          location_name: bi.locations?.name
        }))
      }));

      res.json(formatted);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.post("/api/borrowings", authenticateToken, async (req: any, res) => {
    const { borrower_name, borrower_phone, start_date, due_date, items } = req.body;
    const user_id = req.user.id;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "Minimal satu barang harus dipilih" });
    }

    try {
      // 1. Create borrowing header
      const { data: borrowing, error: borrowError } = await supabase
        .from("borrowings")
        .insert([{ 
          user_id, 
          borrower_name, 
          borrower_phone, 
          start_date, 
          due_date 
        }])
        .select()
        .single();
      
      if (borrowError) throw borrowError;
      
      const borrowing_id = borrowing.id;

      for (const itemData of items) {
        const { item_id, location_id, quantity, initial_condition, initial_image } = itemData;
        const qty = parseInt(quantity);
        
        // Check stock
        const { data: stock, error: stockFetchError } = await supabase
          .from("item_stock")
          .select("quantity, items(name)")
          .eq("item_id", item_id)
          .eq("location_id", location_id)
          .single();
        
        if (stockFetchError || !stock) throw new Error(`Stok barang tidak ditemukan di lokasi yang dipilih`);
        if (stock.quantity < qty) throw new Error(`Stok barang '${(stock as any).items?.name}' tidak mencukupi (Tersedia: ${stock.quantity})`);

        // Insert borrowing item
        const { error: biError } = await supabase
          .from("borrowing_items")
          .insert([{ 
            borrowing_id, 
            item_id, 
            location_id, 
            quantity: qty, 
            initial_condition, 
            initial_image 
          }]);
        if (biError) throw biError;

        // Update stock
        const { error: updateError } = await supabase
          .from("item_stock")
          .update({ quantity: stock.quantity - qty })
          .eq("item_id", item_id)
          .eq("location_id", location_id);
        if (updateError) throw updateError;
      }

      await logActivity(user_id, "CREATE_BORROWING", `Peminjaman baru oleh: ${borrower_name}`);
      res.json({ success: true, id: borrowing_id });
    } catch (e: any) {
      console.error("Create borrowing failed:", e);
      res.status(400).json({ message: e.message });
    }
  });

  app.put("/api/borrowings/:id", authenticateToken, async (req: any, res) => {
    const { id } = req.params;
    const { borrower_name, borrower_phone, start_date, due_date, items } = req.body;
    const user_id = req.user.id;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "Minimal satu barang harus dipilih" });
    }

    try {
      // 1. Get existing borrowing and items
      const { data: existingBorrowing, error: ebError } = await supabase
        .from("borrowings")
        .select("*")
        .eq("id", id)
        .single();
      
      if (ebError || !existingBorrowing) throw new Error("Peminjaman tidak ditemukan");
      if (existingBorrowing.status === 'returned') throw new Error("Peminjaman yang sudah selesai tidak dapat diubah");

      const { data: existingItems, error: eiError } = await supabase
        .from("borrowing_items")
        .select("*")
        .eq("borrowing_id", id);
      
      if (eiError) throw eiError;

      // 2. Update borrowing header
      await supabase
        .from("borrowings")
        .update({ 
          borrower_name, 
          borrower_phone, 
          start_date, 
          due_date 
        })
        .eq("id", id);

      // 3. Process items
      const newItemIds = items.map(i => i.id).filter(Boolean);
      
      // Handle removed items
      for (const existingItem of (existingItems || [])) {
        if (!newItemIds.includes(existingItem.id)) {
          // Item was removed, restore stock
          const { data: stock } = await supabase
            .from("item_stock")
            .select("quantity")
            .eq("item_id", existingItem.item_id)
            .eq("location_id", existingItem.location_id)
            .single();
            
          await supabase
            .from("item_stock")
            .update({ quantity: (stock?.quantity || 0) + existingItem.quantity })
            .eq("item_id", existingItem.item_id)
            .eq("location_id", existingItem.location_id);
          
          await supabase.from("borrowing_items").delete().eq("id", existingItem.id);
        }
      }

      // Handle new and updated items
      for (const itemData of items) {
        const { id: itemIdInBorrowing, item_id, location_id, quantity, initial_condition, initial_image } = itemData;
        const qty = parseInt(quantity);

        if (itemIdInBorrowing) {
          // Existing item update
          const existingItem = (existingItems || []).find(i => i.id === itemIdInBorrowing);
          if (existingItem) {
            const qtyDiff = qty - existingItem.quantity;
            
            if (qtyDiff !== 0) {
              // Check stock if increasing
              const { data: stock } = await supabase
                .from("item_stock")
                .select("quantity")
                .eq("item_id", item_id)
                .eq("location_id", location_id)
                .single();

              if (!stock || (qtyDiff > 0 && stock.quantity < qtyDiff)) {
                throw new Error(`Stok tidak mencukupi untuk penambahan barang`);
              }

              // Update stock
              await supabase
                .from("item_stock")
                .update({ quantity: stock.quantity - qtyDiff })
                .eq("item_id", item_id)
                .eq("location_id", location_id);
            }

            // Update borrowing item
            await supabase
              .from("borrowing_items")
              .update({ 
                quantity: qty, 
                initial_condition, 
                initial_image: initial_image || existingItem.initial_image 
              })
              .eq("id", itemIdInBorrowing);
          }
        } else {
          // New item added to existing borrowing
          // Check stock
          const { data: stock } = await supabase
            .from("item_stock")
            .select("quantity")
            .eq("item_id", item_id)
            .eq("location_id", location_id)
            .single();
          
          if (!stock || stock.quantity < qty) {
            throw new Error(`Stok tidak mencukupi untuk barang baru`);
          }

          // Update stock
          await supabase
            .from("item_stock")
            .update({ quantity: stock.quantity - qty })
            .eq("item_id", item_id)
            .eq("location_id", location_id);

          // Insert
          await supabase
            .from("borrowing_items")
            .insert([{ 
              borrowing_id: id, 
              item_id, 
              location_id, 
              quantity: qty, 
              initial_condition, 
              initial_image 
            }]);
        }
      }

      await logActivity(user_id, "UPDATE_BORROWING", `Update peminjaman ID: ${id} oleh: ${borrower_name}`);
      res.json({ success: true });
    } catch (e: any) {
      console.error("Update borrowing failed:", e);
      res.status(400).json({ message: e.message });
    }
  });

  app.put("/api/borrowings/:id/return", authenticateToken, async (req: any, res) => {
    const { items } = req.body; // items is an array of { borrowing_item_id, final_condition, return_image }
    const { id } = req.params;
    const user_id = req.user.id;
    const now = new Date().toISOString();

    try {
      for (const itemData of items) {
        const { borrowing_item_id, final_condition, return_image } = itemData;
        
        const { data: borrowingItem, error: biFetchError } = await supabase
          .from("borrowing_items")
          .select("*")
          .eq("id", borrowing_item_id)
          .single();

        if (biFetchError || !borrowingItem) throw new Error("Data peminjaman barang tidak ditemukan");
        if (borrowingItem.status === 'returned') continue;

        // Update borrowing item status
        const { error: biUpdateError } = await supabase
          .from("borrowing_items")
          .update({ 
            return_date: now, 
            final_condition, 
            return_image, 
            status: 'returned' 
          })
          .eq("id", borrowing_item_id);
        
        if (biUpdateError) throw biUpdateError;

        // Return stock
        const { data: stock, error: stockFetchError } = await supabase
          .from("item_stock")
          .select("quantity")
          .eq("item_id", borrowingItem.item_id)
          .eq("location_id", borrowingItem.location_id)
          .single();
        
        if (stockFetchError) throw stockFetchError;

        const { error: stockUpdateError } = await supabase
          .from("item_stock")
          .update({ quantity: (stock?.quantity || 0) + borrowingItem.quantity })
          .eq("item_id", borrowingItem.item_id)
          .eq("location_id", borrowingItem.location_id);
        
        if (stockUpdateError) throw stockUpdateError;
      }

      // Check remaining
      const { count: remainingCount, error: remError } = await supabase
        .from("borrowing_items")
        .select("*", { count: 'exact', head: true })
        .eq("borrowing_id", id)
        .eq("status", "borrowed");
      
      if (!remError && remainingCount === 0) {
        await supabase.from("borrowings").update({ status: 'returned' }).eq("id", id);
      }

      const { data: borrowing } = await supabase.from("borrowings").select("borrower_name").eq("id", id).single();
      await logActivity(user_id, "RETURN_BORROWING", `Pengembalian barang oleh: ${borrowing?.borrower_name}`);
      
      res.json({ success: true });
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  // Damages APIs
  app.get("/api/damages", authenticateToken, async (req, res) => {
    try {
      const { data, error } = await supabase
        .from("damages")
        .select(`
          *,
          items (name, unit),
          locations (name)
        `)
        .order("damage_date", { ascending: false });

      if (error) throw error;

      const formatted = (data || []).map(d => ({
        ...d,
        item_name: (d as any).items?.name,
        item_unit: (d as any).items?.unit,
        location_name: (d as any).locations?.name
      }));

      res.json(formatted);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.post("/api/damages", authenticateToken, async (req, res) => {
    const { item_id, location_id, quantity, cause, damage_date, status, image } = req.body;
    const qty = parseInt(quantity);
    
    if (!item_id || !location_id || !qty || !cause || !damage_date) {
      return res.status(400).json({ message: "Semua field harus diisi" });
    }

    try {
      // Check stock
      const { data: stock, error: stockFetchError } = await supabase
        .from("item_stock")
        .select("quantity")
        .eq("item_id", item_id)
        .eq("location_id", location_id)
        .single();
      
      if (stockFetchError || !stock || stock.quantity < qty) {
        throw new Error("Stok tidak mencukupi di lokasi ini");
      }

      // Record damage
      const { error: damageError } = await supabase
        .from("damages")
        .insert([{ 
          item_id, 
          location_id, 
          quantity: qty, 
          cause, 
          damage_date, 
          status: status || 'damaged', 
          image: image || null 
        }]);
      
      if (damageError) throw damageError;

      // Decrease stock
      const { error: updateError } = await supabase
        .from("item_stock")
        .update({ quantity: stock.quantity - qty })
        .eq("item_id", item_id)
        .eq("location_id", location_id);
      
      if (updateError) throw updateError;

      const { data: item } = await supabase.from("items").select("name").eq("id", item_id).single();
      await logActivity((req as any).user.id, "REPORT_DAMAGE", `Lapor kerusakan: ${item?.name} (${qty} unit)`);
      
      res.json({ success: true });
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.put("/api/damages/:id", authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    try {
      const { data: damage, error: fetchError } = await supabase.from("damages").select("*").eq("id", id).single();
      if (fetchError || !damage) throw new Error("Data kerusakan tidak ditemukan");

      const oldStatus = damage.status;
      const newStatus = status;

      if (oldStatus === newStatus) return res.json({ success: true });

      // Update status
      const { error: updateError } = await supabase.from("damages").update({ status: newStatus }).eq("id", id);
      if (updateError) throw updateError;

      // Logic for stock adjustment
      if (newStatus === 'repaired' && oldStatus !== 'repaired') {
        const { data: stock } = await supabase.from("item_stock").select("quantity").eq("item_id", damage.item_id).eq("location_id", damage.location_id).single();
        await supabase.from("item_stock").update({ quantity: (stock?.quantity || 0) + damage.quantity }).eq("item_id", damage.item_id).eq("location_id", damage.location_id);
      } else if (oldStatus === 'repaired' && newStatus !== 'repaired') {
        const { data: stock } = await supabase.from("item_stock").select("quantity").eq("item_id", damage.item_id).eq("location_id", damage.location_id).single();
        if (!stock || stock.quantity < damage.quantity) throw new Error("Stok tidak mencukupi untuk membatalkan status perbaikan");
        await supabase.from("item_stock").update({ quantity: stock.quantity - damage.quantity }).eq("item_id", damage.item_id).eq("location_id", damage.location_id);
      }

      const { data: item } = await supabase.from("items").select("name").eq("id", damage.item_id).single();
      await logActivity((req as any).user.id, "UPDATE_DAMAGE_STATUS", `Update status kerusakan ${item?.name}: ${oldStatus} -> ${newStatus}`);
      
      res.json({ success: true });
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.delete("/api/damages/:id", authenticateToken, async (req, res) => {
    const { id } = req.params;
    try {
      const { data: damage, error: fetchError } = await supabase.from("damages").select("*").eq("id", id).single();
      if (fetchError || !damage) throw new Error("Data kerusakan tidak ditemukan");

      if (damage.status !== 'repaired' && damage.status !== 'discarded') {
        const { data: stock } = await supabase.from("item_stock").select("quantity").eq("item_id", damage.item_id).eq("location_id", damage.location_id).single();
        await supabase.from("item_stock").update({ quantity: (stock?.quantity || 0) + damage.quantity }).eq("item_id", damage.item_id).eq("location_id", damage.location_id);
      }

      await supabase.from("damages").delete().eq("id", id);
      const { data: item } = await supabase.from("items").select("name").eq("id", damage.item_id).single();
      await logActivity((req as any).user.id, "DELETE_DAMAGE", `Menghapus data kerusakan: ${item?.name}`);
      
      res.json({ success: true });
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  // Dashboard Stats
  app.get("/api/dashboard/stats", authenticateToken, async (req, res) => {
    try {
      const [
        { count: totalItems },
        { count: totalCategories },
        { data: lowStockData },
        { count: activeBorrowings },
        { count: totalDamages },
        { count: activeRepairs }
      ] = await Promise.all([
        supabase.from("items").select("*", { count: 'exact', head: true }),
        supabase.from("categories").select("*", { count: 'exact', head: true }),
        supabase.from("item_stock").select("item_id, quantity"), // Will aggregate manually
        supabase.from("borrowings").select("*", { count: 'exact', head: true }).eq("status", "borrowed"),
        supabase.from("damages").select("*", { count: 'exact', head: true }).eq("status", "damaged"),
        supabase.from("damages").select("*", { count: 'exact', head: true }).eq("status", "under_repair")
      ]);

      // Calculate low stock items manually from aggregated quantities
      const stockMap = new Map<number, number>();
      (lowStockData || []).forEach(s => {
        stockMap.set(s.item_id, (stockMap.get(s.item_id) || 0) + s.quantity);
      });
      let lowStockCount = 0;
      stockMap.forEach(qty => { if (qty < 5) lowStockCount++; });

      const { data: recentBorrowingsRaw } = await supabase
        .from("borrowings")
        .select(`
          id, borrower_name, start_date, status, created_at,
          borrowing_items (quantity, items(name))
        `)
        .order("created_at", { ascending: false })
        .limit(5);

      const recentBorrowings = (recentBorrowingsRaw || []).map((b: any) => ({
        id: b.id,
        borrower_name: b.borrower_name,
        start_date: b.start_date,
        status: b.status,
        created_at: b.created_at,
        item_name: b.borrowing_items?.map((bi: any) => bi.items?.name).join(', '),
        quantity: b.borrowing_items?.reduce((sum: number, bi: any) => sum + bi.quantity, 0)
      }));

      const { data: categoryDistRaw } = await supabase
        .from("categories")
        .select(`name, items(id)`);
      
      const categoryDistribution = (categoryDistRaw || []).map((c: any) => ({
        name: c.name,
        count: c.items?.length || 0
      }));

      // Analytics
      const { data: mostBorrowedRaw } = await supabase
        .from("borrowing_items")
        .select(`items(name)`);
      
      const itemBorrowCount = new Map<string, number>();
      (mostBorrowedRaw || []).forEach((bi: any) => {
        const name = bi.items?.name;
        if (name) itemBorrowCount.set(name, (itemBorrowCount.get(name) || 0) + 1);
      });
      const mostBorrowed = Array.from(itemBorrowCount.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      res.json({
        totalItems,
        totalCategories,
        lowStockItems: lowStockCount,
        activeBorrowings,
        totalDamages,
        activeRepairs,
        recentBorrowings,
        categoryDistribution,
        analytics: {
          mostBorrowed,
          avgDuration: 0 // Placeholder or sophisticated calculation needed
        }
      });
    } catch (e: any) {
      console.error("Dashboard stats error:", e);
      res.status(500).json({ message: e.message || "Gagal mengambil statistik dashboard" });
    }
  });

  // Activity Logs
  app.get("/api/logs", authenticateToken, async (req, res) => {
    if ((req as any).user.role !== 'admin') {
      return res.status(403).json({ message: "Akses ditolak" });
    }
    try {
      const { data, error } = await supabase
        .from("activity_logs")
        .select(`
          *,
          users (name)
        `)
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;

      const formatted = (data || []).map(log => ({
        ...log,
        user_name: (log as any).users?.name
      }));

      res.json(formatted);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // User Management
  app.get("/api/users", authenticateToken, async (req, res) => {
    if ((req as any).user.role !== 'admin') {
      return res.status(403).json({ message: "Akses ditolak" });
    }
    try {
      const { data, error } = await supabase
        .from("users")
        .select("*")
        .order("name", { ascending: true });

      if (error) throw error;
      res.json(data);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.put("/api/users/:id/role", authenticateToken, async (req, res) => {
    if ((req as any).user.role !== 'admin') {
      return res.status(403).json({ message: "Akses ditolak" });
    }
    const { id } = req.params;
    const { role } = req.body;

    if (!['admin', 'user'].includes(role)) {
      return res.status(400).json({ message: "Role tidak valid" });
    }

    try {
      const { error } = await supabase
        .from("users")
        .update({ role })
        .eq("id", id);

      if (error) throw error;
      res.json({ message: "Peran berhasil diperbarui" });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // Reports Export Data
  app.get("/api/reports/export", authenticateToken, async (req, res) => {
    const { month, year } = req.query;
    if (!month || !year) return res.status(400).json({ message: "Bulan dan tahun diperlukan" });

    const startDate = `${year}-${month.toString().padStart(2, '0')}-01T00:00:00Z`;
    const endDate = `${year}-${month.toString().padStart(2, '0')}-31T23:59:59Z`;

    try {
      const { data: borrowings, error: bError } = await supabase
        .from("borrowings")
        .select(`
          *,
          recorder:users!borrowings_user_id_fkey (name),
          borrowing_items (
            *,
            items (name, unit)
          )
        `)
        .gte("created_at", startDate)
        .lte("created_at", endDate);

      if (bError) throw bError;

      const borrowingsWithItems = (borrowings || []).map(b => ({
        ...b,
        recorder_name: (b as any).recorder?.name,
        items: (b.borrowing_items || []).map((bi: any) => ({
          ...bi,
          item_name: bi.items?.name,
          item_unit: bi.items?.unit
        }))
      }));

      const { data: damages, error: dError } = await supabase
        .from("damages")
        .select(`
          *,
          items (name),
          locations (name)
        `)
        .gte("damage_date", startDate.split('T')[0])
        .lte("damage_date", endDate.split('T')[0]);

      if (dError) throw dError;

      const formattedDamages = (damages || []).map(d => ({
        ...d,
        item_name: (d as any).items?.name,
        location_name: (d as any).locations?.name
      }));

      res.json({ borrowings: borrowingsWithItems, damages: formattedDamages });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // Catch-all for /api routes to prevent HTML fallback
  app.all("/api/*", (req, res) => {
    res.status(404).json({ message: `API route ${req.method} ${req.url} not found` });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
