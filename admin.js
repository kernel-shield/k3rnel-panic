/* ============================================================
   ADMIN.JS — lógica exclusiva del panel administrativo (admin.html)
   Requiere core.js cargado antes.

   NOTA DE SEGURIDAD: esta es una demo 100% front-end sin backend
   ni base de datos real. La contraseña se compara contra un hash,
   nunca en texto plano, y la sesión de admin expira sola a los 30
   minutos. Para producción real con dinero de por medio, esto debe
   validarse siempre en un servidor — un sitio estático nunca debe
   ser la única barrera de un panel de administración.
============================================================ */

const ADMIN_SESSION_KEY = 'ks_admin_session';
const ADMIN_SESSION_MS = 30 * 60 * 1000; // 30 minutos
const ADMIN_PASS_HASH = hashPass('kernelshield2026');

function adminAuthed(){
  try{
    const raw = sessionStorage.getItem(ADMIN_SESSION_KEY);
    if(!raw) return false;
    const data = JSON.parse(raw);
    return data && data.exp && Date.now() < data.exp;
  }catch(e){ return false; }
}
function setAdminSession(){
  sessionStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify({exp: Date.now() + ADMIN_SESSION_MS}));
}
function clearAdminSession(){
  sessionStorage.removeItem(ADMIN_SESSION_KEY);
}

function showAdminGate(){
  document.getElementById('adminGate').style.display = 'block';
  document.getElementById('adminContent').style.display = 'none';
}
function showAdminContent(){
  document.getElementById('adminGate').style.display = 'none';
  document.getElementById('adminContent').style.display = 'block';
  migrateLegacyData();
  renderAdmin();
  renderAdminPlans();
  renderAdminTickets();
}

let adminFailCount = 0;
document.getElementById('adminGateForm').addEventListener('submit', function(e){
  e.preventDefault();
  const msg = document.getElementById('adminGateMsg');
  const passInput = document.getElementById('adminGatePass');
  if(adminFailCount >= 5){
    msg.textContent = 'Demasiados intentos fallidos. Recarga la página para volver a intentar.';
    msg.className = 'form-msg err';
    return;
  }
  const pass = passInput.value;
  if(hashPass(pass) === ADMIN_PASS_HASH){
    adminFailCount = 0;
    setAdminSession();
    passInput.value = '';
    msg.className = 'form-msg';
    showAdminContent();
  } else {
    adminFailCount++;
    msg.textContent = 'Contraseña incorrecta.';
    msg.className = 'form-msg err';
    passInput.value = '';
  }
});

document.getElementById('adminLogoutBtn').addEventListener('click', ()=>{
  clearAdminSession();
  location.href = 'index.html';
});

/* ============================================================
   TABLA DE ÓRDENES (aprobar / rechazar / revocar)
============================================================ */
function renderAdmin(){
  const db = getUsers();
  const rows = [];
  Object.values(db).forEach(u=>{
    (u.services||[]).forEach(s=>{
      rows.push({user:u, svc:s});
    });
  });
  rows.sort((a,b)=> new Date(b.svc.date) - new Date(a.svc.date));

  const wrap = document.getElementById('adminTableWrap');
  const pendingCount = rows.filter(r=>r.svc.status==='pending').length;
  document.getElementById('adminPendingCount').textContent = pendingCount;
  document.getElementById('adminTotalCount').textContent = rows.length;

  if(rows.length === 0){
    wrap.innerHTML = `<div class="empty-state"><div class="ic-big"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="3" width="16" height="6" rx="1.5"/><rect x="4" y="15" width="16" height="6" rx="1.5"/></svg></div><p>No hay órdenes registradas todavía.</p></div>`;
    return;
  }

  wrap.innerHTML = `
    <table class="svc-table">
      <thead><tr><th>Cliente</th><th>Servicio</th><th>Método</th><th>Precio</th><th>Fecha</th><th>Estado</th><th></th></tr></thead>
      <tbody>
        ${rows.map(r=>{
          let actions = '';
          if(r.svc.status === 'pending'){
            actions = `<div style="display:flex;gap:8px;">
              <button class="btn btn-primary btn-sm" onclick="adminApprove('${esc(r.user.email)}','${esc(r.svc.id)}')">Aprobar</button>
              <button class="btn btn-danger btn-sm" onclick="adminReject('${esc(r.user.email)}','${esc(r.svc.id)}')">Rechazar</button>
            </div>`;
          } else {
            actions = `<button class="btn btn-ghost btn-sm" onclick="adminRevoke('${esc(r.user.email)}','${esc(r.svc.id)}')">Volver a pendiente</button>`;
          }
          return `
          <tr>
            <td><strong>${esc(r.user.first)} ${esc(r.user.last)}</strong><br><span style="color:var(--text-2);font-size:11.5px;">${esc(r.user.email)}</span></td>
            <td>${esc(r.svc.name)}<br><span style="color:var(--text-2);font-size:11.5px;">${esc(r.svc.spec)}</span>${r.svc.rejectReason ? `<br><span style="color:var(--red);font-size:11px;">Motivo: ${esc(r.svc.rejectReason)}</span>` : ''}</td>
            <td>${payMethodTagHTML(r.svc.method)}</td>
            <td style="font-family:var(--mono);">$${r.svc.price.toFixed(2)}</td>
            <td style="color:var(--text-2);">${new Date(r.svc.date).toLocaleDateString('es-CO')}</td>
            <td>${statusPillAdmin(r.svc.status)}</td>
            <td>
              <div style="display:flex;gap:8px;align-items:center;">
                ${actions}
                <button class="btn btn-ghost btn-sm" title="Eliminar orden" style="padding:7px 9px;color:var(--red);" onclick="adminDeleteOrder('${esc(r.user.email)}','${esc(r.svc.id)}')">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6"/></svg>
                </button>
              </div>
            </td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>`;
}

function adminApprove(email, svcId){
  const db = getUsers();
  const user = db[email];
  if(!user) return;
  const svc = user.services.find(s=>s.id===svcId);
  if(svc){ svc.status = 'active'; delete svc.rejectReason; }
  const inv = user.invoices.find(i=>i.svcId===svcId);
  if(inv) inv.status = 'paid';
  db[email] = user;
  saveUsers(db);
  showToast('Servicio activado para ' + user.first + '.');
  renderAdmin();
}

function adminReject(email, svcId){
  const reason = prompt('Motivo del rechazo (visible para el cliente, opcional):') || 'Pago no verificado';
  const db = getUsers();
  const user = db[email];
  if(!user) return;
  const svc = user.services.find(s=>s.id===svcId);
  if(svc){ svc.status = 'rejected'; svc.rejectReason = reason; }
  const inv = user.invoices.find(i=>i.svcId===svcId);
  if(inv) inv.status = 'rejected';
  db[email] = user;
  saveUsers(db);
  showToast('Pago rechazado para ' + user.first + '.');
  renderAdmin();
}

function adminRevoke(email, svcId){
  const db = getUsers();
  const user = db[email];
  if(!user) return;
  const svc = user.services.find(s=>s.id===svcId);
  if(svc){ svc.status = 'pending'; delete svc.rejectReason; }
  const inv = user.invoices.find(i=>i.svcId===svcId);
  if(inv) inv.status = 'pending';
  db[email] = user;
  saveUsers(db);
  renderAdmin();
}

/* Elimina la orden por completo (servicio + su factura asociada).
   A diferencia de "Rechazar", esto no deja rastro — es para limpiar
   pruebas, duplicados o pedidos que ya no quieres ver en la tabla. */
function adminDeleteOrder(email, svcId){
  if(!confirm('¿Eliminar esta orden por completo? Esto también borra su factura asociada y no se puede deshacer.')) return;
  const db = getUsers();
  const user = db[email];
  if(!user) return;
  user.services = user.services.filter(s=>s.id!==svcId);
  user.invoices = (user.invoices||[]).filter(i=>i.svcId!==svcId);
  db[email] = user;
  saveUsers(db);
  showToast('Orden eliminada.');
  renderAdmin();
}

/* ============================================================
   GESTIÓN DE PLANES VPS (crear / editar / eliminar)
============================================================ */
let adminPlanTier = 'essential';

function renderAdminPlans(){
  const plansDB = getPlansDB();
  const list = plansDB[adminPlanTier] || [];
  const wrap = document.getElementById('adminPlansWrap');
  if(!wrap) return;

  if(list.length === 0){
    wrap.innerHTML = `<div class="empty-state"><p>No hay planes en esta categoría todavía.</p></div>`;
    return;
  }

  wrap.innerHTML = `
    <table class="svc-table">
      <thead><tr><th>Plan</th><th>Specs</th><th>Precio</th><th></th></tr></thead>
      <tbody>
        ${list.map(p=>`
          <tr>
            <td><strong>${esc(p.name)}</strong>${p.tag ? ` <span class="tab-chip" style="padding:2px 8px;font-size:10.5px;">${esc(p.tag)}</span>` : ''}</td>
            <td style="color:var(--text-2);">${p.cores} vCores · ${esc(p.ram)} · ${esc(p.disk)} · ${esc(p.port)} · ${esc(p.bw)}${p.backup?' · backups':''}</td>
            <td style="font-family:var(--mono);">$${Number(p.price).toFixed(2)}</td>
            <td>
              <div style="display:flex;gap:8px;">
                <button class="btn btn-ghost btn-sm" onclick="openPlanModal('edit','${adminPlanTier}','${esc(p.id)}')">Editar</button>
                <button class="btn btn-danger btn-sm" onclick="adminDeletePlan('${adminPlanTier}','${esc(p.id)}')">Eliminar</button>
              </div>
            </td>
          </tr>`).join('')}
      </tbody>
    </table>`;
}

document.querySelectorAll('[data-plantier]').forEach(toolbar=>{
  toolbar.addEventListener('click', (e)=>{
    const chip = e.target.closest('.tab-chip[data-tier]');
    if(!chip) return;
    adminPlanTier = chip.dataset.tier;
    toolbar.querySelectorAll('.tab-chip').forEach(c=>c.classList.toggle('active', c===chip));
    renderAdminPlans();
  });
});

function openPlanModal(mode, tier, planId){
  const form = document.getElementById('planForm');
  form.reset();
  document.getElementById('planFormMsg').className = 'form-msg';
  document.getElementById('planTier').value = tier;

  if(mode === 'edit'){
    const plansDB = getPlansDB();
    const p = (plansDB[tier]||[]).find(x=>x.id===planId);
    if(!p) return;
    document.getElementById('planModalTitle').textContent = 'Editar plan VPS';
    document.getElementById('planId').value = p.id;
    document.getElementById('planName').value = p.name;
    document.getElementById('planPrice').value = p.price;
    document.getElementById('planTag').value = p.tag || '';
    document.getElementById('planCores').value = p.cores;
    document.getElementById('planRam').value = p.ram;
    document.getElementById('planDisk').value = p.disk;
    document.getElementById('planPort').value = p.port;
    document.getElementById('planBw').value = p.bw;
    document.getElementById('planBackup').checked = !!p.backup;
  } else {
    document.getElementById('planModalTitle').textContent = 'Nuevo plan VPS';
    document.getElementById('planId').value = '';
  }
  document.getElementById('planModal').classList.add('show');
}

function closePlanModal(){
  document.getElementById('planModal').classList.remove('show');
}

document.getElementById('planForm').addEventListener('submit', function(e){
  e.preventDefault();
  const msg = document.getElementById('planFormMsg');
  const tier = document.getElementById('planTier').value;
  const name = document.getElementById('planName').value.trim();
  const price = parseFloat(document.getElementById('planPrice').value);
  const tag = document.getElementById('planTag').value.trim();
  const cores = parseInt(document.getElementById('planCores').value, 10);
  const ram = document.getElementById('planRam').value.trim();
  const disk = document.getElementById('planDisk').value.trim();
  const port = document.getElementById('planPort').value.trim();
  const bw = document.getElementById('planBw').value.trim();
  const backup = document.getElementById('planBackup').checked;

  if(!name || isNaN(price) || price < 0 || !cores || !ram || !disk || !port || !bw){
    msg.textContent = 'Completa todos los campos obligatorios con valores válidos.';
    msg.className = 'form-msg err';
    return;
  }

  const plansDB = getPlansDB();
  const existingId = document.getElementById('planId').value;
  const list = plansDB[tier] || (plansDB[tier] = []);

  if(existingId){
    const p = list.find(x=>x.id===existingId);
    if(p){
      p.name = name; p.price = price; p.tag = tag || null;
      p.cores = cores; p.ram = ram; p.disk = disk; p.port = port; p.bw = bw; p.backup = backup;
    }
  } else {
    let id = slugify(name);
    if(list.some(x=>x.id===id)) id = id + '-' + Date.now().toString(36);
    list.push({id, name, price, tag: tag || null, cores, ram, disk, port, bw, backup});
  }

  savePlansDB(plansDB);
  closePlanModal();
  showToast('Plan guardado correctamente.');
  renderAdminPlans();
});

function adminDeletePlan(tier, planId){
  if(!confirm('¿Eliminar este plan? Los clientes ya no podrán ordenarlo. Los servicios ya contratados no se ven afectados.')) return;
  const plansDB = getPlansDB();
  plansDB[tier] = (plansDB[tier]||[]).filter(p=>p.id!==planId);
  savePlansDB(plansDB);
  showToast('Plan eliminado.');
  renderAdminPlans();
}

/* ============================================================
   TICKETS DE SOPORTE (vista y respuesta del admin)
============================================================ */
function collectAllTickets(){
  const db = getUsers();
  const rows = [];
  Object.values(db).forEach(u=>{
    if(!Array.isArray(u.tickets)) u.tickets = [];
    u.tickets.forEach(t=> rows.push({user:u, ticket:t}));
  });
  rows.sort((a,b)=> new Date(b.ticket.date) - new Date(a.ticket.date));
  return rows;
}

function renderAdminTickets(){
  const wrap = document.getElementById('adminTicketsWrap');
  const rows = collectAllTickets();
  const openCount = rows.filter(r=>r.ticket.status!=='closed').length;
  document.getElementById('adminTicketOpenBadge').textContent = openCount + (openCount===1 ? ' abierto' : ' abiertos');

  if(rows.length === 0){
    wrap.innerHTML = `<div class="empty-state"><p>No hay tickets registrados todavía.</p></div>`;
    return;
  }

  wrap.innerHTML = rows.map(r=>{
    const last = r.ticket.messages[r.ticket.messages.length-1];
    return `
    <div class="ticket-row" onclick="openAdminTicketModal('${esc(r.user.email)}','${esc(r.ticket.id)}')">
      <div>
        <div class="t-subject">${esc(r.ticket.subject)}</div>
        <div class="t-meta">${esc(r.ticket.id)} · ${esc(r.user.first)} ${esc(r.user.last)} (${esc(r.user.email)}) · ${esc(r.ticket.category)} · ${r.ticket.messages.length} mensaje(s)</div>
      </div>
      ${ticketPillHTML(r.ticket.status)}
    </div>`;
  }).join('');
}

let activeAdminTicket = { email:null, id:null };

function renderAdminTicketThread(ticket){
  document.getElementById('adminTicketThreadWrap').innerHTML = ticket.messages.map(m=>`
    <div class="ticket-msg from-${m.from}">
      <div class="t-who">${m.from === 'client' ? 'Cliente' : 'Soporte Kernel Shield'}</div>
      ${esc(m.text)}
      <div class="t-when">${new Date(m.date).toLocaleString('es-CO')}</div>
    </div>`).join('');
  const w = document.getElementById('adminTicketThreadWrap');
  w.scrollTop = w.scrollHeight;
}

function openAdminTicketModal(email, ticketId){
  const db = getUsers();
  const user = db[email];
  if(!user) return;
  const ticket = (user.tickets||[]).find(t=>t.id===ticketId);
  if(!ticket) return;
  activeAdminTicket = { email, id: ticketId };

  document.getElementById('adminTicketSubject').textContent = ticket.subject;
  document.getElementById('adminTicketMeta').innerHTML = `${esc(ticket.id)} · ${esc(user.first)} ${esc(user.last)} (${esc(user.email)}) · ${esc(ticket.category)} · ${ticketPillHTML(ticket.status)}`;
  renderAdminTicketThread(ticket);

  const replyBox = document.getElementById('adminTicketReplyBox');
  const replyBtn = document.getElementById('adminTicketReplyBtn');
  const closeBtn = document.getElementById('adminCloseTicketBtn');
  if(ticket.status === 'closed'){
    replyBox.style.display = 'none';
    replyBtn.style.display = 'none';
    closeBtn.style.display = 'none';
  } else {
    replyBox.style.display = 'block';
    replyBtn.style.display = 'block';
    closeBtn.style.display = 'block';
    document.getElementById('adminTicketReplyMsg').value = '';
  }
  document.getElementById('adminTicketModal').classList.add('show');
}

function closeAdminTicketModal(){
  document.getElementById('adminTicketModal').classList.remove('show');
  activeAdminTicket = { email:null, id:null };
}

document.getElementById('adminTicketReplyBtn').addEventListener('click', ()=>{
  const text = document.getElementById('adminTicketReplyMsg').value.trim();
  if(!text){ showToast('Escribe un mensaje antes de enviar.'); return; }
  const db = getUsers();
  const user = db[activeAdminTicket.email];
  if(!user) return;
  const ticket = (user.tickets||[]).find(t=>t.id===activeAdminTicket.id);
  if(!ticket) return;
  ticket.messages.push({ from:'admin', text, date: new Date().toISOString() });
  ticket.status = 'answered';
  db[user.email] = user;
  saveUsers(db);
  document.getElementById('adminTicketReplyMsg').value = '';
  renderAdminTicketThread(ticket);
  document.getElementById('adminTicketMeta').innerHTML = `${esc(ticket.id)} · ${esc(user.first)} ${esc(user.last)} (${esc(user.email)}) · ${esc(ticket.category)} · ${ticketPillHTML(ticket.status)}`;
  renderAdminTickets();
  showToast('Respuesta enviada al cliente.');
});

document.getElementById('adminCloseTicketBtn').addEventListener('click', ()=>{
  if(!confirm('¿Marcar este ticket como cerrado? El cliente ya no podrá responder en este hilo.')) return;
  const db = getUsers();
  const user = db[activeAdminTicket.email];
  if(!user) return;
  const ticket = (user.tickets||[]).find(t=>t.id===activeAdminTicket.id);
  if(!ticket) return;
  ticket.status = 'closed';
  db[user.email] = user;
  saveUsers(db);
  showToast('Ticket cerrado.');
  closeAdminTicketModal();
  renderAdminTickets();
});

/* ============================================================
   BOOT
============================================================ */
(function boot(){
  if(adminAuthed()){
    showAdminContent();
  } else {
    showAdminGate();
  }
})();
