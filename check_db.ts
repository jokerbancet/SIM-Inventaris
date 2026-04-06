import Database from 'better-sqlite3';
const db = new Database('inventory.db');
const borrowingsInfo = db.prepare("PRAGMA table_info(borrowings)").all();
console.log("Borrowings table info:", JSON.stringify(borrowingsInfo, null, 2));
const borrowingItemsInfo = db.prepare("PRAGMA table_info(borrowing_items)").all();
console.log("Borrowing_items table info:", JSON.stringify(borrowingItemsInfo, null, 2));
