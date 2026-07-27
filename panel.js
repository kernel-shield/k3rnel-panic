/* ============================================================
   KERNEL SHIELD — PANEL.JS (versión API real)
   Requiere core.js cargado antes.
============================================================ */

showLoading('Verificando sesión...');
let KS_USER = null;

async function initPanel(){
  const authed = await requireAuth();
  if(!authed) return;
  KS_USER = await currentUser();
  await migrateLegacyData();
  document.getElementById('guardScreen').style.display = 'none';
  document.getElementById('appShell').style.display = 'block';
  hideLoading();
  await boot();
}

/* ── TIERS ──────────────────────────────────────────────── */
let tierState = { app: 'essential' };

async function renderPlans(){
  const plansDB = await getPlansDB();
  const list = tierState.app === 'premium' ? plansDB.premium : plansDB.essential;
  document.getElementById('appPlansGrid').innerHTML = list.map(p=>planCardHTML(p,'app',tierState.app)).join('');
  document.getElementById('appTierNote').innerHTML = TIER_META[tierState.app].note;
}

document.querySelectorAll('[data-toolbar]').forEach(toolbar=>{
  toolbar.addEventListener('click', e=>{
    const chip = e.target.closest('.tab-chip[data-tier]'); if(!chip) return;
    tierState[toolbar.dataset.toolbar] = chip.dataset.tier;
    toolbar.querySelectorAll('.tab-chip').forEach(c=>c.classList.toggle('active', c===chip));
    renderPlans();
  });
});

/* ── NAVEGACIÓN ─────────────────────────────────────────── */
async function showAppPage(name){
  document.querySelectorAll('.app-page').forEach(p=>p.style.display='none');
  const el = document.getElementById('app-'+name); if(el) el.style.display='block';
  document.querySelectorAll('.side-link[data-app]').forEach(l=>l.classList.toggle('active',l.dataset.app===name));
  window.scrollTo({top:0,behavior:'instant'});
  if(name==='dashboard') await renderDashboard();
  if(name==='services')  await renderServices();
  if(name==='billing')   await renderInvoices();
  if(name==='tickets')   await renderTickets();
  if(name==='profile')   renderProfile();
}

document.body.addEventListener('click', e=>{
  const appLink = e.target.closest('[data-app]');
  if(appLink){ e.preventDefault(); showAppPage(appLink.dataset.app); }
});

async function doLogout(){
  await apiFetch('/api/auth/logout', { method:'POST' });
  invalidateUserCache();
  location.href = 'index.html';
}
document.getElementById('logoutBtn').addEventListener('click', e=>{ e.preventDefault(); doLogout(); });

/* ── DASHBOARD ──────────────────────────────────────────── */
async function renderDashboard(){
  document.getElementById('dashName').textContent = KS_USER.first;
  showLoading('Cargando...');
  const [ordersRes, ticketsRes] = await Promise.all([
    apiFetch('/api/orders/mine'),
    apiFetch('/api/tickets')
  ]);
  hideLoading();

  const orders  = ordersRes.ok  ? (ordersRes.data.orders || ordersRes.data.services || []) : [];
  const tickets = ticketsRes.ok ? (ticketsRes.data.tickets || []) : [];

  const services = orders.filter(o=>o.type==='service'||!o.type);
  const active   = services.filter(s=>s.status==='active');
  document.getElementById('statActive').textContent = active.length;
  document.getElementById('statSpend').textContent  = '$'+active.reduce((a,s)=>a+Number(s.price),0).toFixed(2);
  document.getElementById('statSince').textContent  = new Date(KS_USER.created_at||KS_USER.createdAt||Date.now())
    .toLocaleDateString('es-CO',{year:'numeric',month:'short',day:'numeric'});

  const openT = tickets.filter(t=>t.status!=='closed').length;
  document.getElementById('statTickets').textContent    = openT;
  document.getElementById('statTicketsSub').textContent = openT===0?'Sin incidencias':'Esperando respuesta';
  document.getElementById('statTicketsSub').className   = 'sub'+(openT===0?' sub-green':'');

  const list = document.getElementById('dashServiceList');
  if(!services.length){
    list.innerHTML=`<div class="empty-state"><div class="ic-big"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="3" width="16" height="6" rx="1.5"/><rect x="4" y="15" width="16" height="6" rx="1.5"/></svg></div><p>Aún no tienes servicios contratados.</p></div>`;
    return;
  }
  list.innerHTML = services.map(s=>`
    <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-bottom:1px dashed var(--border-soft);">
      <div>
        <div style="font-weight:600;font-size:13.5px;">${esc(s.name)}</div>
        <div style="font-size:11.5px;color:var(--text-2);">Contratado el ${new Date(s.created_at||s.date||Date.now()).toLocaleDateString('es-CO')} · ${payMethodTagHTML(s.method)}</div>
        ${s.status==='rejected'?`<div style="font-size:11px;color:var(--red);">Motivo: ${esc(s.reject_reason||s.rejectReason||'')}</div>`:''}
      </div>
      <div style="display:flex;align-items:center;gap:14px;">
        ${pillHTML(s.status)}
        <div style="font-family:var(--mono);font-weight:600;">$${Number(s.price).toFixed(2)}/mes</div>
      </div>
    </div>`).join('');
}

/* ── SERVICIOS ──────────────────────────────────────────── */
async function renderServices(){
  showLoading('Cargando servicios...');
  const { ok, data } = await apiFetch('/api/orders/mine');
  hideLoading();
  const services = ok ? (data.orders||[]) : [];
  const wrap = document.getElementById('servicesTableWrap');
  if(!services.length){
    wrap.innerHTML=`<div class="empty-state"><div class="ic-big"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="4" rx="1"/><rect x="3" y="10" width="18" height="4" rx="1"/><rect x="3" y="16" width="18" height="4" rx="1"/></svg></div><p>No tienes servicios todavía.</p><a href="#" class="btn btn-primary btn-sm" style="margin-top:14px;" data-app="vps">Ver planes VPS</a></div>`;
    return;
  }
  wrap.innerHTML=`
    <table class="svc-table">
      <thead><tr><th>Servicio</th><th>Especificaciones</th><th>Método</th><th>Precio</th><th>Estado</th><th>Fecha</th></tr></thead>
      <tbody>
        ${services.map(s=>`
          <tr>
            <td><strong>${esc(s.name)}</strong>${s.status==='rejected'?`<br><span style="color:var(--red);font-size:11px;">Motivo: ${esc(s.reject_reason||s.rejectReason||'Pago no verificado')}</span>`:''}</td>
            <td style="color:var(--text-2);">${esc(s.spec)}</td>
            <td>${payMethodTagHTML(s.method)}</td>
            <td style="font-family:var(--mono);">$${Number(s.price).toFixed(2)}/mes</td>
            <td>${pillHTML(s.status)}${s.status==='rejected'?` <a href="#" class="btn btn-primary btn-sm" style="margin-left:8px;" data-app="vps">Reintentar</a>`:''}</td>
            <td style="color:var(--text-2);">${new Date(s.created_at||s.date||Date.now()).toLocaleDateString('es-CO')}</td>
          </tr>`).join('')}
      </tbody>
    </table>`;
}

/* ── FACTURAS ───────────────────────────────────────────── */
async function renderInvoices(){
  showLoading('Cargando facturas...');
  const { ok, data } = await apiFetch('/api/orders/mine');
  hideLoading();
  const invoices = ok ? (data.invoices||[]) : [];
  const wrap = document.getElementById('invoiceList');
  if(!invoices.length){
    wrap.innerHTML=`<div class="empty-state"><div class="ic-big"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M7 3h10l2 2v16l-3-2-3 2-3-2-3 2V5l0-2Z"/><path d="M9 9h6M9 13h6"/></svg></div><p>No hay facturas todavía.</p></div>`;
    return;
  }
  wrap.innerHTML=`
    <table class="svc-table">
      <thead><tr><th>Factura</th><th>Descripción</th><th>Método</th><th>Monto</th><th>Estado</th><th>Fecha</th></tr></thead>
      <tbody>
        ${invoices.map(inv=>`
          <tr>
            <td style="font-family:var(--mono);">${esc(inv.id)}</td>
            <td>${esc(inv.desc||inv.description)}</td>
            <td>${payMethodTagHTML(inv.method)}</td>
            <td style="font-family:var(--mono);">$${Number(inv.amount).toFixed(2)}</td>
            <td>${pillHTML(inv.status)}</td>
            <td style="color:var(--text-2);">${new Date(inv.created_at||inv.date).toLocaleDateString('es-CO')}</td>
          </tr>`).join('')}
      </tbody>
    </table>`;
}

/* ── PERFIL ─────────────────────────────────────────────── */
function renderProfile(){
  const u = KS_USER; if(!u) return;
  document.getElementById('profName').value    = u.first+' '+u.last;
  document.getElementById('profEmail').value   = u.email;
  document.getElementById('profCountry').value = u.country||'';
}

/* ── TICKETS ────────────────────────────────────────────── */
async function renderTickets(){
  showLoading('Cargando tickets...');
  const { ok, data } = await apiFetch('/api/tickets');
  hideLoading();
  const tickets = ok ? (data.tickets||[]) : [];
  const wrap = document.getElementById('ticketListWrap');
  if(!tickets.length){
    wrap.innerHTML=`<div class="empty-state"><div class="ic-big"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a2 2 0 0 0-2-2v-3a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v3a2 2 0 0 1 0 4v3a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3a2 2 0 0 0 2-2Z"/></svg></div><p>No tienes tickets abiertos.</p></div>`;
    return;
  }
  wrap.innerHTML = tickets.map(t=>`
    <div class="ticket-row" onclick="openTicketModal('${esc(t.id)}')">
      <div>
        <div class="t-subject">${esc(t.subject)}</div>
        <div class="t-meta">${esc(t.id)} · ${esc(t.category)} · ${new Date(t.created_at||t.date).toLocaleDateString('es-CO')} · ${(t.messages||[]).length} mensaje(s)</div>
      </div>
      ${ticketPillHTML(t.status)}
    </div>`).join('');
}

document.getElementById('newTicketBtn').addEventListener('click', e=>{
  e.preventDefault();
  document.getElementById('newTicketBox').style.display='block';
  document.getElementById('newTicketBtn').style.display='none';
});
document.getElementById('cancelTicketBtn').addEventListener('click', ()=>{
  document.getElementById('ticketForm').reset();
  document.getElementById('ticketFormMsg').className='form-msg';
  document.getElementById('newTicketBox').style.display='none';
  document.getElementById('newTicketBtn').style.display='inline-flex';
});

document.getElementById('ticketForm').addEventListener('submit', async function(e){
  e.preventDefault();
  const msg      = document.getElementById('ticketFormMsg');
  const subject  = document.getElementById('ticketSubject').value.trim();
  const category = document.getElementById('ticketCategory').value;
  const message  = document.getElementById('ticketMessage').value.trim();
  if(!subject||!message){ msg.textContent='Completa el asunto y el mensaje.'; msg.className='form-msg err'; return; }
  showLoading('Enviando ticket...');
  const { ok, data } = await apiFetch('/api/tickets', { method:'POST', body:{ subject, category, message } });
  hideLoading();
  if(!ok){ msg.textContent=data.error||'Error al enviar. Intenta de nuevo.'; msg.className='form-msg err'; return; }
  this.reset(); msg.className='form-msg';
  document.getElementById('newTicketBox').style.display='none';
  document.getElementById('newTicketBtn').style.display='inline-flex';
  showToast('Ticket enviado. Te responderemos lo antes posible.');
  await renderTickets();
});

let activeTicketId = null;

async function openTicketModal(ticketId){
  showLoading('Cargando ticket...');
  const { ok, data } = await apiFetch(`/api/tickets/${ticketId}`);
  hideLoading();
  if(!ok) return;
  const t = data.ticket || data;
  activeTicketId = ticketId;
  document.getElementById('ticketModalSubject').textContent = t.subject;
  document.getElementById('ticketModalMeta').innerHTML = `${esc(t.id)} · ${esc(t.category)} · ${ticketPillHTML(t.status)}`;
  const threadWrap = document.getElementById('ticketThreadWrap');
  threadWrap.innerHTML = (t.messages||[]).map(m=>`
    <div class="ticket-msg from-${m.from}">
      <div class="t-who">${m.from==='client'?'Tú':'Soporte Kernel Shield'}</div>
      ${esc(m.text||m.message||'')}
      <div class="t-when">${new Date(m.date||m.created_at).toLocaleString('es-CO')}</div>
    </div>`).join('');
  threadWrap.scrollTop = threadWrap.scrollHeight;
  const closed = t.status==='closed';
  document.getElementById('ticketReplyBox').style.display  = closed?'none':'block';
  document.getElementById('ticketReplyBtn').style.display  = closed?'none':'block';
  document.getElementById('ticketReplyMsg').value = '';
  document.getElementById('ticketModal').classList.add('show');
}
function closeTicketModal(){ document.getElementById('ticketModal').classList.remove('show'); activeTicketId=null; }

document.getElementById('ticketReplyBtn').addEventListener('click', async ()=>{
  const text = document.getElementById('ticketReplyMsg').value.trim();
  if(!text){ showToast('Escribe un mensaje antes de enviar.'); return; }
  showLoading('Enviando...');
  const { ok } = await apiFetch(`/api/tickets/${activeTicketId}/reply`, { method:'POST', body:{ message:text } });
  hideLoading();
  if(!ok){ showToast('Error al enviar respuesta.'); return; }
  document.getElementById('ticketReplyMsg').value='';
  showToast('Respuesta enviada.');
  await openTicketModal(activeTicketId);
  await renderTickets();
});

/* ── ORDER / CHECKOUT ───────────────────────────────────── */
let pendingPlan=null, pendingInvoiceId=null, pendingMethod='paypal';

async function orderPlan(planId, ctx, tier){
  const plansDB = await getPlansDB();
  const list    = tier==='premium' ? plansDB.premium : plansDB.essential;
  pendingPlan   = list.find(p=>p.id===planId);
  if(!pendingPlan){ showToast('Ese plan ya no está disponible.'); return; }
  pendingInvoiceId = 'INV-'+Math.floor(100000+Math.random()*900000);
  pendingMethod = 'paypal';
  selectPayMethod('paypal');

  const summaryHTML = `
    <div class="row"><span>Plan</span><span>${esc(pendingPlan.name)}</span></div>
    <div class="row"><span>vCores</span><span>${pendingPlan.cores}</span></div>
    <div class="row"><span>Memoria</span><span>${esc(pendingPlan.ram)}</span></div>
    <div class="row"><span>Almacenamiento</span><span>${esc(pendingPlan.disk)}</span></div>
    <div class="row total"><span>Total mensual</span><span>$${Number(pendingPlan.price).toFixed(2)} USD</span></div>`;
  document.getElementById('orderSummary').innerHTML = summaryHTML;
  document.getElementById('orderSummaryConfirm').innerHTML = summaryHTML;
  document.getElementById('modalStep1').style.display='block';
  document.getElementById('modalStep2').style.display='none';
  document.getElementById('orderModal').classList.add('show');
}

function closeModal(){ document.getElementById('orderModal').classList.remove('show'); }
function backToStep1(){
  document.getElementById('modalStep1').style.display='block';
  document.getElementById('modalStep2').style.display='none';
}

function selectPayMethod(method){
  pendingMethod = method;
  document.querySelectorAll('.pay-method-card').forEach(c=>c.classList.toggle('selected',c.dataset.method===method));
  ['paypal','nequi','binance'].forEach(m=>{
    const el = document.getElementById('payDetail'+m.charAt(0).toUpperCase()+m.slice(1));
    if(el) el.style.display = m===method?'block':'none';
  });
  const btn=document.getElementById('goPayBtn'), label=document.getElementById('goPayBtnLabel');
  btn.classList.remove('btn-paypal','btn-nequi','btn-binance');
  const map={paypal:['btn-paypal','Pagar con PayPal'],nequi:['btn-nequi','Pagar con Nequi'],binance:['btn-binance','Pagar con Binance']};
  const [cls,txt] = map[method]||map.paypal;
  btn.classList.add(cls); label.textContent=txt;
}

document.getElementById('payMethodsGrid').addEventListener('click', e=>{
  const card=e.target.closest('.pay-method-card'); if(!card) return;
  selectPayMethod(card.dataset.method);
});

document.getElementById('goPayBtn').addEventListener('click', ()=>{
  if(pendingMethod==='paypal'){
    window.open(buildPaypalLink(pendingPlan.name, pendingPlan.price, pendingInvoiceId),'_blank','noopener');
    document.getElementById('modalStep2Desc').textContent='Confirma abajo cuando termines el pago en PayPal. El equipo verificará y activará tu servicio en pocas horas.';
  } else if(pendingMethod==='nequi'){
    tryOpenNequiApp();
    document.getElementById('modalStep2Desc').textContent=`Envía $${Number(pendingPlan.price).toFixed(2)} USD al Nequi ${NEQUI_NUMBER}. Confirma abajo cuando lo hayas hecho.`;
  } else {
    document.getElementById('modalStep2Desc').textContent=`Envía $${Number(pendingPlan.price).toFixed(2)} USD por Binance Pay al UID ${BINANCE_UID}. Confirma abajo cuando lo hayas hecho.`;
  }
  document.getElementById('modalStep1').style.display='none';
  document.getElementById('modalStep2').style.display='block';
});

document.getElementById('confirmOrderBtn').addEventListener('click', async ()=>{
  showLoading('Registrando orden...');
  const { ok, data } = await apiFetch('/api/orders', {
    method: 'POST',
    body: {
      plan_id:  pendingPlan.id,
      plan_name: pendingPlan.name,
      spec:     `${pendingPlan.cores} vCores · ${pendingPlan.ram} RAM · ${pendingPlan.disk}`,
      price:    pendingPlan.price,
      method:   pendingMethod,
      invoice_id: pendingInvoiceId
    }
  });
  hideLoading();
  if(!ok){ showToast(data.error||'Error al registrar la orden. Intenta de nuevo.'); return; }
  closeModal();
  showPostPayScreen();
});

/* ── PANTALLA POST-PAGO ──────────────────────────────────── */
function showPostPayScreen(){
  // Oculta todas las secciones y muestra la pantalla de confirmación
  document.querySelectorAll('.app-page').forEach(p=>p.style.display='none');
  document.querySelectorAll('.side-link[data-app]').forEach(l=>l.classList.remove('active'));

  const methodLabels = { paypal:'PayPal', nequi:'Nequi', binance:'Binance Pay' };
  const methodName = methodLabels[pendingMethod] || pendingMethod;

  let postPayEl = document.getElementById('app-postpay');
  if(!postPayEl){
    postPayEl = document.createElement('div');
    postPayEl.id = 'app-postpay';
    postPayEl.className = 'app-page';
    document.querySelector('.content').appendChild(postPayEl);
  }

  postPayEl.style.display = 'block';
  postPayEl.innerHTML = `
    <div style="max-width:600px;margin:0 auto;padding:40px 0;">
      <div class="panel-box" style="text-align:center;padding:36px 32px;">
        <div style="width:64px;height:64px;border-radius:50%;background:rgba(51,209,122,0.12);border:1.5px solid rgba(51,209,122,0.3);display:flex;align-items:center;justify-content:center;margin:0 auto 18px;">
          <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="#33d17a" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 13 4 4L19 7"/></svg>
        </div>
        <h2 style="margin-bottom:8px;">¡Pago enviado!</h2>
        <p style="color:var(--text-2);font-size:14px;margin-bottom:24px;">
          Tu orden de <strong>${esc(pendingPlan.name)}</strong> por <strong>$${Number(pendingPlan.price).toFixed(2)} USD/mes</strong> fue registrada vía ${esc(methodName)}.
        </p>

        <div class="panel-box" style="text-align:left;background:var(--bg-1);border:1px solid var(--border-soft);">
          <div style="font-weight:700;font-size:13px;margin-bottom:14px;color:var(--text-0);">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-right:5px;"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>
            ¿Qué sigue?
          </div>
          <ol style="padding-left:18px;color:var(--text-1);font-size:13.5px;line-height:1.8;margin:0;">
            <li><strong>Verificamos tu pago</strong> — El equipo revisa la transacción en tu método de pago (normalmente en menos de 12 horas hábiles).</li>
            <li><strong>Activamos tu VPS</strong> — Una vez confirmado, tu servicio pasa a estado Activo y recibes los datos de acceso.</li>
            <li><strong>Recibe tus datos</strong> — Te entregamos IP, usuario y contraseña por el canal que elijas abajo.</li>
          </ol>
        </div>

        <div style="margin:20px 0;display:grid;grid-template-columns:1fr 1fr;gap:12px;">
          <div class="panel-box" style="background:rgba(114,137,218,0.08);border:1.5px solid rgba(114,137,218,0.25);padding:16px;text-align:center;">
            <div style="font-size:22px;margin-bottom:6px;">💬</div>
            <div style="font-weight:700;font-size:13px;color:#7289da;margin-bottom:6px;">Discord</div>
            <p style="font-size:12px;color:var(--text-2);margin:0 0 10px;">Únete al servidor, abre un ticket y gestiona tu entrega ahí.</p>
            <a href="https://discord.com/invite/7tqGFCwj7y" target="_blank" rel="noopener" class="btn btn-sm" style="background:#7289da;color:#fff;border:none;width:100%;">Ir al servidor</a>
          </div>
          <div class="panel-box" style="background:rgba(58,160,255,0.06);border:1.5px solid rgba(58,160,255,0.2);padding:16px;text-align:center;">
            <div style="font-size:22px;margin-bottom:6px;">🎫</div>
            <div style="font-weight:700;font-size:13px;color:var(--blue-1);margin-bottom:6px;">Ticket en la web</div>
            <p style="font-size:12px;color:var(--text-2);margin:0 0 10px;">Abre un ticket aquí mismo y el equipo te responde directo.</p>
            <a href="#" class="btn btn-primary btn-sm" style="width:100%;" onclick="showPostPayFromBtn()">Abrir ticket</a>
          </div>
        </div>

        <a href="#" class="btn btn-ghost btn-sm" data-app="dashboard" style="margin-top:4px;">Ir al dashboard</a>
      </div>
    </div>`;
}

function showPostPayFromBtn(){
  showAppPage('tickets');
  // Pre-abre el formulario de nuevo ticket si existe el botón
  const btn = document.getElementById('newTicketBtn');
  if(btn) btn.click();
}

/* ── BOOT ───────────────────────────────────────────────── */
async function boot(){
  document.getElementById('sideName').textContent   = KS_USER.first+' '+KS_USER.last;
  document.getElementById('sideMail').textContent   = KS_USER.email;
  document.getElementById('sideAvatar').textContent = (KS_USER.first[0]||'K').toUpperCase();

  await renderPlans();

  const params  = new URLSearchParams(location.search);
  const tab     = params.get('tab');
  const orderId = params.get('order');
  const tier    = params.get('tier')==='premium'?'premium':'essential';

  if(tab==='vps'){
    tierState.app=tier;
    document.querySelectorAll('[data-toolbar="app"] .tab-chip').forEach(c=>c.classList.toggle('active',c.dataset.tier===tier));
    await renderPlans();
    await showAppPage('vps');
    if(orderId) await orderPlan(orderId,'app',tier);
  } else {
    await showAppPage('dashboard');
  }
}

initPanel();
