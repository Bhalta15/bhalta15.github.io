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

let idsConocidos = null;

const modoEliminar  = { mensaje: false, foto: false, cancion: false, frase: false };
const seleccionados = { mensaje: new Set(), foto: new Set(), cancion: new Set(), frase: new Set() };

// ===== CORAZONES MENÚ =====
const seccionesConNuevo = { mensaje: false, foto: false, cancion: false, frase: false, plan: false };

function mostrarCorazon(tipo) {
  seccionesConNuevo[tipo] = true;
  localStorage.setItem(`heart-${tipo}`, 'true');
  const el = document.getElementById(`heart-${tipo}`);
  if (el) el.classList.remove('hidden');
}

function quitarCorazon(tipo) {
  seccionesConNuevo[tipo] = false;
  localStorage.removeItem(`heart-${tipo}`);
  const el = document.getElementById(`heart-${tipo}`);
  if (el) el.classList.add('hidden');
}

function cargarCorazonesGuardados() {
  ['mensaje', 'foto', 'cancion', 'frase', 'plan'].forEach(tipo => {
    if (localStorage.getItem(`heart-${tipo}`) === 'true') {
      mostrarCorazon(tipo);
    }
  });
}

// ===== ELEMENTOS =====
const menuBtn           = document.getElementById('menuBtn');
const sideMenu          = document.getElementById('sideMenu');
const overlay           = document.getElementById('overlay');
const btnCerrarSesion   = document.getElementById('btnCerrarSesion');
const modal             = document.getElementById('modal');
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

const fotoPerfilHeader = document.getElementById('fotoPerfilHeader');
const btnPerfil        = document.getElementById('btnPerfil');


// ===== ONESIGNAL INIT =====
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
  } catch (e) {
    console.error("OneSignal error:", e);
  }
}

// ===== MANDAR NOTIFICACIÓN A LA PAREJA =====
async function notificarPareja(tipo, contenidoRaw = "") {
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
    if (tipo === "mensaje" || tipo === "frase") {
      preview = contenidoRaw.length > 50
        ? contenidoRaw.substring(0, 50) + "..."
        : contenidoRaw;
    } else if (tipo === "cancion") {
      try {
        const parsed = JSON.parse(contenidoRaw);
        const desc = parsed.desc || "";
        preview = desc.length > 50 ? desc.substring(0, 50) + "..." : desc;
      } catch { preview = ""; }
    }

    await fetch("https://daily-love-server.onrender.com/notificar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        oneSignalId,
        tipo,
        nombreUsuario: nombreEnNoti,
        preview
      })
    });
  } catch (e) {
    console.error("Error mandando notificación:", e);
  }
}

// ===== TOAST IN-APP PARA CONTENIDO NUEVO DE LA PAREJA =====
const mensajesInApp = {
  mensaje: "Nuevo mensaje💬",
  foto:    "Nueva foto📸",
  cancion: "Nueva canción🎵",
  frase:   "Nueva frase💭"
};

let apodoDePareja = "";

async function cargarApodoPareja() {
  if (!miUid) return;
  try {
    const snap = await getDoc(doc(db, "usuarios", miUid));
    if (snap.exists()) apodoDePareja = snap.data().apodoPareja || "";
  } catch { apodoDePareja = ""; }
}

function nombreRemitente(nombreUsuarioPareja) {
  return apodoDePareja || nombreUsuarioPareja || "Tu pareja";
}

async function mostrarToastInApp(tipo, nombreUsuarioPareja) {
  if (!apodoDePareja) await cargarApodoPareja();
  const quien = nombreRemitente(nombreUsuarioPareja);
  const accion = mensajesInApp[tipo] || "algo nuevo 💕";
  mostrarToast(`${quien}: ${accion}`, "info");
}

// ===== SESIÓN PERSISTENTE =====
setPersistence(auth, browserLocalPersistence).then(() => {
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.href = "registro.html";
      return;
    }

    try {
      const snap = await getDoc(doc(db, "usuarios", user.uid));

      if (snap.exists()) {
        const datos  = snap.data();
        miUid        = user.uid;
        miGenero     = datos.genero;
        codigoPareja = datos.codigo;

        if (!codigoPareja) {
          window.location.href = "registro.html";
          return;
        }

        const userNameEl     = document.getElementById("userName");
        const userNameMainEl = document.getElementById("userNameMain");

        if (userNameEl)     userNameEl.textContent     = datos.usuario;
        if (userNameMainEl) userNameMainEl.textContent = datos.usuario;

        if (fotoPerfilHeader) {
          fotoPerfilHeader.src = datos.foto
            ? datos.foto
            : `https://ui-avatars.com/api/?name=${datos.usuario}&background=EC4899&color=fff`;
        }

        if (btnPerfil && !btnPerfil.dataset.listener) {
          btnPerfil.onclick = () => { window.location.href = "perfil.html"; };
          btnPerfil.dataset.listener = "true";
        }

        if (!sessionStorage.getItem("bienvenidaMostrada")) {
          mostrarToast(`¡Bienvenida ${datos.usuario}!`, "info");
          sessionStorage.setItem("bienvenidaMostrada", "1");
        }

        await cargarApodoPareja();
        iniciarTiempoReal();
        cargarCorazonesGuardados();

        if (typeof OneSignal !== "undefined") {
          await iniciarOneSignal();
        } else {
          window.OneSignalDeferred = window.OneSignalDeferred || [];
          window.OneSignalDeferred.push(async () => { await iniciarOneSignal(); });
        }

      } else {
        window.location.href = "registro.html";
      }

    } catch (error) {
      console.error("Error cargando usuario:", error);
    }
  });
});

// ===== MENÚ =====
menuBtn.onclick = () => {
  sideMenu.classList.remove('-translate-x-full');
  overlay.classList.remove('hidden');
};
overlay.onclick = () => cerrarMenu();

function cerrarMenu() {
  sideMenu.classList.add('-translate-x-full');
  overlay.classList.add('hidden');
}

document.querySelectorAll('.itemMenu').forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll('.section').forEach(s => s.classList.add('hidden'));
    const seccion = btn.dataset.section;
    document.getElementById(seccion).classList.remove('hidden');
    seccionActiva = seccion;

    const tipoMap = { mensajes: 'mensaje', fotos: 'foto', canciones: 'cancion', frases: 'frase', planes: 'plan' };
    if (tipoMap[seccion]) quitarCorazon(tipoMap[seccion]);

    if (seccion !== 'planes') resetearModoEditarPlanes();

    if (seccion === 'planes') {
      renderPlanes();
    }

    cerrarMenu();
  };
});

// ===== MODAL NUEVO CONTENIDO =====
let tipoActual = "";

window.abrirModal = (tipo) => {
  tipoActual = tipo;
  inputTexto.classList.add('hidden');
  inputCancionDiv.classList.add('hidden');
  inputFile.classList.add('hidden');
  previewImagen.classList.add('hidden');
  inputTexto.value       = "";
  inputDescCancion.value = "";
  inputLinkCancion.value = "";
  inputFile.value        = "";

  if (tipo === "mensaje" || tipo === "frase") {
    inputTexto.classList.remove('hidden');
  } else if (tipo === "cancion") {
    inputCancionDiv.classList.remove('hidden');
  } else if (tipo === "foto") {
    inputFile.classList.remove('hidden');
  }

  modal.classList.remove('hidden');
  modal.classList.add('flex');
  setTimeout(() => {
    modal.classList.remove('opacity-0');
    modal.classList.add('opacity-100');
  }, 10);
};

function cerrarModal() {
  modal.classList.remove('opacity-100');
  modal.classList.add('opacity-0');
  setTimeout(() => {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }, 300);
}
cancelar.onclick = cerrarModal;

// ===== MODAL FOTO GRANDE =====
function abrirFoto(src) {
  imagenGrande.src  = src;
  btnDescargar.href = src;
  modalFoto.classList.remove('hidden');
  modalFoto.classList.add('flex');
}
btnCerrarFoto.onclick = () => {
  modalFoto.classList.add('hidden');
  modalFoto.classList.remove('flex');
};

// ===== COMPRESIÓN DE IMAGEN =====
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
        else if (h > max)     { w *= max / h; h = max; }
        canvas.width = w; canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.7));
      };
    };
    reader.readAsDataURL(file);
  });
}

// ===== PREVIEW IMAGEN (nuevo) =====
inputFile.addEventListener("change", async () => {
  const archivo = inputFile.files[0];
  if (archivo) {
    const img = await comprimirImagen(archivo);
    previewImagen.src = img;
    previewImagen.classList.remove("hidden");
  }
});

// ===== PREVIEW IMAGEN (reemplazar) =====
editFile.addEventListener("change", async () => {
  const archivo = editFile.files[0];
  if (archivo) {
    const img = await comprimirImagen(archivo);
    editPreviewImagen.src = img;
    editPreviewImagen.classList.remove("hidden");
  }
});

// ===== GUARDAR =====
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
  await guardarEnFirebase(contenido);
};

async function guardarEnFirebase(contenido) {
  try {
    await addDoc(collection(db, "parejas", codigoPareja, "contenido"), {
      tipo:        tipoActual,
      contenido:   contenido,
      fecha:       new Date(),
      autorUid:    miUid,
      autorGenero: miGenero,
      reaccion:    null
    });
    mostrarToast("¡Enviado!", "exito");
    cerrarModal();
    await notificarPareja(tipoActual, contenido);
  } catch (error) {
    mostrarToast("Tu pareja aún no se ha registrado, intenta más tarde", "info");
    console.error(error);
  }
}

// ===== EDITAR =====
function abrirModalEditar(d) {
  editTexto.classList.add('hidden');
  editCancionDiv.classList.add('hidden');
  editFile.classList.add('hidden');
  editPreviewImagen.classList.add('hidden');
  editTexto.value        = "";
  editDescCancion.value  = "";
  editLinkCancion.value  = "";
  editFile.value         = "";

  if (d.tipo === "mensaje" || d.tipo === "frase") {
    modalEditarTitulo.textContent = "Editar";
    editTexto.classList.remove('hidden');
    editTexto.value = d.contenido;
  } else if (d.tipo === "cancion") {
    modalEditarTitulo.textContent = "Editar";
    editCancionDiv.classList.remove('hidden');
    try {
      const parsed = JSON.parse(d.contenido);
      editDescCancion.value = parsed.desc || "";
      editLinkCancion.value = parsed.link || "";
    } catch {
      editLinkCancion.value = d.contenido;
    }
  } else if (d.tipo === "foto") {
    modalEditarTitulo.textContent = "Reemplazar foto";
    editFile.classList.remove('hidden');
  }

  modalEditar._docActual = d;
  modalEditar.classList.remove('hidden');
  modalEditar.classList.add('flex');
  setTimeout(() => {
    modalEditar.classList.remove('opacity-0');
    modalEditar.classList.add('opacity-100');
  }, 10);
}

function cerrarModalEditar() {
  modalEditar.classList.remove('opacity-100');
  modalEditar.classList.add('opacity-0');
  setTimeout(() => {
    modalEditar.classList.add('hidden');
    modalEditar.classList.remove('flex');
  }, 300);
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
    await updateDoc(doc(db, "parejas", codigoPareja, "contenido", d.id), {
      contenido: nuevoContenido
    });
    mostrarToast(d.tipo === "foto" ? "¡Foto reemplazada!" : "¡Editado!", "exito");
    cerrarModalEditar();
  } catch (error) {
    mostrarToast("Error al guardar", "error");
    console.error(error);
  }
};

// ===== REACCIONAR =====
async function toggleReaccion(d) {
  if (d.autorUid === miUid) {
    mostrarToast("No puedes reaccionar a tu propio contenido", "info");
    return;
  }
  const ref = doc(db, "parejas", codigoPareja, "contenido", d.id);
  const yaReacciono = d.reaccion === miGenero;
  await updateDoc(ref, { reaccion: yaReacciono ? null : miGenero });
}

// ===== DOBLE TAP =====
function agregarDobleTap(el, d) {
  let lastTap = 0;

  const handler = (e) => {
    if (e.target.closest('.btn-ver-foto')) return;
    const now = Date.now();
    if (now - lastTap < 300) {
      lastTap = 0;
      if (d.autorUid === miUid) {
        abrirModalEditar(d);
      } else {
        toggleReaccion(d);
      }
    } else {
      lastTap = now;
    }
  };

  el.addEventListener("touchend", handler, { passive: true });
  el.addEventListener("dblclick", handler);
}

// ===== MODO ELIMINAR =====
let tipoEliminarActual = "";

window.activarModoEliminar = (tipo) => {
  modoEliminar[tipo] = true;
  seleccionados[tipo].clear();
  tipoEliminarActual = tipo;

  document.getElementById(`btnNuevo${capitalizar(tipo)}`).classList.add('hidden');
  document.getElementById(`btnEliminar${capitalizar(tipo)}`).classList.add('hidden');
  document.getElementById(`btnConfirmar${capitalizar(tipo)}`).classList.remove('hidden');
  document.getElementById(`btnCancelar${capitalizar(tipo)}`).classList.remove('hidden');

  rerenderSeccion(tipo);
};

window.cancelarModoEliminar = (tipo) => {
  modoEliminar[tipo] = false;
  seleccionados[tipo].clear();

  document.getElementById(`btnNuevo${capitalizar(tipo)}`).classList.remove('hidden');
  document.getElementById(`btnEliminar${capitalizar(tipo)}`).classList.remove('hidden');
  document.getElementById(`btnConfirmar${capitalizar(tipo)}`).classList.add('hidden');
  document.getElementById(`btnCancelar${capitalizar(tipo)}`).classList.add('hidden');

  rerenderSeccion(tipo);
};

window.confirmarEliminar = (tipo) => {
  if (seleccionados[tipo].size === 0) {
    mostrarToast("No seleccionaste ningún elemento", "error");
    return;
  }
  tipoEliminarActual = tipo;
  modalEliminar.classList.remove('hidden');
  modalEliminar.classList.add('flex');
};

cancelarEliminar.onclick = () => {
  modalEliminar.classList.add('hidden');
  modalEliminar.classList.remove('flex');
};

aceptarEliminar.onclick = async () => {
  const tipo = tipoEliminarActual;
  const ids  = [...seleccionados[tipo]];
  modalEliminar.classList.add('hidden');
  modalEliminar.classList.remove('flex');

  try {
    await Promise.all(ids.map(id =>
      deleteDoc(doc(db, "parejas", codigoPareja, "contenido", id))
    ));
    mostrarToast("¡Eliminado!", "exito");
    cancelarModoEliminar(tipo);
  } catch (error) {
    mostrarToast("Error al eliminar", "error");
    console.error(error);
  }
};

function capitalizar(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function rerenderSeccion(tipo) {
  const datos = datosGlobal.filter(d => d.tipo === tipo);
  renderPorFecha(tipo, datos);
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

    if (idsConocidos === null) {
      idsConocidos = new Set(datos.map(d => d.id));

      const ultimaVisita = parseInt(localStorage.getItem('ultimaVisita') || '0');
      for (const d of datos) {
        if (d.autorUid !== miUid) {
          const fechaItem = d.fecha?.toDate ? d.fecha.toDate() : new Date(d.fecha);
          if (fechaItem.getTime() > ultimaVisita) {
            mostrarCorazon(d.tipo);
          }
        }
      }

      localStorage.setItem('ultimaVisita', Date.now().toString());

    } else {
      for (const d of datos) {
        if (!idsConocidos.has(d.id) && d.autorUid !== miUid) {
          await cargarApodoPareja();
          let nombrePareja = "";
          try {
            const parejaSnap = await getDoc(doc(db, "usuarios", d.autorUid));
            if (parejaSnap.exists()) nombrePareja = parejaSnap.data().usuario || "";
          } catch { /* silencioso */ }
          await mostrarToastInApp(d.tipo, nombrePareja);

          const seccionDelTipo = { mensaje: 'mensajes', foto: 'fotos', cancion: 'canciones', frase: 'frases' };
          if (seccionActiva !== seccionDelTipo[d.tipo]) {
            mostrarCorazon(d.tipo);
          }
        }
        idsConocidos.add(d.id);
      }
    }

    datosGlobal = datos;
    renderTodo(datos);
  });
}

// ===== FECHAS =====
function obtenerGrupoFecha(fecha) {
  const f = fecha?.toDate ? fecha.toDate() : new Date(fecha);
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const fechaItem = new Date(f);
  fechaItem.setHours(0, 0, 0, 0);
  const diff = Math.floor((hoy - fechaItem) / (1000 * 60 * 60 * 24));
  if (diff === 0) return "Hoy";
  if (diff === 1) return "Ayer";
  return f.toLocaleDateString('es-MX');
}

function formatearFechaCorta(fecha) {
  const f = fecha?.toDate ? fecha.toDate() : new Date(fecha);
  return f.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });
}

// ===== COLOR DE BORDE POR GÉNERO =====
function borderPorGenero(genero) {
  return genero === "hombre"
    ? "border-2 border-blue-300"
    : "border-2 border-pink-300";
}

// ===== CORAZÓN SVG CONTORNO =====
function heartSVG(d) {
  if (!d.reaccion) return "";
  const color = d.reaccion === "hombre" ? "#93c5fd" : "#f9a8d4";
  return `
    <span class="absolute top-2 right-2 pointer-events-none">
      <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24"
        fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
      </svg>
    </span>`;
}

// ===== ICONO OJO PARA FOTOS =====
function ojitaSVG() {
  return `
    <button class="btn-ver-foto absolute bottom-2 right-2 w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center shadow-md hover:bg-purple-700 transition">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
        fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
        <circle cx="12" cy="12" r="3"/>
      </svg>
    </button>`;
}

// ===== CREAR CARD =====
function crearCardHTML(d, enModoEliminar) {
  const borde   = borderPorGenero(d.autorGenero);
  const corazon = heartSVG(d);
  const esMio   = d.autorUid === miUid;
  const selec   = seleccionados[d.tipo]?.has(d.id);

  let extraClases = "";
  let overlayEl   = "";
  if (enModoEliminar) {
    if (esMio) {
      extraClases = selec
        ? "ring-2 ring-red-400 opacity-100 cursor-pointer"
        : "opacity-100 cursor-pointer";
      overlayEl = selec
        ? `<span class="absolute inset-0 bg-red-100 bg-opacity-40 rounded-xl pointer-events-none flex items-center justify-center">
             <svg xmlns="http://www.w3.org/2000/svg" class="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
               <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>
             </svg>
           </span>`
        : "";
    } else {
      extraClases = "opacity-30 pointer-events-none";
    }
  }

  if (d.tipo === "mensaje" || d.tipo === "frase") {
    return `
      <div data-id="${d.id}"
        class="bg-white shadow-lg rounded-xl p-5 ${borde} relative transition-all duration-300 select-none ${extraClases}">
        <p class="text-gray-700 text-lg break-all">"${d.contenido}"</p>
        ${corazon}
        ${overlayEl}
      </div>`;
  }

  if (d.tipo === "foto") {
    return `
      <div data-id="${d.id}"
        class="bg-white shadow-lg rounded-xl p-3 ${borde} relative transition-all duration-300 select-none ${extraClases}">
        <div class="w-full h-48 overflow-hidden rounded-lg">
          <img src="${d.contenido}" alt="Foto" class="w-full h-full object-cover">
        </div>
        ${corazon}
        ${enModoEliminar ? "" : ojitaSVG()}
        ${overlayEl}
      </div>`;
  }

  if (d.tipo === "cancion") {
    let desc = "", link = "";
    try {
      const parsed = JSON.parse(d.contenido);
      desc = parsed.desc; link = parsed.link;
    } catch { link = d.contenido; }

    return `
      <div data-id="${d.id}"
        class="bg-white shadow-lg rounded-xl p-5 ${borde} relative transition-all duration-300 select-none ${extraClases}">
        ${desc ? `<p class="text-gray-700 text-base mb-3 break-all">"${desc}"</p>` : ""}
        <div class="flex items-center justify-between">
          <a href="${link}" target="_blank" class="text-sky-500 hover:underline text-sm truncate max-w-[70%]">${link}</a>
          <a href="${link}" target="_blank"
            class="ml-2 px-3 py-1.5 bg-sky-400 hover:bg-sky-500 text-white text-sm rounded-lg transition whitespace-nowrap">
            Escuchar ▶
          </a>
        </div>
        ${corazon}
        ${overlayEl}
      </div>`;
  }

  return "";
}

// ===== RENDER POR GRUPOS =====
function renderPorFecha(tipo, datos) {
  const contenedorMap = {
    mensaje: "#mensajesContainer",
    foto:    "#fotosContainer",
    cancion: "#cancionesContainer",
    frase:   "#frasesContainer"
  };

  const cont = document.querySelector(contenedorMap[tipo]);
  if (!cont) return;

  const enModoEliminar = modoEliminar[tipo];

  const grupos = {};
  datos.forEach(d => {
    const grupo = obtenerGrupoFecha(d.fecha);
    if (!grupos[grupo]) grupos[grupo] = [];
    grupos[grupo].push(d);
  });

  // ===== ESTADO VACÍO PERSONALIZADO =====
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
    const id              = `grupo-${tipo}-${index}`;
    const abiertoGuardado = gruposAbiertos[id];
    const esHoy           = grupo === "Hoy" || abiertoGuardado;

    html += `
      <div class="mt-4">
        <div onclick="toggleGrupo('${id}', this)" class="flex justify-between items-center cursor-pointer">
          <p class="text-sm text-gray-500">${grupo}</p>
          <span class="flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-gray-400 transition-transform duration-300"
              fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/>
            </svg>
          </span>
        </div>
        <div id="${id}" class="space-y-3 overflow-hidden transition-all duration-500 ease-in-out ${esHoy ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0"}">
          ${grupos[grupo].map(d => crearCardHTML(d, enModoEliminar)).join("")}
        </div>
      </div>`;
  });

  cont.innerHTML = html;

  datos.forEach(d => {
    const cardEl = cont.querySelector(`[data-id="${d.id}"]`);
    if (!cardEl) return;

    if (enModoEliminar) {
      if (d.autorUid === miUid) {
        cardEl.addEventListener("click", () => toggleSeleccion(d.tipo, d.id, cardEl, d));
      }
    } else {
      agregarDobleTap(cardEl, d);
      if (d.tipo === "foto") {
        const ojito = cardEl.querySelector(".btn-ver-foto");
        if (ojito) ojito.addEventListener("click", (e) => {
          e.stopPropagation();
          abrirFoto(d.contenido);
        });
      }
    }
  });
}

// ===== TOGGLE SELECCIÓN =====
function toggleSeleccion(tipo, id, cardEl, d) {
  if (seleccionados[tipo].has(id)) {
    seleccionados[tipo].delete(id);
  } else {
    seleccionados[tipo].add(id);
  }
  const nuevoHTML = crearCardHTML(d, true);
  const temp = document.createElement('div');
  temp.innerHTML = nuevoHTML;
  const nuevaCard = temp.firstElementChild;
  nuevaCard.addEventListener("click", () => toggleSeleccion(tipo, id, nuevaCard, d));
  cardEl.replaceWith(nuevaCard);
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

// ===== RENDER INICIO =====
function renderInicio(datos) {
  const setHTML = (selector, html) => {
    document.querySelectorAll(selector).forEach(el => el.innerHTML = html);
  };

  const mensajes  = datos.filter(d => d.tipo === "mensaje").slice(0, 3);
  const fotos     = datos.filter(d => d.tipo === "foto").slice(0, 4);
  const canciones = datos.filter(d => d.tipo === "cancion").slice(0, 4);
  const frases    = datos.filter(d => d.tipo === "frase").slice(0, 3);

  setHTML(".listaMensajes",
    mensajes.map(m => `<li class="text-gray-700 text-sm mb-1 break-all">"${m.contenido}" - ${formatearFechaCorta(m.fecha)}</li>`).join("")
  );

  document.querySelectorAll(".listaFotos").forEach(el => {
    el.innerHTML = fotos.map((f, i) => `
      <div class="w-full h-32 overflow-hidden rounded-lg cursor-pointer" data-foto-idx="${i}">
        <img src="${f.contenido}" alt="Foto" class="w-full h-full object-cover hover:opacity-90 transition">
      </div>`
    ).join("");
    el.querySelectorAll("[data-foto-idx]").forEach((div, i) => {
      div.addEventListener("click", () => abrirFoto(fotos[i].contenido));
    });
  });

  setHTML(".listaCanciones",
    canciones.map(c => {
      let desc = "", link = "";
      try { const p = JSON.parse(c.contenido); desc = p.desc; link = p.link; }
      catch { link = c.contenido; }
      return `
        <li class="mb-2">
          ${desc ? `<p class="text-gray-600 text-sm break-all">"${desc}"</p>` : ""}
          <a href="${link}" target="_blank" class="text-sky-500 hover:underline text-sm">
            ${link.length > 35 ? link.substring(0, 35) + "..." : link}
          </a>
        </li>`;
    }).join("")
  );
  setHTML(".listaFrases",
    frases.map(f => `<li class="text-gray-700 text-sm mb-1 break-all">"${f.contenido}"</li>`).join("")
  );
}

// ===== RENDER TODO =====
function renderTodo(datos) {
  const tipos = ["mensaje", "foto", "cancion", "frase"];
  tipos.forEach(tipo => {
    renderPorFecha(tipo, datos.filter(d => d.tipo === tipo));
  });
  renderInicio(datos);
}

// ===== PLANES =====
let tabPlanActual    = "cita";
let modoEditarPlanes = false;
let planEditandoId   = null;

const modalPlan       = document.getElementById('modalPlan');
const modalPlanTitulo = document.getElementById('modalPlanTitulo');
const inputPlanTexto  = document.getElementById('inputPlanTexto');
const inputPlanFecha  = document.getElementById('inputPlanFecha');
const labelPlanFecha  = document.getElementById('labelPlanFecha');
const cancelarPlan    = document.getElementById('cancelarPlan');
const guardarPlan     = document.getElementById('guardarPlan');

function resetearModoEditarPlanes() {
  if (!modoEditarPlanes) return;
  modoEditarPlanes = false;
  const btn = document.getElementById('btnEditarPlan');
  if (!btn) return;
  btn.classList.add('bg-purple-100', 'text-purple-600');
  btn.classList.remove('bg-purple-500', 'text-white');
  btn.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
      <path stroke-linecap="round" stroke-linejoin="round" d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
      <path stroke-linecap="round" stroke-linejoin="round" d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
    </svg>`;
  const btnNuevo = document.getElementById('btnNuevoPlan');
  if (btnNuevo) btnNuevo.classList.remove('hidden');
  _renderPlanesHTML();
}

// Tabs de planes — Citas y Planes
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

// Modo editar planes
window.activarModoEditarPlanes = () => {
  modoEditarPlanes = !modoEditarPlanes;
  const btn = document.getElementById('btnEditarPlan');
  const btnNuevo = document.getElementById('btnNuevoPlan');
  if (modoEditarPlanes) {
    btn.classList.remove('bg-purple-100', 'text-purple-600');
    btn.classList.add('bg-purple-500', 'text-white');
    btn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
      </svg>`;
    if (btnNuevo) btnNuevo.classList.add('hidden');
  } else {
    btn.classList.add('bg-purple-100', 'text-purple-600');
    btn.classList.remove('bg-purple-500', 'text-white');
    btn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
        <path stroke-linecap="round" stroke-linejoin="round" d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
      </svg>`;
    if (btnNuevo) btnNuevo.classList.remove('hidden');
  }
  _renderPlanesHTML();
};

// Abrir modal nuevo o editar plan
window.abrirModalPlan = (d = null) => {
  planEditandoId = d ? d.id : null;
  modalPlanTitulo.textContent = d ? 'Editar' : 'Nuevo';
  inputPlanTexto.value = d ? d.texto : '';
  guardarPlan.textContent = d ? 'Aceptar' : 'Enviar';

  const tab = d ? d.tab : tabPlanActual;

  if (tab === 'cita') {
    labelPlanFecha.textContent = 'Fecha de la cita (opcional)';
    inputPlanFecha.type = 'date';
    inputPlanFecha.placeholder = '';
  } else {
    labelPlanFecha.textContent = 'Fecha del plan (opcional)';
    inputPlanFecha.type = 'date';
    inputPlanFecha.placeholder = '';
  }

  inputPlanFecha.value = d?.fechaPlan || '';

  modalPlan.classList.remove('hidden');
  modalPlan.classList.add('flex');
  setTimeout(() => {
    modalPlan.classList.remove('opacity-0');
    modalPlan.classList.add('opacity-100');
  }, 10);
};

function cerrarModalPlan() {
  modalPlan.classList.remove('opacity-100');
  modalPlan.classList.add('opacity-0');
  setTimeout(() => {
    modalPlan.classList.add('hidden');
    modalPlan.classList.remove('flex');
  }, 300);
}
cancelarPlan.onclick = cerrarModalPlan;

guardarPlan.onclick = async () => {
  const texto = inputPlanTexto.value.trim();
  if (!texto) return mostrarToast('Escribe algo primero', 'error');
  const fechaPlan = inputPlanFecha.value.trim();

  if (planEditandoId) {
    try {
      await updateDoc(doc(db, 'parejas', codigoPareja, 'planes', planEditandoId), { texto, fechaPlan });
      mostrarToast('¡Editado!', 'exito');
      cerrarModalPlan();
    } catch (e) {
      mostrarToast('Error al editar', 'error');
      console.error(e);
    }
  } else {
    try {
      await addDoc(collection(db, 'parejas', codigoPareja, 'planes'), {
        texto,
        fechaPlan,
        tab: tabPlanActual,
        fecha: new Date(),
        autorUid: miUid,
        completado: false
      });
      mostrarToast('¡Guardado!', 'exito');
      cerrarModalPlan();
    } catch (e) {
      mostrarToast('Error al guardar', 'error');
      console.error(e);
    }
  }
};

// Marcar como completado
window.marcarCompletado = async (id) => {
  try {
    await updateDoc(doc(db, 'parejas', codigoPareja, 'planes', id), {
      completado: true
    });
    mostrarToast('¡Completado!', 'exito');
  } catch (e) {
    mostrarToast('Error', 'error');
    console.error(e);
  }
};

// Desmarcar — con modal de confirmación
window.desmarcarCompletado = async (id, tab) => {
  const nombreTab = tab === 'cita' ? 'cita' : 'plan';
  const modalConf  = document.getElementById('modalConfirmarDesmarcar');
  const btnAceptar = document.getElementById('aceptarDesmarcar');
  const btnCancelar = document.getElementById('cancelarDesmarcar');
  const textoConf  = document.getElementById('textoDesmarcar');

  textoConf.textContent = `¿Estás seguro de desmarcar esta ${nombreTab}?`;
  modalConf.classList.remove('hidden');
  modalConf.classList.add('flex');

  // Clonar botones para evitar listeners duplicados
  const nuevoAceptar = btnAceptar.cloneNode(true);
  const nuevoCancelar = btnCancelar.cloneNode(true);
  btnAceptar.replaceWith(nuevoAceptar);
  btnCancelar.replaceWith(nuevoCancelar);

  nuevoAceptar.onclick = async () => {
    modalConf.classList.add('hidden');
    modalConf.classList.remove('flex');
    try {
      await updateDoc(doc(db, 'parejas', codigoPareja, 'planes', id), {
        completado: false
      });
      mostrarToast('Desmarcado', 'exito');
    } catch (e) {
      mostrarToast('Error', 'error');
      console.error(e);
    }
  };

  nuevoCancelar.onclick = () => {
    modalConf.classList.add('hidden');
    modalConf.classList.remove('flex');
  };
};

// Eliminar plan — con modal de confirmación
window.eliminarPlan = async (id, tab) => {
  const nombreTab = (tab === 'cita') ? 'cita' : 'plan';
  const modalConf  = document.getElementById('modalConfirmarEliminarPlan');
  const btnAceptar = document.getElementById('aceptarEliminarPlan');
  const btnCancelar = document.getElementById('cancelarEliminarPlan');
  const textoConf  = document.getElementById('textoEliminarPlan');

  textoConf.textContent = `¿Estás seguro de eliminar esta ${nombreTab}?`;
  modalConf.classList.remove('hidden');
  modalConf.classList.add('flex');

  // Clonar botones para evitar listeners duplicados
  const nuevoAceptar = btnAceptar.cloneNode(true);
  const nuevoCancelar = btnCancelar.cloneNode(true);
  btnAceptar.replaceWith(nuevoAceptar);
  btnCancelar.replaceWith(nuevoCancelar);

  nuevoAceptar.onclick = async () => {
    modalConf.classList.add('hidden');
    modalConf.classList.remove('flex');
    try {
      await deleteDoc(doc(db, 'parejas', codigoPareja, 'planes', id));
      mostrarToast('¡Eliminado!', 'exito');
    } catch (e) {
      mostrarToast('Error al eliminar', 'error');
      console.error(e);
    }
  };

  nuevoCancelar.onclick = () => {
    modalConf.classList.add('hidden');
    modalConf.classList.remove('flex');
  };
};

// Listener en tiempo real para planes
function renderPlanes() {
  if (renderPlanes._unsub) {
    _renderPlanesHTML();
    return;
  }
  const ref = collection(db, 'parejas', codigoPareja, 'planes');
  renderPlanes._unsub = onSnapshot(ref, snap => {
    renderPlanes._datos = [];
    snap.forEach(d => renderPlanes._datos.push({ id: d.id, ...d.data() }));
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
    // ===== ESTADO VACÍO PERSONALIZADO PARA PLANES =====
    const vaciosPlan = {
      cita: "Aún no hay citas planeadas... ¡propón una! 🗓️",
      plan: "Aún no hay planes... ¡qué se les ocurre! 💡"
    };
    cont.innerHTML = `<p class="text-center text-gray-400 text-sm py-10">${vaciosPlan[tabPlanActual]}</p>`;
    return;
  }

  cont.innerHTML = datos.map(d => {
    // Línea de fecha
    let fechaLinea = '';
    if (d.tab === 'cita' && d.fechaPlan) {
      let fechaTexto = d.fechaPlan;
      try {
        const [y, m, day] = d.fechaPlan.split('-');
        const dt = new Date(parseInt(y), parseInt(m) - 1, parseInt(day));
        fechaTexto = dt.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });
      } catch {}
      fechaLinea = `<p class="text-xs text-purple-400 mt-1">📅 ${fechaTexto}</p>`;
    } else if (d.fechaPlan) {
      fechaLinea = `<p class="text-xs text-purple-400 mt-1">⏳ ${d.fechaPlan}</p>`;
    }

    // Card clickeable en modo editar
    const cardClick = modoEditarPlanes
      ? `onclick='abrirModalPlan(${JSON.stringify(d).replace(/'/g, "&#39;")})'`
      : '';
    const cursorEditar = modoEditarPlanes ? 'cursor-pointer hover:border-purple-600' : '';

    // Botón eliminar en modo editar — ahora pasa también el tab para el modal
    const btnEliminarCard = modoEditarPlanes ? `
      <button onclick="event.stopPropagation(); eliminarPlan('${d.id}', '${d.tab}')"
        class="absolute bottom-3 right-3 text-xs px-2.5 py-1 rounded bg-red-100 text-red-400 hover:bg-red-200 transition">
        Eliminar
      </button>` : '';

    // Círculo palomita — sin tachado en el texto al estar completado
    const btnCirculo = !modoEditarPlanes ? (
      !d.completado
        ? `<button onclick="marcarCompletado('${d.id}')"
            title="Marcar como completado"
            class="absolute top-3 right-3 w-7 h-7 rounded-full border-2 border-purple-300 hover:bg-purple-100 hover:border-purple-500 transition flex items-center justify-center">
          </button>`
        : `<button onclick="desmarcarCompletado('${d.id}', '${d.tab}')"
            title="Desmarcar"
            class="absolute top-3 right-3 w-7 h-7 rounded-full border-2 border-green-400 bg-green-100 hover:bg-green-200 transition flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>
            </svg>
          </button>`
    ) : '';

    return `
      <div ${cardClick}
        class="bg-white shadow rounded-xl p-4 border-2 border-purple-400 relative transition-all ${d.completado ? 'opacity-60' : ''} ${cursorEditar}">
        <p class="text-gray-700 break-words pr-10">${d.texto}</p>
        ${fechaLinea}
        ${btnCirculo}
        ${btnEliminarCard}
      </div>`;
  }).join('');
}
