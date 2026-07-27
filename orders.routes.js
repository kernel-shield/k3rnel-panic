/* ============================================================
   ORDERS.ROUTES.JS — Kernel Shield
   FIXES:
   - Bug 1: ahora acepta tanto planId como plan_id del body
   - Bug 3: columna unificada a "date" (como está en db.js)
============================================================ */
const express = require('express');
const crypto  = require('crypto');
const db      = require('./db');
const { requireAuth } = require('./auth');

const router = express.Router();
const VALID_METHODS = ['paypal', 'nequi', 'binance'];

function genId(prefix){
  return `${prefix}-${crypto.randomInt(100000, 999999)}`;
}

/* POST /api/orders — crear orden */
router.post('/', requireAuth, async (req, res) => {
  // FIX Bug 1: aceptar plan_id (frontend nuevo) o planId (legacy)
  const planId  = req.body?.plan_id || req.body?.planId;
  const method  = req.body?.method;

  if (!planId) {
    return res.status(400).json({ error: 'Falta el plan seleccionado.' });
  }
  if (!VALID_METHODS.includes(method)) {
    return res.status(400).json({ error: 'Método de pago no válido.' });
  }

  const client = await db.pool.connect();
  let released = false;
  const safeRelease = () => { if(!released){ released=true; client.release(); } };

  try {
    const planRes = await client.query('SELECT * FROM plans WHERE id = $1', [planId]);
    if (planRes.rows.length === 0) {
      safeRelease();
      return res.status(404).json({ error: 'Ese plan ya no está disponible.' });
    }
    const plan  = planRes.rows[0];
    const svcId = genId('SVC');
    const invId = genId('INV');
    const name  = `VPS ${plan.name}`;
    const spec  = `${plan.cores} vCores · ${plan.ram} RAM · ${plan.disk}`;
    const price = parseFloat(plan.price) || 0;

    await client.query('BEGIN');
    await client.query(
      `INSERT INTO services (id, user_id, plan_id, name, spec, price, method, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'pending')`,
      [svcId, req.userId, plan.id, name, spec, price, method]
    );
    await client.query(
      `INSERT INTO invoices (id, user_id, svc_id, "desc", amount, method, status)
       VALUES ($1,$2,$3,$4,$5,$6,'pending')`,
      [invId, req.userId, svcId, name, price, method]
    );
    await client.query('COMMIT');
    safeRelease();
    res.status(201).json({ ok: true, serviceId: svcId, invoiceId: invId });
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch(_){}
    console.error('[orders POST]', e);
    safeRelease();
    res.status(500).json({ error: 'Error al crear la orden.' });
  }
});

/* GET /api/orders/mine — servicios y facturas del usuario */
router.get('/mine', requireAuth, async (req, res) => {
  try {
    // FIX Bug 3: columna es "date", alias como created_at para que el frontend funcione con ambos
    const servicesRes = await db.query(
      `SELECT *, date AS created_at FROM services WHERE user_id = $1 ORDER BY date DESC`,
      [req.userId]
    );
    const invoicesRes = await db.query(
      `SELECT *, date AS created_at FROM invoices WHERE user_id = $1 ORDER BY date DESC`,
      [req.userId]
    );
    res.json({ orders: servicesRes.rows, invoices: invoicesRes.rows });
  } catch (e) {
    console.error('[orders/mine]', e);
    res.status(500).json({ error: 'Error al obtener tus servicios.' });
  }
});

module.exports = router;
