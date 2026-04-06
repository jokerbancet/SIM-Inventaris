import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("inventory.db");
const JWT_SECRET = process.env.JWT_SECRET || "super-secret-key";

// Helper for logging
const logActivity = (user_id: number, action: string, details: string) => {
  try {
    db.prepare("INSERT INTO activity_logs (user_id, action, details) VALUES (?, ?, ?)").run(user_id, action, details);
  } catch (e) {
    console.error("Failed to log activity:", e);
  }
};

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('admin', 'user')),
    name TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    code TEXT UNIQUE
  );

  CREATE TABLE IF NOT EXISTS locations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL
  );

  CREATE TABLE IF NOT EXISTS items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE,
    name TEXT NOT NULL,
    category_id INTEGER,
    location_id INTEGER,
    quantity INTEGER DEFAULT 0,
    unit TEXT NOT NULL,
    location TEXT,
    description TEXT,
    image TEXT,
    status TEXT DEFAULT 'Tersedia' CHECK(status IN ('Tersedia', 'Dipinjam', 'Rusak', 'Sedang Maintenance')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories(id),
    FOREIGN KEY (location_id) REFERENCES locations(id)
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('in', 'out')),
    quantity INTEGER NOT NULL,
    note TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (item_id) REFERENCES items(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS borrowings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    borrower_name TEXT NOT NULL,
    borrower_phone TEXT,
    start_date DATETIME NOT NULL,
    due_date DATETIME,
    status TEXT DEFAULT 'borrowed' CHECK(status IN ('borrowed', 'returned')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS borrowing_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    borrowing_id INTEGER NOT NULL,
    item_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL,
    initial_condition TEXT NOT NULL,
    initial_image TEXT,
    final_condition TEXT,
    return_image TEXT,
    return_date DATETIME,
    status TEXT DEFAULT 'borrowed' CHECK(status IN ('borrowed', 'returned')),
    FOREIGN KEY (borrowing_id) REFERENCES borrowings(id),
    FOREIGN KEY (item_id) REFERENCES items(id)
  );

  CREATE TABLE IF NOT EXISTS damages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id INTEGER NOT NULL,
    location_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL,
    cause TEXT NOT NULL,
    damage_date DATETIME NOT NULL,
    status TEXT DEFAULT 'damaged' CHECK(status IN ('damaged', 'under_repair', 'repaired', 'discarded')),
    image TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (item_id) REFERENCES items(id),
    FOREIGN KEY (location_id) REFERENCES locations(id)
  );

  CREATE TABLE IF NOT EXISTS activity_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    action TEXT NOT NULL,
    details TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`);

// Migration for existing borrowings table
const borrowingsTableInfo = db.prepare("PRAGMA table_info(borrowings)").all() as any[];
const hasBorrowerPhone = borrowingsTableInfo.some(col => col.name === 'borrower_phone');
const hasDueDate = borrowingsTableInfo.some(col => col.name === 'due_date');
const hasBorrowingsCreatedAt = borrowingsTableInfo.some(col => col.name === 'created_at');

if (!hasBorrowerPhone) {
  try {
    db.prepare("ALTER TABLE borrowings ADD COLUMN borrower_phone TEXT").run();
  } catch (e) {}
}
if (!hasDueDate) {
  try {
    db.prepare("ALTER TABLE borrowings ADD COLUMN due_date DATETIME").run();
  } catch (e) {}
}
if (!hasBorrowingsCreatedAt) {
  try {
    db.prepare("ALTER TABLE borrowings ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP").run();
  } catch (e) {}
}

// Migration: Add code and status to items if they don't exist
const itemsTableInfo = db.prepare("PRAGMA table_info(items)").all() as any[];
const hasCode = itemsTableInfo.some(col => col.name === 'code');
const hasStatus = itemsTableInfo.some(col => col.name === 'status');

if (!hasCode) {
  try {
    db.exec("ALTER TABLE items ADD COLUMN code TEXT");
    db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_items_code ON items(code)");
    console.log("Migration successful: Added code column to items");
  } catch (e) {
    console.error("Migration failed (code):", e);
  }
}

if (!hasStatus) {
  try {
    db.exec("ALTER TABLE items ADD COLUMN status TEXT DEFAULT 'Tersedia' CHECK(status IN ('Tersedia', 'Dipinjam', 'Rusak', 'Sedang Maintenance'))");
  } catch (e) {
    console.error("Migration failed (status):", e);
  }
}

// Migration: Add code to categories if it doesn't exist
const categoriesTableInfo = db.prepare("PRAGMA table_info(categories)").all() as any[];
const hasCategoryCode = categoriesTableInfo.some(col => col.name === 'code');
if (!hasCategoryCode) {
  try {
    // SQLite doesn't always support UNIQUE in ADD COLUMN, so we add it first then create an index
    db.exec("ALTER TABLE categories ADD COLUMN code TEXT");
    db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_code ON categories(code)");
    console.log("Migration successful: Added code column to categories");
  } catch (e) {
    console.error("Migration failed (category code):", e);
  }
}

// Migration: Add location_id to items if it doesn't exist
const tableInfo = db.prepare("PRAGMA table_info(items)").all() as any[];
const hasLocationId = tableInfo.some(col => col.name === 'location_id');
if (!hasLocationId) {
  try {
    db.exec("ALTER TABLE items ADD COLUMN location_id INTEGER REFERENCES locations(id)");
  } catch (e) {
    console.error("Migration failed (location_id):", e);
  }
}

// Migration: Add image to items if it doesn't exist
const hasImage = tableInfo.some(col => col.name === 'image');
if (!hasImage) {
  try {
    db.exec("ALTER TABLE items ADD COLUMN image TEXT");
  } catch (e) {
    console.error("Migration failed (image):", e);
  }
}

// Migration for item_stock
const hasItemStockTable = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='item_stock'").get();
if (!hasItemStockTable) {
  db.exec(`
    CREATE TABLE item_stock (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_id INTEGER NOT NULL,
      location_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE,
      FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE CASCADE,
      UNIQUE(item_id, location_id)
    );
  `);
  
  // Migrate existing data from items to item_stock
  db.exec(`
    INSERT INTO item_stock (item_id, location_id, quantity)
    SELECT id, location_id, quantity FROM items WHERE location_id IS NOT NULL;
  `);
}

// Migration for borrowing_items to include location_id
const borrowingItemsTableInfo = db.prepare("PRAGMA table_info(borrowing_items)").all() as any[];
const hasLocationIdInBorrowingItems = borrowingItemsTableInfo.some(col => col.name === 'location_id');
if (!hasLocationIdInBorrowingItems) {
  db.exec("ALTER TABLE borrowing_items ADD COLUMN location_id INTEGER REFERENCES locations(id)");
  
  // Attempt to backfill location_id from items table for existing borrowings
  db.exec(`
    UPDATE borrowing_items 
    SET location_id = (SELECT location_id FROM items WHERE items.id = borrowing_items.item_id)
    WHERE location_id IS NULL;
  `);
}

// Migration: Add image to damages if it doesn't exist
const damagesTableInfo = db.prepare("PRAGMA table_info(damages)").all() as any[];
const hasImageInDamages = damagesTableInfo.some(col => col.name === 'image');
if (!hasImageInDamages) {
  try {
    db.exec("ALTER TABLE damages ADD COLUMN image TEXT");
  } catch (e) {
    console.error("Migration failed (damages image):", e);
  }
}

// Migration: Remove item_id from borrowings if it exists (for multi-item support)
const borrowingsInfo = db.prepare("PRAGMA table_info(borrowings)").all() as any[];
const hasBorrowingItemId = borrowingsInfo.some(col => col.name === 'item_id');
console.log("Checking for borrowings.item_id:", hasBorrowingItemId);
if (hasBorrowingItemId) {
  try {
    console.log("Attempting to drop item_id from borrowings...");
    // SQLite 3.35.0+ supports DROP COLUMN
    db.exec("ALTER TABLE borrowings DROP COLUMN item_id");
    console.log("Successfully dropped item_id from borrowings.");
  } catch (e) {
    // If DROP COLUMN is not supported, we need to recreate the table
    console.log("DROP COLUMN not supported, recreating borrowings table...");
    db.transaction(() => {
      db.exec(`
        CREATE TABLE borrowings_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          borrower_name TEXT NOT NULL,
          borrower_phone TEXT,
          start_date DATETIME NOT NULL,
          due_date DATETIME,
          status TEXT DEFAULT 'borrowed' CHECK(status IN ('borrowed', 'returned')),
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id)
        );
        INSERT INTO borrowings_new (id, user_id, borrower_name, borrower_phone, start_date, due_date, status, created_at)
        SELECT id, user_id, borrower_name, borrower_phone, start_date, due_date, status, created_at FROM borrowings;
        DROP TABLE borrowings;
        ALTER TABLE borrowings_new RENAME TO borrowings;
      `);
    })();
    console.log("Successfully recreated borrowings table.");
  }
}

// Seed Admin User if not exists
const adminExists = db.prepare("SELECT * FROM users WHERE username = ?").get("admin");
if (!adminExists) {
  const hashedPassword = bcrypt.hashSync("admin123", 10);
  db.prepare("INSERT INTO users (username, password, role, name) VALUES (?, ?, ?, ?)").run(
    "admin",
    hashedPassword,
    "admin",
    "Administrator"
  );
  
  // Seed a regular user
  const userHashedPassword = bcrypt.hashSync("user123", 10);
  db.prepare("INSERT INTO users (username, password, role, name) VALUES (?, ?, ?, ?)").run(
    "user",
    userHashedPassword,
    "user",
    "Staff User"
  );
}

// Seed some categories if empty
const categoryCount = (db.prepare("SELECT COUNT(*) as count FROM categories").get() as any).count;
if (categoryCount === 0) {
  const categories = ["Elektronik", "Alat Tulis Kantor", "Furniture", "Lain-lain"];
  const insertCategory = db.prepare("INSERT INTO categories (name) VALUES (?)");
  categories.forEach(cat => {
    try { insertCategory.run(cat); } catch(e) {}
  });
}

// Seed some locations if empty
const locationCount = (db.prepare("SELECT COUNT(*) as count FROM locations").get() as any).count;
if (locationCount === 0) {
  const locations = ["Gudang Utama", "Ruang Staf", "Laboratorium", "Perpustakaan"];
  const insertLocation = db.prepare("INSERT INTO locations (name) VALUES (?)");
  locations.forEach(loc => {
    try { insertLocation.run(loc); } catch(e) {}
  });
}

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
  const authenticateToken = (req: any, res: any, next: any) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.sendStatus(401);

    jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
      if (err) return res.sendStatus(403);
      req.user = user;
      next();
    });
  };

  const isAdmin = (req: any, res: any, next: any) => {
    if (req.user.role !== 'admin') return res.status(403).json({ message: "Admin access required" });
    next();
  };

  // API Routes
  app.post("/api/login", (req, res) => {
    const { username, password } = req.body;
    const user: any = db.prepare("SELECT * FROM users WHERE username = ?").get(username);

    if (!user || !bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ message: "Invalid username or password" });
    }

    const token = jwt.sign({ id: user.id, username: user.username, role: user.role, name: user.name }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ token, user: { id: user.id, username: user.username, role: user.role, name: user.name } });
  });

  // Categories
  app.get("/api/categories", authenticateToken, (req, res) => {
    const categories = db.prepare("SELECT * FROM categories").all();
    res.json(categories);
  });

  app.post("/api/categories", authenticateToken, isAdmin, (req, res) => {
    const { name, code } = req.body;
    try {
      const info = db.prepare("INSERT INTO categories (name, code) VALUES (?, ?)").run(name, code || null);
      logActivity((req as any).user.id, "CREATE_CATEGORY", `Menambah kategori: ${name}`);
      res.json({ id: info.lastInsertRowid, name, code });
    } catch (e: any) {
      console.error("Create category failed:", e);
      res.status(400).json({ message: e.message || "Category already exists" });
    }
  });

  app.put("/api/categories/:id", authenticateToken, isAdmin, (req, res) => {
    const { id } = req.params;
    const { name, code } = req.body;
    try {
      db.prepare("UPDATE categories SET name = ?, code = ? WHERE id = ?").run(name, code || null, id);
      logActivity((req as any).user.id, "UPDATE_CATEGORY", `Update kategori: ${name}`);
      res.json({ id, name, code });
    } catch (e: any) {
      console.error("Update category failed:", e);
      res.status(400).json({ message: e.message || "Update failed" });
    }
  });

  app.delete("/api/categories/:id", authenticateToken, isAdmin, (req, res) => {
    const { id } = req.params;
    try {
      const category: any = db.prepare("SELECT name FROM categories WHERE id = ?").get(id);
      db.prepare("DELETE FROM categories WHERE id = ?").run(id);
      logActivity((req as any).user.id, "DELETE_CATEGORY", `Menghapus kategori: ${category?.name}`);
      res.json({ message: "Category deleted" });
    } catch (e) {
      res.status(400).json({ message: "Delete failed" });
    }
  });

  app.get("/api/categories/:id/next-code", authenticateToken, (req, res) => {
    const { id } = req.params;
    try {
      const category: any = db.prepare("SELECT code FROM categories WHERE id = ?").get(id);
      if (!category || !category.code) {
        return res.json({ nextCode: "" });
      }
      
      // Get the highest number from existing codes with this category prefix
      const prefix = `${category.code}-`;
      const items = db.prepare("SELECT code FROM items WHERE category_id = ? AND code LIKE ?").all(id, `${prefix}%`) as any[];
      
      let maxNum = 0;
      items.forEach(item => {
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
  app.get("/api/locations", authenticateToken, (req, res) => {
    const locations = db.prepare("SELECT * FROM locations").all();
    res.json(locations);
  });

  app.post("/api/locations", authenticateToken, isAdmin, (req, res) => {
    const { name } = req.body;
    try {
      const info = db.prepare("INSERT INTO locations (name) VALUES (?)").run(name);
      logActivity((req as any).user.id, "CREATE_LOCATION", `Menambah lokasi: ${name}`);
      res.json({ id: info.lastInsertRowid, name });
    } catch (e) {
      res.status(400).json({ message: "Location already exists" });
    }
  });

  // Items
  app.get("/api/items", authenticateToken, (req, res) => {
    const items = db.prepare(`
      SELECT items.*, categories.name as category_name
      FROM items 
      LEFT JOIN categories ON items.category_id = categories.id
    `).all() as any[];
    
    const stocks = db.prepare(`
      SELECT item_stock.*, locations.name as location_name
      FROM item_stock
      JOIN locations ON item_stock.location_id = locations.id
    `).all() as any[];
    
    const itemsWithStock = items.map(item => {
      const itemStocks = stocks.filter(s => s.item_id === item.id);
      return {
        ...item,
        stock: itemStocks,
        total_quantity: itemStocks.reduce((sum, s) => sum + s.quantity, 0)
      };
    });
    
    res.json(itemsWithStock);
  });

  app.post("/api/items", authenticateToken, isAdmin, (req: any, res) => {
    const { code, name, category_id, stock, unit, description, image, status } = req.body;
    const user_id = req.user.id;
    // stock: [{ location_id: number, quantity: number }]
    
    const insertItem = db.prepare(`
      INSERT INTO items (code, name, category_id, unit, description, image, status) 
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    
    const insertStock = db.prepare(`
      INSERT INTO item_stock (item_id, location_id, quantity) VALUES (?, ?, ?)
    `);
    
    const transaction = db.transaction(() => {
      const info = insertItem.run(code || null, name, category_id, unit, description, image, status || 'Tersedia');
      const itemId = info.lastInsertRowid;
      
      if (stock && Array.isArray(stock)) {
        stock.forEach((s: any) => {
          if (s.location_id && s.quantity >= 0) {
            insertStock.run(itemId, s.location_id, s.quantity);
          }
        });
      }

      logActivity(user_id, "CREATE_ITEM", `Menambahkan barang: ${name} (${code})`);
      return itemId;
    });
    
    try {
      const itemId = transaction();
      res.json({ id: itemId });
    } catch (e: any) {
      if (e.message.includes('UNIQUE constraint failed: items.code')) {
        return res.status(400).json({ message: "Kode barang sudah digunakan" });
      }
      res.status(500).json({ message: e.message });
    }
  });

  app.put("/api/items/:id", authenticateToken, isAdmin, (req: any, res) => {
    const { name, category_id, stock, unit, description, image, status } = req.body;
    const itemId = req.params.id;
    const user_id = req.user.id;
    
    const updateItem = db.prepare(`
      UPDATE items SET name = ?, category_id = ?, unit = ?, description = ?, image = ?, status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    
    const deleteStock = db.prepare("DELETE FROM item_stock WHERE item_id = ?");
    const insertStock = db.prepare("INSERT INTO item_stock (item_id, location_id, quantity) VALUES (?, ?, ?)");
    
    const transaction = db.transaction(() => {
      updateItem.run(name, category_id, unit, description, image, status || 'Tersedia', itemId);
      deleteStock.run(itemId);
      if (stock && Array.isArray(stock)) {
        stock.forEach((s: any) => {
          if (s.location_id && s.quantity >= 0) {
            insertStock.run(itemId, s.location_id, s.quantity);
          }
        });
      }

      const item: any = db.prepare("SELECT code FROM items WHERE id = ?").get(itemId);
      logActivity(user_id, "UPDATE_ITEM", `Memperbarui barang: ${name} (${item?.code})`);
    });
    
    try {
      transaction();
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.delete("/api/items/:id", authenticateToken, isAdmin, (req: any, res) => {
    const id = req.params.id;
    const user_id = req.user.id;
    
    // Check for references in borrowing_items
    const borrowingRef = db.prepare("SELECT COUNT(*) as count FROM borrowing_items WHERE item_id = ?").get(id) as any;
    if (borrowingRef.count > 0) {
      return res.status(400).json({ message: "Barang tidak bisa dihapus karena sudah pernah dipinjam" });
    }

    // Check for references in transactions
    const transactionRef = db.prepare("SELECT COUNT(*) as count FROM transactions WHERE item_id = ?").get(id) as any;
    if (transactionRef.count > 0) {
      return res.status(400).json({ message: "Barang tidak bisa dihapus karena memiliki riwayat transaksi" });
    }

    const item: any = db.prepare("SELECT name, code FROM items WHERE id = ?").get(id);
    db.prepare("DELETE FROM items WHERE id = ?").run(id);
    logActivity(user_id, "DELETE_ITEM", `Menghapus barang: ${item?.name} (${item?.code})`);
    res.json({ success: true });
  });

  app.post("/api/items/bulk-delete", authenticateToken, isAdmin, (req, res) => {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids)) {
      return res.status(400).json({ message: "Invalid IDs" });
    }

    const results = {
      success: [] as number[],
      failed: [] as { id: number, name: string, reason: string }[]
    };

    const deleteTransaction = db.transaction(() => {
      for (const id of ids) {
        const item: any = db.prepare("SELECT name FROM items WHERE id = ?").get(id);
        if (!item) continue;

        // Check for references
        const borrowingRef = db.prepare("SELECT COUNT(*) as count FROM borrowing_items WHERE item_id = ?").get(id) as any;
        if (borrowingRef.count > 0) {
          results.failed.push({ id, name: item.name, reason: "Sudah pernah dipinjam" });
          continue;
        }

        const transactionRef = db.prepare("SELECT COUNT(*) as count FROM transactions WHERE item_id = ?").get(id) as any;
        if (transactionRef.count > 0) {
          results.failed.push({ id, name: item.name, reason: "Memiliki riwayat transaksi" });
          continue;
        }

        db.prepare("DELETE FROM items WHERE id = ?").run(id);
        results.success.push(id);
      }
    });

    try {
      deleteTransaction();
      res.json(results);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // Borrowings
  app.get("/api/borrowings", authenticateToken, (req, res) => {
    const borrowings = db.prepare(`
      SELECT 
        borrowings.id,
        borrowings.user_id,
        borrowings.borrower_name,
        borrowings.borrower_phone,
        borrowings.start_date,
        borrowings.due_date,
        borrowings.status,
        borrowings.created_at,
        users.name as recorder_name
      FROM borrowings
      JOIN users ON borrowings.user_id = users.id
      ORDER BY borrowings.created_at DESC
    `).all() as any[];

    const borrowingsWithItems = borrowings.map(b => {
      const items = db.prepare(`
        SELECT borrowing_items.*, items.name as item_name, items.unit
        FROM borrowing_items
        JOIN items ON borrowing_items.item_id = items.id
        WHERE borrowing_id = ?
      `).all(b.id);
      return { ...b, items };
    });

    res.json(borrowingsWithItems);
  });

  app.post("/api/borrowings", authenticateToken, (req: any, res) => {
    const { borrower_name, borrower_phone, start_date, due_date, items } = req.body; // items is an array of { item_id, location_id, quantity, initial_condition, initial_image }
    const user_id = req.user.id;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "Minimal satu barang harus dipilih" });
    }

    const dbTransaction = db.transaction(() => {
      // Create borrowing header
      const info = db.prepare(`
        INSERT INTO borrowings (user_id, borrower_name, borrower_phone, start_date, due_date) 
        VALUES (?, ?, ?, ?, ?)
      `).run(user_id, borrower_name, borrower_phone, start_date, due_date);
      
      const borrowing_id = info.lastInsertRowid;

      for (const itemData of items) {
        const { item_id, location_id, quantity, initial_condition, initial_image } = itemData;
        
        // Log borrowing item
        db.prepare(`
          INSERT INTO borrowing_items (borrowing_id, item_id, location_id, quantity, initial_condition, initial_image) 
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(borrowing_id, item_id, location_id, quantity, initial_condition, initial_image);

        // Update item stock
        const stock: any = db.prepare(`
          SELECT item_stock.*, items.name as item_name 
          FROM item_stock 
          JOIN items ON item_stock.item_id = items.id
          WHERE item_stock.item_id = ? AND item_stock.location_id = ?
        `).get(item_id, location_id);
        
        if (!stock) throw new Error(`Stok barang tidak ditemukan di lokasi yang dipilih`);
        
        const newQuantity = stock.quantity - quantity;
        if (newQuantity < 0) throw new Error(`Stok barang '${stock.item_name}' tidak mencukupi di lokasi ini (Tersedia: ${stock.quantity})`);

        db.prepare("UPDATE item_stock SET quantity = ? WHERE item_id = ? AND location_id = ?").run(newQuantity, item_id, location_id);
      }

      logActivity(user_id, "CREATE_BORROWING", `Peminjaman baru oleh: ${borrower_name}`);
    });

    try {
      dbTransaction();
      res.json({ success: true });
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.put("/api/borrowings/:id", authenticateToken, (req: any, res) => {
    const { id } = req.params;
    const { borrower_name, borrower_phone, start_date, due_date, items } = req.body;
    const user_id = req.user.id;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "Minimal satu barang harus dipilih" });
    }

    const dbTransaction = db.transaction(() => {
      // 1. Get existing borrowing and items
      const existingBorrowing = db.prepare("SELECT * FROM borrowings WHERE id = ?").get(id) as any;
      if (!existingBorrowing) throw new Error("Peminjaman tidak ditemukan");
      if (existingBorrowing.status === 'returned') throw new Error("Peminjaman yang sudah selesai tidak dapat diubah");

      const existingItems = db.prepare("SELECT * FROM borrowing_items WHERE borrowing_id = ?").all(id) as any[];

      // 2. Update borrowing header
      db.prepare(`
        UPDATE borrowings 
        SET borrower_name = ?, borrower_phone = ?, start_date = ?, due_date = ?
        WHERE id = ?
      `).run(borrower_name, borrower_phone, start_date, due_date, id);

      // 3. Process items
      const newItemIds = items.map(i => i.id).filter(Boolean);
      
      // Handle removed items
      for (const existingItem of existingItems) {
        if (!newItemIds.includes(existingItem.id)) {
          // Item was removed, restore stock
          db.prepare(`
            UPDATE item_stock 
            SET quantity = quantity + ? 
            WHERE item_id = ? AND location_id = ?
          `).run(existingItem.quantity, existingItem.item_id, existingItem.location_id);
          
          db.prepare("DELETE FROM borrowing_items WHERE id = ?").run(existingItem.id);
        }
      }

      // Handle new and updated items
      for (const itemData of items) {
        const { id: itemIdInBorrowing, item_id, location_id, quantity, initial_condition, initial_image } = itemData;

        if (itemIdInBorrowing) {
          // Existing item update
          const existingItem = existingItems.find(i => i.id === itemIdInBorrowing);
          if (existingItem) {
            const qtyDiff = quantity - existingItem.quantity;
            
            if (qtyDiff !== 0) {
              // Check stock if increasing
              if (qtyDiff > 0) {
                const stock: any = db.prepare("SELECT quantity FROM item_stock WHERE item_id = ? AND location_id = ?").get(item_id, location_id);
                if (!stock || stock.quantity < qtyDiff) {
                  throw new Error(`Stok tidak mencukupi untuk penambahan barang`);
                }
              }

              // Update stock
              db.prepare(`
                UPDATE item_stock 
                SET quantity = quantity - ? 
                WHERE item_id = ? AND location_id = ?
              `).run(qtyDiff, item_id, location_id);
            }

            // Update borrowing item
            db.prepare(`
              UPDATE borrowing_items 
              SET quantity = ?, initial_condition = ?, initial_image = ?
              WHERE id = ?
            `).run(quantity, initial_condition, initial_image || existingItem.initial_image, itemIdInBorrowing);
          }
        } else {
          // New item added to existing borrowing
          db.prepare(`
            INSERT INTO borrowing_items (borrowing_id, item_id, location_id, quantity, initial_condition, initial_image) 
            VALUES (?, ?, ?, ?, ?, ?)
          `).run(id, item_id, location_id, quantity, initial_condition, initial_image);

          // Update stock
          const stock: any = db.prepare("SELECT quantity FROM item_stock WHERE item_id = ? AND location_id = ?").get(item_id, location_id);
          if (!stock || stock.quantity < quantity) {
            throw new Error(`Stok tidak mencukupi untuk barang baru`);
          }

          db.prepare(`
            UPDATE item_stock 
            SET quantity = quantity - ? 
            WHERE item_id = ? AND location_id = ?
          `).run(quantity, item_id, location_id);
        }
      }

      logActivity(user_id, "UPDATE_BORROWING", `Update peminjaman ID: ${id} oleh: ${borrower_name}`);
    });

    try {
      dbTransaction();
      res.json({ success: true });
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.put("/api/borrowings/:id/return", authenticateToken, (req: any, res) => {
    const { items } = req.body; // items is an array of { borrowing_item_id, final_condition, return_image }
    const { id } = req.params;
    const user_id = req.user.id;
    const now = new Date().toISOString();

    const dbTransaction = db.transaction(() => {
      for (const itemData of items) {
        const { borrowing_item_id, final_condition, return_image } = itemData;
        
        const borrowingItem: any = db.prepare("SELECT * FROM borrowing_items WHERE id = ?").get(borrowing_item_id);
        if (!borrowingItem) throw new Error("Data peminjaman barang tidak ditemukan");
        if (borrowingItem.status === 'returned') continue; // Skip if already returned

        // Update borrowing item status
        db.prepare(`
          UPDATE borrowing_items 
          SET return_date = ?, final_condition = ?, return_image = ?, status = 'returned'
          WHERE id = ?
        `).run(now, final_condition, return_image, borrowing_item_id);

        // Return stock to the specific location
        db.prepare(`
          UPDATE item_stock 
          SET quantity = quantity + ? 
          WHERE item_id = ? AND location_id = ?
        `).run(borrowingItem.quantity, borrowingItem.item_id, borrowingItem.location_id);
      }

      // Check if all items in this borrowing are returned
      const remaining = db.prepare("SELECT COUNT(*) as count FROM borrowing_items WHERE borrowing_id = ? AND status = 'borrowed'").get(id) as any;
      if (remaining.count === 0) {
        db.prepare("UPDATE borrowings SET status = 'returned' WHERE id = ?").run(id);
      }

      const borrowing: any = db.prepare("SELECT borrower_name FROM borrowings WHERE id = ?").get(id);
      logActivity(user_id, "RETURN_BORROWING", `Pengembalian barang oleh: ${borrowing?.borrower_name}`);
    });

    try {
      dbTransaction();
      res.json({ success: true });
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  // Damages APIs
  app.get("/api/damages", authenticateToken, (req, res) => {
    const damages = db.prepare(`
      SELECT 
        damages.*, 
        items.name as item_name, 
        items.unit as item_unit,
        locations.name as location_name
      FROM damages
      JOIN items ON damages.item_id = items.id
      JOIN locations ON damages.location_id = locations.id
      ORDER BY damages.damage_date DESC
    `).all();
    res.json(damages);
  });

  app.post("/api/damages", authenticateToken, (req, res) => {
    const { item_id, location_id, quantity, cause, damage_date, status, image } = req.body;
    
    if (!item_id || !location_id || !quantity || !cause || !damage_date) {
      return res.status(400).json({ message: "Semua field harus diisi" });
    }

    const dbTransaction = db.transaction(() => {
      // Check stock
      const stock = db.prepare("SELECT quantity FROM item_stock WHERE item_id = ? AND location_id = ?").get(item_id, location_id) as any;
      if (!stock || stock.quantity < quantity) {
        throw new Error("Stok tidak mencukupi di lokasi ini");
      }

      // Record damage
      db.prepare(`
        INSERT INTO damages (item_id, location_id, quantity, cause, damage_date, status, image)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(item_id, location_id, quantity, cause, damage_date, status || 'damaged', image || null);

      // Decrease stock
      db.prepare("UPDATE item_stock SET quantity = quantity - ? WHERE item_id = ? AND location_id = ?")
        .run(quantity, item_id, location_id);

      const item: any = db.prepare("SELECT name FROM items WHERE id = ?").get(item_id);
      logActivity((req as any).user.id, "REPORT_DAMAGE", `Lapor kerusakan: ${item?.name} (${quantity} unit)`);
    });

    try {
      dbTransaction();
      res.json({ success: true });
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.put("/api/damages/:id", authenticateToken, (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    const dbTransaction = db.transaction(() => {
      const damage = db.prepare("SELECT * FROM damages WHERE id = ?").get(id) as any;
      if (!damage) throw new Error("Data kerusakan tidak ditemukan");

      const oldStatus = damage.status;
      const newStatus = status;

      if (oldStatus === newStatus) return;

      // Update status
      db.prepare("UPDATE damages SET status = ? WHERE id = ?").run(newStatus, id);

      // If changing to repaired, add back to stock
      if (newStatus === 'repaired' && oldStatus !== 'repaired') {
        db.prepare("UPDATE item_stock SET quantity = quantity + ? WHERE item_id = ? AND location_id = ?")
          .run(damage.quantity, damage.item_id, damage.location_id);
      }
      // If changing FROM repaired to something else, subtract from stock
      else if (oldStatus === 'repaired' && newStatus !== 'repaired') {
        const stock = db.prepare("SELECT quantity FROM item_stock WHERE item_id = ? AND location_id = ?").get(damage.item_id, damage.location_id) as any;
        if (!stock || stock.quantity < damage.quantity) {
          throw new Error("Stok tidak mencukupi untuk membatalkan status perbaikan");
        }
        db.prepare("UPDATE item_stock SET quantity = quantity - ? WHERE item_id = ? AND location_id = ?")
          .run(damage.quantity, damage.item_id, damage.location_id);
      }

      const item: any = db.prepare("SELECT name FROM items WHERE id = ?").get(damage.item_id);
      logActivity((req as any).user.id, "UPDATE_DAMAGE_STATUS", `Update status kerusakan ${item?.name}: ${oldStatus} -> ${newStatus}`);
    });

    try {
      dbTransaction();
      res.json({ success: true });
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.delete("/api/damages/:id", authenticateToken, (req, res) => {
    const { id } = req.params;

    const dbTransaction = db.transaction(() => {
      const damage = db.prepare("SELECT * FROM damages WHERE id = ?").get(id) as any;
      if (!damage) throw new Error("Data kerusakan tidak ditemukan");

      // If it wasn't repaired, add back to stock when deleting record?
      // Actually, deleting a record usually means it was a mistake.
      if (damage.status !== 'repaired' && damage.status !== 'discarded') {
        db.prepare("UPDATE item_stock SET quantity = quantity + ? WHERE item_id = ? AND location_id = ?")
          .run(damage.quantity, damage.item_id, damage.location_id);
      }

      db.prepare("DELETE FROM damages WHERE id = ?").run(id);

      const item: any = db.prepare("SELECT name FROM items WHERE id = ?").get(damage.item_id);
      logActivity((req as any).user.id, "DELETE_DAMAGE", `Menghapus data kerusakan: ${item?.name}`);
    });

    try {
      dbTransaction();
      res.json({ success: true });
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  // Dashboard Stats
  app.get("/api/dashboard/stats", authenticateToken, (req, res) => {
    try {
      const totalItems = db.prepare("SELECT COUNT(*) as count FROM items").get() as any;
      const totalCategories = db.prepare("SELECT COUNT(*) as count FROM categories").get() as any;
      
      // Low stock items: items with total quantity across all locations < 5
      const lowStockItems = db.prepare(`
        SELECT COUNT(*) as count FROM (
          SELECT item_id FROM item_stock GROUP BY item_id HAVING SUM(quantity) < 5
        )
      `).get() as any;
      
      const activeBorrowings = db.prepare("SELECT COUNT(*) as count FROM borrowings WHERE status = 'borrowed'").get() as any;
      
      const totalDamages = db.prepare("SELECT COUNT(*) as count FROM damages WHERE status = 'damaged'").get() as any;
      const activeRepairs = db.prepare("SELECT COUNT(*) as count FROM damages WHERE status = 'under_repair'").get() as any;

      const recentBorrowings = db.prepare(`
        SELECT 
          borrowings.id,
          borrowings.borrower_name,
          borrowings.start_date,
          borrowings.status,
          borrowings.created_at,
          GROUP_CONCAT(items.name, ', ') as item_name,
          SUM(borrowing_items.quantity) as quantity
        FROM borrowings 
        JOIN borrowing_items ON borrowings.id = borrowing_items.borrowing_id
        JOIN items ON borrowing_items.item_id = items.id 
        GROUP BY borrowings.id
        ORDER BY borrowings.created_at DESC LIMIT 5
      `).all();

      const categoryDistribution = db.prepare(`
        SELECT categories.name, COUNT(items.id) as count
        FROM categories
        LEFT JOIN items ON categories.id = items.category_id
        GROUP BY categories.id
      `).all();

      res.json({
        totalItems: totalItems.count,
        totalCategories: totalCategories.count,
        lowStockItems: lowStockItems.count,
        activeBorrowings: activeBorrowings.count,
        totalDamages: totalDamages.count,
        activeRepairs: activeRepairs.count,
        recentBorrowings,
        categoryDistribution,
        analytics: {
          mostBorrowed: db.prepare(`
            SELECT items.name, COUNT(borrowing_items.id) as count
            FROM borrowing_items
            JOIN items ON borrowing_items.item_id = items.id
            GROUP BY items.id
            ORDER BY count DESC
            LIMIT 5
          `).all(),
          avgDuration: (() => {
            const res = db.prepare(`
              SELECT AVG(julianday(bi.return_date) - julianday(b.created_at)) as avg_days
              FROM borrowing_items bi
              JOIN borrowings b ON bi.borrowing_id = b.id
              WHERE bi.status = 'returned' AND bi.return_date IS NOT NULL
            `).get() as any;
            return res.avg_days ? parseFloat(res.avg_days.toFixed(1)) : 0;
          })()
        }
      });
    } catch (e: any) {
      console.error("Dashboard stats error:", e);
      res.status(500).json({ message: e.message || "Gagal mengambil statistik dashboard" });
    }
  });

  // Activity Logs
  app.get("/api/logs", authenticateToken, (req, res) => {
    if ((req as any).user.role !== 'admin') {
      return res.status(403).json({ message: "Akses ditolak" });
    }
    const logs = db.prepare(`
      SELECT activity_logs.*, users.name as user_name 
      FROM activity_logs 
      JOIN users ON activity_logs.user_id = users.id 
      ORDER BY activity_logs.created_at DESC 
      LIMIT 100
    `).all();
    res.json(logs);
  });

  // Reports Export Data
  app.get("/api/reports/export", authenticateToken, (req, res) => {
    const { month, year } = req.query;
    if (!month || !year) return res.status(400).json({ message: "Bulan dan tahun diperlukan" });

    const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
    const endDate = `${year}-${month.toString().padStart(2, '0')}-31`;

    const borrowings = db.prepare(`
      SELECT b.*, u.name as recorder_name
      FROM borrowings b
      JOIN users u ON b.user_id = u.id
      WHERE b.created_at BETWEEN ? AND ?
    `).all(startDate, endDate) as any[];

    const borrowingsWithItems = borrowings.map(b => {
      const items = db.prepare(`
        SELECT bi.*, i.name as item_name, i.unit
        FROM borrowing_items bi
        JOIN items i ON bi.item_id = i.id
        WHERE bi.borrowing_id = ?
      `).all(b.id);
      return { ...b, items };
    });

    const damages = db.prepare(`
      SELECT d.*, i.name as item_name, l.name as location_name
      FROM damages d
      JOIN items i ON d.item_id = i.id
      JOIN locations l ON d.location_id = l.id
      WHERE d.damage_date BETWEEN ? AND ?
    `).all(startDate, endDate);

    res.json({ borrowings: borrowingsWithItems, damages });
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
