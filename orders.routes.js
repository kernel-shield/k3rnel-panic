const express = require('express');
const crypto = require('crypto');
const db = require('./db');
const { requireAuth } = require('./auth');

const router = express.Router();
const VALID_METHODS = ['paypal', 'nequi', 'binance'];

function genId(prefix) {
  return `${prefix}-${crypto.randomInt(100000, 999999)}`;
}

router.post('/', requireAuth, async (req, res) => {
  const { planId, method } = req.body || {};
  if (!VALID_METHODS.includes(method)) {
    return res.status(400).json({ error: 'Método de pago no válido.' });
  }

  const client = await db.pool.connect();
  try {
    const planRes = await client.query('SELECT * FROM plans WHERE id = $1', [planId]);
    if (planRes.rows.length === 0) {
      client.release();
      return res.status(404).json({ error: 'Ese plan ya no está disponible.' });
    }
    const plan = planRes.rows[0];

    const svcId = genId('SVC');
    const invId = genId('INV');
    const name = `VPS ${plan.name}`;
    const spec = `${plan.cores} vCores · ${plan.ram} RAM · ${plan.disk}`;
    const price = parseFloat(plan.price) || 0;

    await client.query('BEGIN');
    await client.query(
      `INSERT INTO services (id, user_id, plan_id, name, spec, price, method, status) VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')`,
      [svcId, req.userId, plan.id, name, spec, price, method]
    );
    await client.query(
      `INSERT INTO invoices (id, user_id, svc_id, "desc", amount, method, status) VALUES ($1, $2, $3, $4, $5, $6, 'pending')`,
      [invId, req.userId, svcId, name, price, method]
    );
    await client.query('COMMIT');

    res.status(201).json({ ok: true, serviceId: svcId, invoiceId: invId });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error(e);
    res.status(500).json({ error: 'Error al crear la orden.' });
  } finally {
    client.release();
  }
});

router.get('/mine', requireAuth, async (req, res) => {
  try {
    const servicesRes = await db.query('SELECT * FROM services WHERE user_id = $1 ORDER BY date DESC', [req.userId]);
    const invoicesRes = await db.query('SELECT * FROM invoices WHERE user_id = $1 ORDER BY date DESC', [req.userId]);
    res.json({ services: servicesRes.rows, invoices: invoicesRes.rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al obtener tus servicios.' });
  }
});

module.exports = router;
