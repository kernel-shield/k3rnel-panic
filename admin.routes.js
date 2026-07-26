const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('./db');
const { setAdminCookie, clearAdminCookie, requireAdmin } = require('./auth');

const router = express.Router();

router.post('/login', async (req, res) => {
  const { password } = req.body || {};
  const hash = process.env.ADMIN_PASSWORD_HASH;
  if (!hash) {
    return res.status(500).json({ error: 'El servidor no tiene configurada la contraseña de admin.' });
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

router.use(requireAdmin);

router.get('/orders', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT s.*, u.first, u.last, u.email
      FROM services s JOIN users u ON u.id = s.user_id
      ORDER BY s.date DESC
    `);
    res.json({ orders: result.rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al listar órdenes.' });
  }
});

router.post('/orders/:id/approve', async (req, res) => {
  const client = await db.pool.connect();
  try {
    const svcRes = await client.query('SELECT * FROM services WHERE id = $1', [req.params.id]);
    if (svcRes.rows.length === 0) {
      client.release();
      return res.status(404).json({ error: 'Orden no encontrada.' });
    }
    const svc = svcRes.rows[0];

    await client.query('BEGIN');
    await client.query(`UPDATE services SET status='active', reject_reason=NULL WHERE id = $1`, [svc.id]);
    await client.query(`UPDATE invoices SET status='paid' WHERE svc_id = $1`, [svc.id]);
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error(e);
    res.status(500).json({ error: 'Error al aprobar orden.' });
  } finally {
    client.release();
  }
});

router.post('/orders/:id/reject', async (req, res) => {
  const client = await db.pool.connect();
  try {
    const svcRes = await client.query('SELECT * FROM services WHERE id = $1', [req.params.id]);
    if (svcRes.rows.length === 0) {
      client.release();
      return res.status(404).json({ error: 'Orden no encontrada.' });
    }
    const svc = svcRes.rows[0];
    const reason = (req.body && req.body.reason) || 'Pago no verificado';

    await client.query('BEGIN');
    await client.query(`UPDATE services SET status='rejected', reject_reason=$1 WHERE id = $2`, [reason, svc.id]);
    await client.query(`UPDATE invoices SET status='rejected' WHERE svc_id = $1`, [svc.id]);
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error(e);
    res.status(500).json({ error: 'Error al rechazar orden.' });
  } finally {
    client.release();
  }
});

router.post('/orders/:id/revoke', async (req, res) => {
  const client = await db.pool.connect();
  try {
    const svcRes = await client.query('SELECT * FROM services WHERE id = $1', [req.params.id]);
    if (svcRes.rows.length === 0) {
      client.release();
      return res.status(404).json({ error: 'Orden no encontrada.' });
    }
    const svc = svcRes.rows[0];

    await client.query('BEGIN');
    await client.query(`UPDATE services SET status='pending', reject_reason=NULL WHERE id = $1`, [svc.id]);
    await client.query(`UPDATE invoices SET status='pending' WHERE svc_id = $1`, [svc.id]);
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error(e);
    res.status(500).json({ error: 'Error al revocar orden.' });
  } finally {
    client.release();
  }
});

router.delete('/orders/:id', async (req, res) => {
  const client = await db.pool.connect();
  try {
    const svcRes = await client.query('SELECT * FROM services WHERE id = $1', [req.params.id]);
    if (svcRes.rows.length === 0) {
      client.release();
      return res.status(404).json({ error: 'Orden no encontrada.' });
    }
    const svc = svcRes.rows[0];

    await client.query('BEGIN');
    await client.query(`DELETE FROM invoices WHERE svc_id = $1`, [svc.id]);
    await client.query(`DELETE FROM services WHERE id = $1`, [svc.id]);
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error(e);
    res.status(500).json({ error: 'Error al eliminar orden.' });
  } finally {
    client.release();
  }
});

router.get('/tickets', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT t.*, u.first, u.last, u.email
      FROM tickets t JOIN users u ON u.id = t.user_id
      ORDER BY t.date DESC
    `);
    const rows = result.rows;
    const withCounts = [];
    for (let t of rows) {
      const countRes = await db.query('SELECT COUNT(*) AS c FROM ticket_messages WHERE ticket_id = $1', [t.id]);
      withCounts.push({ ...t, messageCount: parseInt(countRes.rows[0].c, 10) });
    }
    res.json({ tickets: withCounts });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al listar tickets de admin.' });
  }
});

router.get('/tickets/:id', async (req, res) => {
  try {
    const ticketRes = await db.query(`
      SELECT t.*, u.first, u.last, u.email
      FROM tickets t JOIN users u ON u.id = t.user_id
      WHERE t.id = $1
    `, [req.params.id]);
    if (ticketRes.rows.length === 0) return res.status(404).json({ error: 'Ticket no encontrado.' });
    const ticket = ticketRes.rows[0];
    const msgRes = await db.query('SELECT * FROM ticket_messages WHERE ticket_id = $1 ORDER BY id ASC', [ticket.id]);
    res.json({ ticket: { ...ticket, messages: msgRes.rows } });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al ver ticket.' });
  }
});

router.post('/tickets/:id/reply', async (req, res) => {
  const ticketRes = await db.query('SELECT * FROM tickets WHERE id = $1', [req.params.id]);
  if (ticketRes.rows.length === 0) return res.status(404).json({ error: 'Ticket no encontrado.' });
  const ticket = ticketRes.rows[0];
  const { message } = req.body || {};
  if (!message || !message.trim()) return res.status(400).json({ error: 'Escribe un mensaje.' });

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`INSERT INTO ticket_messages (ticket_id, from_role, text) VALUES ($1, 'admin', $2)`, [ticket.id, message.trim()]);
    await client.query(`UPDATE tickets SET status='answered' WHERE id = $1`, [ticket.id]);
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error(e);
    res.status(500).json({ error: 'Error al responder ticket.' });
  } finally {
    client.release();
  }
});

router.post('/tickets/:id/close', async (req, res) => {
  try {
    const ticketRes = await db.query('SELECT * FROM tickets WHERE id = $1', [req.params.id]);
    if (ticketRes.rows.length === 0) return res.status(404).json({ error: 'Ticket no encontrado.' });
    await db.query(`UPDATE tickets SET status='closed' WHERE id = $1`, [req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al cerrar ticket.' });
  }
});

router.post('/plans', async (req, res) => {
  const { id, tier, name, tag, price, cores, ram, disk, port, bw, backup } = req.body || {};
  if (!tier || !['essential', 'premium'].includes(tier)) return res.status(400).json({ error: 'Tier inválido.' });
  if (!name || price == null || !cores || !ram || !disk || !port || !bw) {
    return res.status(400).json({ error: 'Completa todos los campos obligatorios.' });
  }

  const planId = id || name.toLowerCase().trim()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || `plan-${Date.now()}`;

  try {
    const existingRes = await db.query('SELECT id FROM plans WHERE id = $1', [planId]);
    if (existingRes.rows.length > 0 && !id) {
      return res.status(409).json({ error: 'Ya existe un plan con un nombre muy similar.' });
    }

    if (existingRes.rows.length > 0) {
      await db.query(`
        UPDATE plans SET tier=$1, name=$2, tag=$3, price=$4, cores=$5, ram=$6, disk=$7, port=$8, bw=$9, backup=$10
        WHERE id = $11
      `, [tier, name, tag || null, price, cores, ram, disk, port, bw, backup ? 1 : 0, planId]);
    } else {
      const maxRes = await db.query('SELECT COALESCE(MAX(sort_order),-1) AS m FROM plans WHERE tier=$1', [tier]);
      const maxOrder = parseInt(maxRes.rows[0].m, 10);
      await db.query(`
        INSERT INTO plans (id, tier, name, tag, price, cores, ram, disk, port, bw, backup, sort_order)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      `, [planId, tier, name, tag || null, price, cores, ram, disk, port, bw, backup ? 1 : 0, maxOrder + 1]);
    }

    res.json({ ok: true, id: planId });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al guardar el plan.' });
  }
});

router.delete('/plans/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM plans WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al eliminar el plan.' });
  }
});

module.exports = router;
