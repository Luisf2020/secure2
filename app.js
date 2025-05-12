/* ==========================================================
   Seguridad Primavera - JavaScript principal v4.2 (Fix Chrome)
   ========================================================== */

// Polyfill para compatibilidad con navegadores antiguos
if (!window.Promise) {
  window.Promise = Promise;
}

// Configuración inicial segura
document.addEventListener('DOMContentLoaded', function() {
  initApplication();
});

function initApplication() {
  /* ═════════════════ Configuración Segura ══════════════ */
  const $ = s => document.querySelector(s);
  const $$ = s => document.querySelectorAll(s);
  
  // Sistema de almacenamiento con verificación
  const storage = {
    available: false,
    init: function() {
      try {
        const test = '__storage_test__';
        localStorage.setItem(test, test);
        localStorage.removeItem(test);
        this.available = true;
      } catch (e) {
        console.error('LocalStorage no disponible:', e);
        this.available = false;
        showStorageError();
      }
    },
    set: function(k, v) {
      if (!this.available) return false;
      try {
        localStorage.setItem(k, JSON.stringify(v));
        return true;
      } catch (e) {
        console.error('Error al guardar:', e);
        return false;
      }
    },
    get: function(k, d = []) {
      if (!this.available) return d;
      try {
        const item = localStorage.getItem(k);
        return item ? JSON.parse(item) : d;
      } catch (e) {
        console.error('Error al leer:', e);
        return d;
      }
    }
  };
  
  storage.init();

  function showStorageError() {
    Swal.fire({
      title: 'Almacenamiento no disponible',
      html: 'Chrome está bloqueando el almacenamiento local necesario.<br><br>' +
            'Por favor:<ol>' +
            '<li>Abre chrome://settings/content/cookies</li>' +
            '<li>Habilita "Permitir que los sitios guarden y lean datos de cookies"</li>' +
            '<li>Agrega esta página a las excepciones</li>' +
            '</ol>',
      icon: 'error'
    });
  }

  /* ═════════════════ Datos Iniciales ══════════════ */
  // Datos demo para usuario vecino
  const DEMO_DATA = {
    user: { user: 'vecino1004', pass: 'pass1004', role: 'vecino', house: '1004' },
    resident: { name: 'Demo Vecino', house: '1004', phone: '0000-0000', addr: 'Calle Demo 1004' }
  };

  // Inicializar datos si no existen
  function initializeData() {
    if (!storage.available) return;
    
    // Usuarios
    let users = storage.get('users', []);
    if (!users.some(u => u.role === 'vecino')) {
      users.push(DEMO_DATA.user);
      storage.set('users', users);
    }
    
    // Residentes
    let residents = storage.get('residents', []);
    if (!residents.some(r => r.house === '1004')) {
      residents.push(DEMO_DATA.resident);
      storage.set('residents', residents);
    }
    
    // Usuarios admin
    if (!users.some(u => u.role === 'super')) {
      users.push({ user: 'rootadmin', pass: 'root2025', role: 'super' });
    }
    if (!users.some(u => u.role === 'admin')) {
      users.push({ user: 'admin', pass: 'admin123', role: 'admin' });
    }
    storage.set('users', users);
  }
  
  initializeData();

  /* ═════════════════ Estado Global ══════════════ */
  const appState = {
    role: '',
    currentUser: '',
    currentHouse: '',
    currentGuard: null,
    
    login: function(userData) {
      this.role = userData.role;
      this.currentUser = userData.user;
      if (this.role === 'vecino') this.currentHouse = userData.house;
      if (this.role === 'guard') {
        this.currentGuard = storage.get('guards').find(g => g.id === userData.guardId);
      }
      updateUIAfterLogin();
    },
    
    logout: function() {
      this.role = '';
      this.currentUser = '';
      this.currentHouse = '';
      this.currentGuard = null;
      location.reload();
    }
  };

  /* ═════════════════ Sistema de Login ══════════════ */
  function setupLoginForm() {
    const form = $('#loginForm');
    if (!form) return;
    
    form.onsubmit = function(e) {
      e.preventDefault();
      
      const user = $('#user').value.trim();
      const pass = $('#pass').value.trim();
      
      if (!user || !pass) {
        Swal.fire('Error', 'Usuario y contraseña son requeridos', 'error');
        return;
      }
      
      // Verificación especial para usuario demo en Chrome
      if (user === 'vecino1004' && pass === 'pass1004') {
        handleDemoLogin();
        return;
      }
      
      // Login normal
      const users = storage.get('users');
      const account = users.find(u => u.user === user && u.pass === pass);
      
      if (account) {
        appState.login(account);
      } else {
        Swal.fire('Error', 'Credenciales incorrectas', 'error');
      }
    };
  }
  
  function handleDemoLogin() {
    // Verificar si el usuario demo existe, si no, crearlo
    const users = storage.get('users');
    let demoUser = users.find(u => u.user === 'vecino1004');
    
    if (!demoUser) {
      demoUser = DEMO_DATA.user;
      users.push(demoUser);
      storage.set('users', users);
      
      // Asegurar que el residente demo exista
      const residents = storage.get('residents');
      if (!residents.some(r => r.house === '1004')) {
        residents.push(DEMO_DATA.resident);
        storage.set('residents', residents);
      }
    }
    
    appState.login(demoUser);
  }

  /* ═════════════════ Portal del Vecino ══════════════ */
  function initPortal() {
    if (!appState.currentHouse) return;
    
    try {
      // Datos del residente
      const resident = storage.get('residents').find(r => r.house === appState.currentHouse);
      const payments = storage.get('payments').filter(p => p.house === appState.currentHouse);
      
      // Mostrar información
      $('#vecinoCard').innerHTML = `
        <h2 class="title">Hola, ${resident?.name || 'Vecino'}</h2>
        <p><b>Dirección:</b> ${resident?.addr || 'No especificada'}</p>
        <p><b>Teléfono:</b> ${resident?.phone || 'No especificado'}</p>
      `;
      
      // Mostrar pagos
      $('#vecPagos').innerHTML = payments.length 
        ? payments.map(p => `<div>${p.mes} - L. ${p.amount}</div>`).join('')
        : 'Sin pagos registrados';
      
      // Mostrar visitas
      renderVisitasPortal();
      
      // Configurar botón de exportación
      $('#expCSV').onclick = exportVisitsToCSV;
      
      // Configurar cambio de contraseña
      $('#vecPassForm').onsubmit = handlePasswordChange;
      
    } catch (error) {
      console.error('Error inicializando portal:', error);
      Swal.fire('Error', 'No se pudo cargar el portal del vecino', 'error');
    }
  }
  
  function renderVisitasPortal() {
    if (!appState.currentHouse) return;
    
    const visits = storage.get('access')
      .filter(v => v.house === appState.currentHouse)
      .map(v => `<div>${v.time} - ${v.nombre} (${v.tipo})</div>`)
      .join('') || 'Sin visitas registradas';
    
    $('#vecVisitas').innerHTML = visits;
  }
  
  function exportVisitsToCSV() {
    const visits = storage.get('access')
      .filter(v => v.house === appState.currentHouse);
    
    if (!visits.length) {
      Swal.fire('Info', 'No hay visitas para exportar', 'info');
      return;
    }
    
    const csvContent = [
      'Fecha,Nombre,Tipo,Documento,Registrado por,Casa visitada',
      ...visits.map(v => `"${v.time}","${v.nombre}","${v.tipo}","${v.id || ''}","${v.guard}","${v.house}"`)
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `visitas_casa_${appState.currentHouse}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
  
  function handlePasswordChange(e) {
    e.preventDefault();
    
    const newPass = $('#vecNewPass').value.trim();
    if (newPass.length < 4) {
      Swal.fire('Error', 'La contraseña debe tener al menos 4 caracteres', 'warning');
      return;
    }
    
    const users = storage.get('users');
    const userIndex = users.findIndex(u => u.user === appState.currentUser);
    
    if (userIndex !== -1) {
      users[userIndex].pass = newPass;
      if (storage.set('users', users)) {
        Swal.fire('Éxito', 'Contraseña actualizada. Vuelva a iniciar sesión', 'success')
          .then(() => appState.logout());
      } else {
        Swal.fire('Error', 'No se pudo actualizar la contraseña', 'error');
      }
    }
  }

  /* ═════════════════ Navegación ══════════════ */
  function updateUIAfterLogin() {
    $('#login').style.display = 'none';
    
    if (appState.role === 'vecino') {
      initPortal();
      showScreen('#portal');
    } else {
      initAdminApp();
      showScreen('#app');
      activateTab('access');
    }
  }
  
  function showScreen(screenId) {
    $$('.screen').forEach(s => s.style.display = 'none');
    const screen = $(screenId);
    if (screen) screen.style.display = 'block';
  }
  
  function activateTab(tabId) {
    $$('.tab').forEach(t => t.classList.remove('active'));
    $$('.tab-pane').forEach(p => p.classList.add('hidden'));
    
    const tab = $(`[data-tab="${tabId}"]`);
    const pane = $(`#${tabId}`);
    
    if (tab) tab.classList.add('active');
    if (pane) pane.classList.remove('hidden');
  }
  
  // Configurar navegación por pestañas
  $$('.tab').forEach(tab => {
    tab.onclick = () => activateTab(tab.dataset.tab);
  });

  /* ═════════════════ Inicialización ══════════════ */
  function startApplication() {
    setupLoginForm();
    $('#logoutBtn').onclick = $('#logoutVecino').onclick = appState.logout;
    showScreen('#login');
    
    // Verificar si hay una sesión activa (para F5)
    if (storage.get('currentSession')) {
      const session = storage.get('currentSession');
      const users = storage.get('users');
      const account = users.find(u => u.user === session.user);
      
      if (account) {
        appState.login(account);
      }
    }
  }
  
  startApplication();
}

// Polyfill para navegadores antiguos
if (!String.prototype.includes) {
  String.prototype.includes = function(search, start) {
    if (typeof start !== 'number') {
      start = 0;
    }
    if (start + search.length > this.length) {
      return false;
    } else {
      return this.indexOf(search, start) !== -1;
    }
  };
}
