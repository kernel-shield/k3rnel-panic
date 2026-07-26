const express = require('express');
const crypto = require('crypto');
const db = require('./db');
const { requireAuth } = require('../auth');

const router = express.Router();
const VALID_METHODS = ['paypal', 'nequi', 'binance'];

function genId(prefix) {
  return `${prefix}-${crypto.randomInt(100000, 999999)}`;
}

/* Crear una orden nueva: valida el plan y el precio EN EL SERVIDOR
   (nunca confiar en un precio que venga del navegador) y deja el
   servicio + factura en estado "pending" hasta que el admin lo
   verifique manualmente. */
router.post('/', requireAuth, (req, res) => {
  const { planId, method } = req.body || {};
  if (!VALID_METHODS.includes(method)) {
    return res.status(400).json({ error: 'Método de pago no válido.' });
  }
  const plan = db.prepare('SELECT * FROM plans WHERE id = ?').get(planId);
  if (!plan) return res.status(404).json({ error: 'Ese plan ya no está disponible.' });

  const svcId = genId('SVC');
  const invId = genId('INV');
  const name = `VPS ${plan.name}`;
  const spec = `${plan.cores} vCores · ${plan.ram} RAM · ${plan.disk}`;

  const tx = db.transaction(() => {
    db.prepare(`
      INSERT INTO services (id, user_id, plan_id, name, spec, price, method, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')
    `).run(svcId, req.userId, plan.id, name, spec, plan.price, method);

    db.prepare(`
      INSERT INTO invoices (id, user_id, svc_id, desc, amount, method, status)
      VALUES (?, ?, ?, ?, ?, ?, 'pending')
    `).run(invId, req.userId, svcId, name, plan.price, method);
  });
  tx();

  res.status(201).json({ ok: true, serviceId: svcId, invoiceId: invId });
});

/* Servicios + facturas del usuario logueado (para su dashboard) */
router.get('/mine', requireAuth, (req, res) => {
  const services = db.prepare('SELECT * FROM services WHERE user_id = ? ORDER BY date DESC').all(req.userId);
  const invoices = db.prepare('SELECT * FROM invoices WHERE user_id = ? ORDER BY date DESC').all(req.userId);
  res.json({ services, invoices });
});

module.exports = router;
