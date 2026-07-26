/* ============================================================
   DB.JS — Base de datos SQLite para Kernel Shield.
   Se crea automáticamente el archivo kernelshield.db en esta misma
   carpeta la primera vez que arrancas el servidor. No necesitas
   instalar ni configurar ningún motor de base de datos aparte:
   better-sqlite3 guarda todo en ese único archivo.
============================================================ */
const path = require('path');
const Database = require('better-sqlite3');

const dbPath = path.join(__dirname, '..', 'kernelshield.db');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  first TEXT NOT NULL,
  last TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  country TEXT,
  pass_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS plans (
  id TEXT PRIMARY KEY,
  tier TEXT NOT NULL CHECK(tier IN ('essential','premium')),
  name TEXT NOT NULL,
  tag TEXT,
  price REAL NOT NULL,
  cores INTEGER NOT NULL,
  ram TEXT NOT NULL,
  disk TEXT NOT NULL,
  port TEXT NOT NULL,
  bw TEXT NOT NULL,
  backup INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS services (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_id TEXT,
  name TEXT NOT NULL,
  spec TEXT NOT NULL,
  price REAL NOT NULL,
  method TEXT NOT NULL DEFAULT 'paypal',
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','active','rejected')),
  reject_reason TEXT,
  date TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  svc_id TEXT REFERENCES services(id) ON DELETE SET NULL,
  desc TEXT NOT NULL,
  amount REAL NOT NULL,
  method TEXT NOT NULL DEFAULT 'paypal',
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','paid','rejected')),
  date TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tickets (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Otro',
  status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','answered','closed')),
  date TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS ticket_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_id TEXT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  from_role TEXT NOT NULL CHECK(from_role IN ('client','admin')),
  text TEXT NOT NULL,
  date TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_services_user ON services(user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_user ON invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_tickets_user ON tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_msgs_ticket ON ticket_messages(ticket_id);
`);

/* ---------- Seed de planes por defecto (solo si la tabla está vacía) ---------- */
const planCount = db.prepare('SELECT COUNT(*) AS c FROM plans').get().c;
if (planCount === 0) {
  const insertPlan = db.prepare(`
    INSERT INTO plans (id, tier, name, tag, price, cores, ram, disk, port, bw, backup, sort_order)
    VALUES (@id, @tier, @name, @tag, @price, @cores, @ram, @disk, @port, @bw, @backup, @sort_order)
  `);

  const essential = [
    { id: 'micro', name: 'Micro | Essential', tag: null, price: 4.75, cores: 2, ram: '4 GB', disk: '50GB SSD', port: '500 Mbps', bw: '10TB', backup: 0 },
    { id: 'pro', name: 'Pro | Essential', tag: 'Popular', price: 7.45, cores: 4, ram: '8 GB', disk: '80GB SSD', port: '800 Mbps', bw: '10TB', backup: 0 },
    { id: 'max', name: 'Max | Essential', tag: null, price: 14.75, cores: 4, ram: '16 GB', disk: '120GB SSD', port: '800 Mbps', bw: '10TB', backup: 0 },
    { id: 'maxplus', name: 'Max+ | Essential', tag: null, price: 21.50, cores: 6, ram: '24 GB', disk: '160GB SSD', port: '800 Mbps', bw: '10TB', backup: 0 },
    { id: 'super', name: 'Super | Essential', tag: null, price: 32.75, cores: 8, ram: '32 GB', disk: '200GB SSD', port: '800 Mbps', bw: '10TB', backup: 0 },
    { id: 'mega', name: 'Mega | Essential', tag: 'Máximo rendimiento', price: 48.75, cores: 8, ram: '48 GB', disk: '250GB SSD', port: '800 Mbps', bw: '10TB', backup: 0 },
  ];
  const premium = [
    { id: 'nano-vs', name: 'Nano | Virtual Server', tag: null, price: 8.00, cores: 2, ram: '2 GB', disk: '30GB', port: '1+ Gbps', bw: 'Ilimitado', backup: 1 },
    { id: 'micro-vs', name: 'Micro | Virtual Server', tag: null, price: 16.00, cores: 4, ram: '4 GB', disk: '80GB', port: '1+ Gbps', bw: 'Ilimitado', backup: 1 },
    { id: 'pro-vs', name: 'Pro | Virtual Server', tag: 'Popular', price: 32.00, cores: 4, ram: '8 GB', disk: '160GB', port: '1+ Gbps', bw: 'Ilimitado', backup: 1 },
    { id: 'ultra-vs', name: 'Ultra | Virtual Server', tag: null, price: 54.00, cores: 8, ram: '16 GB', disk: '320GB', port: '1+ Gbps', bw: 'Ilimitado', backup: 1 },
    { id: 'mega-vs', name: 'Mega | Virtual Server', tag: null, price: 82.00, cores: 8, ram: '24 GB', disk: '620GB', port: '1+ Gbps', bw: 'Ilimitado', backup: 1 },
    { id: 'max-vs', name: 'Max | Virtual Server', tag: 'Máximo rendimiento', price: 110.00, cores: 12, ram: '32 GB', disk: '980GB SSD', port: '1+ Gbps', bw: 'Ilimitado', backup: 1 },
  ];

  const insertAll = db.transaction((tier, list) => {
    list.forEach((p, i) => insertPlan.run({ ...p, tier, sort_order: i }));
  });
  insertAll('essential', essential);
  insertAll('premium', premium);

  console.log('[db] Planes por defecto insertados.');
}

module.exports = db;
