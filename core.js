/* ============================================================
   KERNEL SHIELD — CORE.JS
   Módulo compartido por TODAS las páginas (index, login, registro,
   vps, panel de cliente y admin). Contiene: seguridad básica (esc),
   datos de planes, storage/auth, métodos de pago (PayPal, Nequi,
   Binance Pay) y utilidades comunes (toast, formateo, etc).

   Nada de la lógica original se eliminó: se mantiene 100% el mismo
   comportamiento de antes, solo reorganizado para que cada página
   HTML pueda cargar únicamente lo que necesita.
============================================================ */

/* ---------- SEGURIDAD: escape de HTML para evitar XSS almacenado ---------- */
function esc(str){
  if(str === null || str === undefined) return '';
  return String(str)
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;')
    .replaceAll('"','&quot;')
    .replaceAll("'",'&#39;');
}

/* ============================================================
   ICONOS SVG
============================================================ */
const CHECK_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m5 13 4 4L19 7"/></svg>`;

const ICON_SVG = {
  bolt: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2 3 14h7l-1 8 10-12h-7l1-8Z"/></svg>`,
  crown: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m2 8 4 3 6-7 6 7 4-3-2 12H4L2 8Z"/></svg>`,
  cpu: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="6" width="12" height="12" rx="1.5"/><path d="M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3"/></svg>`,
  gauge: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 14 15 10"/><circle cx="12" cy="14" r="1"/><path d="M4.9 19a9 9 0 1 1 14.2 0"/></svg>`,
  disk: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6"/><path d="M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/></svg>`,
  net: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5a11 11 0 0 1 14 0"/><path d="M8.5 16a6 6 0 0 1 7 0"/><path d="M12 19.5h.01"/></svg>`,
  wave: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12h3l2-7 4 14 3-10 2 3h6"/></svg>`,
  shieldCheck: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2 4 5v6c0 5 3.4 8.7 8 10 4.6-1.3 8-5 8-10V5l-8-3Z"/><path d="m9 12 2 2 4-4"/></svg>`,
  copy: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`,
  ext: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><path d="M15 3h6v6"/><path d="M10 14 21 3"/></svg>`
};

/* ============================================================
   PLANES VPS POR DEFECTO
============================================================ */
const DEFAULT_PLANS_ESSENTIAL = [
  {id:'micro', name:'Micro | Essential', tag:null, price:4.75, cores:2, ram:'4 GB', disk:'50GB SSD', port:'500 Mbps', bw:'10TB', backup:false},
  {id:'pro', name:'Pro | Essential', tag:'Popular', price:7.45, cores:4, ram:'8 GB', disk:'80GB SSD', port:'800 Mbps', bw:'10TB', backup:false},
  {id:'max', name:'Max | Essential', tag:null, price:14.75, cores:4, ram:'16 GB', disk:'120GB SSD', port:'800 Mbps', bw:'10TB', backup:false},
  {id:'maxplus', name:'Max+ | Essential', tag:null, price:21.50, cores:6, ram:'24 GB', disk:'160GB SSD', port:'800 Mbps', bw:'10TB', backup:false},
  {id:'super', name:'Super | Essential', tag:null, price:32.75, cores:8, ram:'32 GB', disk:'200GB SSD', port:'800 Mbps', bw:'10TB', backup:false},
  {id:'mega', name:'Mega | Essential', tag:'Máximo rendimiento', price:48.75, cores:8, ram:'48 GB', disk:'250GB SSD', port:'800 Mbps', bw:'10TB', backup:false},
];

const DEFAULT_PLANS_PREMIUM = [
  {id:'nano-vs', name:'Nano | Virtual Server', tag:null, price:8.00, cores:2, ram:'2 GB', disk:'30GB', port:'1+ Gbps', bw:'Ilimitado', backup:true},
  {id:'micro-vs', name:'Micro | Virtual Server', tag:null, price:16.00, cores:4, ram:'4 GB', disk:'80GB', port:'1+ Gbps', bw:'Ilimitado', backup:true},
  {id:'pro-vs', name:'Pro | Virtual Server', tag:'Popular', price:32.00, cores:4, ram:'8 GB', disk:'160GB', port:'1+ Gbps', bw:'Ilimitado', backup:true},
  {id:'ultra-vs', name:'Ultra | Virtual Server', tag:null, price:54.00, cores:8, ram:'16 GB', disk:'320GB', port:'1+ Gbps', bw:'Ilimitado', backup:true},
  {id:'mega-vs', name:'Mega | Virtual Server', tag:null, price:82.00, cores:8, ram:'24 GB', disk:'620GB', port:'1+ Gbps', bw:'Ilimitado', backup:true},
  {id:'max-vs', name:'Max | Virtual Server', tag:'Máximo rendimiento', price:110.00, cores:12, ram:'32 GB', disk:'980GB SSD', port:'1+ Gbps', bw:'Ilimitado', backup:true},
];

const PLANS_KEY = 'ks_plans_db';

function getPlansDB(){
  const raw = localStorage.getItem(PLANS_KEY);
  if(!raw){
    const seed = { essential: DEFAULT_PLANS_ESSENTIAL, premium: DEFAULT_PLANS_PREMIUM };
    localStorage.setItem(PLANS_KEY, JSON.stringify(seed));
    return seed;
  }
  try{ return JSON.parse(raw); }
  catch(e){ return { essential: DEFAULT_PLANS_ESSENTIAL, premium: DEFAULT_PLANS_PREMIUM }; }
}
function savePlansDB(db){ localStorage.setItem(PLANS_KEY, JSON.stringify(db)); }

function slugify(str){
  return String(str).toLowerCase().trim()
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'') || ('plan-' + Date.now());
}

const TIER_META = {
  essential: {
    label: 'Essential Series',
    note: `<span class="ic-svg">${ICON_SVG.bolt}</span> Rendimiento estándar con protección DDoS — ideal para la mayoría de servidores de juego.`,
  },
  premium: {
    label: 'Virtual Server Series',
    note: `<span class="ic-svg">${ICON_SVG.crown}</span> Núcleos dedicados, backups automáticos y NVMe de alta velocidad — para comunidades grandes.`,
  }
};

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
      <li><span class="chk-svg">${CHECK_SVG}</span> ${p.cores} vCores</li>
      <li><span class="chk-svg">${CHECK_SVG}</span> ${esc(p.ram)} de memoria</li>
      <li><span class="chk-svg">${CHECK_SVG}</span> ${esc(p.disk)} de almacenamiento</li>
      <li><span class="chk-svg">${CHECK_SVG}</span> Puerto ${esc(p.port)}</li>
      <li><span class="chk-svg">${CHECK_SVG}</span> Ancho de banda ${esc(p.bw)}</li>
      <li><span class="chk-svg">${CHECK_SVG}</span> ${p.backup ? 'Backups automáticos + ' : ''}Protección DDoS</li>
      <li><span class="chk-svg">${CHECK_SVG}</span> 6+ opciones de sistema operativo</li>
    </ul>
    <button class="btn ${isPremium?'btn-gold':'btn-primary'} btn-block" onclick="orderPlan('${p.id}','${ctx}','${tier}')">Ordenar Ahora</button>
  </div>`;
}

/* ============================================================
   STORAGE / AUTH (localStorage-backed, front-end demo auth)
============================================================ */
const DB_KEY = 'ks_users_db';
const SESSION_KEY = 'ks_session';

function getUsers(){ return JSON.parse(localStorage.getItem(DB_KEY) || '{}'); }
function saveUsers(db){ localStorage.setItem(DB_KEY, JSON.stringify(db)); }
function getSession(){ return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); }
function setSession(email){ localStorage.setItem(SESSION_KEY, JSON.stringify({email})); }
function clearSession(){ localStorage.removeItem(SESSION_KEY); }

/* ============================================================
   AUTO-REPARACIÓN DE DATOS ANTIGUOS ("legacy")
   Cuentas creadas con versiones anteriores del sitio pueden tener
   servicios/facturas sin "id", sin "method" o sin "status", lo cual
   rompe las acciones de aprobar/rechazar/eliminar (comparan por id).
   Esta función revisa TODA la base de usuarios una sola vez al cargar
   la página y les asigna lo que les falte, sin tocar nada que ya
   esté bien. Se llama al inicio de panel.js y admin.js.
============================================================ */
function migrateLegacyData(){
  const db = getUsers();
  let changed = false;

  Object.values(db).forEach(user=>{
    if(!Array.isArray(user.services)){ user.services = []; changed = true; }
    if(!Array.isArray(user.invoices)){ user.invoices = []; changed = true; }
    if(!Array.isArray(user.tickets)){ user.tickets = []; changed = true; }

    user.services.forEach(svc=>{
      if(!svc.id){ svc.id = 'SVC-' + Math.floor(100000+Math.random()*900000) + '-legacy'; changed = true; }
      if(!svc.status){ svc.status = 'pending'; changed = true; }
      if(!svc.method){ svc.method = 'paypal'; changed = true; }
      if(!svc.date){ svc.date = new Date().toISOString(); changed = true; }
    });

    user.invoices.forEach(inv=>{
      if(!inv.id){ inv.id = 'INV-' + Math.floor(100000+Math.random()*900000) + '-legacy'; changed = true; }
      if(!inv.status){ inv.status = 'pending'; changed = true; }
      if(!inv.method){ inv.method = 'paypal'; changed = true; }
      if(!inv.date){ inv.date = new Date().toISOString(); changed = true; }
      // Si la factura quedó sin vínculo a su servicio, la emparejamos
      // con el primer servicio "huérfano" (mismo nombre, sin factura
      // asignada todavía) para que ambos vuelvan a estar sincronizados.
      if(!inv.svcId){
        const linkedIds = user.invoices.filter(i=>i!==inv && i.svcId).map(i=>i.svcId);
        const orphan = user.services.find(s=> s.name === inv.desc && !linkedIds.includes(s.id));
        if(orphan){ inv.svcId = orphan.id; changed = true; }
      }
    });

    user.tickets.forEach(t=>{
      if(!t.id){ t.id = 'TCK-' + Math.floor(100000+Math.random()*900000) + '-legacy'; changed = true; }
      if(!t.status){ t.status = 'open'; changed = true; }
      if(!Array.isArray(t.messages)){ t.messages = []; changed = true; }
    });
  });

  if(changed) saveUsers(db);
  return changed;
}

// hash simple no criptográfico — solo para persistencia de demo sin backend
function hashPass(str){
  let h = 0;
  for(let i=0;i<str.length;i++){ h = (Math.imul(31,h) + str.charCodeAt(i))|0; }
  return h.toString(36);
}

function currentUser(){
  const sess = getSession();
  if(!sess) return null;
  const db = getUsers();
  return db[sess.email] || null;
}

/* Redirige a login.html si no hay sesión activa. Se llama al inicio
   de cada página que requiere estar autenticado (panel de cliente). */
function requireAuth(){
  if(!currentUser()){
    location.href = 'login.html';
    return false;
  }
  return true;
}

/* Si ya hay sesión activa y el usuario visita login/registro, lo
   mandamos directo al panel. */
function redirectIfAuthed(){
  if(currentUser()){
    location.href = 'panel.html';
    return true;
  }
  return false;
}

/* ============================================================
   MÉTODOS DE PAGO
   — PayPal: enlace de checkout ya existente (sin cambios).
   — Nequi: se abre la app directamente vía deep link (nequi://),
     con fallback a mostrar el número para envío manual.
   — Binance Pay: se muestra el UID para pagar desde la app.
   Todo pago queda "pending" hasta que el admin lo verifica
   manualmente (no hay pasarela real ni backend).
============================================================ */
const PAYPAL_BUSINESS_EMAIL = 'saylinv2782@gmail.com';
const NEQUI_NUMBER = '3128482212';
const BINANCE_UID = '1216562025';

function buildPaypalLink(itemName, amount, invoiceId){
  const params = new URLSearchParams({
    cmd: '_xclick',
    business: PAYPAL_BUSINESS_EMAIL,
    item_name: 'Kernel Shield - ' + itemName,
    amount: amount.toFixed(2),
    currency_code: 'USD',
    invoice: invoiceId,
    no_shipping: '1'
  });
  return 'https://www.paypal.com/cgi-bin/webscr?' + params.toString();
}

/* Deep link de Nequi: abre la app en móvil directo a "enviar".
   Si el dispositivo no tiene la app instalada, el navegador
   simplemente no hace nada y el usuario usa el número mostrado
   en pantalla para transferir manualmente. */
function buildNequiAppLink(){
  return 'nequi://home';
}

function isMobileDevice(){
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

function tryOpenNequiApp(){
  // Solo tiene sentido intentarlo en celular: en PC no existe la app y el
  // navegador de escritorio no puede "abrir" nada con este enlace, así que
  // ni lo intentamos ahí (evita el aviso feo de "protocolo no reconocido").
  if(!isMobileDevice()) return;
  window.location.href = buildNequiAppLink();
}

const PAY_METHOD_META = {
  paypal: { label: 'PayPal', logoHTML: `<span class="paypal-logo">Pay<b>Pal</b></span>` },
  nequi:  { label: 'Nequi',  logoHTML: `<span class="nequi-logo">Nequi</span>` },
  binance:{ label: 'Binance Pay', logoHTML: `<span class="binance-logo">Binance Pay</span>` }
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
  const t = document.getElementById('toast');
  if(!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._hideT);
  t._hideT = setTimeout(()=>t.classList.remove('show'), 3200);
}

/* ============================================================
   COPIAR AL PORTAPAPELES (número Nequi / UID Binance)
============================================================ */
function copyToClipboard(text, btnEl){
  const done = ()=>{
    if(btnEl){
      const original = btnEl.dataset.label || btnEl.textContent;
      btnEl.dataset.label = original;
      btnEl.classList.add('copied');
      btnEl.textContent = 'Copiado ✓';
      setTimeout(()=>{ btnEl.classList.remove('copied'); btnEl.textContent = original; }, 1600);
    }
    showToast('Copiado al portapapeles.');
  };
  if(navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(text).then(done).catch(()=>fallbackCopy(text, done));
  } else {
    fallbackCopy(text, done);
  }
}
function fallbackCopy(text, cb){
  const ta = document.createElement('textarea');
  ta.value = text; ta.style.position='fixed'; ta.style.opacity='0';
  document.body.appendChild(ta); ta.select();
  try{ document.execCommand('copy'); }catch(e){}
  document.body.removeChild(ta);
  if(cb) cb();
}

/* ============================================================
   PILLS DE ESTADO (compartidas por panel cliente y admin)
============================================================ */
function pillHTML(status){
  if(status === 'active' || status === 'paid') return `<span class="pill active"><span class="dot"></span> ${status==='paid'?'Pagada':'Activo'}</span>`;
  if(status === 'rejected') return `<span class="pill rejected"><span class="dot"></span> Rechazado</span>`;
  return `<span class="pill pending"><span class="dot"></span> Pendiente</span>`;
}

function statusPillAdmin(status){
  if(status==='active') return '<span class="pill active"><span class="dot"></span> Activo</span>';
  if(status==='rejected') return '<span class="pill rejected"><span class="dot"></span> Rechazado</span>';
  return '<span class="pill pending"><span class="dot"></span> Pendiente</span>';
}

function ticketPillHTML(status){
  if(status === 'answered') return `<span class="pill answered"><span class="dot"></span> Respondido</span>`;
  if(status === 'closed') return `<span class="pill closed"><span class="dot"></span> Cerrado</span>`;
  return `<span class="pill pending"><span class="dot"></span> Abierto</span>`;
}

/* ============================================================
   NAVBAR: resalta el link activo según la página actual y
   pinta el estado de sesión (Client Area / nombre de usuario)
============================================================ */
function initPublicNav(activeKey){
  document.querySelectorAll('#publicNav a[data-nav]').forEach(a=>{
    a.classList.toggle('active', a.dataset.nav === activeKey);
  });
  const navRight = document.getElementById('navRight');
  const user = currentUser();
  if(navRight && user){
    navRight.innerHTML = `
      <div class="badge-status"><span class="dot-live"></span> Todos los sistemas operativos</div>
      <a href="panel.html" class="btn btn-ghost btn-sm">Hola, ${esc(user.first)}</a>
      <a href="panel.html" class="btn btn-primary btn-sm">Ir al Panel</a>`;
  }
}
