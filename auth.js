/* ============================================================
   AUTH.JS — utilidades de autenticación real con contraseñas
   hasheadas (bcrypt) y sesiones firmadas (JWT en cookie httpOnly).
   Esto reemplaza el "hash" de juguete y el localStorage que usaba
   la versión front-end-only.
============================================================ */
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;
const COOKIE_NAME = 'ks_session';
const ADMIN_COOKIE_NAME = 'ks_admin_session';

if (!JWT_SECRET || JWT_SECRET.includes('cambia-esto')) {
  console.warn('\n[ADVERTENCIA] JWT_SECRET no está configurado (o sigue con el valor de ejemplo).');
  console.warn('Configura un valor único y secreto en tu archivo .env antes de usar esto en producción.\n');
}

async function hashPassword(plain) {
  return bcrypt.hash(plain, 12);
}
async function comparePassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

function signUserToken(user) {
  return jwt.sign({ uid: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
}
function signAdminToken() {
  return jwt.sign({ admin: true }, JWT_SECRET, { expiresIn: '2h' });
}

const cookieOpts = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  maxAge: 7 * 24 * 60 * 60 * 1000,
};
const adminCookieOpts = { ...cookieOpts, maxAge: 2 * 60 * 60 * 1000 };

function setUserCookie(res, user) {
  res.cookie(COOKIE_NAME, signUserToken(user), cookieOpts);
}
function clearUserCookie(res) {
  res.clearCookie(COOKIE_NAME);
}
function setAdminCookie(res) {
  res.cookie(ADMIN_COOKIE_NAME, signAdminToken(), adminCookieOpts);
}
function clearAdminCookie(res) {
  res.clearCookie(ADMIN_COOKIE_NAME);
}

/* Middleware: exige que haya una sesión de cliente válida.
   Si es válida, deja el id de usuario en req.userId */
function requireAuth(req, res, next) {
  const token = req.cookies[COOKIE_NAME];
  if (!token) return res.status(401).json({ error: 'No has iniciado sesión.' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.userId = payload.uid;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Tu sesión expiró o no es válida. Inicia sesión de nuevo.' });
  }
}

/* Middleware: exige sesión de administrador válida */
function requireAdmin(req, res, next) {
  const token = req.cookies[ADMIN_COOKIE_NAME];
  if (!token) return res.status(401).json({ error: 'Acceso administrativo requerido.' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (!payload.admin) throw new Error('not admin');
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Sesión de administrador inválida o expirada.' });
  }
}

module.exports = {
  hashPassword,
  comparePassword,
  setUserCookie,
  clearUserCookie,
  setAdminCookie,
  clearAdminCookie,
  requireAuth,
  requireAdmin,
};
