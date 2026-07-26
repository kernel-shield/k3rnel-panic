/* ============================================================
   PANEL.JS — lógica exclusiva del panel de cliente (panel.html).
   Requiere core.js cargado antes.
============================================================ */

/* ---------- GUARD DE AUTENTICACIÓN ----------
   requireAuth() ya redirige solo (via location.href) si no hay sesión.
   Guardamos el resultado en KS_AUTHED y lo usamos al final del archivo
   para decidir si arrancamos boot() o no — así el resto del script
   (que registra los botones) siempre se ejecuta sin errores. */
const KS_AUTHED = requireAuth();
if(KS_AUTHED){
  migrateLegacyData();
  document.getElementById('guardScreen').style.display = 'none';
  document.getElementById('appShell').style.display = 'block';
}

/* ---------- TIERS DE PLANES (solo la vista "app" existe aquí) ---------- */
let tierState = { app: 'essential' };

function renderPlans(){
  const plansDB = getPlansDB();
  const appList = tierState.app === 'premium' ? plansDB.premium : plansDB.essential;
  document.getElementById('appPlansGrid').innerHTML = appList.map(p=>planCardHTML(p,'app',tierState.app)).join('');
  document.getElementById('appTierNote').innerHTML = TIER_META[tierState.app].note;
}

document.querySelectorAll('[data-toolbar]').forEach(toolbar=>{
  toolbar.addEventListener('click', (e)=>{
    const chip = e.target.closest('.tab-chip[data-tier]');
    if(!chip) return;
    const ctx = toolbar.dataset.toolbar;
    tierState[ctx] = chip.dataset.tier;
    toolbar.querySelectorAll('.tab-chip').forEach(c=>c.classList.toggle('active', c===chip));
    renderPlans();
  });
});

/* ---------- NAVEGACIÓN ENTRE SECCIONES DEL PANEL ---------- */
function showAppPage(name){
  document.querySelectorAll('.app-page').forEach(p=>p.style.display='none');
  const el = document.getElementById('app-'+name);
  if(el) el.style.display='block';
  document.querySelectorAll('.side-link[data-app]').forEach(l=>l.classList.toggle('active', l.dataset.app===name));
  if(name==='dashboard') renderDashboard();
  if(name==='services') renderServices();
  if(name==='billing') renderInvoices();
  if(name==='tickets') renderTickets();
  if(name==='profile') renderProfile();
  window.scrollTo({top:0, behavior:'instant'});
}

document.body.addEventListener('click', (e)=>{
  const appLink = e.target.closest('[data-app]');
  if(appLink){
    e.preventDefault();
    showAppPage(appLink.dataset.app);
  }
});

function doLogout(){
  clearSession();
  location.href = 'index.html';
}
document.getElementById('logoutBtn').addEventListener('click', (e)=>{ e.preventDefault(); doLogout(); });

/* ---------- RENDER DE DASHBOARD / SERVICIOS / FACTURAS / PERFIL ---------- */
function renderDashboard(){
  const user = currentUser(); if(!user) return;
  document.getElementById('dashName').textContent = user.first;
  const activeServices = user.services.filter(s=>s.status==='active');
  document.getElementById('statActive').textContent = activeServices.length;
  const spend = activeServices.reduce((a,s)=>a+s.price,0);
  document.getElementById('statSpend').textContent = '$'+spend.toFixed(2);
  document.getElementById('statSince').textContent = new Date(user.createdAt).toLocaleDateString('es-CO', {year:'numeric', month:'short', day:'numeric'});

  const openTickets = getUserTickets(user).filter(t=>t.status!=='closed').length;
  document.getElementById('statTickets').textContent = openTickets;
  document.getElementById('statTicketsSub').textContent = openTickets === 0 ? 'Sin incidencias' : 'Esperando respuesta';
  document.getElementById('statTicketsSub').className = 'sub' + (openTickets === 0 ? ' sub-green' : '');

  const list = document.getElementById('dashServiceList');
  if(user.services.length === 0){
    list.innerHTML = `<div class="empty-state"><div class="ic-big"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="3" width="16" height="6" rx="1.5"/><rect x="4" y="15" width="16" height="6" rx="1.5"/><circle cx="8" cy="6" r=".6" fill="currentColor" stroke="none"/><circle cx="8" cy="18" r=".6" fill="currentColor" stroke="none"/></svg></div><p>Aún no tienes servicios contratados.</p></div>`;
  } else {
    list.innerHTML = user.services.slice().reverse().map(s=>`
      <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-bottom:1px dashed var(--border-soft);">
        <div>
          <div style="font-weight:600;font-size:13.5px;">${esc(s.name)}</div>
          <div style="font-size:11.5px;color:var(--text-2);">Contratado el ${new Date(s.date).toLocaleDateString('es-CO')} · ${payMethodTagHTML(s.method)}</div>
        </div>
        <div style="display:flex;align-items:center;gap:14px;">
          ${pillHTML(s.status)}
          <div style="font-family:var(--mono);font-weight:600;">$${s.price.toFixed(2)}/mes</div>
        </div>
      </div>`).join('');
  }
}

function renderServices(){
  const user = currentUser(); if(!user) return;
  const wrap = document.getElementById('servicesTableWrap');
  if(user.services.length === 0){
    wrap.innerHTML = `<div class="empty-state"><div class="ic-big"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="4" rx="1"/><rect x="3" y="10" width="18" height="4" rx="1"/><rect x="3" y="16" width="18" height="4" rx="1"/></svg></div><p>No tienes servicios activos todavía.</p><a href="#" class="btn btn-primary btn-sm" style="margin-top:14px;" data-app="vps">Ver planes VPS</a></div>`;
    return;
  }
  wrap.innerHTML = `
    <table class="svc-table">
      <thead><tr><th>Servicio</th><th>Especificaciones</th><th>Método</th><th>Precio</th><th>Estado</th><th>Fecha</th></tr></thead>
      <tbody>
        ${user.services.slice().reverse().map(s=>`
          <tr>
            <td><strong>${esc(s.name)}</strong>${s.status==='rejected' ? `<br><span style="color:var(--red);font-size:11px;">Motivo: ${esc(s.rejectReason||'Pago no verificado')}</span>` : ''}</td>
            <td style="color:var(--text-2);">${esc(s.spec)}</td>
            <td>${payMethodTagHTML(s.method)}</td>
            <td style="font-family:var(--mono);">$${s.price.toFixed(2)}/mes</td>
            <td>${pillHTML(s.status)}${s.status==='rejected' ? ` <a href="#" class="btn btn-primary btn-sm" style="margin-left:8px;" data-app="vps">Reintentar</a>` : ''}</td>
            <td style="color:var(--text-2);">${new Date(s.date).toLocaleDateString('es-CO')}</td>
          </tr>`).join('')}
      </tbody>
    </table>`;
}

function renderInvoices(){
  const user = currentUser(); if(!user) return;
  const wrap = document.getElementById('invoiceList');
  if(user.invoices.length === 0){
    wrap.innerHTML = `<div class="empty-state"><div class="ic-big"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M7 3h10l2 2v16l-3-2-3 2-3-2-3 2V5l0-2Z"/><path d="M9 9h6M9 13h6"/></svg></div><p>No hay facturas todavía.</p></div>`;
    return;
  }
  wrap.innerHTML = `
    <table class="svc-table">
      <thead><tr><th>Factura</th><th>Descripción</th><th>Método</th><th>Monto</th><th>Estado</th><th>Fecha</th></tr></thead>
      <tbody>
        ${user.invoices.slice().reverse().map(inv=>`
          <tr>
            <td style="font-family:var(--mono);">${esc(inv.id)}</td>
            <td>${esc(inv.desc)}</td>
            <td>${payMethodTagHTML(inv.method)}</td>
            <td style="font-family:var(--mono);">$${inv.amount.toFixed(2)}</td>
            <td>${pillHTML(inv.status)}</td>
            <td style="color:var(--text-2);">${new Date(inv.date).toLocaleDateString('es-CO')}</td>
          </tr>`).join('')}
      </tbody>
    </table>`;
}

function renderProfile(){
  const user = currentUser(); if(!user) return;
  document.getElementById('profName').value = user.first + ' ' + user.last;
  document.getElementById('profEmail').value = user.email;
  document.getElementById('profCountry').value = user.country;
}

/* ============================================================
   SISTEMA DE TICKETS DE SOPORTE
============================================================ */
function getUserTickets(user){
  // Compatibilidad con cuentas creadas antes de que existiera este sistema
  if(!Array.isArray(user.tickets)) user.tickets = [];
  return user.tickets;
}

function renderTickets(){
  const user = currentUser(); if(!user) return;
  const tickets = getUserTickets(user);
  const wrap = document.getElementById('ticketListWrap');

  if(tickets.length === 0){
    wrap.innerHTML = `<div class="empty-state"><div class="ic-big"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a2 2 0 0 0-2-2v-3a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v3a2 2 0 0 1 0 4v3a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3a2 2 0 0 0 2-2Z"/><path d="M10 8v8" stroke-dasharray="1.6 1.6"/></svg></div><p>No tienes tickets abiertos actualmente.</p></div>`;
    return;
  }

  wrap.innerHTML = tickets.slice().reverse().map(t=>{
    const last = t.messages[t.messages.length-1];
    return `
    <div class="ticket-row" onclick="openTicketModal('${esc(t.id)}')">
      <div>
        <div class="t-subject">${esc(t.subject)}</div>
        <div class="t-meta">${esc(t.id)} · ${esc(t.category)} · ${new Date(t.date).toLocaleDateString('es-CO')} · ${t.messages.length} mensaje(s)</div>
      </div>
      ${ticketPillHTML(t.status)}
    </div>`;
  }).join('');
}

/* Mostrar / ocultar el formulario de nuevo ticket */
document.getElementById('newTicketBtn').addEventListener('click', (e)=>{
  e.preventDefault();
  document.getElementById('newTicketBox').style.display = 'block';
  document.getElementById('newTicketBtn').style.display = 'none';
});
document.getElementById('cancelTicketBtn').addEventListener('click', ()=>{
  document.getElementById('ticketForm').reset();
  document.getElementById('ticketFormMsg').className = 'form-msg';
  document.getElementById('newTicketBox').style.display = 'none';
  document.getElementById('newTicketBtn').style.display = 'inline-flex';
});

document.getElementById('ticketForm').addEventListener('submit', function(e){
  e.preventDefault();
  const msg = document.getElementById('ticketFormMsg');
  const subject = document.getElementById('ticketSubject').value.trim();
  const category = document.getElementById('ticketCategory').value;
  const message = document.getElementById('ticketMessage').value.trim();

  if(!subject || !message){
    msg.textContent = 'Completa el asunto y el mensaje.';
    msg.className = 'form-msg err';
    return;
  }

  const user = currentUser();
  const db = getUsers();
  const tickets = getUserTickets(user);
  const ticket = {
    id: 'TCK-' + Math.floor(100000+Math.random()*900000),
    subject, category,
    status: 'open',
    date: new Date().toISOString(),
    messages: [
      { from: 'client', text: message, date: new Date().toISOString() }
    ]
  };
  tickets.push(ticket);
  db[user.email] = user;
  saveUsers(db);

  this.reset();
  msg.className = 'form-msg';
  document.getElementById('newTicketBox').style.display = 'none';
  document.getElementById('newTicketBtn').style.display = 'inline-flex';
  showToast('Ticket enviado. Te responderemos lo antes posible.');
  renderTickets();
});

/* ---------- Modal de hilo / respuesta ---------- */
let activeTicketId = null;

function renderTicketThread(ticket){
  document.getElementById('ticketThreadWrap').innerHTML = ticket.messages.map(m=>`
    <div class="ticket-msg from-${m.from}">
      <div class="t-who">${m.from === 'client' ? 'Tú' : 'Soporte Kernel Shield'}</div>
      ${esc(m.text)}
      <div class="t-when">${new Date(m.date).toLocaleString('es-CO')}</div>
    </div>`).join('');
  const threadWrap = document.getElementById('ticketThreadWrap');
  threadWrap.scrollTop = threadWrap.scrollHeight;
}

function openTicketModal(ticketId){
  const user = currentUser();
  const ticket = getUserTickets(user).find(t=>t.id===ticketId);
  if(!ticket) return;
  activeTicketId = ticketId;

  document.getElementById('ticketModalSubject').textContent = ticket.subject;
  document.getElementById('ticketModalMeta').innerHTML = `${esc(ticket.id)} · ${esc(ticket.category)} · ${ticketPillHTML(ticket.status)}`;
  renderTicketThread(ticket);

  const replyBox = document.getElementById('ticketReplyBox');
  const replyBtn = document.getElementById('ticketReplyBtn');
  if(ticket.status === 'closed'){
    replyBox.style.display = 'none';
    replyBtn.style.display = 'none';
  } else {
    replyBox.style.display = 'block';
    replyBtn.style.display = 'block';
    document.getElementById('ticketReplyMsg').value = '';
  }
  document.getElementById('ticketModal').classList.add('show');
}

function closeTicketModal(){
  document.getElementById('ticketModal').classList.remove('show');
  activeTicketId = null;
}

document.getElementById('ticketReplyBtn').addEventListener('click', ()=>{
  const text = document.getElementById('ticketReplyMsg').value.trim();
  if(!text){ showToast('Escribe un mensaje antes de enviar.'); return; }
  const user = currentUser();
  const db = getUsers();
  const ticket = getUserTickets(user).find(t=>t.id===activeTicketId);
  if(!ticket) return;
  ticket.messages.push({ from:'client', text, date: new Date().toISOString() });
  ticket.status = 'open'; // vuelve a quedar pendiente de respuesta del equipo
  db[user.email] = user;
  saveUsers(db);
  document.getElementById('ticketReplyMsg').value = '';
  renderTicketThread(ticket);
  document.getElementById('ticketModalMeta').innerHTML = `${esc(ticket.id)} · ${esc(ticket.category)} · ${ticketPillHTML(ticket.status)}`;
  renderTickets();
  showToast('Respuesta enviada.');
});

/* ============================================================
   ORDER / CHECKOUT MODAL — PayPal, Nequi, Binance Pay
============================================================ */
let pendingPlan = null, pendingCtx = null, pendingInvoiceId = null, pendingMethod = 'paypal';

function orderPlan(planId, ctx, tier){
  const user = currentUser();
  if(!user){
    showToast('Inicia sesión para ordenar un plan.');
    location.href = 'login.html';
    return;
  }
  const plansDB = getPlansDB();
  const list = tier === 'premium' ? plansDB.premium : plansDB.essential;
  pendingPlan = list.find(p=>p.id===planId);
  if(!pendingPlan){ showToast('Ese plan ya no está disponible.'); return; }
  pendingCtx = ctx;
  pendingInvoiceId = 'INV-' + Math.floor(100000+Math.random()*900000);
  pendingMethod = 'paypal';
  selectPayMethod('paypal');

  const summaryHTML = `
    <div class="row"><span>Plan</span><span>${esc(pendingPlan.name)}</span></div>
    <div class="row"><span>vCores</span><span>${pendingPlan.cores}</span></div>
    <div class="row"><span>Memoria</span><span>${esc(pendingPlan.ram)}</span></div>
    <div class="row"><span>Almacenamiento</span><span>${esc(pendingPlan.disk)}</span></div>
    <div class="row total"><span>Total mensual</span><span>$${pendingPlan.price.toFixed(2)} USD</span></div>
  `;
  document.getElementById('orderSummary').innerHTML = summaryHTML;
  document.getElementById('orderSummaryConfirm').innerHTML = summaryHTML;
  document.getElementById('modalStep1').style.display = 'block';
  document.getElementById('modalStep2').style.display = 'none';
  document.getElementById('orderModal').classList.add('show');
}

function closeModal(){
  document.getElementById('orderModal').classList.remove('show');
}

function backToStep1(){
  document.getElementById('modalStep1').style.display = 'block';
  document.getElementById('modalStep2').style.display = 'none';
}

/* Selector visual de método de pago dentro del modal */
function selectPayMethod(method){
  pendingMethod = method;
  document.querySelectorAll('.pay-method-card').forEach(c=>c.classList.toggle('selected', c.dataset.method===method));
  document.getElementById('payDetailPaypal').style.display = method==='paypal' ? 'block' : 'none';
  document.getElementById('payDetailNequi').style.display = method==='nequi' ? 'block' : 'none';
  document.getElementById('payDetailBinance').style.display = method==='binance' ? 'block' : 'none';

  const btn = document.getElementById('goPayBtn');
  const label = document.getElementById('goPayBtnLabel');
  btn.classList.remove('btn-paypal','btn-nequi','btn-binance');
  if(method === 'nequi'){ btn.classList.add('btn-nequi'); label.textContent = 'Pagar con Nequi'; }
  else if(method === 'binance'){ btn.classList.add('btn-binance'); label.textContent = 'Pagar con Binance'; }
  else { btn.classList.add('btn-paypal'); label.textContent = 'Pagar con PayPal'; }
}

document.getElementById('payMethodsGrid').addEventListener('click', (e)=>{
  const card = e.target.closest('.pay-method-card');
  if(!card) return;
  selectPayMethod(card.dataset.method);
});

document.getElementById('goPayBtn').addEventListener('click', ()=>{
  if(pendingMethod === 'paypal'){
    const link = buildPaypalLink(pendingPlan.name, pendingPlan.price, pendingInvoiceId);
    window.open(link, '_blank', 'noopener');
    document.getElementById('modalStep2Desc').textContent = 'Confirma abajo cuando termines el pago en la pestaña de PayPal. Un miembro del equipo verificará la transacción y activará tu servicio manualmente — normalmente en menos de unas horas.';
  } else if(pendingMethod === 'nequi'){
    tryOpenNequiApp();
    document.getElementById('modalStep2Desc').textContent = 'Envía $' + pendingPlan.price.toFixed(2) + ' USD (o su equivalente en COP) al número Nequi 312 848 2212. Cuando lo hagas, confirma abajo — el equipo verificará y activará tu servicio.';
  } else if(pendingMethod === 'binance'){
    document.getElementById('modalStep2Desc').textContent = 'Envía $' + pendingPlan.price.toFixed(2) + ' USD (o su equivalente) por Binance Pay al UID 1216562025. Cuando lo hagas, confirma abajo — el equipo verificará y activará tu servicio.';
  }
  document.getElementById('modalStep1').style.display = 'none';
  document.getElementById('modalStep2').style.display = 'block';
});

document.getElementById('confirmOrderBtn').addEventListener('click', ()=>{
  const user = currentUser();
  const db = getUsers();
  const svc = {
    id: 'SVC-' + Math.floor(100000+Math.random()*900000),
    name: 'VPS ' + pendingPlan.name,
    spec: `${pendingPlan.cores} vCores · ${pendingPlan.ram} RAM · ${pendingPlan.disk}`,
    price: pendingPlan.price,
    date: new Date().toISOString(),
    method: pendingMethod,
    status: 'pending' // pending -> active (lo activa el admin manualmente)
  };
  user.services.push(svc);
  user.invoices.push({
    id: pendingInvoiceId,
    svcId: svc.id,
    desc: svc.name,
    amount: pendingPlan.price,
    date: new Date().toISOString(),
    method: pendingMethod,
    status: 'pending' // pending -> paid
  });
  db[user.email] = user;
  saveUsers(db);
  closeModal();
  showToast('Pago registrado. Tu servicio quedó pendiente de verificación.');
  showAppPage('dashboard');
});

/* ============================================================
   BOOT — entra directo al dashboard; si viene de vps.html con
   ?tab=vps y opcionalmente ?order=planId&tier=essential|premium,
   abre esa sección y lanza el checkout automáticamente.
============================================================ */
function boot(){
  const user = currentUser();
  document.getElementById('sideName').textContent = user.first + ' ' + user.last;
  document.getElementById('sideMail').textContent = user.email;
  document.getElementById('sideAvatar').textContent = (user.first[0]||'K').toUpperCase();

  renderPlans();

  const params = new URLSearchParams(location.search);
  const tab = params.get('tab');
  const orderId = params.get('order');
  const tier = params.get('tier') === 'premium' ? 'premium' : 'essential';

  if(tab === 'vps'){
    tierState.app = tier;
    document.querySelectorAll('[data-toolbar="app"] .tab-chip').forEach(c=>c.classList.toggle('active', c.dataset.tier===tier));
    renderPlans();
    showAppPage('vps');
    if(orderId){
      orderPlan(orderId, 'app', tier);
    }
  } else {
    showAppPage('dashboard');
  }
}

/* ---------- ARRANQUE REAL ----------
   Se ejecuta acá, al final del archivo, cuando ya existen: tierState,
   todas las funciones (render*, showAppPage, orderPlan, etc.) y todos
   los event listeners de los botones ya quedaron registrados arriba. */
if(KS_AUTHED){
  boot();
}
