/* ==========================================================
   Seguridad Primavera – JavaScript principal  v 4.0
   ========================================================== */

/* ═════════════════ Helpers + almacenamiento ══════════════ */
const $  = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);
const ls = {
  set : (k,v)=>localStorage.setItem(k,JSON.stringify(v)),
  get : (k,d=[])=>JSON.parse(localStorage.getItem(k)||JSON.stringify(d))
};

/* ── Seed universal de vecinos para cualquier origen ── */
;(function seedDefaultResidents() {
  // Si no hay ningún vecino en storage, sembramos uno demo
  if (!ls.get('residents').length) {
    ls.set('residents', [
      { name: 'Demo Vecino', house: '1004', phone: '0000-0000', addr: 'Calle Demo 1004' }
    ]);
  }
  // Si no hay ningún user con role 'vecino', sembramos sus credenciales
  const users = ls.get('users', []);
  if (!users.some(u => u.role === 'vecino')) {
    users.push({ user: 'vecino1004', pass: 'pass1004', role: 'vecino', house: '1004' });
    ls.set('users', users);
  }
})();


/* ── Semilla / Garantía de usuarios base ── */
(function ensureBaseUsers() {
  const SUPER = { user: 'rootadmin', pass: 'root2025', role: 'super' };
  const ADMIN = { user: 'admin',     pass: 'admin123',  role: 'admin' };

  const users = ls.get('users', []);

  /* — super‑admin — */
  const iSuper = users.findIndex(u => u.role === 'super');
  if (iSuper === -1) {
    users.push(SUPER);
  } else {
    users[iSuper] = { ...users[iSuper], ...SUPER };     // fuerza contraseña
  }

  /* — admin “normal” — */
  if (!users.some(u => u.role === 'admin')) users.push(ADMIN);

  ls.set('users', users);
})();



/* ═════════════════ Estado de sesión ══════════════════════ */
let role='',currentUser='',currentHouse=null,currentGuard=null;

/* ═════════════════ Utilidades generales ═════════════════ */
const rand = n=>Math.random().toString(36).slice(-n);
const genCred = p=>({user:`${p}${rand(5)}`,pass:rand(8)});
const userExists = u=>ls.get('users').some(x=>x.user===u);
const addUser = u=>{const arr=ls.get('users');arr.push(u);ls.set('users',arr);};
const delUsers = fn=>ls.set('users',ls.get('users').filter(u=>!fn(u)));
const updatePass = (u,p)=>{const a=ls.get('users');const x=a.find(e=>e.user===u);if(!x)return false;x.pass=p;ls.set('users',a);return true;};

/* ═════════════════ Navegación básica ════════════════════ */
const show=sel=>{$$('.screen').forEach(s=>s.style.display='none');$(sel).style.display='block';};
const tab = id =>{$$('.tab').forEach(t=>t.classList.remove('active'));
  $(`[data-tab="${id}"]`).classList.add('active');
  $$('.tab-pane').forEach(p=>p.classList.add('hidden'));
  $('#'+id).classList.remove('hidden');};
$$('.tab').forEach(b=>b.onclick=()=>tab(b.dataset.tab));
show('#login');

/* ==========================================================
   LOGIN
   ========================================================== */
$('#loginForm').onsubmit=e=>{
  e.preventDefault();
  const u=$('#user').value.trim(), p=$('#pass').value.trim();
  const acc=ls.get('users').find(a=>a.user===u&&a.pass===p);
  if(!acc)return Swal.fire('Error','Credenciales incorrectas','error');

  role=acc.role; currentUser=acc.user;
  if(role==='vecino') currentHouse=acc.house;
  if(role==='guard')  currentGuard=ls.get('guards').find(g=>g.id===acc.guardId);

  $('#login').style.display='none';
  if(role==='vecino'){ initPortal(); show('#portal'); }
  else               { initApp();    show('#app');    tab('access'); }
};
$('#logoutBtn').onclick=$('#logoutVecino').onclick=()=>location.reload();

/* ==========================================================
   PORTAL VECINO
   ========================================================== */
function initPortal(){
  const res=ls.get('residents').find(r=>r.house===currentHouse);
  const pays=ls.get('payments').filter(p=>p.house===currentHouse);
  $('#vecinoCard').innerHTML=`<h2 class="title">Hola, ${res?.name||''}</h2>
    <p><b>Dirección:</b> ${res?.addr||''}</p><p><b>Tel.:</b> ${res?.phone||''}</p>`;
  $('#vecPagos').innerHTML=pays.length?pays.map(p=>`<div>${p.mes} – L. ${p.amount}</div>`).join(''):'Sin pagos.';
  renderVisitasPortal();

  $('#expCSV').onclick=()=>{
    const vis=ls.get('access').filter(v=>v.house===currentHouse);
    if(!vis.length)return;
    const csv='Fecha,Nombre,Tipo,Registró\n'+vis.map(v=>`${v.time},${v.nombre},${v.tipo},${v.guard}`).join('\n');
    saveAs(new Blob([csv],{type:'text/csv'}),`visitas_casa${currentHouse}.csv`);
  };
  $('#vecPassForm').onsubmit=e=>{
    e.preventDefault();
    const np=$('#vecNewPass').value.trim();
    if(np.length<4)return Swal.fire('Mínimo 4 caracteres','','warning');
    if(updatePass(currentUser,np)) Swal.fire('Actualizada','Vuelva a entrar','success').then(()=>location.reload());
  };
}
const renderVisitasPortal=()=>$('#vecVisitas').innerHTML=
  ls.get('access').filter(v=>v.house===currentHouse)
    .map(v=>`<div>${v.time} – ${v.nombre} (${v.tipo})</div>`).join('')||'Sin visitas.';

/* ==========================================================
   APP PRINCIPAL
   ========================================================== */
function initApp(){

  /* ---- flags de rol ---- */
  const isSuper  = role==='super';
  const isAdmin  = role==='admin';
  const isGuard  = role==='guard';
  const canErase = isSuper;                 // sólo super‑admin borra directo
  const canManage= isSuper||isAdmin;        // super y admin tienen CRUD

  /* ---- UI conditional ---- */
  if(isAdmin) $('#accessForm').style.display='none';
  if(!canManage)
    ['residents','guards','companies','payments','debts','settings'].forEach(id=>$(`[data-tab="${id}"]`).classList.add('hidden'));
  else $('#settingsTab').classList.remove('hidden');
  if(isSuper) $('#reqTab').classList.remove('hidden');

  $('#profileTab').classList.toggle('hidden', !isGuard);
  $('#visitsTab').classList.remove('hidden');

  $('#whoami').textContent =
    isSuper? 'Sesión: Super‑Admin'
    : isAdmin? 'Sesión: Administrador'
    : isGuard? `Sesión: Guardia – ${currentGuard?.name||currentUser}`
    : '';

  /* ---------- helpers comunes ---------- */
  const visitasHoy = ()=>ls.get('access').filter(a=>new Date(a.time).toDateString()===new Date().toDateString()).length;

  const syncSelectors=()=>{
    const res=ls.get('residents'), com=ls.get('companies');
    $('#payRes').innerHTML = res.map((r,i)=>`<option value="${i}">${r.name} (Casa ${r.house})</option>`).join('');
    $('#debtRes').innerHTML =
      `<optgroup label="Residentes">${res.map((r,i)=>`<option data-type="res" value="${i}">${r.name}</option>`).join('')}</optgroup>`+
      `<optgroup label="Empresas">${com.map((c,i)=>`<option data-type="com" value="${i}">${c.name}</option>`).join('')}</optgroup>`;
  };
  const syncHostList=()=>{
    const res=ls.get('residents'), com=ls.get('companies');
    $('#hostList').innerHTML=
      res.map(r=>`<option data-house="${r.house}" value="${r.name} (Casa ${r.house})">`).join('')+
      com.map(c=>`<option data-house="${c.unit}" value="${c.name} (Local ${c.unit})">`).join('');
  };
  $('#acHost').oninput=()=>{
    const opt=[...$('#hostList').options].find(o=>o.value===$('#acHost').value);
    if(opt) $('#acHouse').value=opt.dataset.house;
  };

  const kpi=()=>{
    const mes=new Date().toISOString().slice(0,7);
    const ingresos=ls.get('payments').filter(p=>p.mes===mes).reduce((s,p)=>s+p.amount,0);
    const total=ls.get('residents').length+ls.get('companies').length;
    const pend=ls.get('debts').length;
    const pct=total?Math.round(pend/total*100):0;
    $('#kpiRow').innerHTML=isGuard?
      `<div class="card-glass"><h3 class="text-xl">Visitas hoy</h3><p class="text-3xl">${visitasHoy()}</p></div>`
      :`<div class="card-glass"><h3 class="text-xl">Ingresos mes</h3><p class="text-3xl">L. ${ingresos}</p></div>
        <div class="card-glass"><h3 class="text-xl">% Pendientes</h3><p class="text-3xl">${pct}%</p></div>
        <div class="card-glass"><h3 class="text-xl">Visitas hoy</h3><p class="text-3xl">${visitasHoy()}</p></div>`;
  };

  /* ---------- Accesos ---------- */
  $('#accessForm').onsubmit=e=>{
    e.preventDefault();
    const rec={
      nombre:$('#acNombre').value.trim(),
      id:$('#acId').value.trim(),
      host:$('#acHost').value.trim(),
      house:$('#acHouse').value.trim(),
      tipo:$('#acTipo').value,
      guard:isGuard?currentGuard?.name||currentUser:currentUser,
      time:new Date().toLocaleString()
    };
    const a=ls.get('access');a.unshift(rec);ls.set('access',a);
    renderAccess();$('#accessForm').reset();kpi();renderVisits();
  };

  const renderAccess=()=>$('#accessList').innerHTML=
    ls.get('access').map((a,i)=>`
      <div class="flex justify-between mb-2 items-start">
        <div>${a.time} · ${a.tipo} · ${a.nombre}
          ${a.id?`<br>Doc.: ${a.id}`:''}
          <br>Visita a: <b>${a.host}</b>
          <br><small>Registró: ${a.guard}</small></div>
        ${canErase?`<button data-i="${i}" class="btn-red delAcc w-8 h-8 flex items-center justify-center text-sm">✕</button>`:''}
      </div>`).join('');

  $('#accessList').onclick=e=>{
    if(!e.target.classList.contains('delAcc')||!canErase)return;
    const i=+e.target.dataset.i;let arr=ls.get('access');arr.splice(i,1);ls.set('access',arr);
    renderAccess();renderVisits();
  };

  /* —— limpiar historial —— */
  if(canManage){
    $('#clrAccess').onclick=()=>{
      if(canErase){
        Swal.fire({title:'¿Vaciar historial?',icon:'warning',showCancelButton:true,confirmButtonText:'Sí'}).then(r=>{
          if(r.isConfirmed){ls.set('access',[]);renderAccess();renderVisits();Swal.fire('Hecho','','success');}
        });
      }else{
        crearSolicitud('access');
        Swal.fire('Solicitud enviada','Super‑admin la revisará','info');
      }
    };
  }else $('#clrAccess')?.remove();

  /* ---------- Bitácora ---------- */
  $('#bitForm').onsubmit=e=>{
    e.preventDefault();
    const b=ls.get('bitacora');b.unshift({text:$('#bitText').value,time:new Date().toLocaleString()});
    ls.set('bitacora',b);renderBits();$('#bitForm').reset();
  };
  const renderBits=()=>$('#bitList').innerHTML=
    ls.get('bitacora').slice(0,100).map(b=>`<div>${b.time} – ${b.text}</div>`).join('');

  if(canManage){
    $('#clrBitacora').onclick=()=>{
      if(canErase){
        Swal.fire({title:'¿Vaciar bitácora?',icon:'warning',showCancelButton:true,confirmButtonText:'Sí'}).then(r=>{
          if(r.isConfirmed){ls.set('bitacora',[]);renderBits();Swal.fire('Hecho','','success');}
        });
      }else{
        crearSolicitud('bitacora');
        Swal.fire('Solicitud enviada','Super‑admin la revisará','info');
      }
    };
  }else $('#clrBitacora')?.remove();

  /* ---------- CRUD: Residentes ---------- */
  $('#resForm').onsubmit=e=>{
    e.preventDefault();
    const r={name:$('#resName').value,house:$('#resHouse').value,phone:$('#resPhone').value,addr:$('#resAddr').value};
    let u=$('#resUser').value.trim(),p=$('#resPass').value.trim();
    if(u||p){if(!u||!p)return Swal.fire('Completa ambos campos','','warning');
             if(userExists(u))return Swal.fire('Usuario duplicado','','error');}
    else ({user:u,pass:p}=genCred('v'));
    addUser({user:u,pass:p,role:'vecino',house:r.house});
    Swal.fire('Credenciales',`Usuario:<b>${u}</b><br>Contraseña:<b>${p}</b>`,'info');
    const arr=ls.get('residents');arr.push(r);ls.set('residents',arr);
    renderResidents();$('#resForm').reset();syncSelectors();syncHostList();
  };
  const renderResidents=()=>$('#resList').innerHTML=
    ls.get('residents').map((r,i)=>`
      <div class="flex justify-between mb-2 items-start">
        <div><b>${r.house}</b> – ${r.name}<br>Tel: ${r.phone}<br>Dir: ${r.addr}</div>
        <button data-i="${i}" class="btn-red delRes w-8 h-8 flex items-center justify-center text-sm">✕</button>
      </div>`).join('');
  $('#resList').onclick=e=>{
    if(!e.target.classList.contains('delRes'))return;
    const i=+e.target.dataset.i;const r=ls.get('residents')[i];
    delUsers(u=>u.role==='vecino'&&u.house===r.house);
    let arr=ls.get('residents');arr.splice(i,1);ls.set('residents',arr);
    renderResidents();syncSelectors();syncHostList();
  };

  /* ---------- CRUD: Guardias ---------- */
  $('#guardForm').onsubmit=e=>{
    e.preventDefault();
    const g={name:$('#gName').value,phone:$('#gPhone').value,idCard:$('#gIdCard').value.trim(),id:rand(6)};
    let u=$('#gUser').value.trim(),p=$('#gPass').value.trim();
    if(u||p){if(!u||!p)return Swal.fire('Campos faltan','','warning');
             if(userExists(u))return Swal.fire('Usuario duplicado','','error');}
    else ({user:u,pass:p}=genCred('g'));
    addUser({user:u,pass:p,role:'guard',guardId:g.id});
    Swal.fire('Credenciales',`Usuario:<b>${u}</b><br>Contraseña:<b>${p}</b>`,'info');
    const arr=ls.get('guards');arr.push(g);ls.set('guards',arr);
    renderGuards();$('#guardForm').reset();
  };
  const renderGuards=()=>$('#guardList').innerHTML=
    ls.get('guards').map((g,i)=>`
      <div class="flex justify-between mb-2 items-start">
        <div><b>ID:</b> ${g.id}<br><b>${g.name}</b>${g.idCard?`<br>ID doc.: ${g.idCard}`:''}<br>Tel: ${g.phone}</div>
        <button data-i="${i}" class="btn-red delGuard w-8 h-8 flex items-center justify-center text-sm">✕</button>
      </div>`).join('');
  $('#guardList').onclick=e=>{
    if(!e.target.classList.contains('delGuard'))return;
    const i=+e.target.dataset.i;const g=ls.get('guards')[i];
    delUsers(u=>u.role==='guard'&&u.guardId===g.id);
    let arr=ls.get('guards');arr.splice(i,1);ls.set('guards',arr);
    renderGuards();
  };

  /* ---------- CRUD: Empresas ---------- */
  $('#comForm').onsubmit=e=>{
    e.preventDefault();
    const c={name:$('#comName').value,unit:$('#comUnit').value,phone:$('#comPhone').value,addr:$('#comAddr').value};
    const arr=ls.get('companies');arr.push(c);ls.set('companies',arr);
    renderCompanies();$('#comForm').reset();syncSelectors();syncHostList();
  };
  const renderCompanies=()=>$('#comList').innerHTML=
    ls.get('companies').map((c,i)=>`
      <div class="flex justify-between mb-2 items-start">
        <div><b>${c.unit}</b> – ${c.name}<br>Tel: ${c.phone}<br>Dir: ${c.addr}</div>
        <button data-i="${i}" class="btn-red delCom w-8 h-8 flex items-center justify-center text-sm">✕</button>
      </div>`).join('');
  $('#comList').onclick=e=>{
    if(!e.target.classList.contains('delCom'))return;
    const i=+e.target.dataset.i;let arr=ls.get('companies');arr.splice(i,1);ls.set('companies',arr);
    renderCompanies();syncSelectors();syncHostList();
  };

  /* ---------- Pagos ---------- */
  $('#payForm').onsubmit=e=>{
    e.preventDefault();
    const idx=$('#payRes').value;
    const r=ls.get('residents')[idx];
    if(!r)return;
    const p={name:r.name,house:r.house,amount:+$('#payMonto').value,mes:$('#payMes').value,time:new Date().toLocaleString()};
    const arr=ls.get('payments');arr.unshift(p);ls.set('payments',arr);
    renderPays();$('#payForm').reset();kpi();drawDebtChart();
  };
  const renderPays=()=>$('#payList').innerHTML=
    ls.get('payments').slice(0,50).map(p=>`<div>${p.mes} • ${p.name} • L. ${p.amount}</div>`).join('');

  /* ---------- Deudas ---------- */
  $('#debtForm').onsubmit=e=>{
    e.preventDefault();
    const opt=$('#debtRes').selectedOptions[0],type=opt.dataset.type,val=+opt.value;
    let name,house;
    if(type==='res'){const r=ls.get('residents')[val];name=r.name;house=`Casa ${r.house}`;}
    else            {const c=ls.get('companies')[val];name=c.name;house=`Local ${c.unit}`;}
    const d={name,house,mes:$('#debtMes').value,amount:+$('#debtAmount').value,type};
    const arr=ls.get('debts');arr.unshift(d);ls.set('debts',arr);
    renderDebts();drawDebtChart();$('#debtForm').reset();kpi();
  };
  const renderDebts=()=>$('#debtList').innerHTML=
    ls.get('debts').length?ls.get('debts').map((d,i)=>`
      <div class="card-glass moroso mb-2 flex justify-between items-center">
        <div><b>${d.name}</b> – ${d.house}<br>${d.mes} – L. ${d.amount}</div>
        <button data-i="${i}" class="btn-green payDebt w-20 h-8 flex items-center justify-center text-sm">Pagado</button>
      </div>`).join(''):'<p class="text-green-300">Sin deudas 🎉</p>';
  $('#debtList').onclick=e=>{
    if(!e.target.classList.contains('payDebt'))return;
    const i=+e.target.dataset.i;let arr=ls.get('debts');arr.splice(i,1);ls.set('debts',arr);
    renderDebts();drawDebtChart();kpi();
  };
  let debtChart;
  const drawDebtChart=()=>{
    if(!$('#chartDebts'))return;
    const total=ls.get('residents').length+ls.get('companies').length,
          pend =ls.get('debts').length;
    debtChart?.destroy();
    debtChart=new Chart($('#chartDebts'),{
      type:'doughnut',
      data:{labels:['Al día','Pendientes'],
            datasets:[{data:[total-pend,pend],backgroundColor:['#10b981','#ef4444']}]},
      options:{plugins:{legend:{position:'bottom'}}}});
  };

  /* ---------- Solicitudes (super‑admin) ---------- */
  function renderRequests(){
    $('#reqList').innerHTML=
      ls.get('requests').map((r,i)=>`
        <div class="card-glass mb-3">
          <p><b>${r.type==='access'?'Borrar historial de visitas':'Vaciar bitácora'}</b></p>
          <p>Solicitó: ${r.requester} – ${r.time}</p>
          <p>Estado: <b class="${
            r.status==='pendiente'?'text-amber-300':r.status==='aprobado'?'text-green-300':'text-rose-300'}">
            ${r.status}</b></p>
          ${r.status==='pendiente'?`
            <div class="mt-2 flex gap-2">
              <button data-i="${i}" class="btn-green btnAp px-4">Aprobar</button>
              <button data-i="${i}" class="btn-red   btnDe px-4">Denegar</button>
            </div>`:''}
        </div>`).join('')||'<p class="opacity-60">Sin solicitudes.</p>';
  }

  if(isSuper){
    $('#reqTab').onclick=renderRequests;
    $('#reqList').onclick=e=>{
      const i=+e.target.dataset.i;
      if(Number.isNaN(i))return;
      let reqs=ls.get('requests');const req=reqs[i];
      if(!req||req.status!=='pendiente')return;
      if(e.target.classList.contains('btnAp')){
        if(req.type==='access')   ls.set('access',[]);
        if(req.type==='bitacora') ls.set('bitacora',[]);
        req.status='aprobado';
        ls.set('requests',reqs);
        renderRequests();renderAccess();renderBits();renderVisits();
        Swal.fire('Aprobado','Se ejecutó la acción','success');
      }
      if(e.target.classList.contains('btnDe')){
        req.status='denegado';ls.set('requests',reqs);renderRequests();
      }
    };
  }

  function crearSolicitud(type){
    const arr=ls.get('requests');
    arr.push({id:Date.now(),type,requester:currentUser,status:'pendiente',time:new Date().toLocaleString()});
    ls.set('requests',arr);
  }

  /* ---------- Ajustes Admin ---------- */
  if(isAdmin){
    $('#admUser').value=currentUser;
    $('#admForm').onsubmit=e=>{
      e.preventDefault();
      const nU=$('#admUser').value.trim(), nP=$('#admPass').value.trim();
      if(!nU||!nP)return Swal.fire('Campos requeridos','','warning');
      if(nU!==currentUser&&userExists(nU))return Swal.fire('Usuario duplicado','','error');
      const users=ls.get('users');const adm=users.find(u=>u.role==='admin');
      adm.user=nU;adm.pass=nP;ls.set('users',users);
      Swal.fire('Actualizado','Reinicia sesión','success').then(()=>location.reload());
    };

    $('#adminClearAllVisits').onclick=()=>{
      crearSolicitud('access');
      Swal.fire('Solicitud enviada','Super‑admin la revisará','info');
    };
  }else if(!isSuper){ $('#adminClearAllVisits')?.remove(); }

  /* super puede borrar global de inmediato */
  if(isSuper){
    $('#adminClearAllVisits').onclick=()=>{
      Swal.fire({title:'¿Borrar todos los registros de visitas?',icon:'warning',
        showCancelButton:true,confirmButtonText:'Sí'}).then(r=>{
        if(r.isConfirmed){ls.set('access',[]);renderAccess();renderVisits();Swal.fire('Hecho','','success');}
      });
    };
  }

  /* ---------- Perfil guardia ---------- */
  if(isGuard){
    $('#guardPassForm').onsubmit=e=>{
      e.preventDefault();
      const np=$('#guardNewPass').value.trim();
      if(np.length<4)return Swal.fire('Mínimo 4 caracteres','','warning');
      if(updatePass(currentUser,np)) Swal.fire('Actualizada','Vuelva a entrar','success').then(()=>location.reload());
    };
  }

  /* ---------- Historial de visitas (solo lectura) ---------- */
  const renderVisits=()=>$('#visitsList').innerHTML=
    ls.get('access').map(a=>`
      <div class="mb-2">${a.time} • ${a.tipo} • ${a.nombre}
        ${a.id?`<br>Doc.: ${a.id}`:''}
        <br>Visita a: <b>${a.host}</b>
        <br><small>Registró: ${a.guard}</small></div>`).join('');

  /* ---------- inicial ---------- */
  (function initAll(){
    syncSelectors();syncHostList();
    renderResidents();renderGuards();renderCompanies();
    renderAccess();renderBits();renderPays();renderDebts();drawDebtChart();renderVisits();kpi();
    if(isSuper) renderRequests();
  })();
}

/* ==========================================================
   ServiceWorker (opcional)
   ========================================================== */
if('serviceWorker' in navigator){
  navigator.serviceWorker.register('service-worker.js');
}
/* ────────────────────────────────────────────────────────────
  Override completo de login: admite vecinos demo o admin
  (colocar al final de app.js)
──────────────────────────────────────────────────────────── */
;(function(){
  const form = document.getElementById('loginForm');
  if (!form) return;

  form.onsubmit = function(e) {
    e.preventDefault();
    const u = $('#user').value.trim();
    const p = $('#pass').value.trim();

    // Buscar credenciales en localStorage
    const acc = ls.get('users', []).find(a => a.user === u && a.pass === p);
    if (!acc) {
      return Swal.fire('Error', 'Credenciales incorrectas', 'error');
    }

    // Autenticación exitosa
    role = acc.role;
    currentUser = acc.user;
    if (role === 'vecino') {
      currentHouse = acc.house;
    } else if (role === 'guard') {
      currentGuard = ls.get('guards').find(g => g.id === acc.guardId);
      isTurnActive = Boolean(ls.get('activeTurn')?.user === currentUser);
    }

    // Ocultar login y mostrar la pantalla adecuada
    $('#login').style.display = 'none';
    if (role === 'vecino') {
      initPortal();
      show('#portal');
    } else {
      initApp();
      show('#app');
      tab('access');
    }
  };
})();
