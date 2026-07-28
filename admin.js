/* ============================================================
   KERNEL SHIELD — ADMIN.JS (versión API real corregida)
   Requiere core.js cargado antes.
   El admin se autentica con POST /api/admin/login (cookie aparte).
============================================================ */

let ADMIN_AUTHED = false;

function showAdminGate(){
  document.getElementById('adminGate').style.display='block';
  document.getElementById('adminContent').style.display='none';
}
async function showAdminContent(){
  document.getElementById('adminGate').style.display='none';
  document.getElementById('adminContent').style.display='block';
  showLoading('Cargando panel...');
  await Promise.all([renderAdmin(), renderAdminPlans(), renderAdminTickets()]);
  hideLoading();
}

/* ── LOGIN ADMIN ────────────────────────────────────────── */
let adminFailCount = 0;

document.getElementById('adminGateForm').addEventListener('submit', async function(e){
  e.preventDefault();
  const msg        = document.getElementById('adminGateMsg');
  const passInput  = document.getElementById('adminGatePass');
  if(adminFailCount>=5){ msg.textContent='Demasiados intentos. Recarga la página.'; msg.className='form-msg err'; return; }
  showLoading('Verificando...');
  const { ok, data } = await apiFetch('/api/admin/login', { method:'POST', body:{ password: passInput.value } });
  hideLoading();
  passInput.value = '';
  if(ok){
    adminFailCount = 0; ADMIN_AUTHED = true; msg.className='form-msg';
    await showAdminContent();
  } else {
    adminFailCount++;
    msg.textContent = (data.error||'Contraseña incorrecta.')+` (intento ${adminFailCount}/5)`;
    msg.className = 'form-msg err';
  }
});

document.getElementById('adminLogoutBtn').addEventListener('click', async ()=>{
  await apiFetch('/api/admin/logout', { method:'POST' });
  ADMIN_AUTHED = false;
  location.href = 'index.html';
});

/* ── ÓRDENES ────────────────────────────────────────────── */
async function renderAdmin(){
  showLoading('Cargando órdenes...');
  const { ok, data } = await apiFetch('/api/admin/orders');
  hideLoading();
  const orders = ok ? (data.orders||[]) : [];

  const pending = orders.filter(o=>o.status==='pending').length;
  document.getElementById('adminPendingCount').textContent = pending;
  document.getElementById('adminTotalCount').textContent   = orders.length;

  const wrap = document.getElementById('adminTableWrap');
  if(!orders.length){
    wrap.innerHTML=`<div class="empty-state"><div class="ic-big"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="3" width="16" height="6" rx="1.5"/><rect x="4" y="15" width="16" height="6" rx="1.5"/></svg></div><p>No hay órdenes todavía.</p></div>`;
    return;
  }

  wrap.innerHTML=`
    <table class="svc-table">
      <thead><tr><th>Cliente</th><th>Servicio</th><th>Método</th><th>Precio</th><th>Fecha</th><th>Estado</th><th>Acciones</th></tr></thead>
      <tbody>
        ${orders.map(o=>{
          const userName = (o.user_first||o.first||'?')+' '+(o.user_last||o.last||'');
          const userEmail = o.user_email||o.email||'';
          let actions = '';
          if(o.status==='pending'){
            actions=`<div style="display:flex;gap:8px;">
              <button class="btn btn-primary btn-sm" onclick="adminApprove('${esc(o.id)}')">Aprobar</button>
              <button class="btn btn-danger btn-sm" onclick="adminReject('${esc(o.id)}')">Rechazar</button>
            </div>`;
          } else {
            actions=`<button class="btn btn-ghost btn-sm" onclick="adminRevoke('${esc(o.id)}')">Volver a pendiente</button>`;
          }
          return `
          <tr>
            <td>
              <strong>${esc(userName)}</strong><br>
              <span style="color:var(--text-2);font-size:11.5px;">${esc(userEmail)}</span>
              ${o.country ? `<br><span style="color:var(--text-2);font-size:11px;">🌎 ${esc(o.country)}</span>` : ''}
              ${o.discord ? `<br><span style="color:#7289da;font-size:11px;font-weight:600;">💬 ${esc(o.discord)}</span>` : ''}
            </td>
            <td>${esc(o.name||o.plan_name)}<br><span style="color:var(--text-2);font-size:11.5px;">${esc(o.spec)}</span>${o.reject_reason||o.rejectReason?`<br><span style="color:var(--red);font-size:11px;">Motivo: ${esc(o.reject_reason||o.rejectReason)}</span>`:''}</td>
            <td>${payMethodTagHTML(o.method)}</td>
            <td style="font-family:var(--mono);">$${Number(o.price).toFixed(2)}</td>
            <td style="color:var(--text-2);">${new Date(o.created_at||o.date).toLocaleDateString('es-CO')}</td>
            <td>${statusPillAdmin(o.status)}</td>
            <td>
              <div style="display:flex;gap:8px;align-items:center;">
                ${actions}
                <button class="btn btn-ghost btn-sm" style="padding:7px 9px;color:var(--red);" title="Eliminar" onclick="adminDeleteOrder('${esc(o.id)}')">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6"/></svg>
                </button>
              </div>
            </td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>`;
}

async function adminApprove(id){
  showLoading('Activando...');
  await apiFetch(`/api/admin/orders/${id}/approve`, { method:'POST' });
  hideLoading(); showToast('Servicio activado.'); await renderAdmin();
}

async function adminReject(id){
  const reason = prompt('Motivo del rechazo (lo verá el cliente):') || 'Pago no verificado';
  showLoading('Rechazando...');
  await apiFetch(`/api/admin/orders/${id}/reject`, { method:'POST', body:{ reason } });
  hideLoading(); showToast('Pago rechazado.'); await renderAdmin();
}

async function adminRevoke(id){
  showLoading('Revirtiendo...');
  await apiFetch(`/api/admin/orders/${id}/revoke`, { method:'POST' });
  hideLoading(); await renderAdmin();
}

async function adminDeleteOrder(id){
  if(!confirm('¿Eliminar esta orden por completo? No se puede deshacer.')) return;
  showLoading('Eliminando...');
  await apiFetch(`/api/admin/orders/${id}`, { method:'DELETE' });
  hideLoading(); showToast('Orden eliminada.'); await renderAdmin();
}

/* ── PLANES VPS ─────────────────────────────────────────── */
let adminPlanTier = 'essential';

async function renderAdminPlans(){
  invalidatePlansCache(); // forzar re-fetch la próxima vez
  const { ok, data } = await apiFetch('/api/plans');
  
  // Blindaje estricto para asegurar que allPlans sea un array válido siempre
  const rawPlans = ok ? (data.plans || data || []) : [];
  const allPlans = Array.isArray(rawPlans) ? rawPlans : [];

  const list = allPlans.filter(p => p.tier === adminPlanTier);
  const wrap = document.getElementById('adminPlansWrap'); if(!wrap) return;

  if(!list.length){
    wrap.innerHTML=`<div class="empty-state"><p>No hay planes en esta categoría. Crea uno nuevo arriba.</p></div>`; return;
  }
  wrap.innerHTML=`
    <table class="svc-table">
      <thead><tr><th>Plan</th><th>Specs</th><th>Precio</th><th></th></tr></thead>
      <tbody>
        ${list.map(p=>`
          <tr>
            <td><strong>${esc(p.name)}</strong>${p.tag?` <span class="tab-chip" style="padding:2px 8px;font-size:10.5px;">${esc(p.tag)}</span>`:''}</td>
            <td style="color:var(--text-2);">${p.cores} vCores · ${esc(p.ram)} · ${esc(p.disk)} · ${esc(p.port)} · ${esc(p.bw)}${p.backup?' · backups':''}</td>
            <td style="font-family:var(--mono);">$${Number(p.price).toFixed(2)}</td>
            <td>
              <div style="display:flex;gap:8px;">
                <button class="btn btn-ghost btn-sm" onclick="openPlanModal('edit','${adminPlanTier}','${esc(p.id)}')">Editar</button>
                <button class="btn btn-danger btn-sm" onclick="adminDeletePlan('${esc(p.id)}')">Eliminar</button>
              </div>
            </td>
          </tr>`).join('')}
      </tbody>
    </table>`;
}

document.querySelectorAll('[data-plantier]').forEach(tb=>{
  tb.addEventListener('click', e=>{
    const chip=e.target.closest('.tab-chip[data-tier]'); if(!chip) return;
    adminPlanTier=chip.dataset.tier;
    tb.querySelectorAll('.tab-chip').forEach(c=>c.classList.toggle('active',c===chip));
    renderAdminPlans();
  });
});

function openPlanModal(mode, tier, planId){
  const form=document.getElementById('planForm'); form.reset();
  document.getElementById('planFormMsg').className='form-msg';
  document.getElementById('planTier').value=tier;
  if(mode==='edit'){
    apiFetch('/api/plans').then(({data})=>{
      const rawAll = data.plans || data || [];
      const all = Array.isArray(rawAll) ? rawAll : [];
      const p=all.find(x=>x.id===planId); if(!p) return;
      document.getElementById('planModalTitle').textContent='Editar plan VPS';
      document.getElementById('planId').value=p.id;
      document.getElementById('planName').value=p.name;
      document.getElementById('planPrice').value=p.price;
      document.getElementById('planTag').value=p.tag||'';
      document.getElementById('planCores').value=p.cores;
      document.getElementById('planRam').value=p.ram;
      document.getElementById('planDisk').value=p.disk;
      document.getElementById('planPort').value=p.port;
      document.getElementById('planBw').value=p.bw;
      document.getElementById('planBackup').checked=!!p.backup;
      document.getElementById('planModal').classList.add('show');
    });
    return;
  }
  document.getElementById('planModalTitle').textContent='Nuevo plan VPS';
  document.getElementById('planId').value='';
  document.getElementById('planModal').classList.add('show');
}
function closePlanModal(){ document.getElementById('planModal').classList.remove('show'); }

document.getElementById('planForm').addEventListener('submit', async function(e){
  e.preventDefault();
  const msg=document.getElementById('planFormMsg'); msg.className='form-msg';
  const tier=document.getElementById('planTier').value;
  const name=document.getElementById('planName').value.trim();
  const price=parseFloat(document.getElementById('planPrice').value);
  const tag=document.getElementById('planTag').value.trim();
  const cores=parseInt(document.getElementById('planCores').value,10);
  const ram=document.getElementById('planRam').value.trim();
  const disk=document.getElementById('planDisk').value.trim();
  const port=document.getElementById('planPort').value.trim();
  const bw=document.getElementById('planBw').value.trim();
  const backup=document.getElementById('planBackup').checked;
  if(!name||isNaN(price)||price<0||!cores||!ram||!disk||!port||!bw){
    msg.textContent='Completa todos los campos requeridos.'; msg.className='form-msg err'; return;
  }
  const existId=document.getElementById('planId').value;
  const id=existId||slugify(name)||('plan-'+Date.now().toString(36));
  showLoading('Guardando plan...');
  const { ok, data } = await apiFetch('/api/admin/plans', {
    method:'POST', body:{id, name, tier, price, tag:tag||null, cores, ram, disk, port, bw, backup}
  });
  hideLoading();
  if(!ok){ msg.textContent=data.error||'Error al guardar.'; msg.className='form-msg err'; return; }
  invalidatePlansCache();
  closePlanModal(); showToast('Plan guardado.'); await renderAdminPlans();
});

async function adminDeletePlan(planId){
  if(!confirm('¿Eliminar este plan?')) return;
  showLoading('Eliminando...');
  await apiFetch(`/api/admin/plans/${planId}`, { method:'DELETE' });
  hideLoading(); invalidatePlansCache(); showToast('Plan eliminado.'); await renderAdminPlans();
}

/* ── TICKETS (admin) ────────────────────────────────────── */
async function renderAdminTickets(){
  showLoading('Cargando tickets...');
  const { ok, data } = await apiFetch('/api/admin/tickets');
  hideLoading();
  const tickets = ok ? (data.tickets||[]) : [];
  const wrap = document.getElementById('adminTicketsWrap');
  const open  = tickets.filter(t=>t.status!=='closed').length;
  document.getElementById('adminTicketOpenBadge').textContent = open+(open===1?' abierto':' abiertos');

  if(!tickets.length){
    wrap.innerHTML=`<div class="empty-state"><p>No hay tickets todavía.</p></div>`; return;
  }
  wrap.innerHTML = tickets.map(t=>`
    <div class="ticket-row" onclick="openAdminTicketModal('${esc(t.id)}')">
      <div>
        <div class="t-subject">${esc(t.subject)}</div>
        <div class="t-meta">${esc(t.id)} · ${esc(t.user_first||t.first||'?')} ${esc(t.user_last||t.last||'')} (${esc(t.user_email||t.email||'')})${t.discord ? ` · 💬 ${esc(t.discord)}` : ''}${t.country ? ` · 🌎 ${esc(t.country)}` : ''} · ${esc(t.category)} · ${(t.messages||[]).length} mensaje(s)</div>
      </div>
      ${ticketPillHTML(t.status)}
    </div>`).join('');
}

let activeAdminTicketId = null;

async function openAdminTicketModal(ticketId){
  showLoading('Cargando ticket...');
  const { ok, data } = await apiFetch(`/api/admin/tickets/${ticketId}`);
  hideLoading();
  if(!ok) return;
  const t = data.ticket||data;
  activeAdminTicketId = ticketId;
  document.getElementById('adminTicketSubject').textContent = t.subject;
  document.getElementById('adminTicketMeta').innerHTML=`${esc(t.id)} · ${esc(t.user_first||t.first||'?')} ${esc(t.user_last||t.last||'')} (${esc(t.user_email||t.email||'')})${t.discord ? ` · <span style="color:#7289da;font-weight:600;">💬 ${esc(t.discord)}</span>` : ''}${t.country ? ` · 🌎 ${esc(t.country)}` : ''} · ${esc(t.category)} · ${ticketPillHTML(t.status)}`;
  const w=document.getElementById('adminTicketThreadWrap');
  w.innerHTML=(t.messages||[]).map(m=>`
    <div class="ticket-msg from-${m.from_role||m.from}">
      <div class="t-who">${(m.from_role||m.from)==='client'?'Cliente':'Soporte Kernel Shield'}</div>
      ${esc(m.text||m.message||'')}
      <div class="t-when">${new Date(m.date||m.created_at).toLocaleString('es-CO')}</div>
    </div>`).join('');
  w.scrollTop=w.scrollHeight;
  const closed=t.status==='closed';
  document.getElementById('adminTicketReplyBox').style.display=closed?'none':'block';
  document.getElementById('adminTicketReplyBtn').style.display=closed?'none':'block';
  document.getElementById('adminCloseTicketBtn').style.display=closed?'none':'block';
  document.getElementById('adminTicketReplyMsg').value='';
  document.getElementById('adminTicketModal').classList.add('show');
}
function closeAdminTicketModal(){ document.getElementById('adminTicketModal').classList.remove('show'); activeAdminTicketId=null; }

document.getElementById('adminTicketReplyBtn').addEventListener('click', async ()=>{
  const text=document.getElementById('adminTicketReplyMsg').value.trim();
  if(!text){ showToast('Escribe un mensaje antes de enviar.'); return; }
  showLoading('Enviando...');
  await apiFetch(`/api/admin/tickets/${activeAdminTicketId}/reply`, { method:'POST', body:{ message:text } });
  hideLoading(); showToast('Respuesta enviada al cliente.');
  await openAdminTicketModal(activeAdminTicketId);
  await renderAdminTickets();
});

document.getElementById('adminCloseTicketBtn').addEventListener('click', async ()=>{
  if(!confirm('¿Cerrar este ticket?')) return;
  showLoading('Cerrando...');
  await apiFetch(`/api/admin/tickets/${activeAdminTicketId}/close`, { method:'POST' });
  hideLoading(); showToast('Ticket cerrado.'); closeAdminTicketModal(); await renderAdminTickets();
});

/* ── BOOT ───────────────────────────────────────────────── */
(async function boot(){
  // Verificar si ya hay sesión admin activa en el servidor
  const { ok } = await apiFetch('/api/admin/orders');
  if(ok){ ADMIN_AUTHED=true; await showAdminContent(); }
  else { showAdminGate(); }
})();
