/* ============================================================
   KERNEL SHIELD — CORE.JS (versión API real)
   Conecta con el backend Node.js en vez de localStorage.
   La URL de la API se configura aquí abajo una sola vez.
============================================================ */

/* ── URL base de la API ─────────────────────────────────────
   En desarrollo: http://localhost:4000
   En producción: https://api.kernelshield.xyz  (o donde corras el servidor)
   ─────────────────────────────────────────────────────────── */
const API = window.KS_API_URL || 'https://k3rnel-panic.onrender.com/';

/* ── XSS guard ─────────────────────────────────────────────── */
function esc(str){
  if(str === null || str === undefined) return '';
  return String(str)
    .replaceAll('&','&amp;').replaceAll('<','&lt;')
    .replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
}

/* ── SVGs ────────────────────────────────────────────────── */
const CHECK_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m5 13 4 4L19 7"/></svg>`;

const ICON_SVG = {
  bolt:       `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2 3 14h7l-1 8 10-12h-7l1-8Z"/></svg>`,
  crown:      `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m2 8 4 3 6-7 6 7 4-3-2 12H4L2 8Z"/></svg>`,
  cpu:        `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="6" width="12" height="12" rx="1.5"/><path d="M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3"/></svg>`,
  gauge:      `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 14 15 10"/><circle cx="12" cy="14" r="1"/><path d="M4.9 19a9 9 0 1 1 14.2 0"/></svg>`,
  disk:       `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6"/><path d="M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/></svg>`,
  shieldCheck:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2 4 5v6c0 5 3.4 8.7 8 10 4.6-1.3 8-5 8-10V5l-8-3Z"/><path d="m9 12 2 2 4-4"/></svg>`,
  copy:       `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`,
  ext:        `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><path d="M15 3h6v6"/><path d="M10 14 21 3"/></svg>`,
};

/* ── TIER META (planes) ─────────────────────────────────── */
const TIER_META = {
  essential: {
    label: 'Essential Series',
    note: `<span class="ic-svg">${ICON_SVG.bolt}</span> Rendimiento estándar con protección DDoS — ideal para la mayoría de servidores.`,
  },
  premium: {
    label: 'Virtual Server Series',
    note: `<span class="ic-svg">${ICON_SVG.crown}</span> Núcleos dedicados, backups automáticos y NVMe de alta velocidad — para comunidades grandes.`,
  }
};

function slugify(str){
  return String(str).toLowerCase().trim()
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'') || ('plan-'+Date.now());
}

/* ── PLAN CARD ──────────────────────────────────────────── */
function planCardHTML(p, ctx, tier){
  const isPremium = tier === 'premium';
  return `
  <div class="plan-card ${p.tag?'feat':''} ${isPremium?'premium':''}">
    ${p.tag ? `<div class="plan-tag ${isPremium?'gold':''}">${esc(p.tag)}</div>` : ''}
    <div class="plan-badge-icon ${isPremium?'gold':''}">${isPremium ? ICON_SVG.crown : ICON_SVG.bolt}</div>
    <div class="plan-name">${esc(p.name)}</div>
    <div class="plan-sub">${TIER_META[tier].label} · DDoS Protection incluida</div>
    <div class="plan-price"><span class="cur">$</span><span class="amt">${Number(p.price).toFixed(2)}</span><span class="per">USD / mes</span></div>
    <ul class="plan-feats">
      <li><span class="chk-svg">${CHECK_SVG}</span> ${esc(String(p.cores))} vCores</li>
      <li><span class="chk-svg">${CHECK_SVG}</span> ${esc(p.ram)} de memoria</li>
      <li><span class="chk-svg">${CHECK_SVG}</span> ${esc(p.disk)} de almacenamiento</li>
      <li><span class="chk-svg">${CHECK_SVG}</span> Puerto ${esc(p.port)}</li>
      <li><span class="chk-svg">${CHECK_SVG}</span> Ancho de banda ${esc(p.bw)}</li>
      <li><span class="chk-svg">${CHECK_SVG}</span> ${p.backup ? 'Backups automáticos + ' : ''}Protección DDoS</li>
      <li><span class="chk-svg">${CHECK_SVG}</span> 6+ opciones de sistema operativo</li>
    </ul>
    <button class="btn ${isPremium?'btn-gold':'btn-primary'} btn-block"
      onclick="orderPlan('${esc(p.id)}','${esc(ctx)}','${tier}')">Ordenar Ahora</button>
  </div>`;
}

/* ============================================================
   API HELPER — todas las peticiones van aquí
============================================================ */
async function apiFetch(path, opts={}){
  const res = await fetch(API + path, {
    credentials: 'include',      // envía/recibe cookies de sesión
    headers: { 'Content-Type': 'application/json', ...(opts.headers||{}) },
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json().catch(()=>({}));
  return { ok: res.ok, status: res.status, data };
}

/* ============================================================
   AUTH — lee /api/auth/me (cookie de sesión real)
============================================================ */

/* Cache en memoria para no hacer /me en cada render */
let _userCache = null;

async function currentUser(){
  if(_userCache) return _userCache;
  const { ok, data } = await apiFetch('/api/auth/me');
  _userCache = ok ? data : null;
  return _userCache;
}

function invalidateUserCache(){ _userCache = null; }

/* Redirige a login si no hay sesión activa */
async function requireAuth(){
  const user = await currentUser();
  if(!user){ location.href = 'login.html'; return false; }
  return true;
}

/* Si ya hay sesión y visita login/registro, manda al panel */
async function redirectIfAuthed(){
  const user = await currentUser();
  if(user){ location.href = 'panel.html'; return true; }
  return false;
}

/* migrateLegacyData: ya no hace nada (el backend tiene sus propios datos) */
function migrateLegacyData(){ return Promise.resolve(); }

/* ============================================================
   PLANES — cargados desde la API (admin los puede editar)
============================================================ */
let _plansCache = null;

async function getPlansDB(){
  if(_plansCache) return _plansCache;
  const { ok, data } = await apiFetch('/api/plans');
  if(ok && data){
    _plansCache = {
      essential: (data.plans || data).filter(p => p.tier === 'essential'),
      premium:   (data.plans || data).filter(p => p.tier === 'premium'),
    };
  } else {
    _plansCache = { essential: [], premium: [] };
  }
  return _plansCache;
}

function invalidatePlansCache(){ _plansCache = null; }

/* ============================================================
   MÉTODOS DE PAGO (sin cambios)
============================================================ */
const PAYPAL_BUSINESS_EMAIL = 'saylinv2782@gmail.com';
const NEQUI_NUMBER          = '3128482212';
const BINANCE_UID           = '1216562025';

function buildPaypalLink(itemName, amount, invoiceId){
  const params = new URLSearchParams({
    cmd: '_xclick', business: PAYPAL_BUSINESS_EMAIL,
    item_name: 'Kernel Shield - ' + itemName,
    amount: amount.toFixed(2), currency_code: 'USD',
    invoice: invoiceId, no_shipping: '1'
  });
  return 'https://www.paypal.com/cgi-bin/webscr?' + params.toString();
}

function buildNequiAppLink(){ return 'nequi://home'; }
function isMobileDevice(){ return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent); }
function tryOpenNequiApp(){ if(isMobileDevice()) window.location.href = buildNequiAppLink(); }

const PAY_METHOD_META = {
  paypal:  { label: 'PayPal',      logoHTML: `<span class="paypal-logo">Pay<b>Pal</b></span>` },
  nequi:   { label: 'Nequi',       logoHTML: `<span class="nequi-logo">Nequi</span>` },
  binance: { label: 'Binance Pay', logoHTML: `<span class="binance-logo">Binance Pay</span>` }
};

function payMethodTagHTML(method){
  const m = method || 'paypal';
  const label = PAY_METHOD_META[m] ? PAY_METHOD_META[m].label : 'PayPal';
  return `<span class="pay-method-tag-table ${m}">${label}</span>`;
}

/* ============================================================
   TOAST
============================================================ */
function showToast(msg){
  const t = document.getElementById('toast'); if(!t) return;
  t.textContent = msg; t.classList.add('show');
  clearTimeout(t._hideT);
  t._hideT = setTimeout(()=>t.classList.remove('show'), 3200);
}

/* ============================================================
   CLIPBOARD
============================================================ */
function copyToClipboard(text, btnEl){
  const done = ()=>{
    if(btnEl){
      const original = btnEl.dataset.label || btnEl.textContent;
      btnEl.dataset.label = original; btnEl.classList.add('copied');
      btnEl.textContent = 'Copiado ✓';
      setTimeout(()=>{ btnEl.classList.remove('copied'); btnEl.textContent = original; }, 1600);
    }
    showToast('Copiado al portapapeles.');
  };
  if(navigator.clipboard?.writeText){
    navigator.clipboard.writeText(text).then(done).catch(()=>fallbackCopy(text,done));
  } else { fallbackCopy(text,done); }
}
function fallbackCopy(text, cb){
  const ta = document.createElement('textarea');
  ta.value = text; ta.style.cssText='position:fixed;opacity:0';
  document.body.appendChild(ta); ta.select();
  try{ document.execCommand('copy'); }catch(e){}
  document.body.removeChild(ta); if(cb) cb();
}

/* ============================================================
   PILLS
============================================================ */
function pillHTML(status){
  if(status === 'active' || status === 'paid')
    return `<span class="pill active"><span class="dot"></span> ${status==='paid'?'Pagada':'Activo'}</span>`;
  if(status === 'rejected')
    return `<span class="pill rejected"><span class="dot"></span> Rechazado</span>`;
  return `<span class="pill pending"><span class="dot"></span> Pendiente</span>`;
}
function statusPillAdmin(status){
  if(status==='active')   return '<span class="pill active"><span class="dot"></span> Activo</span>';
  if(status==='rejected') return '<span class="pill rejected"><span class="dot"></span> Rechazado</span>';
  return '<span class="pill pending"><span class="dot"></span> Pendiente</span>';
}
function ticketPillHTML(status){
  if(status==='answered') return `<span class="pill answered"><span class="dot"></span> Respondido</span>`;
  if(status==='closed')   return `<span class="pill closed"><span class="dot"></span> Cerrado</span>`;
  return `<span class="pill pending"><span class="dot"></span> Abierto</span>`;
}

/* ============================================================
   NAVBAR PÚBLICA — async porque currentUser() es async
============================================================ */
async function initPublicNav(activeKey){
  document.querySelectorAll('#publicNav a[data-nav]').forEach(a=>{
    a.classList.toggle('active', a.dataset.nav === activeKey);
  });
  const navRight = document.getElementById('navRight');
  const user = await currentUser();
  if(navRight && user){
    navRight.innerHTML = `
      <div class="badge-status"><span class="dot-live"></span> Todos los sistemas operativos</div>
      <a href="panel.html" class="btn btn-ghost btn-sm">Hola, ${esc(user.first)}</a>
      <a href="panel.html" class="btn btn-primary btn-sm">Ir al Panel</a>`;
  }
}

/* ============================================================
   LOADING OVERLAY
============================================================ */
function showLoading(msg='Cargando...'){
  let el = document.getElementById('_ks_loading');
  if(!el){
    el = document.createElement('div');
    el.id = '_ks_loading';
    el.style.cssText = 'position:fixed;inset:0;background:rgba(4,6,12,.85);display:flex;align-items:center;justify-content:center;z-index:9999;font-family:Inter,sans-serif;color:#aab4c8;font-size:14px;gap:10px;backdrop-filter:blur(4px);';
    el.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3aa0ff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="animation:ks-spin 1s linear infinite"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg><style>@keyframes ks-spin{to{transform:rotate(360deg)}}</style><span id="_ks_loading_msg">${msg}</span>`;
    document.body.appendChild(el);
  } else {
    const m = document.getElementById('_ks_loading_msg');
    if(m) m.textContent = msg;
    el.style.display = 'flex';
  }
}
function hideLoading(){
  const el = document.getElementById('_ks_loading');
  if(el) el.style.display = 'none';
}
