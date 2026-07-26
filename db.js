/* ============================================================
   DB.JS — Conexión a PostgreSQL (Supabase) para Kernel Shield.
   ============================================================ */
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Inicializar tablas en PostgreSQL automáticamente al arrancar
async function initDB() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        first TEXT NOT NULL,
        last TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        country TEXT,
        pass_hash TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (NOW()::text)
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
        date TEXT NOT NULL DEFAULT (NOW()::text)
      );

      CREATE TABLE IF NOT EXISTS invoices (
        id TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        svc_id TEXT REFERENCES services(id) ON DELETE SET NULL,
        "desc" TEXT NOT NULL,
        amount REAL NOT NULL,
        method TEXT NOT NULL DEFAULT 'paypal',
        status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','paid','rejected')),
        date TEXT NOT NULL DEFAULT (NOW()::text)
      );

      CREATE TABLE IF NOT EXISTS tickets (
        id TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        subject TEXT NOT NULL,
        category TEXT NOT NULL DEFAULT 'Otro',
        status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','answered','closed')),
        date TEXT NOT NULL DEFAULT (NOW()::text)
      );

      CREATE TABLE IF NOT EXISTS ticket_messages (
        id SERIAL PRIMARY KEY,
        ticket_id TEXT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
        from_role TEXT NOT NULL CHECK(from_role IN ('client','admin')),
        text TEXT NOT NULL,
        date TEXT NOT NULL DEFAULT (NOW()::text)
      );
    `);

    // Seed de planes por defecto
    const planCheck = await client.query('SELECT COUNT(*) AS c FROM plans');
    if (parseInt(planCheck.rows[0].c) === 0) {
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

      for (let i = 0; i < essential.length; i++) {
        let p = essential[i];
        await client.query(
          `INSERT INTO plans (id, tier, name, tag, price, cores, ram, disk, port, bw, backup, sort_order) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) ON CONFLICT (id) DO NOTHING`,
          [p.id, 'essential', p.name, p.tag, p.price, p.cores, p.ram, p.disk, p.port, p.bw, p.backup, i]
        );
      }
      for (let i = 0; i < premium.length; i++) {
        let p = premium[i];
        await client.query(
          `INSERT INTO plans (id, tier, name, tag, price, cores, ram, disk, port, bw, backup, sort_order) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) ON CONFLICT (id) DO NOTHING`,
          [p.id, 'premium', p.name, p.tag, p.price, p.cores, p.ram, p.disk, p.port, p.bw, p.backup, i]
        );
      }
      console.log('[db] Planes por defecto insertados en Supabase.');
    }
    console.log('[db] Conectado exitosamente a Supabase PostgreSQL.');
  } catch (err) {
    console.error('Error al inicializar la base de datos de Supabase:', err);
  } finally {
    client.release();
  }
}

initDB();

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool
};
