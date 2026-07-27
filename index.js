/* ============================================================
   INDEX.JS — Servidor principal Kernel Shield
   FIX Bug 2: rutas apuntan a archivos en la misma carpeta (raíz)
============================================================ */
require('dotenv').config();
const express      = require('express');
const cookieParser = require('cookie-parser');
const cors         = require('cors');
const path         = require('path');

const authRoutes   = require('./auth.routes');
const plansRoutes  = require('./plans.routes');
const ordersRoutes = require('./orders.routes');
const ticketsRoutes= require('./tickets.routes');
const adminRoutes  = require('./admin.routes');

const app = express();

app.set('trust proxy', 1);
app.use(express.json());
app.use(cookieParser());
app.use(cors({
  // Permite cualquier origen con credenciales (cookies)
  // En producción reemplaza true por 'https://billing.kernelshield.xyz'
  origin: process.env.CORS_ORIGIN === '*' ? true : (process.env.CORS_ORIGIN || true),
  credentials: true
}));

// Health check
app.get('/api/health', (req, res) => res.json({ ok: true, service: 'kernelshield-api', ts: Date.now() }));

// Rutas
app.use('/api/auth',    authRoutes);
app.use('/api/plans',   plansRoutes);
app.use('/api/orders',  ordersRoutes);
app.use('/api/tickets', ticketsRoutes);
app.use('/api/admin',   adminRoutes);

// 404 para rutas API no encontradas
app.use('/api', (req, res) => {
  res.status(404).json({ error: `Ruta no encontrada: ${req.method} ${req.path}` });
});

// Error handler global
app.use((err, req, res, next) => {
  console.error('[server error]', err);
  res.status(500).json({ error: 'Error interno del servidor.' });
});

const PORT = parseInt(process.env.PORT) || 4000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n✅ Kernel Shield API corriendo en http://0.0.0.0:${PORT}`);
  console.log(`   Health check: http://localhost:${PORT}/api/health\n`);
});
