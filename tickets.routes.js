const express = require('express');
const crypto = require('crypto');
const db = require('./db');
const { requireAuth } = require('../auth');

const router = express.Router();

function genId(prefix) {
  return `${prefix}-${crypto.randomInt(100000, 999999)}`;
}

function ticketWithMessages(ticketId) {
  const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(ticketId);
  if (!ticket) return null;
  const messages = db.prepare('SELECT * FROM ticket_messages WHERE ticket_id = ? ORDER BY id ASC').all(ticketId);
  return { ...ticket, messages };
}

/* Listar tickets propios (sin los mensajes, para la lista) */
router.get('/', requireAuth, (req, res) => {
  const tickets = db.prepare('SELECT * FROM tickets WHERE user_id = ? ORDER BY date DESC').all(req.userId);
  const withCounts = tickets.map(t => {
    const count = db.prepare('SELECT COUNT(*) AS c FROM ticket_messages WHERE ticket_id = ?').get(t.id).c;
    return { ...t, messageCount: count };
  });
  res.json({ tickets: withCounts });
});

/* Ver el hilo completo de un ticket propio */
router.get('/:id', requireAuth, (req, res) => {
  const ticket = db.prepare('SELECT * FROM tickets WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!ticket) return res.status(404).json({ error: 'Ticket no encontrado.' });
  res.json({ ticket: ticketWithMessages(req.params.id) });
});

/* Crear ticket nuevo */
router.post('/', requireAuth, (req, res) => {
  const { subject, category, message } = req.body || {};
  if (!subject || !message) return res.status(400).json({ error: 'Completa el asunto y el mensaje.' });

  const id = genId('TCK');
  const tx = db.transaction(() => {
    db.prepare(`
      INSERT INTO tickets (id, user_id, subject, category, status) VALUES (?, ?, ?, ?, 'open')
    `).run(id, req.userId, subject.trim(), category || 'Otro');
    db.prepare(`
      INSERT INTO ticket_messages (ticket_id, from_role, text) VALUES (?, 'client', ?)
    `).run(id, message.trim());
  });
  tx();

  res.status(201).json({ ok: true, ticket: ticketWithMessages(id) });
});

/* Responder en un ticket propio (vuelve a marcarlo como "open" para el equipo) */
router.post('/:id/reply', requireAuth, (req, res) => {
  const ticket = db.prepare('SELECT * FROM tickets WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!ticket) return res.status(404).json({ error: 'Ticket no encontrado.' });
  if (ticket.status === 'closed') return res.status(400).json({ error: 'Este ticket está cerrado y ya no acepta respuestas.' });

  const { message } = req.body || {};
  if (!message || !message.trim()) return res.status(400).json({ error: 'Escribe un mensaje.' });

  const tx = db.transaction(() => {
    db.prepare(`INSERT INTO ticket_messages (ticket_id, from_role, text) VALUES (?, 'client', ?)`).run(ticket.id, message.trim());
    db.prepare(`UPDATE tickets SET status = 'open' WHERE id = ?`).run(ticket.id);
  });
  tx();

  res.json({ ok: true, ticket: ticketWithMessages(ticket.id) });
});

module.exports = router;
