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

// FIX CRÍTICO: tu frontend (GitHub Pages / Netlify / etc.) y tu backend
// (Render) viven en dominios DIFERENTES → esto es "cross-site" para el
// navegador. Con sameSite:'lax' el navegador guarda la cookie pero se
// niega a reenviarla en peticiones cross-site, así que el login "pega"
// un instante y luego siempre te manda de vuelta a login (y por eso
// tampoco cargan tickets/billing: toda petición autenticada fallaba).
// sameSite:'none' + secure:true es lo correcto para este caso (ambos
// dominios usan HTTPS, así que secure:true no es problema).
const isProd = process.env.NODE_ENV === 'production';
const cookieOpts = {
  httpOnly: true,
  sameSite: isProd ? 'none' : 'lax',
  secure: isProd, // sameSite:'none' EXIGE secure:true, si no el navegador ignora la cookie
  path: '/',
  maxAge: 7 * 24 * 60 * 60 * 1000,
};
const adminCookieOpts = { ...cookieOpts, maxAge: 2 * 60 * 60 * 1000 };

function setUserCookie(res, user) {
  res.cookie(COOKIE_NAME, signUserToken(user), cookieOpts);
}
function clearUserCookie(res) {
  // Debe repetir sameSite/secure/path exactos, si no el navegador no la borra
  res.clearCookie(COOKIE_NAME, { httpOnly: true, sameSite: cookieOpts.sameSite, secure: cookieOpts.secure, path: '/' });
}
function setAdminCookie(res) {
  res.cookie(ADMIN_COOKIE_NAME, signAdminToken(), adminCookieOpts);
}
function clearAdminCookie(res) {
  res.clearCookie(ADMIN_COOKIE_NAME, { httpOnly: true, sameSite: cookieOpts.sameSite, secure: cookieOpts.secure, path: '/' });
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
