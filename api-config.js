/* ============================================================
   API-CONFIG.JS — Kernel Shield
   Este archivo define window.KS_API_URL ANTES de que core.js lo
   necesite. Así solo tienes que cambiar la URL en UN solo lugar
   cuando tu backend de Render cambie, en vez de editar 6 HTML.

   ⚠️ ACCIÓN REQUERIDA:
   Reemplaza la URL de abajo por la URL real de tu servicio en
   Render. La encuentras en el dashboard de Render, arriba del todo
   de tu Web Service — algo como:
     https://kernelshield-api.onrender.com

   Si además tienes un dominio propio (ej. api.kernelshield.xyz)
   apuntando a Render con un Custom Domain, puedes usar ese en su
   lugar — pero debe existir y estar verificado en Render, si no,
   NADA en el sitio funcionará (login, billing, tickets, admin).
============================================================ */
(function () {
  // Detecta automáticamente si estás probando en tu máquina (localhost)
  // vs en producción, para no tener que cambiar esto a mano cada vez.
  const isLocal = ['localhost', '127.0.0.1'].includes(window.location.hostname);

  window.KS_API_URL = isLocal
  ? 'http://localhost:4000'
  : 'https://k3rnel-panic.onrender.com';

  // ── Supabase (solo para el botón "Continuar con Google") ──
  // También lo centralizamos aquí para que no tengas que buscarlo
  // dentro de login.html / registro.html.
  window.KS_SUPABASE_URL = 'https://vptcxzbbrxilfaqoxxvt.supabase.co';
  window.KS_SUPABASE_ANON_KEY = 'AQUI_TU_SUPABASE_ANON_KEY'; // 👈 CAMBIA ESTO por tu llave anon real
})();
