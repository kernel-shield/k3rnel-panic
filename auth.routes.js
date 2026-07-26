const express = require('express');
const db = require('./db');
const { hashPassword, comparePassword, setUserCookie, clearUserCookie, requireAuth } = require('../auth');

const router = express.Router();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.post('/register', async (req, res) => {
  try {
    const { first, last, email, country, password } = req.body || {};
    const cleanEmail = String(email || '').trim().toLowerCase();

    if (!first || !last) return res.status(400).json({ error: 'Ingresa tu nombre y apellido.' });
    if (!EMAIL_RE.test(cleanEmail)) return res.status(400).json({ error: 'Ingresa un correo electrónico válido.' });
    if (!password || password.length < 6) return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres.' });

    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(cleanEmail);
    if (existing) return res.status(409).json({ error: 'Ya existe una cuenta registrada con ese correo.' });

    const passHash = await hashPassword(password);
    const info = db.prepare(`
      INSERT INTO users (first, last, email, country, pass_hash) VALUES (?, ?, ?, ?, ?)
    `).run(first.trim(), last.trim(), cleanEmail, country || null, passHash);

    const user = { id: info.lastInsertRowid, email: cleanEmail };
    setUserCookie(res, user);
    res.status(201).json({ ok: true, user: { id: user.id, first, last, email: cleanEmail, country } });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error interno al crear la cuenta.' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    const cleanEmail = String(email || '').trim().toLowerCase();
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(cleanEmail);
    if (!user) return res.status(401).json({ error: 'Correo o contraseña incorrectos.' });

    const ok = await comparePassword(password || '', user.pass_hash);
    if (!ok) return res.status(401).json({ error: 'Correo o contraseña incorrectos.' });

    setUserCookie(res, user);
    res.json({ ok: true, user: { id: user.id, first: user.first, last: user.last, email: user.email, country: user.country } });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error interno al iniciar sesión.' });
  }
});

router.post('/logout', (req, res) => {
  clearUserCookie(res);
  res.json({ ok: true });
});

router.get('/me', requireAuth, (req, res) => {
  const user = db.prepare('SELECT id, first, last, email, country, created_at FROM users WHERE id = ?').get(req.userId);
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado.' });
  res.json({ user });
});

module.exports = router;
