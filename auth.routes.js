const express = require('express');
const db = require('./db');
const { hashPassword, comparePassword, setUserCookie, clearUserCookie, requireAuth } = require('./auth');

const router = express.Router();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.post('/register', async (req, res) => {
  try {
    const { first, last, email, country, discord, password } = req.body || {};
    const cleanEmail = String(email || '').trim().toLowerCase();

    if (!first || !last) return res.status(400).json({ error: 'Ingresa tu nombre y apellido.' });
    if (!EMAIL_RE.test(cleanEmail)) return res.status(400).json({ error: 'Ingresa un correo electrónico válido.' });
    if (!password || password.length < 6) return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres.' });

    const existingRes = await db.query('SELECT id FROM users WHERE email = $1', [cleanEmail]);
    if (existingRes.rows.length > 0) return res.status(409).json({ error: 'Ya existe una cuenta registrada con ese correo.' });

    const passHash = await hashPassword(password);
    let insertRes;
    try {
      insertRes = await db.query(
        `INSERT INTO users (first, last, email, country, discord, pass_hash) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [first.trim(), last.trim(), cleanEmail, country || null, discord ? discord.trim() : null, passHash]
      );
    } catch (colErr) {
      // Columna discord aún no existe — insertar sin ella
      insertRes = await db.query(
        `INSERT INTO users (first, last, email, country, pass_hash) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [first.trim(), last.trim(), cleanEmail, country || null, passHash]
      );
    }

    const userId = insertRes.rows[0].id;
    const user = { id: userId, email: cleanEmail };
    setUserCookie(res, user);
    res.status(201).json({ ok: true, user: { id: user.id, first, last, email: cleanEmail, country, discord: discord || null } });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error interno al crear la cuenta.' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    const cleanEmail = String(email || '').trim().toLowerCase();
    
    const userRes = await db.query('SELECT * FROM users WHERE email = $1', [cleanEmail]);
    if (userRes.rows.length === 0) return res.status(401).json({ error: 'Correo o contraseña incorrectos.' });
    
    const user = userRes.rows[0];
    const ok = await comparePassword(password || '', user.pass_hash);
    if (!ok) return res.status(401).json({ error: 'Correo o contraseña incorrectos.' });

    setUserCookie(res, user);
    res.json({ ok: true, user: { id: user.id, first: user.first, last: user.last, email: user.email, country: user.country, discord: user.discord || null } });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error interno al iniciar sesión.' });
  }
});

router.post('/logout', (req, res) => {
  clearUserCookie(res);
  res.json({ ok: true });
});

router.get('/me', requireAuth, async (req, res) => {
  try {
    // FIX: la columna real en la tabla users es "date", no "created_at".
    // La alias-eamos para que el frontend (que espera created_at) funcione.
    let userRes;
    try {
      userRes = await db.query(
        'SELECT id, first, last, email, country, discord, date AS created_at FROM users WHERE id = $1',
        [req.userId]
      );
    } catch (colErr) {
      userRes = await db.query(
        'SELECT id, first, last, email, country, date AS created_at FROM users WHERE id = $1',
        [req.userId]
      );
    }
    if (userRes.rows.length === 0) return res.status(404).json({ error: 'Usuario no encontrado.' });
    const user = userRes.rows[0];
    res.json({ user: { ...user, discord: user.discord || null } });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

module.exports = router;
