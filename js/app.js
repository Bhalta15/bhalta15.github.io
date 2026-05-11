// ===== FIREBASE =====
import { db, auth } from "./firebase.js";
import {
  onAuthStateChanged,
  signOut,
  browserLocalPersistence,
  setPersistence
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  doc, getDoc, setDoc, collection, addDoc, updateDoc, deleteDoc, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { mostrarToast } from "./toast.js";

// ===== ONESIGNAL APP ID =====
const ONESIGNAL_APP_ID = "1c802966-0ba1-4c4b-8b5b-7e0d8074f499";

// ===== ESTADO GLOBAL =====
let codigoPareja   = null;
let miUid          = null;
let miGenero       = null;
let unsubscribe    = null;
let gruposAbiertos = {};
let datosGlobal    = [];
let seccionActiva  = "inicio";
let idsConocidos   = null;

// ===== MODO POR SECCIÓN =====
const modoSeccion   = { mensaje: null, foto: null, cancion: null, frase: null };
const seleccionados = { mensaje: new Set(), foto: new Set(), cancion: new Set(), frase: new Set() };

// ===== MODO PLANES =====
let modoPlan = null;
const seleccionadosPlan = new Set();

// ===== CORAZONES MENÚ =====
function mostrarCorazon(tipo) {
  localStorage.setItem(`heart-${tipo}`, 'true');
  const el = document.getElementById(`heart-${tipo}`);
  if (el) el.classList.remove('hidden');
}
function quitarCorazon(tipo) {
  localStorage.removeItem(`heart-${tipo}`);
  const el = document.getElementById(`heart-${tipo}`);
  if (el) el.classList.add('hidden');
}
function cargarCorazonesGuardados() {
  ['mensaje', 'foto', 'cancion', 'frase', 'plan'].forEach(tipo => {
    if (localStorage.getItem(`heart-${tipo}`) === 'true') mostrarCorazon(tipo);
  });
}

// ===== LÓGICA: quitar corazón tras eliminar si ya no hay nuevos de pareja =====
function actualizarCorazonTrasEliminar(tipo) {
  const ultimaVisita = parseInt(localStorage.getItem('ultimaVisita') || '0');
  const hayNuevosDePareja = datosGlobal.some(d => {
    if (d.tipo !== tipo || d.autorUid === miUid) return false;
    const fecha = d.fecha?.toDate ? d.fecha.toDate() : new Date(d.fecha || 0);
    return fecha.getTime() > ultimaVisita;
  });
  if (!hayNuevosDePareja) quitarCorazon(tipo);
}

function actualizarCorazonTrasEliminarPlanes() {
  const ultimaVisita = parseInt(localStorage.getItem('ultimaVisita') || '0');
  const hayNuevosDePareja = (renderPlanes._datos || []).some(d => {
    if (d.autorUid === miUid) return false;
    const fecha = d.fecha?.toDate ? d.fecha.toDate() : new Date(d.fecha || 0);
    return fecha.getTime() > ultimaVisita;
  });
  if (!hayNuevosDePareja) quitarCorazon('plan');
}

// ===== TÍTULOS =====
const titulosNuevo  = { mensaje: "Nuevo mensaje", foto: "Nueva foto", cancion: "Nueva canción", frase: "Nueva frase" };
const titulosEditar = { mensaje: "Editar mensaje", foto: "Reemplazar foto", cancion: "Editar canción", frase: "Editar frase" };

// ===== ELEMENTOS =====
const menuBtn           = document.getElementById('menuBtn');
const sideMenu          = document.getElementById('sideMenu');
const overlay           = document.getElementById('overlay');
const modal             = document.getElementById('modal');
const modalNuevoTitulo  = document.getElementById('modalNuevoTitulo');
const inputTexto        = document.getElementById('inputTexto');
const inputCancionDiv   = document.getElementById('inputCancionDiv');
const inputDescCancion  = document.getElementById('inputDescCancion');
const inputLinkCancion  = document.getElementById('inputLinkCancion');
const inputFile         = document.getElementById('inputFile');
const previewImagen     = document.getElementById('previewImagen');
const cancelar          = document.getElementById('cancelar');
const guardar           = document.getElementById('guardar');
const modalFoto         = document.getElementById('modalFoto');
const imagenGrande      = document.getElementById('imagenGrande');
const btnDescargar      = document.getElementById('btnDescargar');
const btnCerrarFoto     = document.getElementById('btnCerrarFoto');
const modalEditar       = document.getElementById('modalEditar');
const modalEditarTitulo = document.getElementById('modalEditarTitulo');
const editTexto         = document.getElementById('editTexto');
const editCancionDiv    = document.getElementById('editCancionDiv');
const editDescCancion   = document.getElementById('editDescCancion');
const editLinkCancion   = document.getElementById('editLinkCancion');
const editFile          = document.getElementById('editFile');
const editPreviewImagen = document.getElementById('editPreviewImagen');
const cancelarEditar    = document.getElementById('cancelarEditar');
const guardarEditar     = document.getElementById('guardarEditar');
const modalEliminar     = document.getElementById('modalEliminar');
const cancelarEliminar  = document.getElementById('cancelarEliminar');
const aceptarEliminar   = document.getElementById('aceptarEliminar');
const fotoPerfilHeader  = document.getElementById('fotoPerfilHeader');
const btnPerfil         = document.getElementById('btnPerfil');

// ===== SVGs REUTILIZABLES =====
const lapizSVG = `<svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
  <path stroke-linecap="round" stroke-linejoin="round" d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
  <path stroke-linecap="round" stroke-linejoin="round" d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
</svg>`;

const basureroSVG = `<svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
  <polyline points="3 6 5 6 21 6"/>
  <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
  <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
</svg>`;

// ===== ONESIGNAL =====
async function iniciarOneSignal() {
  try {
    await OneSignal.init({
      appId: ONESIGNAL_APP_ID,
      serviceWorkerPath: "/OneSignalSDKWorker.js",
      serviceWorkerParam: { scope: "/" },
      notifyButton: { enable: false },
      allowLocalhostAsSecureOrigin: true
    });
    const permission = await OneSignal.Notifications.requestPermission();
    if (!permission) return;
    const playerId = await OneSignal.User.PushSubscription.id;
    if (playerId && miUid && codigoPareja) {
      await setDoc(doc(db, "usuarios", miUid), { oneSignalId: playerId }, { merge: true });
    }
    if (OneSignal.Notifications.clearAll) {
      await OneSignal.Notifications.clearAll();
    }
  } catch (e) { console.error("OneSignal error:", e); }
}

// ===== NOTIFICACIÓN A LA PAREJA =====
// esEliminacion = true → manda noti de "eliminó su X"
async function notificarPareja(tipo, contenidoRaw = "", esEdicion = false, esEliminacion = false) {
  try {
    const parejaSnap = await getDoc(doc(db, "parejas", codigoPareja));
    if (!parejaSnap.exists()) return;
    const miembros = parejaSnap.data()?.usuarios || [];
    const uidPareja = miembros.find(uid => uid !== miUid);
    if (!uidPareja) return;
    const parejaUserSnap = await getDoc(doc(db, "usuarios", uidPareja));
    if (!parejaUserSnap.exists()) return;
    const oneSignalId = parejaUserSnap.data()?.oneSignalId;
    if (!oneSignalId) return;
    const apodoQueEllaTieneParaMi = parejaUserSnap.data()?.apodoPareja || "";
    const miNombre = document.getElementById("userName").textContent;
    const nombreEnNoti = apodoQueEllaTieneParaMi || miNombre;

    let preview = "";
    // Al eliminar no enviamos preview
    if (!esEliminacion) {
      if (tipo === "mensaje" || tipo === "frase") {
        preview = contenidoRaw.length > 50 ? contenidoRaw.substring(0, 50) + "..." : contenidoRaw;
      } else if (tipo === "cancion") {
        try { const p = JSON.parse(contenidoRaw); preview = (p.desc || "").substring(0, 50); } catch {}
      }
    }

    await fetch("https://daily-love-server.onrender.com/notificar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ oneSignalId, tipo, nombreUsuario: nombreEnNoti, preview, esEdicion, esEliminacion })
    });
  } catch (e) { console.error("Error notificación:", e); }
}

// Notifica eliminación solo si los ítems eliminados eran míos
async function notificarEliminacionSiCorresponde(tipo, itemsEliminados) {
  const miosEliminados = itemsEliminados.filter(i => i.autorUid === miUid);
  if (miosEliminados.length === 0) return;
  const tipoNoti = miosEliminados[0].tipo;
  await notificarPareja(tipoNoti, "", false, true);
}

// ===== TOAST IN-APP =====
const mensajesInApp = { mensaje: "nuevo mensaje", foto: "nueva foto", cancion: "nueva canción", frase: "nueva frase" };
let apodoDePareja = "";

async function cargarApodoPareja() {
  if (!miUid) return;
  try {
    const snap = await getDoc(doc(db, "usuarios", miUid));
    if (snap.exists()) apodoDePareja = snap.data().apodoPareja || "";
  } catch { apodoDePareja = ""; }
}

async function mostrarToastInApp(tipo, nombreUsuarioPareja) {
  if (!apodoDePareja) await cargarApodoPareja();
  const quien = apodoDePareja || nombreUsuarioPareja || "Tu pareja";
  mostrarToast(`${quien}: ${mensajesInApp[tipo] || "algo nuevo 💕"}`, "info");
}

// ===== TOAST CON DESHACER =====
let deshacerTimeout = null;
let deshacerDatos   = null;

function mostrarToastDeshacer(tipo, items) {
  if (deshacerTimeout) {
    clearTimeout(deshacerTimeout);
    deshacerTimeout = null;
    if (deshacerDatos) {
      _ejecutarCommit(deshacerDatos);
    }
  }
  deshacerDatos = { tipo, items };

  let toastEl = document.getElementById('toast-deshacer');
  if (!toastEl) {
    toastEl = document.createElement('div');
    toastEl.id = 'toast-deshacer';
    toastEl.style.cssText = [
      'position:fixed',
      'bottom:24px',
      'left:50%',
      'transform:translateX(-50%)',
      'z-index:999',
      'display:none',
      'align-items:center',
      'gap:12px',
      'background:#ede9fe',
      'color:#6d28d9',
      'font-size:14px',
      'padding:12px 20px',
      'border-radius:16px',
      'box-shadow:0 8px 24px rgba(124,58,237,0.2)',
      'border:2px solid #7c3aed',
      'white-space:nowrap'
    ].join(';');
    document.body.appendChild(toastEl);
  }

  const n = items.length;
  toastEl.innerHTML = `
    <span style="font-weight:500;color:#6d28d9;">${n > 1 ? `${n} elementos eliminados` : 'Eliminado'}</span>
    <button id="btn-deshacer" style="font-weight:700;color:#7c3aed;text-decoration:underline;background:none;border:none;cursor:pointer;padding:0;">Deshacer</button>`;

  toastEl.style.display = 'flex';
  toastEl.classList.remove('slide-down');
  toastEl.classList.add('slide-up');

  document.getElementById('btn-deshacer').onclick = () => {
    if (deshacerTimeout) {
      clearTimeout(deshacerTimeout);
      deshacerTimeout = null;
    }

    const itemsRestaurar = deshacerDatos?.items || [];
    const tipoRestaurar  = deshacerDatos?.tipo;
    deshacerDatos = null;

    _ocultarToastDeshacer(toastEl);

    if (tipoRestaurar === 'plan') {
      if (!renderPlanes._datos) renderPlanes._datos = [];
      renderPlanes._datos = [...renderPlanes._datos, ...itemsRestaurar].sort((a, b) => {
        const fa = a.fecha?.toDate ? a.fecha.toDate() : new Date(a.fecha || 0);
        const fb = b.fecha?.toDate ? b.fecha.toDate() : new Date(b.fecha || 0);
        return fb - fa;
      });
      _renderPlanesHTML();
      // Re-evaluar corazón de plan tras restaurar
      actualizarCorazonTrasEliminarPlanes();
      const ultimaVisitaP = parseInt(localStorage.getItem('ultimaVisita') || '0');
      const hayNuevosPlan = (renderPlanes._datos || []).some(d => {
        if (d.autorUid === miUid) return false;
        const f = d.fecha?.toDate ? d.fecha.toDate() : new Date(d.fecha || 0);
        return f.getTime() > ultimaVisitaP;
      });
      if (hayNuevosPlan) mostrarCorazon('plan');
    } else {
      datosGlobal = [...datosGlobal, ...itemsRestaurar].sort((a, b) => {
        const fa = a.fecha?.toDate ? a.fecha.toDate() : new Date(a.fecha);
        const fb = b.fecha?.toDate ? b.fecha.toDate() : new Date(b.fecha);
        return fb - fa;
      });
      if (tipoRestaurar) rerenderSeccion(tipoRestaurar);
      renderInicio(datosGlobal);
      // Re-evaluar corazón del tipo restaurado
      const ultimaVisita = parseInt(localStorage.getItem('ultimaVisita') || '0');
      const hayNuevos = datosGlobal.some(d => {
        if (d.tipo !== tipoRestaurar || d.autorUid === miUid) return false;
        const f = d.fecha?.toDate ? d.fecha.toDate() : new Date(d.fecha || 0);
        return f.getTime() > ultimaVisita;
      });
      if (hayNuevos) mostrarCorazon(tipoRestaurar);
    }
    mostrarToast('¡Restaurado!', 'exito');
  };

  deshacerTimeout = setTimeout(async () => {
    deshacerTimeout = null;
    _ocultarToastDeshacer(toastEl);
    if (deshacerDatos) {
      const datos = deshacerDatos;
      await _ejecutarCommit(datos);
      deshacerDatos = null;
    }
  }, 4000);
}

async function _ejecutarCommit(datos) {
  if (datos.tipo === 'plan') {
    await commitEliminarPlanes(datos);
  } else {
    await commitEliminar(datos);
  }
}

function _ocultarToastDeshacer(toastEl) {
  if (!toastEl || toastEl.style.display === 'none') return;
  toastEl.classList.remove('slide-up');
  toastEl.classList.add('slide-down');
  setTimeout(() => {
    toastEl.style.display = 'none';
    toastEl.classList.remove('slide-down');
  }, 320);
}

function ocultarToastDeshacerById() {
  const toastEl = document.getElementById('toast-deshacer');
  if (toastEl) _ocultarToastDeshacer(toastEl);
}

async function commitEliminar({ tipo, items }) {
  try {
    for (const item of items) {
      await deleteDoc(doc(db, "parejas", codigoPareja, "contenido", item.id));
    }
    await notificarEliminacionSiCorresponde(tipo, items);
    actualizarCorazonTrasEliminar(tipo);
  } catch (e) { console.error("Error eliminando:", e); mostrarToast("Error al eliminar", "error"); }
}

async function commitEliminarPlanes({ items }) {
  try {
    for (const item of items) {
      await deleteDoc(doc(db, 'parejas', codigoPareja, 'planes', item.id));
    }
    // Notificar a la pareja si eran planes/citas míos
    const mios = items.filter(i => i.autorUid === miUid);
    if (mios.length > 0) {
      await notificarPareja(mios[0].tab || 'plan', "", false, true);
    }
  } catch (e) { console.error("Error eliminando planes:", e); mostrarToast("Error al eliminar", "error"); }
}

// ===== SESIÓN =====
setPersistence(auth, browserLocalPersistence).then(() => {
  onAuthStateChanged(auth, async (user) => {
    if (!user) { window.location.href = "registro.html"; return; }
    try {
      const snap = await getDoc(doc(db, "usuarios", user.uid));
      if (snap.exists()) {
        const datos  = snap.data();
        miUid        = user.uid;
        miGenero     = datos.genero;
        codigoPareja = datos.codigo;
        if (!codigoPareja) { window.location.href = "registro.html"; return; }
        const el1 = document.getElementById("userName");
        const el2 = document.getElementById("userNameMain");
        if (el1) el1.textContent = datos.usuario;
        if (el2) el2.textContent = datos.usuario;
        if (fotoPerfilHeader) {
          fotoPerfilHeader.src = datos.foto || `https://ui-avatars.com/api/?name=${datos.usuario}&background=EC4899&color=fff`;
        }
        if (btnPerfil && !btnPerfil.dataset.listener) {
          btnPerfil.onclick = () => { window.location.href = "perfil.html"; };
          btnPerfil.dataset.listener = "true";
        }
        if (!sessionStorage.getItem("bienvenidaMostrada")) {
          const saludo = datos.genero === "mujer" ? "Bienvenida" : "Bienvenido";
          mostrarToast(`¡${saludo} ${datos.usuario}!`, "info");
          sessionStorage.setItem("bienvenidaMostrada", "1");
        }
        await cargarApodoPareja();
        iniciarTiempoReal();
        renderPlanes();
        cargarCorazonesGuardados();
        actualizarMenuActivo('inicio');
        if (typeof OneSignal !== "undefined") {
          await iniciarOneSignal();
        } else {
          window.OneSignalDeferred = window.OneSignalDeferred || [];
          window.OneSignalDeferred.push(async () => { await iniciarOneSignal(); });
        }
      } else { window.location.href = "registro.html"; }
    } catch (error) { console.error("Error cargando usuario:", error); }
  });
});

// ===== MENÚ LATERAL =====
menuBtn.onclick = () => {
  sideMenu.classList.remove('-translate-x-full');
  overlay.classList.remove('hidden');
};
overlay.onclick = () => cerrarMenu();

function cerrarMenu() {
  sideMenu.classList.add('-translate-x-full');
  overlay.classList.add('hidden');
}

function actualizarMenuActivo(seccion) {
  document.querySelectorAll('.itemMenu').forEach(btn => {
    btn.classList.remove('activo');
    if (btn.dataset.section === seccion) btn.classList.add('activo');
  });
}

// ===== RESETEAR MODO AL NAVEGAR =====
function resetearModoSeccion(tipo) {
  if (!modoSeccion[tipo]) return;
  modoSeccion[tipo] = null;
  seleccionados[tipo].clear();
  ocultarBarraFlotante(tipo);
  actualizarBotonesHeader(tipo);
  rerenderSeccion(tipo);
}

function resetearTodosModos() {
  if (deshacerTimeout) {
    clearTimeout(deshacerTimeout);
    deshacerTimeout = null;
  }
  if (deshacerDatos) {
    _ejecutarCommit(deshacerDatos);
    deshacerDatos = null;
  }
  ocultarToastDeshacerById();

  ['mensaje', 'foto', 'cancion', 'frase'].forEach(tipo => {
    modoSeccion[tipo] = null;
    seleccionados[tipo].clear();
    ocultarBarraFlotante(tipo);
    actualizarBotonesHeader(tipo);
  });
  resetearModoEditarPlanes();
}

document.querySelectorAll('.itemMenu').forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll('.section').forEach(s => s.classList.add('hidden'));
    const seccion = btn.dataset.section;
    document.getElementById(seccion).classList.remove('hidden');
    seccionActiva = seccion;
    actualizarMenuActivo(seccion);
    resetearTodosModos();
    const tipoMap = { mensajes: 'mensaje', fotos: 'foto', canciones: 'cancion', frases: 'frase', planes: 'plan', promesas: 'promesa' };
    if (tipoMap[seccion]) quitarCorazon(tipoMap[seccion]);
    if (seccion === 'planes') renderPlanes();
    if (seccion === 'promesas') renderPromesas();
    cerrarMenu();
  };
});

// ===== MENÚ DE TRES PUNTITOS =====
document.addEventListener('click', (e) => {
  if (!e.target.closest('.menu-puntitos-container')) {
    document.querySelectorAll('.menu-puntitos-dropdown').forEach(m => m.classList.add('hidden'));
  }
});

window.toggleMenuPuntitos = (tipo) => {
  const dropdown = document.getElementById(`dropdown-${tipo}`);
  document.querySelectorAll('.menu-puntitos-dropdown').forEach(m => {
    if (m.id !== `dropdown-${tipo}`) m.classList.add('hidden');
  });
  dropdown.classList.toggle('hidden');
};

window.elegirModo = (tipo, modo) => {
  document.getElementById(`dropdown-${tipo}`)?.classList.add('hidden');

  if (modoSeccion[tipo] === modo) {
    resetearModoSeccion(tipo);
    rerenderSeccion(tipo);
    return;
  }

  modoSeccion[tipo] = modo;
  seleccionados[tipo].clear();
  actualizarBotonesHeader(tipo);
  rerenderSeccion(tipo);

  if (modo === 'eliminar') mostrarBarraFlotante(tipo);
  else ocultarBarraFlotante(tipo);
};

window.cancelarModo = (tipo) => {
  if (deshacerTimeout && deshacerDatos?.tipo === tipo) {
    clearTimeout(deshacerTimeout);
    deshacerTimeout = null;
    const datos = deshacerDatos;
    deshacerDatos = null;
    ocultarToastDeshacerById();
    _ejecutarCommit(datos);
  }
  modoSeccion[tipo] = null;
  seleccionados[tipo].clear();
  ocultarBarraFlotante(tipo);
  actualizarBotonesHeader(tipo);
  rerenderSeccion(tipo);
};

// ===== MODO EXTRAS (PLANES/CITAS) =====
window.elegirModoPlan = (modo) => {
  document.getElementById('dropdown-plan')?.classList.add('hidden');

  if (modoPlan === modo) {
    resetearModoEditarPlanes();
    return;
  }

  modoPlan = modo;
  seleccionadosPlan.clear();
  _actualizarBotonesHeaderPlan();
  _renderPlanesHTML();

  if (modo === 'eliminar') mostrarBarraFlotantePlan();
  else ocultarBarraFlotantePlan();
};

window.cancelarModoPlan = () => {
  resetearModoEditarPlanes();
};

function _actualizarBotonesHeaderPlan() {
  const btnNuevo    = document.getElementById('btnNuevoPlan');
  const btnPuntitos = document.getElementById('btnPuntitosPlan');
  const btnCancelar = document.getElementById('btnCancelarPlan');
  const enModo = modoPlan !== null;
  if (btnNuevo)    btnNuevo.classList.toggle('hidden', enModo);
  if (btnPuntitos) btnPuntitos.classList.toggle('hidden', enModo);
  if (btnCancelar) btnCancelar.classList.toggle('hidden', !enModo);
}

function mostrarBarraFlotantePlan() {
  let barra = document.getElementById('barra-plan');
  if (!barra) {
    barra = document.createElement('div');
    barra.id = 'barra-plan';
    barra.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:50;display:flex;align-items:center;gap:12px;background:#ede9fe;border:2px solid #7c3aed;border-radius:16px;padding:10px 20px;box-shadow:0 8px 24px rgba(124,58,237,0.2);white-space:nowrap;';
    document.body.appendChild(barra);
  }
  _actualizarBarraFlotantePlan();
  barra.style.display = 'flex';
  barra.classList.remove('hidden', 'slide-down');
  barra.classList.add('slide-up');
}

function ocultarBarraFlotantePlan() {
  const barra = document.getElementById('barra-plan');
  if (!barra) return;
  if (barra.style.display === 'none' && barra.classList.contains('hidden')) return;
  barra.classList.remove('slide-up');
  barra.classList.add('slide-down');
  setTimeout(() => {
    barra.style.display = 'none';
    barra.classList.add('hidden');
    barra.classList.remove('slide-down');
  }, 320);
}

function _actualizarBarraFlotantePlan() {
  const barra = document.getElementById('barra-plan');
  if (!barra) return;
  const n = seleccionadosPlan.size;
  barra.innerHTML = `
    <span style="font-size:14px;color:#6d28d9;font-weight:500;">${n} seleccionado${n !== 1 ? 's' : ''}</span>
    <button onclick="solicitarEliminarPlanes()"
      style="display:flex;align-items:center;gap:6px;padding:6px 14px;border-radius:10px;font-size:14px;font-weight:600;border:none;cursor:${n > 0 ? 'pointer' : 'not-allowed'};background:${n > 0 ? '#7c3aed' : '#ddd6fe'};color:${n > 0 ? 'white' : '#a78bfa'};">
      ${basureroSVG} Eliminar${n > 0 ? ` (${n})` : ''}
    </button>`;
}

window.solicitarEliminarPlanes = () => {
  const n = seleccionadosPlan.size;
  if (n === 0) return;

  const textoModal = document.querySelector('#modalEliminar p');
  if (textoModal) textoModal.textContent = `¿Eliminar ${n} ${n !== 1 ? 'elementos seleccionados' : 'elemento seleccionado'}?`;

  modalEliminar.classList.remove('hidden');
  modalEliminar.classList.add('flex');

  const btnAceptar  = document.getElementById('aceptarEliminar');
  const btnCancelar = document.getElementById('cancelarEliminar');
  const nuevoAceptar  = btnAceptar.cloneNode(true);
  const nuevoCancelar = btnCancelar.cloneNode(true);
  btnAceptar.replaceWith(nuevoAceptar);
  btnCancelar.replaceWith(nuevoCancelar);

  nuevoCancelar.onclick = () => {
    modalEliminar.classList.add('hidden');
    modalEliminar.classList.remove('flex');
  };

  nuevoAceptar.onclick = async () => {
    modalEliminar.classList.add('hidden');
    modalEliminar.classList.remove('flex');
    const ids = [...seleccionadosPlan];
    const itemsEliminados = (renderPlanes._datos || []).filter(d => ids.includes(d.id));

    seleccionadosPlan.clear();
    if (renderPlanes._datos) {
      renderPlanes._datos = renderPlanes._datos.filter(d => !ids.includes(d.id));
    }

    // Actualizar corazón de plan ANTES del toast deshacer
    actualizarCorazonTrasEliminarPlanes();

    modoPlan = null;
    ocultarBarraFlotantePlan();
    _actualizarBotonesHeaderPlan();
    _renderPlanesHTML();

    mostrarToastDeshacer('plan', itemsEliminados);
  };
};

// ===== ACTUALIZAR HEADER =====
function actualizarBotonesHeader(tipo) {
  const btnNuevo    = document.getElementById(`btnNuevo${capitalizar(tipo)}`);
  const btnPuntitos = document.getElementById(`btnPuntitos${capitalizar(tipo)}`);
  const btnCancelar = document.getElementById(`btnCancelar${capitalizar(tipo)}`);
  const enModo = modoSeccion[tipo] !== null;
  if (btnNuevo)    btnNuevo.classList.toggle('hidden', enModo);
  if (btnPuntitos) btnPuntitos.classList.toggle('hidden', enModo);
  if (btnCancelar) btnCancelar.classList.toggle('hidden', !enModo);
}

// ===== BARRA FLOTANTE (modo eliminar contenido) =====
function mostrarBarraFlotante(tipo) {
  let barra = document.getElementById(`barra-${tipo}`);
  if (!barra) {
    barra = document.createElement('div');
    barra.id = `barra-${tipo}`;
    barra.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:50;display:flex;align-items:center;gap:12px;background:#ede9fe;border:2px solid #7c3aed;border-radius:16px;padding:10px 20px;box-shadow:0 8px 24px rgba(124,58,237,0.2);white-space:nowrap;';
    document.body.appendChild(barra);
  }
  actualizarBarraFlotante(tipo);
  barra.style.display = 'flex';
  barra.classList.remove('hidden', 'slide-down');
  barra.classList.add('slide-up');
}

function ocultarBarraFlotante(tipo) {
  const barra = document.getElementById(`barra-${tipo}`);
  if (!barra) return;
  if (barra.style.display === 'none' && barra.classList.contains('hidden')) return;
  barra.classList.remove('slide-up');
  barra.classList.add('slide-down');
  setTimeout(() => {
    barra.style.display = 'none';
    barra.classList.add('hidden');
    barra.classList.remove('slide-down');
  }, 320);
}

function actualizarBarraFlotante(tipo) {
  const barra = document.getElementById(`barra-${tipo}`);
  if (!barra) return;
  const n = seleccionados[tipo].size;
  barra.innerHTML = `
    <span style="font-size:14px;color:#6d28d9;font-weight:500;">${n} seleccionado${n !== 1 ? 's' : ''}</span>
    <button onclick="solicitarEliminarSeleccionados('${tipo}')"
      style="display:flex;align-items:center;gap:6px;padding:6px 14px;border-radius:10px;font-size:14px;font-weight:600;border:none;cursor:${n > 0 ? 'pointer' : 'not-allowed'};background:${n > 0 ? '#7c3aed' : '#ddd6fe'};color:${n > 0 ? 'white' : '#a78bfa'};">
      ${basureroSVG} Eliminar${n > 0 ? ` (${n})` : ''}
    </button>`;
}

// ===== SOLICITAR ELIMINAR SELECCIONADOS =====
window.solicitarEliminarSeleccionados = (tipo) => {
  const n = seleccionados[tipo].size;
  if (n === 0) return;

  const textoModal = document.querySelector('#modalEliminar p');
  if (textoModal) textoModal.textContent = `¿Eliminar ${n} elemento${n !== 1 ? 's' : ''} seleccionado${n !== 1 ? 's' : ''}?`;

  modalEliminar.classList.remove('hidden');
  modalEliminar.classList.add('flex');

  const btnAceptar  = document.getElementById('aceptarEliminar');
  const btnCancelar = document.getElementById('cancelarEliminar');
  const nuevoAceptar  = btnAceptar.cloneNode(true);
  const nuevoCancelar = btnCancelar.cloneNode(true);
  btnAceptar.replaceWith(nuevoAceptar);
  btnCancelar.replaceWith(nuevoCancelar);

  nuevoCancelar.onclick = () => {
    modalEliminar.classList.add('hidden');
    modalEliminar.classList.remove('flex');
  };

  nuevoAceptar.onclick = async () => {
    modalEliminar.classList.add('hidden');
    modalEliminar.classList.remove('flex');

    const ids   = [...seleccionados[tipo]];
    const items = datosGlobal.filter(d => ids.includes(d.id));

    seleccionados[tipo].clear();
    datosGlobal = datosGlobal.filter(d => !ids.includes(d.id));

    // Actualizar corazón ANTES del toast deshacer
    actualizarCorazonTrasEliminar(tipo);

    modoSeccion[tipo] = null;
    ocultarBarraFlotante(tipo);
    actualizarBotonesHeader(tipo);
    rerenderSeccion(tipo);

    mostrarToastDeshacer(tipo, items);
  };
};

// ===== MODAL NUEVO =====
let tipoActual = "";

window.abrirModal = (tipo) => {
  tipoActual = tipo;
  inputTexto.classList.add('hidden');
  inputCancionDiv.classList.add('hidden');
  inputFile.classList.add('hidden');
  previewImagen.classList.add('hidden');
  inputTexto.value = "";
  inputDescCancion.value = "";
  inputLinkCancion.value = "";
  inputFile.value = "";
  if (modalNuevoTitulo) modalNuevoTitulo.textContent = titulosNuevo[tipo] || "Nuevo contenido";
  if (tipo === "mensaje" || tipo === "frase") inputTexto.classList.remove('hidden');
  else if (tipo === "cancion") inputCancionDiv.classList.remove('hidden');
  else if (tipo === "foto") inputFile.classList.remove('hidden');
  modal.classList.remove('hidden');
  modal.classList.add('flex');
  setTimeout(() => { modal.classList.remove('opacity-0'); modal.classList.add('opacity-100'); }, 10);
};

function cerrarModal() {
  modal.classList.remove('opacity-100');
  modal.classList.add('opacity-0');
  setTimeout(() => { modal.classList.add('hidden'); modal.classList.remove('flex'); }, 300);
}
cancelar.onclick = cerrarModal;

// ===== MODAL FOTO GRANDE =====
function abrirFoto(src) {
  imagenGrande.src = src;
  btnDescargar.href = src;
  modalFoto.classList.remove('hidden');
  modalFoto.classList.add('flex');
}
btnCerrarFoto.onclick = () => { modalFoto.classList.add('hidden'); modalFoto.classList.remove('flex'); };

// ===== COMPRESIÓN =====
function comprimirImagen(file) {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.src = e.target.result;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const max = 800;
        let w = img.width, h = img.height;
        if (w > h && w > max) { h *= max / w; w = max; }
        else if (h > max) { w *= max / h; h = max; }
        canvas.width = w; canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.7));
      };
    };
    reader.readAsDataURL(file);
  });
}

inputFile.addEventListener("change", async () => {
  const f = inputFile.files[0];
  if (f) { previewImagen.src = await comprimirImagen(f); previewImagen.classList.remove("hidden"); }
});
editFile.addEventListener("change", async () => {
  const f = editFile.files[0];
  if (f) { editPreviewImagen.src = await comprimirImagen(f); editPreviewImagen.classList.remove("hidden"); }
});

// ===== GUARDAR NUEVO =====
guardar.onclick = async () => {
  let contenido = "";
  if (tipoActual === "mensaje" || tipoActual === "frase") {
    contenido = inputTexto.value.trim();
    if (!contenido) return mostrarToast("Escribe algo primero", "error");
  } else if (tipoActual === "cancion") {
    const desc = inputDescCancion.value.trim();
    const link = inputLinkCancion.value.trim();
    if (!desc) return mostrarToast("Escribe una dedicatoria", "error");
    if (!link) return mostrarToast("Pega el link de la canción", "error");
    contenido = JSON.stringify({ desc, link });
  } else if (tipoActual === "foto") {
    const archivo = inputFile.files[0];
    if (!archivo) return mostrarToast("Selecciona una imagen", "error");
    contenido = await comprimirImagen(archivo);
  }
  if (!codigoPareja) return mostrarToast("No se encontró tu código de pareja", "error");
  try {
    await addDoc(collection(db, "parejas", codigoPareja, "contenido"), {
      tipo: tipoActual, contenido, fecha: new Date(), autorUid: miUid, autorGenero: miGenero, reaccion: null
    });
    mostrarToast("¡Enviado!", "exito");
    cerrarModal();
    await notificarPareja(tipoActual, contenido);
  } catch (error) {
    mostrarToast("Tu pareja aún no se ha registrado, intenta más tarde", "info");
    console.error(error);
  }
};

// ===== MODAL EDITAR =====
function abrirModalEditar(d) {
  editTexto.classList.add('hidden');
  editCancionDiv.classList.add('hidden');
  editFile.classList.add('hidden');
  editPreviewImagen.classList.add('hidden');
  editTexto.value = "";
  editDescCancion.value = "";
  editLinkCancion.value = "";
  editFile.value = "";
  modalEditarTitulo.textContent = titulosEditar[d.tipo] || "Editar";
  if (d.tipo === "mensaje" || d.tipo === "frase") {
    editTexto.classList.remove('hidden');
    editTexto.value = d.contenido;
  } else if (d.tipo === "cancion") {
    editCancionDiv.classList.remove('hidden');
    try { const p = JSON.parse(d.contenido); editDescCancion.value = p.desc || ""; editLinkCancion.value = p.link || ""; }
    catch { editLinkCancion.value = d.contenido; }
  } else if (d.tipo === "foto") {
    editFile.classList.remove('hidden');
  }
  modalEditar._docActual = d;
  modalEditar.classList.remove('hidden');
  modalEditar.classList.add('flex');
  setTimeout(() => { modalEditar.classList.remove('opacity-0'); modalEditar.classList.add('opacity-100'); }, 10);
}

function cerrarModalEditar() {
  modalEditar.classList.remove('opacity-100');
  modalEditar.classList.add('opacity-0');
  setTimeout(() => { modalEditar.classList.add('hidden'); modalEditar.classList.remove('flex'); }, 300);
}
cancelarEditar.onclick = cerrarModalEditar;

guardarEditar.onclick = async () => {
  const d = modalEditar._docActual;
  if (!d) return;
  let nuevoContenido = "";
  if (d.tipo === "mensaje" || d.tipo === "frase") {
    nuevoContenido = editTexto.value.trim();
    if (!nuevoContenido) return mostrarToast("Escribe algo", "error");
  } else if (d.tipo === "cancion") {
    const desc = editDescCancion.value.trim();
    const link = editLinkCancion.value.trim();
    if (!desc) return mostrarToast("Escribe la descripción", "error");
    if (!link) return mostrarToast("Escribe el link", "error");
    nuevoContenido = JSON.stringify({ desc, link });
  } else if (d.tipo === "foto") {
    const archivo = editFile.files[0];
    if (!archivo) return mostrarToast("Selecciona una imagen", "error");
    nuevoContenido = await comprimirImagen(archivo);
  }
  try {
    await updateDoc(doc(db, "parejas", codigoPareja, "contenido", d.id), { contenido: nuevoContenido });
    mostrarToast(d.tipo === "foto" ? "¡Foto reemplazada!" : "¡Editado!", "exito");
    cerrarModalEditar();
    await notificarPareja(d.tipo, nuevoContenido, true);
  } catch (error) { mostrarToast("Error al guardar", "error"); console.error(error); }
};

// ===== REACCIONAR (doble tap) =====
async function toggleReaccion(d) {
  if (d.autorUid === miUid) { mostrarToast("No puedes reaccionar a tu propio contenido", "info"); return; }
  const ref = doc(db, "parejas", codigoPareja, "contenido", d.id);
  await updateDoc(ref, { reaccion: d.reaccion === miGenero ? null : miGenero });
}

function agregarDobleTap(el, d) {
  let lastTap = 0;
  const handler = (e) => {
    if (e.target.closest('.btn-ver-foto')) return;
    const now = Date.now();
    if (now - lastTap < 300) { lastTap = 0; if (d.autorUid !== miUid) toggleReaccion(d); }
    else lastTap = now;
  };
  el.addEventListener("touchend", handler, { passive: true });
  el.addEventListener("dblclick", handler);
}

// ===== HELPERS =====
function capitalizar(str) { return str.charAt(0).toUpperCase() + str.slice(1); }

function rerenderSeccion(tipo) {
  renderPorFecha(tipo, datosGlobal.filter(d => d.tipo === tipo));
}

function borderPorGenero(genero) {
  return genero === "hombre" ? "border-2 border-blue-300" : "border-2 border-pink-300";
}

function heartSVG(d) {
  if (!d.reaccion) return "";
  const color = d.reaccion === "hombre" ? "#93c5fd" : "#f9a8d4";
  return `<span class="absolute top-2 right-2 pointer-events-none">
    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24"
      fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
    </svg></span>`;
}

function ojitaSVG() {
  return `<button class="btn-ver-foto absolute bottom-2 right-2 w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center shadow-md hover:bg-purple-700 transition">
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
      fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg></button>`;
}

// ===== CREAR CARD HTML =====
function crearCardHTML(d, modo) {
  const borde   = borderPorGenero(d.autorGenero);
  const corazon = heartSVG(d);
  const esMio   = d.autorUid === miUid;

  if (modo === 'eliminar') {
    const opAjena      = !esMio ? 'opacity-40' : '';
    const seleccionado = seleccionados[d.tipo]?.has(d.id);
    const checkClass   = seleccionado ? 'bg-purple-500 border-purple-500' : 'bg-white border-gray-300';

    const checkHTML = esMio
      ? `<div class="checkbox-card absolute top-3 left-3 w-6 h-6 rounded-full border-2 flex items-center justify-center transition ${checkClass}">
          ${seleccionado ? `<svg xmlns="http://www.w3.org/2000/svg" class="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>` : ''}
        </div>` : '';

    if (d.tipo === "mensaje" || d.tipo === "frase") {
      return `<div data-id="${d.id}" data-tipo="${d.tipo}" data-selectable="${esMio}"
        class="bg-white shadow-lg rounded-xl p-5 pl-12 ${borde} relative transition-all duration-300 select-none ${opAjena} ${esMio ? 'cursor-pointer' : ''}">
        ${checkHTML}<p class="text-gray-700 text-lg break-words pr-8">"${d.contenido}"</p>${corazon}</div>`;
    }
    if (d.tipo === "foto") {
      return `<div data-id="${d.id}" data-tipo="${d.tipo}" data-selectable="${esMio}"
        class="bg-white shadow-lg rounded-xl p-3 pl-12 ${borde} relative transition-all duration-300 select-none ${opAjena} ${esMio ? 'cursor-pointer' : ''}">
        ${checkHTML}<div class="w-full h-48 overflow-hidden rounded-lg"><img src="${d.contenido}" alt="Foto" class="w-full h-full object-cover"></div>${corazon}</div>`;
    }
    if (d.tipo === "cancion") {
      let desc = "", link = "";
      try { const p = JSON.parse(d.contenido); desc = p.desc; link = p.link; } catch { link = d.contenido; }
      return `<div data-id="${d.id}" data-tipo="${d.tipo}" data-selectable="${esMio}"
        class="bg-white shadow-lg rounded-xl p-5 pl-12 ${borde} relative transition-all duration-300 select-none ${opAjena} ${esMio ? 'cursor-pointer' : ''}">
        ${checkHTML}${desc ? `<p class="text-gray-700 text-base mb-3 break-words">"${desc}"</p>` : ""}
        <div class="flex items-center justify-between">
          <span class="text-gray-400 text-sm truncate max-w-[70%]">${link}</span>
          <span class="ml-2 px-3 py-1.5 bg-gray-200 text-gray-400 text-sm rounded-lg whitespace-nowrap cursor-not-allowed">Escuchar ▶</span>
        </div>${corazon}</div>`;
    }
  }

  if (modo === 'editar') {
  const opAjena      = !esMio ? 'opacity-40' : '';
  const cursorEditar = esMio ? 'cursor-pointer hover:border-purple-400' : '';

  // Iconito abajo derecha
  const iconEditar = esMio
    ? `<span class="absolute bottom-3 right-3 text-purple-400">
         ${lapizSVG}
       </span>`
    : '';

  if (d.tipo === "mensaje" || d.tipo === "frase") {
    return `<div data-id="${d.id}" data-editar="${esMio}"
      class="bg-white shadow-lg rounded-xl p-5 ${borde} relative transition-all duration-300 select-none ${opAjena} ${cursorEditar}">
      <p class="text-gray-700 text-lg break-words pr-8">"${d.contenido}"</p>
      ${corazon}
      ${iconEditar}
    </div>`;
  }

  if (d.tipo === "foto") {
    return `<div data-id="${d.id}" data-editar="${esMio}"
      class="bg-white shadow-lg rounded-xl p-3 ${borde} relative transition-all duration-300 select-none ${opAjena} ${cursorEditar}">
      <div class="w-full h-48 overflow-hidden rounded-lg">
        <img src="${d.contenido}" alt="Foto" class="w-full h-full object-cover">
      </div>
      ${corazon}
      ${iconEditar}
    </div>`;
  }

  if (d.tipo === "cancion") {
    let desc = "", link = "";

    try {
      const p = JSON.parse(d.contenido);
      desc = p.desc;
      link = p.link;
    } catch {
      link = d.contenido;
    }

    return `<div data-id="${d.id}" data-editar="${esMio}"
      class="bg-white shadow-lg rounded-xl p-5 ${borde} relative transition-all duration-300 select-none ${opAjena} ${cursorEditar}">
      
      ${desc ? `<p class="text-gray-700 text-base mb-3 break-words">"${desc}"</p>` : ""}

      <div class="flex items-center justify-between">
        <span class="text-gray-400 text-sm truncate max-w-[70%]">${link}</span>
        <span class="ml-2 px-3 py-1.5 bg-gray-200 text-gray-400 text-sm rounded-lg whitespace-nowrap cursor-not-allowed">
          Escuchar ▶
        </span>
      </div>

      ${corazon}
      ${iconEditar}
    </div>`;
  }
}

  // Modo normal
  if (d.tipo === "mensaje" || d.tipo === "frase") {
    return `<div data-id="${d.id}"
      class="bg-white shadow-lg rounded-xl p-5 ${borde} relative transition-all duration-300 select-none">
      <p class="text-gray-700 text-lg break-words pr-8">"${d.contenido}"</p>${corazon}</div>`;
  }
  if (d.tipo === "foto") {
    return `<div data-id="${d.id}"
      class="bg-white shadow-lg rounded-xl p-3 ${borde} relative transition-all duration-300 select-none">
      <div class="w-full h-48 overflow-hidden rounded-lg"><img src="${d.contenido}" alt="Foto" class="w-full h-full object-cover"></div>
      ${corazon}${ojitaSVG()}</div>`;
  }
  if (d.tipo === "cancion") {
    let desc = "", link = "";
    try { const p = JSON.parse(d.contenido); desc = p.desc; link = p.link; } catch { link = d.contenido; }
    return `<div data-id="${d.id}"
      class="bg-white shadow-lg rounded-xl p-5 ${borde} relative transition-all duration-300 select-none">
      ${desc ? `<p class="text-gray-700 text-base mb-3 break-words">"${desc}"</p>` : ""}
      <div class="flex items-center justify-between">
        <a href="${link}" target="_blank" class="text-sky-500 hover:underline text-sm truncate max-w-[70%]">${link}</a>
        <a href="${link}" target="_blank" class="ml-2 px-3 py-1.5 bg-sky-400 hover:bg-sky-500 text-white text-sm rounded-lg transition whitespace-nowrap">Escuchar ▶</a>
      </div>${corazon}</div>`;
  }

  return "";
}

// ===== RENDER POR FECHA =====
function renderPorFecha(tipo, datos) {
  const contenedorMap = {
    mensaje: "#mensajesContainer",
    foto:    "#fotosContainer",
    cancion: "#cancionesContainer",
    frase:   "#frasesContainer"
  };
  const cont = document.querySelector(contenedorMap[tipo]);
  if (!cont) return;

  const modo   = modoSeccion[tipo];
  const grupos = {};
  datos.forEach(d => {
    const g = obtenerGrupoFecha(d.fecha);
    if (!grupos[g]) grupos[g] = [];
    grupos[g].push(d);
  });

  if (Object.keys(grupos).length === 0) {
    const vacios = {
      mensaje: "Aún no hay mensajes... ¡manda el primero! 💬",
      foto:    "Aún no hay fotos... ¡sube un recuerdo! 📸",
      cancion: "Aún no hay canciones... ¿cuál es la de ustedes? 🎵",
      frase:   "Aún no hay frases... ¡exprésate! 💭"
    };
    cont.innerHTML = `<p class="text-center text-gray-400 text-sm py-10">${vacios[tipo]}</p>`;
    return;
  }

  let html = "";
  Object.keys(grupos).forEach((grupo, index) => {
    const id    = `grupo-${tipo}-${index}`;
    const esHoy = grupo === "Hoy" || gruposAbiertos[id];
    html += `<div class="mt-4">
      <div onclick="toggleGrupo('${id}', this)" class="flex justify-between items-center cursor-pointer">
        <p class="text-sm text-gray-500">${grupo}</p>
        <span class="flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-gray-400 transition-transform duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/>
          </svg></span>
      </div>
      <div id="${id}" class="space-y-3 overflow-hidden transition-all duration-500 ease-in-out ${esHoy ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0"}">
        ${grupos[grupo].map(d => crearCardHTML(d, modo)).join("")}
      </div></div>`;
  });

  cont.innerHTML = html;

  datos.forEach(d => {
    const cardEl = cont.querySelector(`[data-id="${d.id}"]`);
    if (!cardEl) return;

    if (modo === 'eliminar') {
      if (d.autorUid === miUid) {
        cardEl.addEventListener('click', () => {
          if (seleccionados[d.tipo].has(d.id)) seleccionados[d.tipo].delete(d.id);
          else seleccionados[d.tipo].add(d.id);
          rerenderSeccion(d.tipo);
          actualizarBarraFlotante(d.tipo);
        });
      }
    } else if (modo === 'editar') {
      if (d.autorUid === miUid) {
        cardEl.addEventListener('click', () => abrirModalEditar(d));
      }
    } else {
      agregarDobleTap(cardEl, d);
      if (d.tipo === "foto") {
        const ojito = cardEl.querySelector(".btn-ver-foto");
        if (ojito) ojito.addEventListener("click", e => { e.stopPropagation(); abrirFoto(d.contenido); });
      }
    }
  });
}

// ===== TOGGLE GRUPO =====
window.toggleGrupo = (id, el) => {
  const contenedor = document.getElementById(id);
  const flecha     = el.querySelector("svg");
  const abierto    = !contenedor.classList.contains("max-h-0");
  if (abierto) {
    contenedor.classList.remove("max-h-[2000px]", "opacity-100");
    contenedor.classList.add("max-h-0", "opacity-0");
    if (flecha) flecha.style.transform = "rotate(-90deg)";
    gruposAbiertos[id] = false;
  } else {
    contenedor.classList.remove("max-h-0", "opacity-0");
    contenedor.classList.add("max-h-[2000px]", "opacity-100");
    if (flecha) flecha.style.transform = "rotate(0deg)";
    gruposAbiertos[id] = true;
  }
};

// ===== FECHAS =====
function obtenerGrupoFecha(fecha) {
  const f   = fecha?.toDate ? fecha.toDate() : new Date(fecha);
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const fi  = new Date(f); fi.setHours(0, 0, 0, 0);
  const diff = Math.floor((hoy - fi) / (1000 * 60 * 60 * 24));
  if (diff === 0) return "Hoy";
  if (diff === 1) return "Ayer";
  return f.toLocaleDateString('es-MX');
}

function formatearFechaCorta(fecha) {
  const f = fecha?.toDate ? fecha.toDate() : new Date(fecha);
  return f.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });
}

function formatearFechaPlan(fechaPlan) {
  try {
    const [y, m, day] = fechaPlan.split('-');
    const dt = new Date(parseInt(y), parseInt(m) - 1, parseInt(day));
    return dt.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });
  } catch { return fechaPlan; }
}

// ===== RENDER INICIO =====
function renderInicio(datos) {
  const setHTML   = (sel, html) => document.querySelectorAll(sel).forEach(el => el.innerHTML = html);
  const mensajes  = datos.filter(d => d.tipo === "mensaje").slice(0, 3);
  const fotos     = datos.filter(d => d.tipo === "foto").slice(0, 4);
  const canciones = datos.filter(d => d.tipo === "cancion").slice(0, 4);
  const frases    = datos.filter(d => d.tipo === "frase").slice(0, 3);

  setHTML(".listaMensajes", mensajes.map(m =>
    `<li class="text-gray-700 text-sm mb-1 break-words">"${m.contenido}" - ${formatearFechaCorta(m.fecha)}</li>`
  ).join(""));

  document.querySelectorAll(".listaFotos").forEach(el => {
    el.innerHTML = fotos.map((f, i) =>
      `<div class="w-full h-32 overflow-hidden rounded-lg cursor-pointer" data-foto-idx="${i}">
        <img src="${f.contenido}" alt="Foto" class="w-full h-full object-cover hover:opacity-90 transition">
      </div>`
    ).join("");
    el.querySelectorAll("[data-foto-idx]").forEach((div, i) =>
      div.addEventListener("click", () => abrirFoto(fotos[i].contenido))
    );
  });

  setHTML(".listaCanciones", canciones.map(c => {
    let desc = "", link = "";
    try { const p = JSON.parse(c.contenido); desc = p.desc; link = p.link; } catch { link = c.contenido; }
    return `<li class="mb-2">${desc ? `<p class="text-gray-600 text-sm break-words">"${desc}"</p>` : ""}
      <a href="${link}" target="_blank" class="text-sky-500 hover:underline text-sm">
        ${link.length > 35 ? link.substring(0, 35) + "..." : link}
      </a></li>`;
  }).join(""));

  setHTML(".listaFrases", frases.map(f =>
    `<li class="text-gray-700 text-sm mb-1 break-words">"${f.contenido}"</li>`
  ).join(""));
}

// ===== RENDER TODO =====
function renderTodo(datos) {
  ["mensaje", "foto", "cancion", "frase"].forEach(tipo =>
    renderPorFecha(tipo, datos.filter(d => d.tipo === tipo))
  );
  renderInicio(datos);
}

// ===== TIEMPO REAL =====
function iniciarTiempoReal() {
  if (!codigoPareja) return;
  if (unsubscribe) unsubscribe();
  const ref = collection(db, "parejas", codigoPareja, "contenido");
  unsubscribe = onSnapshot(ref, async (snapshot) => {
    const datos = [];
    snapshot.forEach(d => datos.push({ id: d.id, ...d.data() }));
    datos.sort((a, b) => {
      const fa = a.fecha?.toDate ? a.fecha.toDate() : new Date(a.fecha);
      const fb = b.fecha?.toDate ? b.fecha.toDate() : new Date(b.fecha);
      return fb - fa;
    });

    const idsPendientes = (deshacerDatos && deshacerDatos.tipo !== 'plan')
      ? new Set(deshacerDatos.items.map(i => i.id))
      : new Set();

    if (idsConocidos === null) {
      idsConocidos = new Set(datos.map(d => d.id));
      const ultimaVisita = parseInt(localStorage.getItem('ultimaVisita') || '0');
      for (const d of datos) {
        if (d.autorUid !== miUid) {
          const fechaItem = d.fecha?.toDate ? d.fecha.toDate() : new Date(d.fecha);
          if (fechaItem.getTime() > ultimaVisita) mostrarCorazon(d.tipo);
        }
      }
      localStorage.setItem('ultimaVisita', Date.now().toString());
    } else {
      for (const d of datos) {
        if (!idsConocidos.has(d.id) && d.autorUid !== miUid) {
          await cargarApodoPareja();
          let nombrePareja = "";
          try {
            const ps = await getDoc(doc(db, "usuarios", d.autorUid));
            if (ps.exists()) nombrePareja = ps.data().usuario || "";
          } catch {}
          await mostrarToastInApp(d.tipo, nombrePareja);
          const seccionDelTipo = { mensaje: 'mensajes', foto: 'fotos', cancion: 'canciones', frase: 'frases' };
          if (seccionActiva !== seccionDelTipo[d.tipo]) mostrarCorazon(d.tipo);
        }
        idsConocidos.add(d.id);
      }
    }

    const datosParaRender = datos.filter(d => !idsPendientes.has(d.id));
    datosGlobal = datosParaRender;
    renderTodo(datosParaRender);
  });
}

// ===== PLANES =====
let tabPlanActual  = "cita";
let planEditandoId = null;

const modalPlan       = document.getElementById('modalPlan');
const modalPlanTitulo = document.getElementById('modalPlanTitulo');
const inputPlanTexto  = document.getElementById('inputPlanTexto');
const inputPlanFecha  = document.getElementById('inputPlanFecha');
const labelPlanFecha  = document.getElementById('labelPlanFecha');
const cancelarPlan    = document.getElementById('cancelarPlan');
const guardarPlan     = document.getElementById('guardarPlan');

function resetearModoEditarPlanes() {
  if (deshacerTimeout && deshacerDatos?.tipo === 'plan') {
    clearTimeout(deshacerTimeout);
    deshacerTimeout = null;
    const datos = deshacerDatos;
    deshacerDatos = null;
    ocultarToastDeshacerById();
    commitEliminarPlanes(datos);
  }
  modoPlan = null;
  seleccionadosPlan.clear();
  ocultarBarraFlotantePlan();
  _actualizarBotonesHeaderPlan();
  _renderPlanesHTML();
}

document.querySelectorAll('.tabPlan').forEach(btn => {
  btn.onclick = () => {
    tabPlanActual = btn.dataset.tab;
    document.querySelectorAll('.tabPlan').forEach(t => {
      t.classList.remove('text-purple-600', 'border-purple-500');
      t.classList.add('text-gray-400', 'border-transparent');
    });
    btn.classList.remove('text-gray-400', 'border-transparent');
    btn.classList.add('text-purple-600', 'border-purple-500');
    resetearModoEditarPlanes();
    _renderPlanesHTML();
  };
});

window.abrirModalPlan = (d = null) => {
  planEditandoId = d ? d.id : null;
  const tab = d ? d.tab : tabPlanActual;
  const nombreTab = tab === 'cita' ? 'cita' : tab === 'promesa' ? 'promesa' : 'plan';
  modalPlanTitulo.textContent    = d ? `Editar ${nombreTab}` : (tab === 'cita' ? 'Nueva cita' : tab === 'promesa' ? 'Nueva promesa 💍' : 'Nuevo plan');
  inputPlanTexto.value           = d ? d.texto : '';
  guardarPlan.textContent        = d ? 'Aceptar' : 'Enviar';

  // Mostrar/ocultar fecha o plazo según tab
  const plazoDiv = document.getElementById('plazoDiv');
  if (tab === 'promesa') {
    labelPlanFecha.classList.add('hidden');
    inputPlanFecha.classList.add('hidden');
    inputPlanFecha.value = '';
    plazoDiv.classList.remove('hidden');
    inputPlanTexto.placeholder = 'Describe la promesa...';
    // Restaurar plazo si es edición
    const selectPlazo = document.getElementById('selectPlazo');
    if (selectPlazo) selectPlazo.value = d?.plazo || '';
  } else {
    labelPlanFecha.classList.remove('hidden');
    inputPlanFecha.classList.remove('hidden');
    plazoDiv.classList.add('hidden');
    labelPlanFecha.textContent = tab === 'cita' ? 'Fecha de la cita (opcional)' : 'Fecha del plan (opcional)';
    inputPlanFecha.type  = 'date';
    inputPlanFecha.value = d?.fechaPlan || '';
    inputPlanTexto.placeholder = tab === 'cita' ? 'Describe la cita...' : 'Describe el plan...';
  }

  modalPlan.classList.remove('hidden');
  modalPlan.classList.add('flex');
  setTimeout(() => { modalPlan.classList.remove('opacity-0'); modalPlan.classList.add('opacity-100'); }, 10);
};



function cerrarModalPlan() {
  modalPlan.classList.remove('opacity-100');
  modalPlan.classList.add('opacity-0');
  setTimeout(() => { modalPlan.classList.add('hidden'); modalPlan.classList.remove('flex'); }, 300);
}
cancelarPlan.onclick = cerrarModalPlan;

guardarPlan.onclick = async () => {
  const texto     = inputPlanTexto.value.trim();
  const fechaPlan = inputPlanFecha.value.trim();
  if (!texto) return mostrarToast('Escribe algo primero', 'error');

  // Obtener plazo si es promesa
  let plazo = null;
  if (tabPlanActual === 'promesa' || (planEditandoId && (renderPlanes._datos||[]).find(x=>x.id===planEditandoId)?.tab === 'promesa')) {
    const selectPlazo = document.getElementById('selectPlazo');
    plazo = selectPlazo?.value || (renderPlanes._datos||[]).find(x=>x.id===planEditandoId)?.plazo || null;
    if (!plazo && !planEditandoId) return mostrarToast('Selecciona un plazo', 'error');
  }

  if (planEditandoId) {
    try {
      const updateData = { texto, fechaPlan };
      if (plazo !== null) updateData.plazo = plazo;
      await updateDoc(doc(db, 'parejas', codigoPareja, 'planes', planEditandoId), updateData);
      mostrarToast('¡Editado!', 'exito');
      cerrarModalPlan();
      await notificarPareja(tabPlanActual === 'cita' ? 'cita' : tabPlanActual === 'promesa' ? 'promesa' : 'plan', texto, true);
    } catch (e) { mostrarToast('Error al editar', 'error'); console.error(e); }
  } else {
    try {
      const newData = { texto, fechaPlan, tab: tabPlanActual, fecha: new Date(), autorUid: miUid, completado: false };
      if (plazo) newData.plazo = plazo;
      await addDoc(collection(db, 'parejas', codigoPareja, 'planes'), newData);
      mostrarToast('¡Guardado!', 'exito');
      cerrarModalPlan();
      await notificarPareja(tabPlanActual === 'cita' ? 'cita' : tabPlanActual === 'promesa' ? 'promesa' : 'plan', texto, false);
    } catch (e) { mostrarToast('Error al guardar', 'error'); console.error(e); }
  }
};

window.marcarCompletado = async (id) => {
  try { await updateDoc(doc(db, 'parejas', codigoPareja, 'planes', id), { completado: true }); mostrarToast('¡Completado!', 'exito'); }
  catch (e) { mostrarToast('Error', 'error'); console.error(e); }
};

window.desmarcarCompletado = async (id, tab) => {
  const nombreTab = tab === 'cita' ? 'cita' : 'plan';
  const modalConf = document.getElementById('modalConfirmarDesmarcar');
  let btnAceptar  = document.getElementById('aceptarDesmarcar');
  let btnCancelar = document.getElementById('cancelarDesmarcar');
  document.getElementById('textoDesmarcar').textContent = `¿Estás seguro de desmarcar esta ${nombreTab}?`;
  modalConf.classList.remove('hidden'); modalConf.classList.add('flex');
  const na = btnAceptar.cloneNode(true); const nc = btnCancelar.cloneNode(true);
  btnAceptar.replaceWith(na); btnCancelar.replaceWith(nc);
  na.onclick = async () => {
    modalConf.classList.add('hidden'); modalConf.classList.remove('flex');
    try { await updateDoc(doc(db, 'parejas', codigoPareja, 'planes', id), { completado: false }); mostrarToast('Desmarcado', 'exito'); }
    catch (e) { mostrarToast('Error', 'error'); console.error(e); }
  };
  nc.onclick = () => { modalConf.classList.add('hidden'); modalConf.classList.remove('flex'); };
};

// ===== RENDER PLANES =====
function renderPlanes() {
  if (renderPlanes._datos) _renderPlanesHTML();
  if (renderPlanes._unsub) return;

  const ref = collection(db, 'parejas', codigoPareja, 'planes');
  renderPlanes._unsub = onSnapshot(ref, snap => {
    const idsPendientes = (deshacerDatos?.tipo === 'plan')
      ? new Set(deshacerDatos.items.map(i => i.id))
      : new Set();

    // Detectar nuevos planes/citas de la pareja (corazón en Extras)
    if (renderPlanes._idsConocidos === undefined) {
      renderPlanes._idsConocidos = new Set();
      const ultimaVisita = parseInt(localStorage.getItem('ultimaVisita') || '0');
      snap.forEach(d => {
        renderPlanes._idsConocidos.add(d.id);
        const data = d.data();
        if (data.autorUid !== miUid) {
          const fechaItem = data.fecha?.toDate ? data.fecha.toDate() : new Date(data.fecha || 0);
          if (fechaItem.getTime() > ultimaVisita) mostrarCorazon('plan');
        }
      });
    } else {
      snap.forEach(d => {
        if (!renderPlanes._idsConocidos.has(d.id)) {
          const data = d.data();
          if (data.autorUid !== miUid) {
            mostrarCorazon('plan');
            // Si ya estamos en Extras, quitar el corazón de inmediato
            if (seccionActiva === 'planes') quitarCorazon('plan');
          }
          renderPlanes._idsConocidos.add(d.id);
        }
      });
    }

    renderPlanes._datos = [];
    snap.forEach(d => {
      if (!idsPendientes.has(d.id)) {
        renderPlanes._datos.push({ id: d.id, ...d.data() });
      }
    });
    renderPlanes._datos.sort((a, b) => {
      const fa = a.fecha?.toDate ? a.fecha.toDate() : new Date(a.fecha || 0);
      const fb = b.fecha?.toDate ? b.fecha.toDate() : new Date(b.fecha || 0);
      return fb - fa;
    });
    _renderPlanesHTML();
  });
}

function _renderPlanesHTML() {
  const cont = document.getElementById('planesContainer');
  if (!cont) return;
  const datos = (renderPlanes._datos || []).filter(d => d.tab === tabPlanActual);

  if (datos.length === 0) {
    const vaciosPlan = {
      cita:    "Aún no hay citas planeadas... ¡propón una! 🗓️",
      plan:    "Aún no hay planes... ¡qué se les ocurre! 💡",
      promesa: "Aún no hay promesas... ¡escriban sus sueños juntos! 💍"
    };
    cont.innerHTML = `<p class="text-center text-gray-400 text-sm py-10">${vaciosPlan[tabPlanActual] || ''}</p>`;
    return;
  }

  cont.innerHTML = datos.map(d => {
    let fechaLinea = '';
    if (d.tab === 'promesa' && d.plazo) {
      const plazoMap = {
        corto:  '⚡ Corto plazo (- 1 año)',
        mediano:'🌱 Mediano plazo (1 - 3 años)',
        largo:  '🌟 Largo plazo (3+ años)'
      };
      fechaLinea = `<p class="text-xs text-purple-400 mt-1">${plazoMap[d.plazo] || ''}</p>`;
    } else if (d.fechaPlan) {
      const emoji = d.tab === 'cita' ? '📅' : '⏳';
      fechaLinea = `<p class="text-xs text-purple-400 mt-1">${emoji} ${formatearFechaPlan(d.fechaPlan)}</p>`;
    }

    if (modoPlan === 'eliminar') {
      const seleccionado = seleccionadosPlan.has(d.id);
      const checkClass   = seleccionado ? 'bg-purple-500 border-purple-500' : 'bg-white border-gray-300';
      const checkHTML = `<div class="checkbox-card absolute top-3 left-3 w-6 h-6 rounded-full border-2 flex items-center justify-center transition ${checkClass}">
        ${seleccionado ? `<svg xmlns="http://www.w3.org/2000/svg" class="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>` : ''}
      </div>`;
      return `<div data-plan-id="${d.id}" class="bg-white shadow rounded-xl p-4 pl-12 border-2 border-purple-400 relative transition-all cursor-pointer select-none ${d.completado ? 'opacity-60' : ''}">
        ${checkHTML}
        <p class="text-gray-700 break-words pr-6">${d.texto}</p>
        ${fechaLinea}
      </div>`;
    }

    if (modoPlan === 'editar') {
      return `<div data-plan-id="${d.id}" class="bg-white shadow rounded-xl p-4 border-2 border-purple-400 relative transition-all cursor-pointer hover:border-purple-600 select-none ${d.completado ? 'opacity-60' : ''}">
        <p class="text-gray-700 break-words pr-6">${d.texto}</p>
        ${fechaLinea}
        <span class="absolute top-3 right-3 text-purple-400">${lapizSVG}</span>
      </div>`;
    }

    // Modo normal
    const btnCirculo = !d.completado
      ? `<button onclick="marcarCompletado('${d.id}')" title="Marcar como completado"
          class="absolute top-3 right-3 w-7 h-7 rounded-full border-2 border-purple-300 hover:bg-purple-100 hover:border-purple-500 transition flex items-center justify-center"></button>`
      : `<button onclick="desmarcarCompletado('${d.id}', '${d.tab}')" title="Desmarcar"
          class="absolute top-3 right-3 w-7 h-7 rounded-full border-2 border-green-400 bg-green-100 hover:bg-green-200 transition flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>
          </svg></button>`;

    return `<div class="bg-white shadow rounded-xl p-4 border-2 border-purple-400 relative transition-all ${d.completado ? 'opacity-60' : ''}">
      <p class="text-gray-700 break-words pr-10">${d.texto}</p>
      ${fechaLinea}${btnCirculo}
    </div>`;
  }).join('');

  if (modoPlan === 'eliminar') {
    cont.querySelectorAll('[data-plan-id]').forEach(card => {
      const id = card.dataset.planId;
      card.addEventListener('click', () => {
        if (seleccionadosPlan.has(id)) seleccionadosPlan.delete(id);
        else seleccionadosPlan.add(id);
        _renderPlanesHTML();
        _actualizarBarraFlotantePlan();
      });
    });
  } else if (modoPlan === 'editar') {
    cont.querySelectorAll('[data-plan-id]').forEach(card => {
      const id = card.dataset.planId;
      card.addEventListener('click', () => {
        const d = (renderPlanes._datos || []).find(x => x.id === id);
        if (d) abrirModalPlan(d);
      });
    });
  }
          }
