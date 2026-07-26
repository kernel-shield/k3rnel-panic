const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('./db');
const { setAdminCookie, clearAdminCookie, requireAdmin } = require('../auth');

const router = express.Router();

/* ---------- Login / logout del panel admin ---------- */
router.post('/login', async (req, res) => {
  const { password } = req.body || {};
  const hash = process.env.ADMIN_PASSWORD_HASH;
  if (!hash) {
    return res.status(500).json({ error: 'El servidor no tiene configurada la contraseña de admin (ADMIN_PASSWORD_HASH en .env).' });
  }
  const ok = await bcrypt.compare(password || '', hash);
  if (!ok) return res.status(401).json({ error: 'Contraseña incorrecta.' });
  setAdminCookie(res);
  res.json({ ok: true });
});

router.post('/logout', (req, res) => {
  clearAdminCookie(res);
  res.json({ ok: true });
});

/* Todo lo de abajo requiere sesión de admin válida */
router.use(requireAdmin);

/* ---------- Órdenes (servicios) de todos los clientes ---------- */
router.get('/orders', (req, res) => {
  const rows = db.prepare(`
    SELECT s.*, u.first, u.last, u.email
    FROM services s JOIN users u ON u.id = s.user_id
    ORDER BY s.date DESC
  `).all();
  res.json({ orders: rows });
});

router.post('/orders/:id/approve', (req, res) => {
  const svc = db.prepare('SELECT * FROM services WHERE id = ?').get(req.params.id);
  if (!svc) return res.status(404).json({ error: 'Orden no encontrada.' });
  const tx = db.transaction(() => {
    db.prepare(`UPDATE services SET status='active', reject_reason=NULL WHERE id = ?`).run(svc.id);
    db.prepare(`UPDATE invoices SET status='paid' WHERE svc_id = ?`).run(svc.id);
  });
  tx();
  res.json({ ok: true });
});

router.post('/orders/:id/reject', (req, res) => {
  const svc = db.prepare('SELECT * FROM services WHERE id = ?').get(req.params.id);
  if (!svc) return res.status(404).json({ error: 'Orden no encontrada.' });
  const reason = (req.body && req.body.reason) || 'Pago no verificado';
  const tx = db.transaction(() => {
    db.prepare(`UPDATE services SET status='rejected', reject_reason=? WHERE id = ?`).run(reason, svc.id);
    db.prepare(`UPDATE invoices SET status='rejected' WHERE svc_id = ?`).run(svc.id);
  });
  tx();
  res.json({ ok: true });
});

router.post('/orders/:id/revoke', (req, res) => {
  const svc = db.prepare('SELECT * FROM services WHERE id = ?').get(req.params.id);
  if (!svc) return res.status(404).json({ error: 'Orden no encontrada.' });
  const tx = db.transaction(() => {
    db.prepare(`UPDATE services SET status='pending', reject_reason=NULL WHERE id = ?`).run(svc.id);
    db.prepare(`UPDATE invoices SET status='pending' WHERE svc_id = ?`).run(svc.id);
  });
  tx();
  res.json({ ok: true });
});

router.delete('/orders/:id', (req, res) => {
  const svc = db.prepare('SELECT * FROM services WHERE id = ?').get(req.params.id);
  if (!svc) return res.status(404).json({ error: 'Orden no encontrada.' });
  const tx = db.transaction(() => {
    db.prepare(`DELETE FROM invoices WHERE svc_id = ?`).run(svc.id);
    db.prepare(`DELETE FROM services WHERE id = ?`).run(svc.id);
  });
  tx();
  res.json({ ok: true });
});

/* ---------- Tickets (todos los clientes) ---------- */
router.get('/tickets', (req, res) => {
  const rows = db.prepare(`
    SELECT t.*, u.first, u.last, u.email
    FROM tickets t JOIN users u ON u.id = t.user_id
    ORDER BY t.date DESC
  `).all();
  const withCounts = rows.map(t => {
    const count = db.prepare('SELECT COUNT(*) AS c FROM ticket_messages WHERE ticket_id = ?').get(t.id).c;
    return { ...t, messageCount: count };
  });
  res.json({ tickets: withCounts });
});

router.get('/tickets/:id', (req, res) => {
  const ticket = db.prepare(`
    SELECT t.*, u.first, u.last, u.email
    FROM tickets t JOIN users u ON u.id = t.user_id
    WHERE t.id = ?
  `).get(req.params.id);
  if (!ticket) return res.status(404).json({ error: 'Ticket no encontrado.' });
  const messages = db.prepare('SELECT * FROM ticket_messages WHERE ticket_id = ? ORDER BY id ASC').all(ticket.id);
  res.json({ ticket: { ...ticket, messages } });
});

router.post('/tickets/:id/reply', (req, res) => {
  const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(req.params.id);
  if (!ticket) return res.status(404).json({ error: 'Ticket no encontrado.' });
  const { message } = req.body || {};
  if (!message || !message.trim()) return res.status(400).json({ error: 'Escribe un mensaje.' });

  const tx = db.transaction(() => {
    db.prepare(`INSERT INTO ticket_messages (ticket_id, from_role, text) VALUES (?, 'admin', ?)`).run(ticket.id, message.trim());
    db.prepare(`UPDATE tickets SET status='answered' WHERE id = ?`).run(ticket.id);
  });
  tx();
  res.json({ ok: true });
});

router.post('/tickets/:id/close', (req, res) => {
  const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(req.params.id);
  if (!ticket) return res.status(404).json({ error: 'Ticket no encontrado.' });
  db.prepare(`UPDATE tickets SET status='closed' WHERE id = ?`).run(ticket.id);
  res.json({ ok: true });
});

/* ---------- Gestión de planes VPS ---------- */
router.post('/plans', (req, res) => {
  const { id, tier, name, tag, price, cores, ram, disk, port, bw, backup } = req.body || {};
  if (!tier || !['essential', 'premium'].includes(tier)) return res.status(400).json({ error: 'Tier inválido.' });
  if (!name || price == null || !cores || !ram || !disk || !port || !bw) {
    return res.status(400).json({ error: 'Completa todos los campos obligatorios.' });
  }

  const planId = id || name.toLowerCase().trim()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || `plan-${Date.now()}`;

  const existing = db.prepare('SELECT id FROM plans WHERE id = ?').get(planId);
  if (existing && !id) {
    return res.status(409).json({ error: 'Ya existe un plan con un nombre muy similar.' });
  }

  if (existing) {
    db.prepare(`
      UPDATE plans SET tier=?, name=?, tag=?, price=?, cores=?, ram=?, disk=?, port=?, bw=?, backup=?
      WHERE id = ?
    `).run(tier, name, tag || null, price, cores, ram, disk, port, bw, backup ? 1 : 0, planId);
  } else {
    const maxOrder = db.prepare('SELECT COALESCE(MAX(sort_order),-1) AS m FROM plans WHERE tier=?').get(tier).m;
    db.prepare(`
      INSERT INTO plans (id, tier, name, tag, price, cores, ram, disk, port, bw, backup, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(planId, tier, name, tag || null, price, cores, ram, disk, port, bw, backup ? 1 : 0, maxOrder + 1);
  }

  res.json({ ok: true, id: planId });
});

router.delete('/plans/:id', (req, res) => {
  db.prepare('DELETE FROM plans WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
