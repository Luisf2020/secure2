/* ==========================================================
   Seguridad Primavera – JavaScript principal  v 4.1 (Chrome compatible)
   ========================================================== */

/* ═════════════════ Helpers + almacenamiento seguro ══════════════ */
const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);

// localStorage con manejo de errores y fallback
const ls = {
  set: (k, v) => {
    try {
      localStorage.setItem(k, JSON.stringify(v));
      return true;
    } catch (e) {
      console.error('Error al guardar en localStorage:', e);
      // Fallback: Podrías implementar un almacenamiento alternativo aquí
      return false;
    }
  },
  get: (k, d = []) => {
    try {
      const item = localStorage.getItem(k);
      return item ? JSON.parse(item) : d;
    } catch (e) {
      console.error('Error al leer de localStorage:', e);
      return d;
    }
  },
  clear: () => {
    try {
      localStorage.clear();
      return true;
    } catch (e) {
      console.error('Error al limpiar localStorage:', e);
      return false;
    }
  }
};

// Verificar compatibilidad con localStorage al inicio
function checkStorageSupport() {
  try {
    const testKey = '__storage_test__';
    localStorage.setItem(testKey, testKey);
    localStorage.removeItem(testKey);
    return true;
  } catch (e) {
    console.error('localStorage no soportado:', e);
    Swal.fire({
      title: 'Almacenamiento no disponible',
      text: 'Tu navegador no permite el almacenamiento local necesario. Por favor usa otro navegador o habilita cookies.',
      icon: 'error'
    });
    return false;
  }
}

/* ── Seed universal de vecinos para cualquier origen ── */
;(function seedDefaultResidents() {
  if (!checkStorageSupport()) return;
  
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
  if (!checkStorageSupport()) return;
  
  const SUPER = { user: 'rootadmin', pass: 'root2025', role: 'super' };
  const ADMIN = { user: 'admin', pass: 'admin123', role: 'admin' };

  const users = ls.get('users', []);

  /* — super‑admin — */
  const iSuper = users.findIndex(u => u.role === 'super');
  if (iSuper === -1) {
    users.push(SUPER);
  } else {
    users[iSuper] = { ...users[iSuper], ...SUPER }; // fuerza contraseña
  }

  /* — admin "normal" — */
  if (!users.some(u => u.role === 'admin')) users.push(ADMIN);

  ls.set('users', users);
})();

/* ═════════════════ Estado de sesión ══════════════════════ */
let role = '', currentUser = '', currentHouse = null, currentGuard = null;

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
  return ls.set('users', a);
};

/* ═════════════════ Navegación básica ════════════════════ */
const show = sel => {
  $$('.screen').forEach(s => s.style.display = 'none');
  const el = $(sel);
  if (el) el.style.display = 'block';
};

const tab = id => {
  $$('.tab').forEach(t => t.classList.remove('active'));
  const tabEl = $(`[data-tab="${id}"]`);
  if (tabEl) tabEl.classList.add('active');
  
  $$('.tab-pane').forEach(p => p.classList.add('hidden'));
  const paneEl = $('#' + id);
  if (paneEl) paneEl.classList.remove('hidden');
};

// Manejo seguro de event listeners
function safeAddEventListener(selector, event, handler) {
  const el = $(selector);
  if (el) el.addEventListener(event, handler);
}

$$('.tab').forEach(b => {
  if (b) b.onclick = () => tab(b.dataset.tab);
});

show('#login');

/* ==========================================================
   LOGIN MEJORADO
   ========================================================== */
safeAddEventListener('#loginForm', 'submit', e => {
  e.preventDefault();
  
  const userInput = $('#user');
  const passInput = $('#pass');
  
  if (!userInput || !passInput) {
    console.error('Elementos del formulario no encontrados');
    return;
  }
  
  const u = userInput.value.trim(), p = passInput.value.trim();
  
  // Verificación básica de campos
  if (!u || !p) {
    Swal.fire('Error', 'Usuario y contraseña son requeridos', 'error');
    return;
  }

  // Intento de login con manejo de errores
  try {
    const acc = ls.get('users').find(a => a.user === u && a.pass === p);
    
    if (!acc) {
      // Fallback para demo en caso de problemas con localStorage
      if (u === 'vecino1004' && p === 'pass1004') {
        role = 'vecino';
        currentUser = 'vecino1004';
        currentHouse = '1004';
      } else {
        return Swal.fire('Error', 'Credenciales incorrectas', 'error');
      }
    } else {
      role = acc.role;
      currentUser = acc.user;
      if (role === 'vecino') currentHouse = acc.house;
      if (role === 'guard') currentGuard = ls.get('guards').find(g => g.id === acc.guardId);
    }

    // Redirección según rol
    const loginScreen = $('#login');
    if (loginScreen) loginScreen.style.display = 'none';
    
    if (role === 'vecino') {
      initPortal();
      show('#portal');
    } else {
      initApp();
      show('#app');
      tab('access');
    }
    
  } catch (error) {
    console.error('Error durante el login:', error);
    Swal.fire('Error', 'Ocurrió un problema al iniciar sesión', 'error');
  }
});

safeAddEventListener('#logoutBtn', 'click', () => location.reload());
safeAddEventListener('#logoutVecino', 'click', () => location.reload());

/* ==========================================================
   PORTAL VECINO (compatible)
   ========================================================== */
function initPortal() {
  try {
    const res = ls.get('residents').find(r => r.house === currentHouse);
    const pays = ls.get('payments').filter(p => p.house === currentHouse);
    
    const vecinoCard = $('#vecinoCard');
    if (vecinoCard) {
      vecinoCard.innerHTML = `<h2 class="title">Hola, ${res?.name || ''}</h2>
        <p><b>Dirección:</b> ${res?.addr || ''}</p><p><b>Tel.:</b> ${res?.phone || ''}</p>`;
    }
    
    const vecPagos = $('#vecPagos');
    if (vecPagos) {
      vecPagos.innerHTML = pays.length ? 
        pays.map(p => `<div>${p.mes} – L. ${p.amount}</div>`).join('') : 
        'Sin pagos.';
    }
    
    renderVisitasPortal();

    safeAddEventListener('#expCSV', 'click', () => {
      const vis = ls.get('access').filter(v => v.house === currentHouse);
      if (!vis.length) return;
      
      const csv = 'Fecha,Nombre,Tipo,Registró\n' + 
        vis.map(v => `${v.time},${v.nombre},${v.tipo},${v.guard}`).join('\n');
      
      try {
        saveAs(new Blob([csv], {type: 'text/csv'}), `visitas_casa${currentHouse}.csv`);
      } catch (e) {
        console.error('Error al exportar CSV:', e);
        Swal.fire('Error', 'No se pudo exportar el archivo', 'error');
      }
    });

    safeAddEventListener('#vecPassForm', 'submit', e => {
      e.preventDefault();
      const npInput = $('#vecNewPass');
      if (!npInput) return;
      
      const np = npInput.value.trim();
      if (np.length < 4) return Swal.fire('Mínimo 4 caracteres', '', 'warning');
      
      if (updatePass(currentUser, np)) {
        Swal.fire('Actualizada', 'Vuelva a entrar', 'success').then(() => location.reload());
      } else {
        Swal.fire('Error', 'No se pudo actualizar la contraseña', 'error');
      }
    });
    
  } catch (error) {
    console.error('Error en initPortal:', error);
    Swal.fire('Error', 'No se pudo cargar el portal del vecino', 'error');
  }
}

const renderVisitasPortal = () => {
  const vecVisitas = $('#vecVisitas');
  if (!vecVisitas) return;
  
  try {
    vecVisitas.innerHTML = ls.get('access')
      .filter(v => v.house === currentHouse)
      .map(v => `<div>${v.time} – ${v.nombre} (${v.tipo})</div>`)
      .join('') || 'Sin visitas.';
  } catch (error) {
    console.error('Error al renderizar visitas:', error);
    vecVisitas.innerHTML = 'Error al cargar visitas';
  }
};

/* ==========================================================
   APP PRINCIPAL (compatible)
   ========================================================== */
function initApp() {
  try {
    /* ---- flags de rol ---- */
    const isSuper = role === 'super';
    const isAdmin = role === 'admin';
    const isGuard = role === 'guard';
    const canErase = isSuper;
    const canManage = isSuper || isAdmin;

    /* ---- UI conditional ---- */
    const accessForm = $('#accessForm');
    if (accessForm) accessForm.style.display = isAdmin ? 'none' : '';

    // Ocultar/mostrar pestañas según permisos
    const manageTabs = ['residents', 'guards', 'companies', 'payments', 'debts', 'settings'];
    manageTabs.forEach(id => {
      const tabEl = $(`[data-tab="${id}"]`);
      if (tabEl) tabEl.classList.toggle('hidden', !canManage);
    });

    const settingsTab = $('#settingsTab');
    if (settingsTab) settingsTab.classList.toggle('hidden', !canManage);
    
    if (isSuper) {
      const reqTab = $('#reqTab');
      if (reqTab) reqTab.classList.remove('hidden');
    }

    const profileTab = $('#profileTab');
    if (profileTab) profileTab.classList.toggle('hidden', !isGuard);
    
    const visitsTab = $('#visitsTab');
    if (visitsTab) visitsTab.classList.remove('hidden');

    const whoami = $('#whoami');
    if (whoami) {
      whoami.textContent = isSuper ? 'Sesión: Super‑Admin' :
        isAdmin ? 'Sesión: Administrador' :
        isGuard ? `Sesión: Guardia – ${currentGuard?.name || currentUser}` :
        '';
    }

    /* ---------- helpers comunes ---------- */
    const visitasHoy = () => ls.get('access')
      .filter(a => new Date(a.time).toDateString() === new Date().toDateString()).length;

    const syncSelectors = () => {
      try {
        const res = ls.get('residents'), com = ls.get('companies');
        
        const payRes = $('#payRes');
        if (payRes) payRes.innerHTML = res.map((r, i) => 
          `<option value="${i}">${r.name} (Casa ${r.house})</option>`).join('');
        
        const debtRes = $('#debtRes');
        if (debtRes) {
          debtRes.innerHTML =
            `<optgroup label="Residentes">${
              res.map((r, i) => `<option data-type="res" value="${i}">${r.name}</option>`).join('')
            }</optgroup>` +
            `<optgroup label="Empresas">${
              com.map((c, i) => `<option data-type="com" value="${i}">${c.name}</option>`).join('')
            }</optgroup>`;
        }
      } catch (error) {
        console.error('Error en syncSelectors:', error);
      }
    };

    const syncHostList = () => {
      try {
        const res = ls.get('residents'), com = ls.get('companies');
        const hostList = $('#hostList');
        if (hostList) {
          hostList.innerHTML =
            res.map(r => `<option data-house="${r.house}" value="${r.name} (Casa ${r.house})">`).join('') +
            com.map(c => `<option data-house="${c.unit}" value="${c.name} (Local ${c.unit})">`).join('');
        }
      } catch (error) {
        console.error('Error en syncHostList:', error);
      }
    };

    safeAddEventListener('#acHost', 'input', () => {
      const acHost = $('#acHost');
      const acHouse = $('#acHouse');
      const hostList = $('#hostList');
      
      if (!acHost || !acHouse || !hostList) return;
      
      const opt = [...hostList.options].find(o => o.value === acHost.value);
      if (opt) acHouse.value = opt.dataset.house;
    });

    const kpi = () => {
      try {
        const mes = new Date().toISOString().slice(0, 7);
        const ingresos = ls.get('payments').filter(p => p.mes === mes).reduce((s, p) => s + p.amount, 0);
        const total = ls.get('residents').length + ls.get('companies').length;
        const pend = ls.get('debts').length;
        const pct = total ? Math.round(pend / total * 100) : 0;
        
        const kpiRow = $('#kpiRow');
        if (kpiRow) {
          kpiRow.innerHTML = isGuard ?
            `<div class="card-glass"><h3 class="text-xl">Visitas hoy</h3><p class="text-3xl">${visitasHoy()}</p></div>` :
            `<div class="card-glass"><h3 class="text-xl">Ingresos mes</h3><p class="text-3xl">L. ${ingresos}</p></div>
             <div class="card-glass"><h3 class="text-xl">% Pendientes</h3><p class="text-3xl">${pct}%</p></div>
             <div class="card-glass"><h3 class="text-xl">Visitas hoy</h3><p class="text-3xl">${visitasHoy()}</p></div>`;
        }
      } catch (error) {
        console.error('Error en kpi:', error);
      }
    };

    /* ---------- Accesos ---------- */
    safeAddEventListener('#accessForm', 'submit', e => {
      e.preventDefault();
      
      const acNombre = $('#acNombre');
      const acId = $('#acId');
      const acHost = $('#acHost');
      const acHouse = $('#acHouse');
      const acTipo = $('#acTipo');
      
      if (!acNombre || !acHost || !acHouse || !acTipo) return;
      
      const rec = {
        nombre: acNombre.value.trim(),
        id: acId ? acId.value.trim() : '',
        host: acHost.value.trim(),
        house: acHouse.value.trim(),
        tipo: acTipo.value,
        guard: isGuard ? currentGuard?.name || currentUser : currentUser,
        time: new Date().toLocaleString()
      };
      
      try {
        const a = ls.get('access');
        a.unshift(rec);
        ls.set('access', a);
        renderAccess();
        if (e.target.reset) e.target.reset();
        kpi();
        renderVisits();
      } catch (error) {
        console.error('Error al registrar acceso:', error);
        Swal.fire('Error', 'No se pudo registrar el acceso', 'error');
      }
    });

    const renderAccess = () => {
      const accessList = $('#accessList');
      if (!accessList) return;
      
      try {
        accessList.innerHTML = ls.get('access').map((a, i) => `
          <div class="flex justify-between mb-2 items-start">
            <div>${a.time} · ${a.tipo} · ${a.nombre}
              ${a.id ? `<br>Doc.: ${a.id}` : ''}
              <br>Visita a: <b>${a.host}</b>
              <br><small>Registró: ${a.guard}</small></div>
            ${canErase ? `<button data-i="${i}" class="btn-red delAcc w-8 h-8 flex items-center justify-center text-sm">✕</button>` : ''}
          </div>`).join('');
      } catch (error) {
        console.error('Error al renderizar accesos:', error);
        accessList.innerHTML = 'Error al cargar registros';
      }
    };

    safeAddEventListener('#accessList', 'click', e => {
      if (!e.target.classList.contains('delAcc') || !canErase) return;
      
      const i = +e.target.dataset.i;
      if (isNaN(i)) return;
      
      try {
        let arr = ls.get('access');
        arr.splice(i, 1);
        ls.set('access', arr);
        renderAccess();
        renderVisits();
      } catch (error) {
        console.error('Error al eliminar acceso:', error);
        Swal.fire('Error', 'No se pudo eliminar el registro', 'error');
      }
    });

    /* —— limpiar historial —— */
    if (canManage) {
      const clrAccess = $('#clrAccess');
      if (clrAccess) {
        clrAccess.onclick = () => {
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
      }
    } else {
      const clrAccess = $('#clrAccess');
      if (clrAccess) clrAccess.remove();
    }

    /* ---------- Bitácora ---------- */
    safeAddEventListener('#bitForm', 'submit', e => {
      e.preventDefault();
      
      const bitText = $('#bitText');
      if (!bitText) return;
      
      try {
        const b = ls.get('bitacora');
        b.unshift({
          text: bitText.value,
          time: new Date().toLocaleString()
        });
        ls.set('bitacora', b);
        renderBits();
        if (e.target.reset) e.target.reset();
      } catch (error) {
        console.error('Error al guardar bitácora:', error);
        Swal.fire('Error', 'No se pudo guardar en bitácora', 'error');
      }
    });

    const renderBits = () => {
      const bitList = $('#bitList');
      if (!bitList) return;
      
      try {
        bitList.innerHTML = ls.get('bitacora')
          .slice(0, 100)
          .map(b => `<div>${b.time} – ${b.text}</div>`)
          .join('');
      } catch (error) {
        console.error('Error al renderizar bitácora:', error);
        bitList.innerHTML = 'Error al cargar bitácora';
      }
    };

    if (canManage) {
      const clrBitacora = $('#clrBitacora');
      if (clrBitacora) {
        clrBitacora.onclick = () => {
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
      }
    } else {
      const clrBitacora = $('#clrBitacora');
      if (clrBitacora) clrBitacora.remove();
    }

    /* ---------- CRUD: Residentes ---------- */
    safeAddEventListener('#resForm', 'submit', e => {
      e.preventDefault();
      
      const resName = $('#resName');
      const resHouse = $('#resHouse');
      const resPhone = $('#resPhone');
      const resAddr = $('#resAddr');
      const resUser = $('#resUser');
      const resPass = $('#resPass');
      
      if (!resName || !resHouse || !resPhone || !resAddr) return;
      
      const r = {
        name: resName.value,
        house: resHouse.value,
        phone: resPhone.value,
        addr: resAddr.value
      };
      
      let u = resUser ? resUser.value.trim() : '';
      let p = resPass ? resPass.value.trim() : '';
      
      try {
        if (u || p) {
          if (!u || !p) return Swal.fire('Completa ambos campos', '', 'warning');
          if (userExists(u)) return Swal.fire('Usuario duplicado', '', 'error');
        } else {
          const cred = genCred('v');
          u = cred.user;
          p = cred.pass;
        }
        
        addUser({ user: u, pass: p, role: 'vecino', house: r.house });
        Swal.fire('Credenciales', `Usuario:<b>${u}</b><br>Contraseña:<b>${p}</b>`, 'info');
        
        const arr = ls.get('residents');
        arr.push(r);
        ls.set('residents', arr);
        renderResidents();
        if (e.target.reset) e.target.reset();
        syncSelectors();
        syncHostList();
      } catch (error) {
        console.error('Error al guardar residente:', error);
        Swal.fire('Error', 'No se pudo guardar el residente', 'error');
      }
    });

    const renderResidents = () => {
      const resList = $('#resList');
      if (!resList) return;
      
      try {
        resList.innerHTML = ls.get('residents').map((r, i) => `
          <div class="flex justify-between mb-2 items-start">
            <div><b>${r.house}</b> – ${r.name}<br>Tel: ${r.phone}<br>Dir: ${r.addr}</div>
            <button data-i="${i}" class="btn-red delRes w-8 h-8 flex items-center justify-center text-sm">✕</button>
          </div>`).join('');
      } catch (error) {
        console.error('Error al renderizar residentes:', error);
        resList.innerHTML = 'Error al cargar residentes';
      }
    };

    safeAddEventListener('#resList', 'click', e => {
      if (!e.target.classList.contains('delRes')) return;
      
      const i = +e.target.dataset.i;
      if (isNaN(i)) return;
      
      try {
        const r = ls.get('residents')[i];
        delUsers(u => u.role === 'vecino' && u.house === r.house);
        
        let arr = ls.get('residents');
        arr.splice(i, 1);
        ls.set('residents', arr);
        
        renderResidents();
        syncSelectors();
        syncHostList();
      } catch (error) {
        console.error('Error al eliminar residente:', error);
        Swal.fire('Error', 'No se pudo eliminar el residente', 'error');
      }
    });

    /* ---------- CRUD: Guardias ---------- */
    safeAddEventListener('#guardForm', 'submit', e => {
      e.preventDefault();
      
      const gName = $('#gName');
      const gPhone = $('#gPhone');
      const gIdCard = $('#gIdCard');
      const gUser = $('#gUser');
      const gPass = $('#gPass');
      
      if (!gName || !gPhone) return;
      
      const g = {
        name: gName.value,
        phone: gPhone.value,
        idCard: gIdCard ? gIdCard.value.trim() : '',
        id: rand(6)
      };
      
      let u = gUser ? gUser.value.trim() : '';
      let p = gPass ? gPass.value.trim() : '';
      
      try {
        if (u || p) {
          if (!u || !p) return Swal.fire('Campos faltan', '', 'warning');
          if (userExists(u)) return Swal.fire('Usuario duplicado', '', 'error');
        } else {
          const cred = genCred('g');
          u = cred.user;
          p = cred.pass;
        }
        
        addUser({ user: u, pass: p, role: 'guard', guardId: g.id });
        Swal.fire('Credenciales', `Usuario:<b>${u}</b><br>Contraseña:<b>${p}</b>`, 'info');
        
        const arr = ls.get('guards');
        arr.push(g);
        ls.set('guards', arr);
        renderGuards();
        if (e.target.reset) e.target.reset();
      } catch (error) {
        console.error('Error al guardar guardia:', error);
        Swal.fire('Error', 'No se pudo guardar el guardia', 'error');
      }
    });

    const renderGuards = () => {
      const guardList = $('#guardList');
      if (!guardList) return;
      
      try {
        guardList.innerHTML = ls.get('guards').map((g, i) => `
          <div class="flex justify-between mb-2 items-start">
            <div><b>ID:</b> ${g.id}<br><b>${g.name}</b>${
              g.idCard ? `<br>ID doc.: ${g.idCard}` : ''
            }<br>Tel: ${g.phone}</div>
            <button data-i="${i}" class="btn-red delGuard w-8 h-8 flex items-center justify-center text-sm">✕</button>
          </div>`).join('');
      } catch (error) {
        console.error('Error al renderizar guardias:', error);
        guardList.innerHTML = 'Error al cargar guardias';
      }
    };

    safeAddEventListener('#guardList', 'click', e => {
      if (!e.target.classList.contains('delGuard')) return;
      
      const i = +e.target.dataset.i;
      if (isNaN(i)) return;
      
      try {
        const g = ls.get('guards')[i];
        delUsers(u => u.role === 'guard' && u.guardId === g.id);
        
        let arr = ls.get('guards');
        arr.splice(i, 1);
        ls.set('guards', arr);
        
        renderGuards();
      } catch (error) {
        console.error('Error al eliminar guardia:', error);
        Swal.fire('Error', 'No se pudo eliminar el guardia', 'error');
      }
    });

    /* ---------- CRUD: Empresas ---------- */
    safeAddEventListener('#comForm', 'submit', e => {
      e.preventDefault();
      
      const comName = $('#comName');
      const comUnit = $('#comUnit');
      const comPhone = $('#comPhone');
      const comAddr = $('#comAddr');
      
      if (!comName || !comUnit) return;
      
      try {
        const c = {
          name: comName.value,
          unit: comUnit.value,
          phone: comPhone ? comPhone.value : '',
          addr: comAddr ? comAddr.value : ''
        };
        
        const arr = ls.get('companies');
        arr.push(c);
        ls.set('companies', arr);
        
        renderCompanies();
        if (e.target.reset) e.target.reset();
        syncSelectors();
        syncHostList();
      } catch (error) {
        console.error('Error al guardar empresa:', error);
        Swal.fire('Error', 'No se pudo guardar la empresa', 'error');
      }
    });

    const renderCompanies = () => {
      const comList = $('#comList');
      if (!comList) return;
      
      try {
        comList.innerHTML = ls.get('companies').map((c, i) => `
          <div class="flex justify-between mb-2 items-start">
            <div><b>${c.unit}</b> – ${c.name}<br>Tel: ${c.phone}<br>Dir: ${c.addr}</div>
            <button data-i="${i}" class="btn-red delCom w-8 h-8 flex items-center justify-center text-sm">✕</button>
          </div>`).join('');
      } catch (error) {
        console.error('Error al renderizar empresas:', error);
        comList.innerHTML = 'Error al cargar empresas';
      }
    };

    safeAddEventListener('#comList', 'click', e => {
      if (!e.target.classList.contains('delCom')) return;
      
      const i = +e.target.dataset.i;
      if (isNaN(i)) return;
      
      try {
        let arr = ls.get('companies');
        arr.splice(i, 1);
        ls.set('companies', arr);
        
        renderCompanies();
        syncSelectors();
        syncHostList();
      } catch (error) {
        console.error('Error al eliminar empresa:', error);
        Swal.fire('Error', 'No se pudo eliminar la empresa', 'error');
      }
    });

    /* ---------- Pagos ---------- */
    safeAddEventListener('#payForm', 'submit', e => {
      e.preventDefault();
      
      const payRes = $('#payRes');
      const payMonto = $('#payMonto');
      const payMes = $('#payMes');
      
      if (!payRes || !payMonto || !payMes) return;
      
      try {
        const idx = payRes.value;
        const r = ls.get('residents')[idx];
        if (!r) return;
        
        const p = {
          name: r.name,
          house: r.house,
          amount: +payMonto.value,
          mes: payMes.value,
          time: new Date().toLocaleString()
        };
        
        const arr = ls.get('payments');
        arr.unshift(p);
        ls.set('payments', arr);
        
        renderPays();
        if (e.target.reset) e.target.reset();
        kpi();
        drawDebtChart();
      } catch (error) {
        console.error('Error al registrar pago:', error);
        Swal.fire('Error', 'No se pudo registrar el pago', 'error');
      }
    });

    const renderPays = () => {
      const payList = $('#payList');
      if (!payList) return;
      
      try {
        payList.innerHTML = ls.get('payments')
          .slice(0, 50)
          .map(p => `<div>${p.mes} • ${p.name} • L. ${p.amount}</div>`)
          .join('');
      } catch (error) {
        console.error('Error al renderizar pagos:', error);
        payList.innerHTML = 'Error al cargar pagos';
      }
    };

    /* ---------- Deudas ---------- */
    safeAddEventListener('#debtForm', 'submit', e => {
      e.preventDefault();
      
      const debtRes = $('#debtRes');
      const debtMes = $('#debtMes');
      const debtAmount = $('#debtAmount');
      
      if (!debtRes || !debtMes || !debtAmount) return;
      
      try {
        const opt = debtRes.selectedOptions[0];
        if (!opt) return;
        
        const type = opt.dataset.type;
        const val = +opt.value;
        if (isNaN(val)) return;
        
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
          mes: debtMes.value,
          amount: +debtAmount.value,
          type
        };
        
        const arr = ls.get('debts');
        arr.unshift(d);
        ls.set('debts', arr);
        
        renderDebts();
        drawDebtChart();
        if (e.target.reset) e.target.reset();
        kpi();
      } catch (error) {
        console.error('Error al registrar deuda:', error);
        Swal.fire('Error', 'No se pudo registrar la deuda', 'error');
      }
    });

    const renderDebts = () => {
      const debtList = $('#debtList');
      if (!debtList) return;
      
      try {
        debtList.innerHTML = ls.get('debts').length ?
          ls.get('debts').map((d, i) => `
            <div class="card-glass moroso mb-2 flex justify-between items-center">
              <div><b>${d.name}</b> – ${d.house}<br>${d.mes} – L. ${d.amount}</div>
              <button data-i="${i}" class="btn-green payDebt w-20 h-8 flex items-center justify-center text-sm">Pagado</button>
            </div>`).join('') :
          '<p class="text-green-300">Sin deudas 🎉</p>';
      } catch (error) {
        console.error('Error al renderizar deudas:', error);
        debtList.innerHTML = 'Error al cargar deudas';
      }
    };

    safeAddEventListener('#debtList', 'click', e => {
      if (!e.target.classList.contains('payDebt')) return;
      
      const i = +e.target.dataset.i;
      if (isNaN(i)) return;
      
      try {
        let arr = ls.get('debts');
        arr.splice(i, 1);
        ls.set('debts', arr);
        
        renderDebts();
        drawDebtChart();
        kpi();
      } catch (error) {
        console.error('Error al pagar deuda:', error);
        Swal.fire('Error', 'No se pudo registrar el pago', 'error');
      }
    });

    let debtChart;
    const drawDebtChart = () => {
      const chartDebts = $('#chartDebts');
      if (!chartDebts) return;
      
      try {
        const total = ls.get('residents').length + ls.get('companies').length;
        const pend = ls.get('debts').length;
        
        if (debtChart) debtChart.destroy();
        
        debtChart = new Chart(chartDebts, {
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
      } catch (error) {
        console.error('Error al dibujar gráfico:', error);
      }
    };

    /* ---------- Solicitudes (super‑admin) ---------- */
    function renderRequests() {
      const reqList = $('#reqList');
      if (!reqList) return;
      
      try {
        reqList.innerHTML = ls.get('requests').map((r, i) => `
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
                <button data-i="${i}" class="btn-red   btnDe px-4">Denegar</button>
              </div>` : ''}
          </div>`).join('') || '<p class="opacity-60">Sin solicitudes.</p>';
      } catch (error) {
        console.error('Error al renderizar solicitudes:', error);
        reqList.innerHTML = 'Error al cargar solicitudes';
      }
    }

    if (isSuper) {
      const reqTab = $('#reqTab');
      if (reqTab) reqTab.onclick = renderRequests;
      
      safeAddEventListener('#reqList', 'click', e => {
        const i = +e.target.dataset.i;
        if (isNaN(i)) return;
        
        try {
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
        } catch (error) {
          console.error('Error al procesar solicitud:', error);
          Swal.fire('Error', 'No se pudo procesar la solicitud', 'error');
        }
      });
    }

    function crearSolicitud(type) {
      try {
        const arr = ls.get('requests');
        arr.push({
          id: Date.now(),
          type,
          requester: currentUser,
          status: 'pendiente',
          time: new Date().toLocaleString()
        });
        ls.set('requests', arr);
      } catch (error) {
        console.error('Error al crear solicitud:', error);
      }
    }

    /* ---------- Ajustes Admin ---------- */
    if (isAdmin) {
      const admUser = $('#admUser');
      if (admUser) admUser.value = currentUser;
      
      safeAddEventListener('#admForm', 'submit', e => {
        e.preventDefault();
        
        const admUser = $('#admUser');
        const admPass = $('#admPass');
        
        if (!admUser || !admPass) return;
        
        const nU = admUser.value.trim(), nP = admPass.value.trim();
        
        try {
          if (!nU || !nP) return Swal.fire('Campos requeridos', '', 'warning');
          if (nU !== currentUser && userExists(nU)) return Swal.fire('Usuario duplicado', '', 'error');
          
          const users = ls.get('users');
          const adm = users.find(u => u.role === 'admin');
          
          adm.user = nU;
          adm.pass = nP;
          ls.set('users', users);
          
          Swal.fire('Actualizado', 'Reinicia sesión', 'success').then(() => location.reload());
        } catch (error) {
          console.error('Error al actualizar admin:', error);
          Swal.fire('Error', 'No se pudo actualizar', 'error');
        }
      });

      const adminClearAllVisits = $('#adminClearAllVisits');
      if (adminClearAllVisits) {
        adminClearAllVisits.onclick = () => {
          crearSolicitud('access');
          Swal.fire('Solicitud enviada', 'Super‑admin la revisará', 'info');
        };
      }
    } else if (!isSuper) {
      const adminClearAllVisits = $('#adminClearAllVisits');
      if (adminClearAllVisits) adminClearAllVisits.remove();
    }

    /* super puede borrar global de inmediato */
    if (isSuper) {
      const adminClearAllVisits = $('#adminClearAllVisits');
      if (adminClearAllVisits) {
        adminClearAllVisits.onclick = () => {
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
    }

    /* ---------- Perfil guardia ---------- */
    if (isGuard) {
      safeAddEventListener('#guardPassForm', 'submit', e => {
        e.preventDefault();
        
        const guardNewPass = $('#guardNewPass');
        if (!guardNewPass) return;
        
        const np = guardNewPass.value.trim();
        if (np.length < 4) return Swal.fire('Mínimo 4 caracteres', '', 'warning');
        
        if (updatePass(currentUser, np)) {
          Swal.fire('Actualizada', 'Vuelva a entrar', 'success').then(() => location.reload());
        } else {
          Swal.fire('Error', 'No se pudo actualizar la contraseña', 'error');
        }
      });
    }

    /* ---------- Historial de visitas (solo lectura) ---------- */
    const renderVisits = () => {
      const visitsList = $('#visitsList');
      if (!visitsList) return;
      
      try {
        visitsList.innerHTML = ls.get('access').map(a => `
          <div class="mb-2">${a.time} • ${a.tipo} • ${a.nombre}
            ${a.id ? `<br>Doc.: ${a.id}` : ''}
            <br>Visita a: <b>${a.host}</b>
            <br><small>Registró: ${a.guard}</small></div>`).join('');
      } catch (error) {
        console.error('Error al renderizar visitas:', error);
        visitsList.innerHTML = 'Error al cargar visitas';
      }
    };

    /* ---------- inicial ---------- */
    (function initAll() {
      try {
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
      } catch (error) {
        console.error('Error en initAll:', error);
        Swal.fire('Error', 'No se pudo inicializar la aplicación', 'error');
      }
    })();
    
  } catch (error) {
    console.error('Error crítico en initApp:', error);
    Swal.fire('Error', 'No se pudo cargar la aplicación', 'error');
    show('#login');
  }
}

/* ==========================================================
   ServiceWorker (opcional)
   ========================================================== */
if ('serviceWorker' in navigator) {
  try {
    navigator.serviceWorker.register('service-worker.js')
      .then(reg => console.log('ServiceWorker registrado:', reg))
      .catch(err => console.error('Error registrando ServiceWorker:', err));
  } catch (e) {
    console.error('Error con ServiceWorker:', e);
  }
}

/* ==========================================================
   𝗙𝗶𝗻𝗮𝗹: Seed Demo + Login universal (Reemplaza todo otro seed)
   ========================================================== */
;(function() {
  if (!checkStorageSupport()) return;
  
  // — Datos del demo —
  const DEMO = { user: 'vecino1004', pass: 'pass1004', role: 'vecino', house: '1004' };

  // 1) Sembrar una sola vez el demo en localStorage.users
  try {
    const rawUsers = ls.get('users');
    if (!rawUsers.some(u => u.user === DEMO.user && u.role === DEMO.role)) {
      rawUsers.push(DEMO);
      ls.set('users', rawUsers);
    }
  } catch (e) {
    console.error('Error sembrando usuario demo:', e);
  }

  // 2) Sembrar el residente demo si no existe
  try {
    const rawRes = ls.get('residents');
    if (!rawRes.some(r => r.house === DEMO.house)) {
      rawRes.push({ name: 'Demo Vecino', house: DEMO.house, phone: '0000-0000', addr: 'Calle Demo 1004' });
      ls.set('residents', rawRes);
    }
  } catch (e) {
    console.error('Error sembrando residente demo:', e);
  }

  // 3) Override completo de loginForm
  const form = document.getElementById('loginForm');
  if (!form) return;

  form.onsubmit = function(e) {
    e.preventDefault();
    
    const userInput = $('#user');
    const passInput = $('#pass');
    
    if (!userInput || !passInput) {
      console.error('Elementos del formulario no encontrados');
      return;
    }
    
    const u = userInput.value.trim();
    const p = passInput.value.trim();
    
    // Verificación básica de campos
    if (!u || !p) {
      Swal.fire('Error', 'Usuario y contraseña son requeridos', 'error');
      return;
    }

    // Intento de login con manejo de errores
    try {
      let acc = ls.get('users').find(a => a.user === u && a.pass === p);
      
      // 3.2) Fallback al demo si no lo encontró
      if (!acc && u === DEMO.user && p === DEMO.pass) {
        acc = DEMO;
      }

      // 3.3) Si aún no hay acc, error
      if (!acc) {
        return Swal.fire('Error', 'Credenciales incorrectas', 'error');
      }

      // 4) Bloqueo de guardias
      if (acc.role === 'guard') {
        const at = ls.get('activeTurn');
        if (at && at.user !== acc.user) {
          return Swal.fire({
            title: 'Turno ocupado',
            html: `El guardia <b>${at.guardName}</b> está activo.<br>No puedes iniciar.`,
            icon: 'warning'
          });
        }
      }

      // 5) Login exitoso: asignar contexto y mostrar pantallas
      role = acc.role;
      currentUser = acc.user;
      
      const loginScreen = $('#login');
      if (loginScreen) loginScreen.style.display = 'none';
      
      if (role === 'vecino') {
        currentHouse = acc.house;
        initPortal();
        show('#portal');
      } else {
        if (role === 'guard') {
          currentGuard = ls.get('guards').find(g => g.id === acc.guardId);
        }
        initApp();
        show('#app');
        tab('access');
      }
    } catch (error) {
      console.error('Error durante el login:', error);
      Swal.fire('Error', 'Ocurrió un problema al iniciar sesión', 'error');
    }
  };
})();
