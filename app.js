/* ==========================================================
   Seguridad Primavera – JavaScript principal (v 3.7)
   • Botones ✕ compactos de 32 px
   • Sólo el administrador puede:
       – borrar registros individuales o limpiar Historial Accesos
       – vaciar toda la Bitácora
       – borrar todo el historial global de visitas
   ========================================================== */

/* ---------- Helpers + almacenamiento ---------- */
const $  = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);
const ls = { set:(k,v)=>localStorage.setItem(k,JSON.stringify(v)),
             get:(k,d=[])=>JSON.parse(localStorage.getItem(k)||JSON.stringify(d)) };

if(!localStorage.getItem('users')){
  ls.set('users',[{user:'admin',pass:'admin123',role:'admin'}]);
}

/* ---------- Estado ---------- */
let role='',currentUser='',currentHouse=null,currentGuard=null;

/* ---------- Utilidades ---------- */
const rand     = n=>Math.random().toString(36).slice(-n);
const genCred  = p=>({user:`${p}${rand(5)}`,pass:rand(8)});
const userExists = u=>ls.get('users').some(x=>x.user===u);
const addUser    = u=>{const arr=ls.get('users');arr.push(u);ls.set('users',arr);};
const delUsers   = fn=>ls.set('users',ls.get('users').filter(u=>!fn(u)));
const updatePassword = (u,p)=>{const arr=ls.get('users');const x=arr.find(e=>e.user===u);
  if(!x)return false;x.pass=p;ls.set('users',arr);return true;};

/* ---------- Navegación ---------- */
const show=sel=>{$$('.screen').forEach(s=>s.style.display='none');$(sel).style.display='block';};
const tab=id=>{$$('.tab').forEach(t=>t.classList.remove('active'));
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
  const u=$('#user').value.trim(),
        p=$('#pass').value.trim();
  const acc=ls.get('users').find(a=>a.user===u&&a.pass===p);
  if(!acc)return Swal.fire('Error','Credenciales incorrectas','error');

  role        = acc.role;
  currentUser = acc.user;
  currentHouse= acc.house||null;
  if(role==='guard') currentGuard = ls.get('guards').find(g=>g.id===acc.guardId);

  $('#login').style.display='none';

  if(role==='vecino'){
    initPortal();
    show('#portal');
  }else{
    initApp();
    show('#app');
    $('#whoami').textContent = role==='admin'
      ? 'Sesión: Administrador'
      : `Sesión: Guardia – ${currentGuard?.name||currentUser}`;
    tab('access');
  }
};
$('#logoutBtn').onclick=$('#logoutVecino').onclick=()=>location.reload();

/* ==========================================================
   PORTAL VECINO
   ========================================================== */
function initPortal(){
  const res=ls.get('residents').find(r=>r.house===currentHouse);
  const pays=ls.get('payments').filter(p=>p.house===currentHouse);
  const last=pays.map(p=>p.mes).sort().slice(-1)[0]||'—';

  $('#vecinoCard').innerHTML=`
    <h2 class="title">Hola, ${res.name}</h2>
    <p><b>Dirección:</b> ${res.addr}</p>
    <p><b>Tel.:</b> ${res.phone}</p>
    <p>Último pago: <b>${last}</b> • Total: ${pays.length}</p>`;

  $('#vecPagos').innerHTML=
    pays.length?pays.map(p=>`<div>${p.mes} – L. ${p.amount}</div>`).join(''):'Sin pagos.';

  renderVisitasPortal();

  $('#expCSV').onclick=()=>{
    const vis=ls.get('access').filter(v=>v.house===currentHouse);
    if(!vis.length)return;
    const csv='Fecha,Nombre,Tipo,Registró\n'+
      vis.map(v=>`${v.time},${v.nombre},${v.tipo},${v.guard}`).join('\n');
    saveAs(new Blob([csv],{type:'text/csv'}),`visitas_casa${currentHouse}.csv`);
  };

  $('#vecPassForm').onsubmit=e=>{
    e.preventDefault();
    const np=$('#vecNewPass').value.trim();
    if(np.length<4)return Swal.fire('Mínimo 4 caracteres','','warning');
    if(updatePassword(currentUser,np)){
      Swal.fire('Contraseña actualizada','Vuelve a iniciar sesión','success')
        .then(()=>location.reload());
    }else Swal.fire('Error','No se pudo actualizar','error');
  };
}
const renderVisitasPortal = ()=>$('#vecVisitas').innerHTML=
  ls.get('access').filter(v=>v.house===currentHouse)
    .map(v=>`<div>${v.time} – ${v.nombre} (${v.tipo})</div>`).join('') || 'Sin visitas.';

/* ==========================================================
   APP PRINCIPAL
   ========================================================== */
function initApp(){

  const isAdmin = role==='admin';

  /* ---------- visibilidad/config ---------- */
  if(isAdmin) $('#accessForm').style.display='none';
  if(!isAdmin)
    ['residents','guards','companies','payments','debts','settings']
      .forEach(id=>$(`[data-tab="${id}"]`)?.classList.add('hidden'));
  else $('#settingsTab').classList.remove('hidden');

  $('#profileTab').classList.toggle('hidden', role!=='guard');
  $('#visitsTab').classList.remove('hidden');

  /* ---------- helpers ---------- */
  const visitasHoy = ()=>ls.get('access')
    .filter(a=>new Date(a.time).toDateString()===new Date().toDateString()).length;

  const syncSelectors = ()=>{
    const res=ls.get('residents'), com=ls.get('companies');
    const resOpt=res.map((r,i)=>`<option data-type="res" value="${i}">${r.name} (Casa ${r.house})</option>`).join('');
    const comOpt=com.map((c,i)=>`<option data-type="com" value="${i}">${c.name} (Local ${c.unit})</option>`).join('');
    $('#payRes').innerHTML=resOpt;
    $('#debtRes').innerHTML=`<optgroup label="Residentes">${resOpt}</optgroup><optgroup label="Empresas">${comOpt}</optgroup>`;
  };

  const syncHostList = ()=>{
    const res=ls.get('residents'), com=ls.get('companies');
    $('#hostList').innerHTML=
      res.map(r=>`<option data-house="${r.house}" value="${r.name} (Casa ${r.house})">`).join('')+
      com.map(c=>`<option data-house="${c.unit}" value="${c.name} (Local ${c.unit})">`).join('');
  };

  $('#acHost').oninput=()=>{
    const val=$('#acHost').value;
    const opt=[...$('#hostList').options].find(o=>o.value===val);
    if(opt) $('#acHouse').value=opt.dataset.house;
  };

  const kpi = ()=>{
    const vh=visitasHoy();
    if(role==='guard'){
      $('#kpiRow').innerHTML=`<div class="card-glass"><h3 class="text-xl">Visitas hoy</h3><p class="text-3xl">${vh}</p></div>`;
      return;
    }
    const mes=new Date().toISOString().slice(0,7);
    const ing=ls.get('payments').filter(p=>p.mes===mes).reduce((s,p)=>s+p.amount,0);
    const total=ls.get('residents').length+ls.get('companies').length;
    const pend=ls.get('debts').length;
    const pct=total?Math.round(pend/total*100):0;
    $('#kpiRow').innerHTML=`
      <div class="card-glass"><h3 class="text-xl">Ingresos mes</h3><p class="text-3xl">L. ${ing}</p></div>
      <div class="card-glass"><h3 class="text-xl">% Pendientes</h3><p class="text-3xl">${pct}%</p></div>
      <div class="card-glass"><h3 class="text-xl">Visitas hoy</h3><p class="text-3xl">${vh}</p></div>`;
  };

  /* ======================================================
     ACCESOS
     ====================================================== */
  $('#accessForm').onsubmit=e=>{
    e.preventDefault();
    const rec={
      nombre:$('#acNombre').value,
      id    :$('#acId').value.trim(),
      host  :$('#acHost').value,
      house :$('#acHouse').value,
      tipo  :$('#acTipo').value,
      guard :currentGuard?.name||currentUser,
      time  :new Date().toLocaleString()
    };
    const arr=ls.get('access');arr.unshift(rec);ls.set('access',arr);
    renderAccess();$('#accessForm').reset();kpi();renderVisits();if(role==='vecino')renderVisitasPortal();
  };

  const renderAccess=()=>$('#accessList').innerHTML=
    ls.get('access').map((a,i)=>`
      <div class="flex justify-between mb-2 items-start">
        <div>${a.time} · ${a.tipo} · ${a.nombre}
          ${a.id?`<br>Documento: ${a.id}`:''}
          <br>Visita a: <b>${a.host}</b>
          <br><small>Registró: ${a.guard}</small>
        </div>
        ${isAdmin?`<button data-i="${i}" class="btn-red delAcc w-8 h-8 flex items-center justify-center text-sm shrink-0">✕</button>`:''}
      </div>`).join('');

  $('#accessList').onclick=e=>{
    if(!isAdmin || !e.target.classList.contains('delAcc')) return;
    const i=+e.target.dataset.i;
    let arr=ls.get('access');arr.splice(i,1);ls.set('access',arr);
    renderAccess();renderVisits();
  };

  if(isAdmin){
    $('#clrAccess').onclick=()=>{
      Swal.fire({
        title:'¿Vaciar historial?',
        text :'Eliminará todos los registros de accesos',
        icon :'warning',showCancelButton:true,confirmButtonText:'Sí, borrar'
      }).then(r=>{
        if(r.isConfirmed){
          ls.set('access',[]);
          renderAccess();renderVisits();
          Swal.fire('Hecho','Historial eliminado','success');
        }
      });
    };
  }else $('#clrAccess')?.remove();

  /* ======================================================
     RESIDENTES / GUARDIAS / EMPRESAS / PAGOS / DEUDAS
     — exactamente igual a v 3.6, botones ✕ compactos —
     ====================================================== */
  /* --- Residentes --- */
  $('#resForm').onsubmit=e=>{/* … */};
  const renderResidents=()=>{/* … */};
  $('#resList').onclick=e=>{/* … */};
  /* --- Guardias --- */
  $('#guardForm').onsubmit=e=>{/* … */};
  const renderGuards=()=>{/* … */};
  $('#guardList').onclick=e=>{/* … */};
  /* --- Empresas --- */
  $('#comForm').onsubmit=e=>{/* … */};
  const renderCompanies=()=>{/* … */};
  $('#comList').onclick=e=>{/* … */};
  /* --- Pagos --- */
  $('#payForm').onsubmit=e=>{/* … */};
  const renderPays=()=>{/* … */};
  /* --- Deudas --- */
  $('#debtForm').onsubmit=e=>{/* … */};
  const renderDebts=()=>{/* … */};
  $('#debtList').onclick=e=>{/* … */};
  let debtChart; const drawDebtChart=()=>{/* … */};

  /* ======================================================
     BITÁCORA
     ====================================================== */
  $('#bitForm').onsubmit=e=>{
    e.preventDefault();
    const arr=ls.get('bitacora');
    arr.unshift({text:$('#bitText').value,time:new Date().toLocaleString()});
    ls.set('bitacora',arr);
    renderBits();$('#bitForm').reset();
  };
  const renderBits=()=>$('#bitList').innerHTML=
    ls.get('bitacora').slice(0,100).map(b=>`<div>${b.time} – ${b.text}</div>`).join('');

  if(isAdmin){
    $('#clrBitacora').onclick=()=>{
      Swal.fire({
        title:'¿Vaciar bitácora?',
        text :'Se eliminarán todas las entradas de incidentes',
        icon :'warning',showCancelButton:true,confirmButtonText:'Sí, borrar'
      }).then(r=>{
        if(r.isConfirmed){
          ls.set('bitacora',[]);
          renderBits();
          Swal.fire('Hecho','Bitácora vaciada','success');
        }
      });
    };
  }else $('#clrBitacora')?.remove();

  /* ======================================================
     Ajustes admin + borrar global (sin cambios)
     ====================================================== */
  if(isAdmin){
    $('#admUser').value=currentUser;
    $('#admForm').onsubmit=e=>{
      e.preventDefault();
      const nU=$('#admUser').value.trim(),
            nP=$('#admPass').value.trim();
      if(!nU||!nP)return Swal.fire('Campos requeridos','','warning');
      if(nU!==currentUser && userExists(nU))return Swal.fire('Usuario duplicado','','error');
      const users=ls.get('users');const adm=users.find(u=>u.role==='admin');
      adm.user=nU;adm.pass=nP;ls.set('users',users);
      Swal.fire('Actualizado','Reinicia sesión','success').then(()=>location.reload());
    };

    $('#adminClearAllVisits').onclick=()=>{
      Swal.fire({
        title:'¿Borrar TODO el historial de visitas?',
        text :'Esta acción eliminará todos los registros',
        icon :'warning',showCancelButton:true,confirmButtonText:'Sí, borrar'
      }).then(r=>{
        if(r.isConfirmed){
          ls.set('access',[]);
          renderAccess();renderVisits();renderVisitasPortal();
          Swal.fire('Hecho','Historial eliminado con éxito','success');
        }
      });
    };
  }else $('#adminClearAllVisits')?.remove();

  /* ======================================================
     Perfil guardia (sin cambios)
     ====================================================== */
  if(role==='guard'){
    $('#guardPassForm').onsubmit=e=>{
      e.preventDefault();
      const np=$('#guardNewPass').value.trim();
      if(np.length<4)return Swal.fire('Mínimo 4 caracteres','','warning');
      if(updatePassword(currentUser,np)){
        Swal.fire('Contraseña actualizada','Vuelve a iniciar sesión','success')
          .then(()=>location.reload());
      }else Swal.fire('Error','No se pudo actualizar','error');
    };
  }

  /* ======================================================
     Historial de visitas solo lectura
     ====================================================== */
  const renderVisits=()=>$('#visitsList').innerHTML=
    ls.get('access').map(a=>`
      <div class="mb-2">
        ${a.time} • ${a.tipo} • ${a.nombre}
        ${a.id?`<br>Doc.: ${a.id}`:''}
        <br>Visita a: <b>${a.host}</b><br><small>Registró: ${a.guard}</small>
      </div>`).join('');

  /* ---------- Inicial ---------- */
  (function initAll(){
    syncSelectors();syncHostList();
    renderAccess();renderResidents();renderGuards();renderCompanies();
    renderPays();renderDebts();drawDebtChart();renderBits();
    renderVisits();kpi();
  })();
}

/* ==========================================================
   Service‑Worker (opcional)
   ========================================================== */
if('serviceWorker' in navigator){
  navigator.serviceWorker.register('service-worker.js');
}
