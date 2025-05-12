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






/* ═════════════════ Utilidades generales ═════════════════ */
const rand = n => Math.random().toString(36).slice(-n);
const genCred = p => ({user: `${p}${rand(5)}`, pass: rand(8)});
const userExists = u => ls.get('users').some(x => x.user === u);
const addUser = u => { const arr = ls.get('users'); arr.push(u); ls.set('users', arr); };
const delUsers = fn => ls.set('users', ls.get('users').filter(u => !fn(u)));
const updatePass = (u, p) => {
  const a = ls.get('users');
  const x = a.find(e => e.user === u);
  if (!x) return false;
  x.pass = p;
  ls.set('users', a);
  return true;
};

/* ═════════════════ Navegación básica ════════════════════ */
const show = sel => {
  $$('.screen').forEach(s => s.style.display = 'none');
  $(sel).style.display = 'block';
};

const tab = id => {
  $$('.tab').forEach(t => t.classList.remove('active'));
  $(`[data-tab="${id}"]`).classList.add('active');
  $$('.tab-pane').forEach(p => p.classList.add('hidden'));
  $(`#${id}`).classList.remove('hidden');
};

$$('.tab').forEach(b => b.onclick = () => tab(b.dataset.tab));
show('#login');

/* ==========================================================
   LOGIN
   ========================================================== */
$('#loginForm').onsubmit = e => {
  e.preventDefault();
  const u = $('#user').value.trim(), p = $('#pass').value.trim();
  const acc = ls.get('users').find(a => a.user === u && a.pass === p);
  if (!acc) return Swal.fire('Error', 'Credenciales incorrectas', 'error');

  if (acc.role === 'guard') {
    const activeTurn = ls.get('activeTurn');
    if (activeTurn && activeTurn.user !== u) {
      const guardName = activeTurn.guardName || "Un guardia";
      return Swal.fire({
        title: 'Turno ocupado',
        html: `El guardia <b>${guardName}</b> ya está activo.<br>No puedes iniciar sesión mientras otro guardia esté en turno.`,
        icon: 'warning'
      });
    }
  }

  role = acc.role;
  currentUser = acc.user;
  if (role === 'vecino') currentHouse = acc.house;
  if (role === 'guard') currentGuard = ls.get('guards').find(g => g.id === acc.guardId);

  isTurnActive = checkActiveTurn();

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

const checkActiveTurn = () => {
  const activeTurn = ls.get('activeTurn');
  return activeTurn && activeTurn.user === currentUser;
};

$('#logoutBtn').onclick = $('#logoutVecino').onclick = () => {
  if (isTurnActive) {
    setActiveTurn(false);
  }
  location.reload();
};

/* ==========================================================
   PORTAL VECINO
   ========================================================== */
function initPortal() {
  const res = ls.get('residents').find(r => r.house === currentHouse);
  const pays = ls.get('payments').filter(p => p.house === currentHouse);
  $('#vecinoCard').innerHTML = `<h2 class="title">Hola, ${res?.name || ''}</h2>
    <p><b>Dirección:</b> ${res?.addr || ''}</p><p><b>Tel.:</b> ${res?.phone || ''}</p>`;
  $('#vecPagos').innerHTML = pays.length ? pays.map(p => `<div>${p.mes} – L. ${p.amount}</div>`).join('') : 'Sin pagos.';
  renderVisitasPortal();

  $('#expCSV').onclick = () => {
    const vis = ls.get('access').filter(v => v.house === currentHouse);
    if (!vis.length) return;
    const csv = 'Fecha,Nombre,Tipo,Registró\n' + vis.map(v => `${v.time},${v.nombre},${v.tipo},${v.guard}`).join('\n');
    saveAs(new Blob([csv], {type: 'text/csv'}), `visitas_casa${currentHouse}.csv`);
  };
  
  $('#vecPassForm').onsubmit = e => {
    e.preventDefault();
    const np = $('#vecNewPass').value.trim();
    if (np.length < 4) return Swal.fire('Mínimo 4 caracteres', '', 'warning');
    if (updatePass(currentUser, np)) {
      Swal.fire('Actualizada', 'Vuelva a entrar', 'success').then(() => location.reload());
    }
  };
}

const renderVisitasPortal = () => $('#vecVisitas').innerHTML =
  ls.get('access').filter(v => v.house === currentHouse)
    .map(v => `<div>${v.time} – ${v.nombre} (${v.tipo})</div>`).join('') || 'Sin visitas.';

/* ==========================================================
   APP PRINCIPAL
   ========================================================== */
function initApp() {
  const isSuper = role === 'super';
  const isAdmin = role === 'admin';
  const isGuard = role === 'guard';
  const canErase = isSuper;
  const canManage = isSuper || isAdmin;

  if (isAdmin) $('#accessForm').style.display = 'none';
  if (!canManage) {
    ['residents', 'guards', 'companies', 'payments', 'debts', 'settings'].forEach(id => {
      $(`[data-tab="${id}"]`).classList.add('hidden');
    });
  } else {
    $('#settingsTab').classList.remove('hidden');
  }
  
  if (isSuper) $('#reqTab').classList.remove('hidden');

  $('#profileTab').classList.toggle('hidden', !isGuard);
  $('#visitsTab').classList.remove('hidden');

  $('#whoami').textContent =
    isSuper ? 'Sesión: Super‑Admin' :
    isAdmin ? 'Sesión: Administrador' :
    isGuard ? `Sesión: Guardia – ${currentGuard?.name || currentUser}` : '';

  updateTurnUI();
  
  $('#toggleTurnBtn').onclick = () => {
    if (setActiveTurn(!isTurnActive)) {
      updateTurnUI();
      Swal.fire(
        isTurnActive ? 'Turno activado' : 'Turno desactivado',
        isTurnActive ? 'Ahora estás en servicio' : 'Has finalizado tu turno',
        isTurnActive ? 'success' : 'info'
      ).then(() => {
        renderGuards(); // Actualizar lista de guardias para mostrar estado actual
      });
    }
  };

  const visitasHoy = () => ls.get('access').filter(a => 
    new Date(a.time).toDateString() === new Date().toDateString()).length;

  const syncSelectors = () => {
    const res = ls.get('residents'), com = ls.get('companies');
    $('#payRes').innerHTML = res.map((r, i) => 
      `<option value="${i}">${r.name} (Casa ${r.house})</option>`).join('');
    $('#debtRes').innerHTML =
      `<optgroup label="Residentes">${res.map((r, i) => 
        `<option data-type="res" value="${i}">${r.name}</option>`).join('')}</optgroup>` +
      `<optgroup label="Empresas">${com.map((c, i) => 
        `<option data-type="com" value="${i}">${c.name}</option>`).join('')}</optgroup>`;
  };

  const syncHostList = () => {
    const res = ls.get('residents'), com = ls.get('companies');
    $('#hostList').innerHTML =
      res.map(r => `<option data-house="${r.house}" value="${r.name} (Casa ${r.house})">`).join('') +
      com.map(c => `<option data-house="${c.unit}" value="${c.name} (Local ${c.unit})">`).join('');
  };

  $('#acHost').oninput = () => {
    const opt = [...$('#hostList').options].find(o => o.value === $('#acHost').value);
    if (opt) $('#acHouse').value = opt.dataset.house;
  };

  const kpi = () => {
    const mes = new Date().toISOString().slice(0, 7);
    const ingresos = ls.get('payments').filter(p => p.mes === mes).reduce((s, p) => s + p.amount, 0);
    const total = ls.get('residents').length + ls.get('companies').length;
    const pend = ls.get('debts').length;
    const pct = total ? Math.round(pend / total * 100) : 0;
    
    $('#kpiRow').innerHTML = isGuard ?
      `<div class="card-glass"><h3 class="text-xl">Visitas hoy</h3><p class="text-3xl">${visitasHoy()}</p></div>` :
      `<div class="card-glass"><h3 class="text-xl">Ingresos mes</h3><p class="text-3xl">L. ${ingresos}</p></div>
       <div class="card-glass"><h3 class="text-xl">% Pendientes</h3><p class="text-3xl">${pct}%</p></div>
       <div class="card-glass"><h3 class="text-xl">Visitas hoy</h3><p class="text-3xl">${visitasHoy()}</p></div>`;
  };

  $('#accessForm').onsubmit = e => {
    e.preventDefault();
    const rec = {
      nombre: $('#acNombre').value.trim(),
      id: $('#acId').value.trim(),
      host: $('#acHost').value.trim(),
      house: $('#acHouse').value.trim(),
      tipo: $('#acTipo').value,
      guard: isGuard ? currentGuard?.name || currentUser : currentUser,
      time: new Date().toLocaleString()
    };
    const a = ls.get('access');
    a.unshift(rec);
    ls.set('access', a);
    renderAccess();
    $('#accessForm').reset();
    kpi();
    renderVisits();
  };

  const renderAccess = () => $('#accessList').innerHTML =
    ls.get('access').map((a, i) => `
      <div class="flex justify-between mb-2 items-start">
        <div>${a.time} · ${a.tipo} · ${a.nombre}
          ${a.id ? `<br>Doc.: ${a.id}` : ''}
          <br>Visita a: <b>${a.host}</b>
          <br><small>Registró: ${a.guard}</small></div>
        ${canErase ? `<button data-i="${i}" class="btn-red delAcc w-8 h-8 flex items-center justify-center text-sm">✕</button>` : ''}
      </div>`).join('');

  $('#accessList').onclick = e => {
    if (!e.target.classList.contains('delAcc') || !canErase) return;
    const i = +e.target.dataset.i;
    let arr = ls.get('access');
    arr.splice(i, 1);
    ls.set('access', arr);
    renderAccess();
    renderVisits();
  };

  if (canManage) {
    $('#clrAccess').onclick = () => {
      if (canErase) {
        Swal.fire({
          title: '¿Vaciar historial?',
          icon: 'warning',
          showCancelButton: true,
          confirmButtonText: 'Sí'
        }).then(r => {
          if (r.isConfirmed) {
            ls.set('access', []);
            renderAccess();
            renderVisits();
            Swal.fire('Hecho', '', 'success');
          }
        });
      } else {
        crearSolicitud('access');
        Swal.fire('Solicitud enviada', 'Super‑admin la revisará', 'info');
      }
    };
  } else {
    $('#clrAccess')?.remove();
  }

  $('#bitForm').onsubmit = e => {
    e.preventDefault();
    const b = ls.get('bitacora');
    b.unshift({
      text: $('#bitText').value,
      time: new Date().toLocaleString()
    });
    ls.set('bitacora', b);
    renderBits();
    $('#bitForm').reset();
  };

  const renderBits = () => $('#bitList').innerHTML =
    ls.get('bitacora').slice(0, 100).map(b => `<div>${b.time} – ${b.text}</div>`).join('');

  if (canManage) {
    $('#clrBitacora').onclick = () => {
      if (canErase) {
        Swal.fire({
          title: '¿Vaciar bitácora?',
          icon: 'warning',
          showCancelButton: true,
          confirmButtonText: 'Sí'
        }).then(r => {
          if (r.isConfirmed) {
            ls.set('bitacora', []);
            renderBits();
            Swal.fire('Hecho', '', 'success');
          }
        });
      } else {
        crearSolicitud('bitacora');
        Swal.fire('Solicitud enviada', 'Super‑admin la revisará', 'info');
      }
    };
  } else {
    $('#clrBitacora')?.remove();
  }

  $('#resForm').onsubmit = e => {
    e.preventDefault();
    const r = {
      name: $('#resName').value,
      house: $('#resHouse').value,
      phone: $('#resPhone').value,
      addr: $('#resAddr').value
    };
    let u = $('#resUser').value.trim(), p = $('#resPass').value.trim();
    if (u || p) {
      if (!u || !p) return Swal.fire('Completa ambos campos', '', 'warning');
      if (userExists(u)) return Swal.fire('Usuario duplicado', '', 'error');
    } else {
      ({user: u, pass: p} = genCred('v'));
    }
    addUser({
      user: u,
      pass: p,
      role: 'vecino',
      house: r.house
    });
    Swal.fire('Credenciales', `Usuario:<b>${u}</b><br>Contraseña:<b>${p}</b>`, 'info');
    const arr = ls.get('residents');
    arr.push(r);
    ls.set('residents', arr);
    renderResidents();
    $('#resForm').reset();
    syncSelectors();
    syncHostList();
  };

  const renderResidents = () => $('#resList').innerHTML =
    ls.get('residents').map((r, i) => `
      <div class="flex justify-between mb-2 items-start">
        <div><b>${r.house}</b> – ${r.name}<br>Tel: ${r.phone}<br>Dir: ${r.addr}</div>
        <button data-i="${i}" class="btn-red delRes w-8 h-8 flex items-center justify-center text-sm">✕</button>
      </div>`).join('');

  $('#resList').onclick = e => {
    if (!e.target.classList.contains('delRes')) return;
    const i = +e.target.dataset.i;
    const r = ls.get('residents')[i];
    delUsers(u => u.role === 'vecino' && u.house === r.house);
    let arr = ls.get('residents');
    arr.splice(i, 1);
    ls.set('residents', arr);
    renderResidents();
    syncSelectors();
    syncHostList();
  };

  $('#guardForm').onsubmit = e => {
    e.preventDefault();
    const g = {
      name: $('#gName').value,
      phone: $('#gPhone').value,
      idCard: $('#gIdCard').value.trim(),
      id: rand(6)
    };
    
    let u = $('#gUser').value.trim(), p = $('#gPass').value.trim();
    if (u || p) {
      if (!u || !p) return Swal.fire('Campos faltan', '', 'warning');
      if (userExists(u)) return Swal.fire('Usuario duplicado', '', 'error');
    } else {
      ({user: u, pass: p} = genCred('g'));
    }
    
    const guards = ls.get('guards');
    guards.push(g);
    ls.set('guards', guards);
    
    addUser({
      user: u,
      pass: p,
      role: 'guard',
      guardId: g.id
    });
    
    Swal.fire({
      title: 'Guardia creado',
      html: `Usuario: <b>${u}</b><br>Contraseña: <b>${p}</b><br><br>El turno comienza <b>INACTIVO</b>`,
      icon: 'info'
    });
    renderGuards();
    $('#guardForm').reset();
  };

  const renderGuards = () => {
    const activeTurn = ls.get('activeTurn');
    $('#guardList').innerHTML = ls.get('guards').map((g, i) => `
      <div class="flex justify-between mb-2 items-start">
        <div>
          <b>ID:</b> ${g.id}<br>
          <b>${g.name}</b>${g.idCard ? `<br>ID doc.: ${g.idCard}` : ''}<br>
          Tel: ${g.phone}
          ${activeTurn?.guardId === g.id ? 
            '<div class="text-green-500 text-sm">Turno activo</div>' : ''}
        </div>
        <div class="flex flex-col gap-1">
          <button data-id="${g.id}" class="btn-red delGuard w-8 h-8 flex items-center justify-center text-sm">✕</button>
          ${activeTurn?.guardId === g.id ?
            `<button data-id="${g.id}" class="btn-amber deactivateGuard w-8 h-8 flex items-center justify-center text-sm">⏸</button>` :
            `<button data-id="${g.id}" class="btn-green activateGuard w-8 h-8 flex items-center justify-center text-sm">▶</button>`
          }
        </div>
      </div>`).join('');
  };

  $('#guardList').onclick = e => {
    if (e.target.classList.contains('delGuard')) {
      const guardId = e.target.dataset.id;
      const g = ls.get('guards').find(g => g.id === guardId);
      delUsers(u => u.role === 'guard' && u.guardId === guardId);
      let arr = ls.get('guards').filter(g => g.id !== guardId);
      ls.set('guards', arr);
      renderGuards();
    }
    
    if (e.target.classList.contains('deactivateGuard')) {
      const guardId = e.target.dataset.id;
      const result = desactivarGuardiaPorId(guardId);
      if (result.success) {
        Swal.fire('Éxito', result.message, 'success');
        renderGuards();
        updateTurnUI();
      } else {
        Swal.fire('Error', result.message, 'error');
      }
    }
    
    if (e.target.classList.contains('activateGuard')) {
      const guardId = e.target.dataset.id;
      const guardUser = ls.get('users').find(u => u.role === 'guard' && u.guardId === guardId);
      if (guardUser) {
        currentUser = guardUser.user;
        currentGuard = ls.get('guards').find(g => g.id === guardId);
        if (setActiveTurn(true)) {
          Swal.fire('Turno activado', `El guardia ${currentGuard?.name} ahora está activo`, 'success');
          renderGuards();
          updateTurnUI();
        }
      }
    }
  };

  $('#comForm').onsubmit = e => {
    e.preventDefault();
    const c = {
      name: $('#comName').value,
      unit: $('#comUnit').value,
      phone: $('#comPhone').value,
      addr: $('#comAddr').value
    };
    const arr = ls.get('companies');
    arr.push(c);
    ls.set('companies', arr);
    renderCompanies();
    $('#comForm').reset();
    syncSelectors();
    syncHostList();
  };

  const renderCompanies = () => $('#comList').innerHTML =
    ls.get('companies').map((c, i) => `
      <div class="flex justify-between mb-2 items-start">
        <div><b>${c.unit}</b> – ${c.name}<br>Tel: ${c.phone}<br>Dir: ${c.addr}</div>
        <button data-i="${i}" class="btn-red delCom w-8 h-8 flex items-center justify-center text-sm">✕</button>
      </div>`).join('');

  $('#comList').onclick = e => {
    if (!e.target.classList.contains('delCom')) return;
    const i = +e.target.dataset.i;
    let arr = ls.get('companies');
    arr.splice(i, 1);
    ls.set('companies', arr);
    renderCompanies();
    syncSelectors();
    syncHostList();
  };

  $('#payForm').onsubmit = e => {
    e.preventDefault();
    const idx = $('#payRes').value;
    const r = ls.get('residents')[idx];
    if (!r) return;
    const p = {
      name: r.name,
      house: r.house,
      amount: +$('#payMonto').value,
      mes: $('#payMes').value,
      time: new Date().toLocaleString()
    };
    const arr = ls.get('payments');
    arr.unshift(p);
    ls.set('payments', arr);
    renderPays();
    $('#payForm').reset();
    kpi();
    drawDebtChart();
  };

  const renderPays = () => $('#payList').innerHTML =
    ls.get('payments').slice(0, 50).map(p => `<div>${p.mes} • ${p.name} • L. ${p.amount}</div>`).join('');

  $('#debtForm').onsubmit = e => {
    e.preventDefault();
    const opt = $('#debtRes').selectedOptions[0];
    const type = opt.dataset.type;
    const val = +opt.value;
    let name, house;
    
    if (type === 'res') {
      const r = ls.get('residents')[val];
      name = r.name;
      house = `Casa ${r.house}`;
    } else {
      const c = ls.get('companies')[val];
      name = c.name;
      house = `Local ${c.unit}`;
    }
    
    const d = {
      name,
      house,
      mes: $('#debtMes').value,
      amount: +$('#debtAmount').value,
      type
    };
    
    const arr = ls.get('debts');
    arr.unshift(d);
    ls.set('debts', arr);
    renderDebts();
    drawDebtChart();
    $('#debtForm').reset();
    kpi();
  };

  const renderDebts = () => $('#debtList').innerHTML =
    ls.get('debts').length ? ls.get('debts').map((d, i) => `
      <div class="card-glass moroso mb-2 flex justify-between items-center">
        <div><b>${d.name}</b> – ${d.house}<br>${d.mes} – L. ${d.amount}</div>
        <button data-i="${i}" class="btn-green payDebt w-20 h-8 flex items-center justify-center text-sm">Pagado</button>
      </div>`).join('') : '<p class="text-green-300">Sin deudas 🎉</p>';

  $('#debtList').onclick = e => {
    if (!e.target.classList.contains('payDebt')) return;
    const i = +e.target.dataset.i;
    let arr = ls.get('debts');
    arr.splice(i, 1);
    ls.set('debts', arr);
    renderDebts();
    drawDebtChart();
    kpi();
  };

  let debtChart;
  const drawDebtChart = () => {
    if (!$('#chartDebts')) return;
    const total = ls.get('residents').length + ls.get('companies').length;
    const pend = ls.get('debts').length;
    debtChart?.destroy();
    debtChart = new Chart($('#chartDebts'), {
      type: 'doughnut',
      data: {
        labels: ['Al día', 'Pendientes'],
        datasets: [{
          data: [total - pend, pend],
          backgroundColor: ['#10b981', '#ef4444']
        }]
      },
      options: {
        plugins: {
          legend: {
            position: 'bottom'
          }
        }
      }
    });
  };

  function renderRequests() {
    $('#reqList').innerHTML = ls.get('requests').map((r, i) => `
      <div class="card-glass mb-3">
        <p><b>${r.type === 'access' ? 'Borrar historial de visitas' : 'Vaciar bitácora'}</b></p>
        <p>Solicitó: ${r.requester} – ${r.time}</p>
        <p>Estado: <b class="${
          r.status === 'pendiente' ? 'text-amber-300' : 
          r.status === 'aprobado' ? 'text-green-300' : 'text-rose-300'}">
          ${r.status}</b></p>
        ${r.status === 'pendiente' ? `
          <div class="mt-2 flex gap-2">
            <button data-i="${i}" class="btn-green btnAp px-4">Aprobar</button>
            <button data-i="${i}" class="btn-red btnDe px-4">Denegar</button>
          </div>` : ''}
      </div>`).join('') || '<p class="opacity-60">Sin solicitudes.</p>';
  }

  if (isSuper) {
    $('#reqTab').onclick = renderRequests;
    $('#reqList').onclick = e => {
      const i = +e.target.dataset.i;
      if (Number.isNaN(i)) return;
      let reqs = ls.get('requests');
      const req = reqs[i];
      if (!req || req.status !== 'pendiente') return;
      
      if (e.target.classList.contains('btnAp')) {
        if (req.type === 'access') ls.set('access', []);
        if (req.type === 'bitacora') ls.set('bitacora', []);
        req.status = 'aprobado';
        ls.set('requests', reqs);
        renderRequests();
        renderAccess();
        renderBits();
        renderVisits();
        Swal.fire('Aprobado', 'Se ejecutó la acción', 'success');
      }
      
      if (e.target.classList.contains('btnDe')) {
        req.status = 'denegado';
        ls.set('requests', reqs);
        renderRequests();
      }
    };
  }

  function crearSolicitud(type) {
    const arr = ls.get('requests');
    arr.push({
      id: Date.now(),
      type,
      requester: currentUser,
      status: 'pendiente',
      time: new Date().toLocaleString()
    });
    ls.set('requests', arr);
  }

  if (isAdmin) {
    $('#admUser').value = currentUser;
    $('#admForm').onsubmit = e => {
      e.preventDefault();
      const nU = $('#admUser').value.trim();
      const nP = $('#admPass').value.trim();
      if (!nU || !nP) return Swal.fire('Campos requeridos', '', 'warning');
      if (nU !== currentUser && userExists(nU)) return Swal.fire('Usuario duplicado', '', 'error');
      const users = ls.get('users');
      const adm = users.find(u => u.role === 'admin');
      adm.user = nU;
      adm.pass = nP;
      ls.set('users', users);
      Swal.fire('Actualizado', 'Reinicia sesión', 'success').then(() => location.reload());
    };

    $('#adminClearAllVisits').onclick = () => {
      crearSolicitud('access');
      Swal.fire('Solicitud enviada', 'Super‑admin la revisará', 'info');
    };
  } else if (!isSuper) {
    $('#adminClearAllVisits')?.remove();
  }

  if (isSuper) {
    $('#adminClearAllVisits').onclick = () => {
      Swal.fire({
        title: '¿Borrar todos los registros de visitas?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Sí'
      }).then(r => {
        if (r.isConfirmed) {
          ls.set('access', []);
          renderAccess();
          renderVisits();
          Swal.fire('Hecho', '', 'success');
        }
      });
    };
  }

  if (isGuard) {
    $('#guardPassForm').onsubmit = e => {
      e.preventDefault();
      const np = $('#guardNewPass').value.trim();
      if (np.length < 4) return Swal.fire('Mínimo 4 caracteres', '', 'warning');
      if (updatePass(currentUser, np)) {
        Swal.fire('Actualizada', 'Vuelva a entrar', 'success').then(() => location.reload());
      }
    };
  }

  const renderVisits = () => $('#visitsList').innerHTML =
    ls.get('access').map(a => `
      <div class="mb-2">${a.time} • ${a.tipo} • ${a.nombre}
        ${a.id ? `<br>Doc.: ${a.id}` : ''}
        <br>Visita a: <b>${a.host}</b>
        <br><small>Registró: ${a.guard}</small></div>`).join('');

  (function initAll() {
    desactivarTodosLosGuardias();
    syncSelectors();
    syncHostList();
    renderResidents();
    renderGuards();
    renderCompanies();
    renderAccess();
    renderBits();
    renderPays();
    renderDebts();
    drawDebtChart();
    renderVisits();
    kpi();
    if (isSuper) renderRequests();
  })();
}


/* ════════════════════════════════════════════════════════
   Deshabilitar todos los botones “Registrar” hasta activar turno
   Colocar al final de app.js
   ════════════════════════════════════════════════════════ */
(function(){
  // 1) Recoger todos los botones de tipo submit dentro de #app
  const registerButtons = Array.from(document.querySelectorAll('#app button[type="submit"]'));

  // 2) Función para actualizar el estado de todos ellos
  function updateAllRegisterButtons() {
    registerButtons.forEach(btn => {
      // Si es guardia y no está en turno, deshabilitar
      if (role === 'guard' && !isTurnActive) {
        btn.disabled = true;
      } else {
        btn.disabled = false;
      }
    });
  }

  // 3) Al cargar la página, aplicar el estado inicial
  window.addEventListener('load', updateAllRegisterButtons);

  // 4) Asegurarse también tras initApp
  if (typeof initApp === 'function') {
    const _initApp = window.initApp;
    window.initApp = function() {
      _initApp();
      updateAllRegisterButtons();
    };
  }

  // 5) Cada vez que cambies turno, re-evaluar
  const toggleBtn = document.getElementById('toggleTurnBtn');
  if (toggleBtn) {
    const orig = toggleBtn.onclick;
    toggleBtn.onclick = () => {
      const ok = setActiveTurn(!isTurnActive);
      if (ok) {
        updateTurnUI();
        renderGuards();
        updateAllRegisterButtons();
      }
      if (orig) orig();
    };
  }
})();


/* ==========================================================
   ServiceWorker (opcional)
   ========================================================== */
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('service-worker.js');
}



/* ════════════════════════════════════════════════════════
   Override completo de setActiveTurn con logging
   Garantiza único guardia activo
   ════════════════════════════════════════════════════════ */

window.setActiveTurn = function(active) {
  console.log('[DEBUG] setActiveTurn called, active =', active);
  const existing = ls.get('activeTurn');
  console.log('[DEBUG] activeTurn in storage =', existing);

  if (active) {
    // Si ya hay otro guardia activo y no eres tú, bloquear
    if (existing && existing.user !== currentUser) {
      console.log('[DEBUG] Bloqueando activación, turno ocupado por', existing.user);
      Swal.fire({
        title: 'Turno ocupado',
        html: `El guardia <b>${existing.guardName}</b> ya está activo.`,
        icon: 'warning'
      });
      return false;
    }

    // Activa tu turno
    const newTurn = {
      user: currentUser,
      guardId: currentGuard?.id,
      guardName: currentGuard?.name || currentUser,
      startTime: new Date().toLocaleString()
    };
    ls.set('activeTurn', newTurn);
    isTurnActive = true;
    console.log('[DEBUG] Turno activado:', newTurn);
    updateTurnUI();
    return true;
  } else {
    // Desactivar turno
    ls.set('activeTurn', null);
    isTurnActive = false;
    console.log('[DEBUG] Turno desactivado');
    updateTurnUI();
    return true;
  }
};

// Asegurarse de que la UI refleje el estado al cargar
window.addEventListener('load', () => {
  isTurnActive = (ls.get('activeTurn')?.user === currentUser);
  console.log('[DEBUG] Estado inicial isTurnActive =', isTurnActive);
  updateTurnUI();
});



/* ════════════════════════════════════════════════════════
   Override completo de setActiveTurn + bloqueo en dashboard
   Solo un guardia activo, debe desactivar antes de que otro active
   ════════════════════════════════════════════════════════ */

(function() {
  // Guardamos la versión original
  const _setActiveTurn = window.setActiveTurn;

  window.setActiveTurn = function(active) {
    console.log('[DEBUG] setActiveTurn called, active =', active);
    const existing = ls.get('activeTurn');
    console.log('[DEBUG] activeTurn en storage =', existing);

    if (active) {
      // Si ya hay otro guardia activo y no eres tú, bloquear
      if (existing && existing.user !== currentUser) {
        console.log('[DEBUG] Bloqueando activación, turno ocupado por', existing.user);
        Swal.fire({
          title: 'Turno ocupado',
          html: `El guardia <b>${existing.guardName}</b> ya está activo.<br>Debes desactivar tu turno primero.`,
          icon: 'warning'
        });
        return false;
      }
      // Si ya estás activo, no hacer nada
      if (existing && existing.user === currentUser) {
        console.log('[DEBUG] Ya estás en turno');
        return false;
      }
      // Activar tu turno
      const newTurn = {
        user: currentUser,
        guardId: currentGuard?.id,
        guardName: currentGuard?.name || currentUser,
        startTime: new Date().toLocaleString()
      };
      ls.set('activeTurn', newTurn);
      isTurnActive = true;
      console.log('[DEBUG] Turno activado:', newTurn);
      updateTurnUI();
      renderGuards(); // Refrescar dashboard guardias
      return true;
    } else {
      // Desactivar tu turno
      if (!existing || existing.user !== currentUser) {
        console.log('[DEBUG] No tienes turno activo para desactivar');
        return false;
      }
      ls.set('activeTurn', null);
      isTurnActive = false;
      console.log('[DEBUG] Turno desactivado por', currentUser);
      updateTurnUI();
      renderGuards(); // Refrescar dashboard guardias
      return true;
    }
  };

  // Al cargar la página, actualizar estado y UI
  window.addEventListener('load', () => {
    const active = ls.get('activeTurn');
    isTurnActive = active && active.user === currentUser;
    console.log('[DEBUG] Estado inicial isTurnActive =', isTurnActive);
    updateTurnUI();
    renderGuards();
  });
})();


/* ════════════════════════════════════════════════════════
   Persistencia de turno activo y no reset en initAll / logout
   ════════════════════════════════════════════════════════ */
(function(){
  // 1) Anular desactivación automática en initAll
  if (typeof initAll === 'function') {
    const _initAll = initAll;
    initAll = function(){
      // Sin desactivar guardias
      // Llamamos sólo a los métodos de render y sync
      syncSelectors();
      syncHostList();
      renderResidents();
      renderGuards();
      renderCompanies();
      renderAccess();
      renderBits();
      renderPays();
      renderDebts();
      drawDebtChart();
      renderVisits();
      kpi();
      if (role === 'super') renderRequests();
    };
  }

  // 2) Reconfigurar logout para NO desactivar turno
  const logoutButtons = $$('#logoutBtn, #logoutVecino');
  logoutButtons.forEach(btn => {
    btn.onclick = () => {
      location.reload();
    };
  });

  // 3) Al cargar, reflejar el estado persistido
  window.addEventListener('load', () => {
    // isTurnActive se lee de localStorage
    const active = ls.get('activeTurn');
    isTurnActive = active && active.user === currentUser;
    updateTurnUI();
    renderGuards();
  });
})();

/* ════════════════════════════════════════════════════════
   Persistencia y bloqueo en login para guardias activos
   ════════════════════════════════════════════════════════ */
(function(){
  const loginForm = document.getElementById('loginForm');
  const originalOnsubmit = loginForm.onsubmit;

  loginForm.onsubmit = function(e) {
    e.preventDefault();
    const u = $('#user').value.trim();
    const p = $('#pass').value.trim();
    const acc = ls.get('users').find(a => a.user === u && a.pass === p);
    if (!acc) {
      return Swal.fire('Error', 'Credenciales incorrectas', 'error');
    }

    if (acc.role === 'guard') {
      const activeTurn = ls.get('activeTurn');
      // Bloquear si otro guardia está activo
      if (activeTurn && activeTurn.user !== u) {
        return Swal.fire({
          title: 'Turno ocupado',
          html: `El guardia <b>${activeTurn.guardName}</b> ya está activo.<br>Debe desactivar su turno antes de iniciar sesión.`,
          icon: 'warning'
        });
      }
      // Si eres tú el activo, mantener activo
      isTurnActive = activeTurn && activeTurn.user === u;
    }

    // Continuar con el flujo original de login
    role = acc.role;
    currentUser = acc.user;
    if (role === 'vecino') currentHouse = acc.house;
    if (role === 'guard') currentGuard = ls.get('guards').find(g => g.id === acc.guardId);

    // Ocultar login y mostrar la pantalla correspondiente
    $('#login').style.display = 'none';
    if (role === 'vecino') {
      initPortal();
      show('#portal');
    } else {
      initApp();
      show('#app');
      tab('access');
    }

    // Reflejar inmediatamente el estado de turno en el dashboard
    updateTurnUI();
    renderGuards();
  };

  // Al cargar la página, si ya había un guardia activo, mantenerlo activo
  window.addEventListener('load', () => {
    const active = ls.get('activeTurn');
    if (active && active.user === currentUser) {
      isTurnActive = true;
    }
    updateTurnUI();
    renderGuards();
  });
})();

/* ════════════════════════════════════════════════════════
   Persistencia de turno de guardia tras logout/login
   ════════════════════════════════════════════════════════ */
(function(){
  // 1) Override de logout para NO desactivar turno
  $$('#logoutBtn, #logoutVecino').forEach(btn => {
    btn.onclick = () => {
      // Solo recarga la página, sin tocar el turno
      location.reload();
    };
  });

  // 2) Override de login para recuperar isTurnActive desde localStorage
  const loginForm = document.getElementById('loginForm');
  loginForm.onsubmit = function(e) {
    e.preventDefault();
    const u = $('#user').value.trim();
    const p = $('#pass').value.trim();
    const acc = ls.get('users').find(a => a.user === u && a.pass === p);
    if (!acc) {
      return Swal.fire('Error', 'Credenciales incorrectas', 'error');
    }
    if (acc.role === 'guard') {
      const activeTurn = ls.get('activeTurn');
      if (activeTurn && activeTurn.user !== u) {
        return Swal.fire({
          title: 'Turno ocupado',
          html: `El guardia <b>${activeTurn.guardName}</b> ya está activo.<br>Debe desactivar su turno antes de iniciar sesión.`,
          icon: 'warning'
        });
      }
    }

    // Autenticación ok
    role = acc.role;
    currentUser = acc.user;
    if (role === 'vecino') currentHouse = acc.house;
    if (role === 'guard') currentGuard = ls.get('guards').find(g => g.id === acc.guardId);

    // Mostrar pantallas
    $('#login').style.display = 'none';
    if (role === 'vecino') {
      initPortal();
      show('#portal');
    } else {
      initApp();
      show('#app');
      tab('access');
    }

    // ¡Clave! Recuperar estado activo de guardia
    isTurnActive = (ls.get('activeTurn')?.user === currentUser);
    updateTurnUI();
    renderGuards();
  };
})();





/* ════════════════════════════════════════════════════════
   Overlay funcional para turnos de guardias
   (activar, desactivar y mostrar/ocultar dinámicamente)
   Colocar al final de app.js
   ════════════════════════════════════════════════════════ */
(function() {
  const OVERLAY_ID = 'turnBlockOverlay';

  const createOverlay = () => {
    const overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;
    Object.assign(overlay.style, {
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.8)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 9999,
    });
    overlay.innerHTML = `
      <div style="background: #1e293b; padding: 2rem; border-radius: 8px; color: white; text-align:center;">
        <h2 style="margin-bottom: 1rem;">🔒 Turno Inactivo</h2>
        <p style="margin-bottom: 1.5rem;">Debes activar tu turno para acceder al dashboard</p>
        <button id="overlayActivateTurn" style="
          background: #f59e0b; color: #fff; border: none; padding: 0.5rem 1rem;
          border-radius: 4px; cursor: pointer; margin-right: 0.5rem;">
          Activar Turno
        </button>
        <button id="overlayLogout" style="
          background: #ef4444; color: #fff; border: none; padding: 0.5rem 1rem;
          border-radius: 4px; cursor: pointer;">
          Salir
        </button>
      </div>
    `;
    return overlay;
  };

  const showOverlay = () => {
    if (role === 'guard' && !isTurnActive && !document.getElementById(OVERLAY_ID)) {
      const overlay = createOverlay();
      document.body.appendChild(overlay);

      // Botón Activar Turno del overlay
      overlay.querySelector('#overlayActivateTurn').onclick = () => {
        overlay.remove(); // Ocultar overlay antes
        document.querySelector('#app').style.pointerEvents = '';
        document.getElementById('toggleTurnBtn')?.click();
      };

      // Botón Salir del overlay
      overlay.querySelector('#overlayLogout').onclick = () => location.reload();

      // Bloquear el dashboard mientras esté el overlay
      document.querySelector('#app').style.pointerEvents = 'none';
    }
  };

  const hideOverlay = () => {
    const overlay = document.getElementById(OVERLAY_ID);
    if (overlay) {
      overlay.remove();
      document.querySelector('#app').style.pointerEvents = '';
    }
  };

  const updateOverlay = () => {
    if (role === 'guard') {
      if (isTurnActive) hideOverlay();
      else showOverlay();
    }
  };

  // Integración con initApp
  if (typeof initApp === 'function') {
    const originalInitApp = initApp;
    initApp = function() {
      originalInitApp();
      updateOverlay();
    };
  }

  // Al cargar la página
  window.addEventListener('load', updateOverlay);

  // Hook al botón de activar/desactivar turno
  const toggleBtn = document.getElementById('toggleTurnBtn');
  if (toggleBtn) {
    const originalToggle = toggleBtn.onclick;
    toggleBtn.onclick = function(e) {
      const result = originalToggle?.call(this, e);
      // Verificar estado actualizado luego del cambio
      setTimeout(() => {
        const currentTurn = ls.get('activeTurn');
        isTurnActive = currentTurn?.user === currentUser;
        updateTurnUI();
        renderGuards();
        updateOverlay();
      }, 100);
      return result;
    };
  }

  // Reaccionar a cambios en localStorage (otras pestañas)
  window.addEventListener('storage', (e) => {
    if (e.key === 'activeTurn') {
      isTurnActive = ls.get('activeTurn')?.user === currentUser;
      updateOverlay();
    }
  });
})();

