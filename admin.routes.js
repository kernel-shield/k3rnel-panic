const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('./db');
const { setAdminCookie, clearAdminCookie, requireAdmin } = require('./auth');

const router = express.Router();

router.post('/login', async (req, res) => {
  const { password } = req.body || {};
  const hash = process.env.ADMIN_PASSWORD_HASH;
  if (!hash) return res.status(500).json({ error: 'Contraseña de admin no configurada.' });
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

/* ── ÓRDENES ── */
router.get('/orders', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT s.*, u.first, u.last, u.email
      FROM services s JOIN users u ON u.id::text = s.user_id
      ORDER BY s.date DESC
    `);
    res.json({ orders: result.rows });
  } catch (e) {
    console.error('[admin/orders]', e);
    res.status(500).json({ error: 'Error al listar órdenes.' });
  }
});

router.post('/orders/:id/approve', async (req, res) => {
  const client = await db.pool.connect();
  try {
    const r = await client.query('SELECT * FROM services WHERE id = $1', [req.params.id]);
    if (!r.rows.length) { client.release(); return res.status(404).json({ error: 'Orden no encontrada.' }); }
    await client.query('BEGIN');
    await client.query(`UPDATE services SET status='active', reject_reason=NULL WHERE id=$1`, [req.params.id]);
    await client.query(`UPDATE invoices SET status='paid' WHERE svc_id=$1`, [req.params.id]);
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (e) {
    await client.query('ROLLBACK').catch(()=>{});
    console.error(e); res.status(500).json({ error: 'Error al aprobar.' });
  } finally { client.release(); }
});

router.post('/orders/:id/reject', async (req, res) => {
  const client = await db.pool.connect();
  try {
    const r = await client.query('SELECT * FROM services WHERE id = $1', [req.params.id]);
    if (!r.rows.length) { client.release(); return res.status(404).json({ error: 'Orden no encontrada.' }); }
    const reason = req.body?.reason || 'Pago no verificado';
    await client.query('BEGIN');
    await client.query(`UPDATE services SET status='rejected', reject_reason=$1 WHERE id=$2`, [reason, req.params.id]);
    await client.query(`UPDATE invoices SET status='rejected' WHERE svc_id=$1`, [req.params.id]);
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (e) {
    await client.query('ROLLBACK').catch(()=>{});
    console.error(e); res.status(500).json({ error: 'Error al rechazar.' });
  } finally { client.release(); }
});

router.post('/orders/:id/revoke', async (req, res) => {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`UPDATE services SET status='pending', reject_reason=NULL WHERE id=$1`, [req.params.id]);
    await client.query(`UPDATE invoices SET status='pending' WHERE svc_id=$1`, [req.params.id]);
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (e) {
    await client.query('ROLLBACK').catch(()=>{});
    console.error(e); res.status(500).json({ error: 'Error al revocar.' });
  } finally { client.release(); }
});

router.delete('/orders/:id', async (req, res) => {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`DELETE FROM invoices WHERE svc_id=$1`, [req.params.id]);
    await client.query(`DELETE FROM services WHERE id=$1`, [req.params.id]);
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (e) {
    await client.query('ROLLBACK').catch(()=>{});
    console.error(e); res.status(500).json({ error: 'Error al eliminar.' });
  } finally { client.release(); }
});

/* ── TICKETS ── */
router.get('/tickets', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT t.*, u.first, u.last, u.email
      FROM tickets t JOIN users u ON u.id::text = t.user_id
      ORDER BY t.date DESC
    `);
    const withCounts = [];
    for (const t of result.rows) {
      const c = await db.query('SELECT COUNT(*) AS c FROM ticket_messages WHERE ticket_id=$1', [t.id]);
      withCounts.push({ ...t, messageCount: parseInt(c.rows[0].c, 10) });
    }
    res.json({ tickets: withCounts });
  } catch (e) {
    console.error('[admin/tickets]', e);
    res.status(500).json({ error: 'Error al listar tickets.' });
  }
});

router.get('/tickets/:id', async (req, res) => {
  try {
    const r = await db.query(`
      SELECT t.*, u.first, u.last, u.email
      FROM tickets t JOIN users u ON u.id::text = t.user_id
      WHERE t.id=$1
    `, [req.params.id]);
    if (!r.rows.length) return res.status(404).json({ error: 'Ticket no encontrado.' });
    const msgs = await db.query('SELECT * FROM ticket_messages WHERE ticket_id=$1 ORDER BY id ASC', [req.params.id]);
    res.json({ ticket: { ...r.rows[0], messages: msgs.rows } });
  } catch (e) {
    console.error(e); res.status(500).json({ error: 'Error al ver ticket.' });
  }
});

router.post('/tickets/:id/reply', async (req, res) => {
  const { message } = req.body || {};
  if (!message?.trim()) return res.status(400).json({ error: 'Escribe un mensaje.' });
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`INSERT INTO ticket_messages (ticket_id, from_role, text) VALUES ($1,'admin',$2)`, [req.params.id, message.trim()]);
    await client.query(`UPDATE tickets SET status='answered' WHERE id=$1`, [req.params.id]);
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (e) {
    await client.query('ROLLBACK').catch(()=>{});
    console.error(e); res.status(500).json({ error: 'Error al responder.' });
  } finally { client.release(); }
});

router.post('/tickets/:id/close', async (req, res) => {
  try {
    await db.query(`UPDATE tickets SET status='closed' WHERE id=$1`, [req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    console.error(e); res.status(500).json({ error: 'Error al cerrar ticket.' });
  }
});

/* ── PLANES (GET para admin.js frontend) ── */
router.get('/plans', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM plans ORDER BY tier, COALESCE(sort_order,0)');
    res.json({
      essential: result.rows.filter(p=>p.tier==='essential'),
      premium:   result.rows.filter(p=>p.tier==='premium'),
    });
  } catch (e) {
    console.error(e); res.status(500).json({ error: 'Error al obtener planes.' });
  }
});

router.post('/plans', async (req, res) => {
  const { id, tier, name, tag, price, cores, ram, disk, port, bw, backup } = req.body || {};
  if (!tier || !['essential','premium'].includes(tier)) return res.status(400).json({ error: 'Tier inválido.' });
  if (!name || price==null || !cores || !ram || !disk || !port || !bw)
    return res.status(400).json({ error: 'Completa todos los campos.' });

  const planId = id || name.toLowerCase().trim()
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'') || `plan-${Date.now()}`;

  try {
    const ex = await db.query('SELECT id FROM plans WHERE id=$1', [planId]);
    if (ex.rows.length) {
      await db.query(`UPDATE plans SET tier=$1,name=$2,tag=$3,price=$4,cores=$5,ram=$6,disk=$7,port=$8,bw=$9,backup=$10 WHERE id=$11`,
        [tier,name,tag||null,price,cores,ram,disk,port,bw,backup?1:0,planId]);
    } else {
      const mx = await db.query('SELECT COALESCE(MAX(sort_order),-1) AS m FROM plans WHERE tier=$1',[tier]);
      await db.query(`INSERT INTO plans (id,tier,name,tag,price,cores,ram,disk,port,bw,backup,sort_order) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [planId,tier,name,tag||null,price,cores,ram,disk,port,bw,backup?1:0,parseInt(mx.rows[0].m,10)+1]);
    }
    res.json({ ok: true, id: planId });
  } catch (e) {
    console.error(e); res.status(500).json({ error: 'Error al guardar plan.' });
  }
});

router.delete('/plans/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM plans WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    console.error(e); res.status(500).json({ error: 'Error al eliminar plan.' });
  }
});

module.exports = router;
