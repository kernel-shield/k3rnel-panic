require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');

const authRoutes = require('./auth.routes');
const plansRoutes = require('./plans.routes');
const ordersRoutes = require('./orders.routes');
const ticketsRoutes = require('./tickets.routes');
const adminRoutes = require('./admin.routes');

const app = express();

app.use(express.json());
app.use(cookieParser());
app.use(cors());
    origin: true,
    credentials: true
}));

app.get('/api/health', (req, res) => res.json({ ok: true, service: 'kernelshield-server' }));

app.use('/api/auth', authRoutes);
app.use('/api/plans', plansRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/tickets', ticketsRoutes);
app.use('/api/admin', adminRoutes);

// Manejador de errores por si algo revienta sin ser capturado en una ruta
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Error interno del servidor.' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`\n✅ Kernel Shield API corriendo en http://localhost:${PORT}`);
  console.log(`   Base de datos: ${require('path').join(__dirname, '..', 'kernelshield.db')}\n`);
});
