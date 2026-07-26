const express = require('express');
const crypto = require('crypto');
const db = require('./db');
const { requireAuth } = require('./auth');

const router = express.Router();

function genId(prefix) {
  return `${prefix}-${crypto.randomInt(100000, 999999)}`;
}

async function ticketWithMessages(ticketId) {
  const ticketRes = await db.query('SELECT * FROM tickets WHERE id = $1', [ticketId]);
  if (ticketRes.rows.length === 0) return null;
  const ticket = ticketRes.rows[0];
  const msgRes = await db.query('SELECT * FROM ticket_messages WHERE ticket_id = $1 ORDER BY id ASC', [ticketId]);
  return { ...ticket, messages: msgRes.rows };
}

router.get('/', requireAuth, async (req, res) => {
  try {
    const ticketsRes = await db.query('SELECT * FROM tickets WHERE user_id = $1 ORDER BY date DESC', [req.userId]);
    const tickets = ticketsRes.rows;
    
    const withCounts = [];
    for (let t of tickets) {
      const countRes = await db.query('SELECT COUNT(*) AS c FROM ticket_messages WHERE ticket_id = $1', [t.id]);
      withCounts.push({ ...t, messageCount: parseInt(countRes.rows[0].c, 10) });
    }
    res.json({ tickets: withCounts });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al listar tickets.' });
  }
});

router.get('/:id', requireAuth, async (req, res) => {
  try {
    const ticketRes = await db.query('SELECT * FROM tickets WHERE id = $1 AND user_id = $2', [req.params.id, req.userId]);
    if (ticketRes.rows.length === 0) return res.status(404).json({ error: 'Ticket no encontrado.' });
    const fullTicket = await ticketWithMessages(req.params.id);
    res.json({ ticket: fullTicket });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al obtener el ticket.' });
  }
});

router.post('/', requireAuth, async (req, res) => {
  const { subject, category, message } = req.body || {};
  if (!subject || !message) return res.status(400).json({ error: 'Completa el asunto y el mensaje.' });

  const id = genId('TCK');
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO tickets (id, user_id, subject, category, status) VALUES ($1, $2, $3, $4, 'open')`,
      [id, req.userId, subject.trim(), category || 'Otro']
    );
    await client.query(
      `INSERT INTO ticket_messages (ticket_id, from_role, text) VALUES ($1, 'client', $2)`,
      [id, message.trim()]
    );
    await client.query('COMMIT');

    const fullTicket = await ticketWithMessages(id);
    res.status(201).json({ ok: true, ticket: fullTicket });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error(e);
    res.status(500).json({ error: 'Error al crear el ticket.' });
  } finally {
    client.release();
  }
});

router.post('/:id/reply', requireAuth, async (req, res) => {
  const ticketRes = await db.query('SELECT * FROM tickets WHERE id = $1 AND user_id = $2', [req.params.id, req.userId]);
  if (ticketRes.rows.length === 0) return res.status(404).json({ error: 'Ticket no encontrado.' });
  const ticket = ticketRes.rows[0];
  if (ticket.status === 'closed') return res.status(400).json({ error: 'Este ticket está cerrado y ya no acepta respuestas.' });

  const { message } = req.body || {};
  if (!message || !message.trim()) return res.status(400).json({ error: 'Escribe un mensaje.' });

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`INSERT INTO ticket_messages (ticket_id, from_role, text) VALUES ($1, 'client', $2)`, [ticket.id, message.trim()]);
    await client.query(`UPDATE tickets SET status = 'open' WHERE id = $1`, [ticket.id]);
    await client.query('COMMIT');

    const fullTicket = await ticketWithMessages(ticket.id);
    res.json({ ok: true, ticket: fullTicket });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error(e);
    res.status(500).json({ error: 'Error al responder el ticket.' });
  } finally {
    client.release();
  }
});

module.exports = router;
