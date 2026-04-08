import { auth, db } from "./firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, getDoc, collection, onSnapshot } 
from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ===== MENU =====
const menuBtn = document.getElementById('menuBtn');
const sideMenu = document.getElementById('sideMenu');
const overlay = document.getElementById('overlay');

const menuButtons = document.querySelectorAll('.menuBtn');
const sections = document.querySelectorAll('.section');

menuBtn.onclick = () => {
  sideMenu.classList.remove('-translate-x-full');
  overlay.classList.remove('hidden');
};

overlay.onclick = cerrarMenu;

function cerrarMenu() {
  sideMenu.classList.add('-translate-x-full');
  overlay.classList.add('hidden');
}

menuButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    sections.forEach(sec => sec.classList.add('hidden'));
    document.getElementById(btn.dataset.section).classList.remove('hidden');
    cerrarMenu();
  });
});

// ===== CERRAR SESIÓN =====
const btnCerrarSesion = document.getElementById("btnCerrarSesion");

if (btnCerrarSesion) {
  btnCerrarSesion.onclick = async () => {
    await signOut(auth);
    window.location.href = "registro.html";
  };
}

// ===== SESIÓN =====
let codigoPareja = null;

const userName = document.getElementById("userName");
const userNameMain = document.getElementById("userNameMain");

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "registro.html";
    return;
  }

  const docRef = doc(db, "usuarios", user.uid);
  const docSnap = await getDoc(docRef);

  if (docSnap.exists()) {
    const data = docSnap.data();

    userName.textContent = data.usuario;
    userNameMain.textContent = data.usuario;

    codigoPareja = data.codigo;

    iniciarTiempoReal();
  }
});

// ===== TIEMPO REAL =====
function iniciarTiempoReal() {
  if (!codigoPareja) return;

  const ref = collection(db, "parejas", codigoPareja, "contenido");

  let primeraCarga = true;

  onSnapshot(ref, (snapshot) => {

    const datos = [];

    // 🔥 DETECTAR NUEVOS DATOS
    snapshot.docChanges().forEach(change => {
      if (change.type === "added") {

        if (!primeraCarga) {
          mostrarNotificacion();
        }

      }
    });

    snapshot.forEach(doc => {
      datos.push({ id: doc.id, ...doc.data() });
    });

    primeraCarga = false;

    datos.sort((a, b) => {
      const fa = a.fecha?.toDate ? a.fecha.toDate() : new Date(a.fecha);
      const fb = b.fecha?.toDate ? b.fecha.toDate() : new Date(b.fecha);
      return fb - fa;
    });

    renderTodo(datos);
  });
}

// 🔔 NOTIFICACIÓN
function mostrarNotificacion() {
  if (Notification.permission === "granted") {
    new Notification("💖 Daily Love", {
      body: "Tu pareja acaba de publicar algo 💌",
      icon: "DailyLove.png"
    });
  }
}

// ===== FECHAS =====
function obtenerGrupoFecha(fecha) {
  const hoy = new Date();
  const f = fecha?.toDate ? fecha.toDate() : new Date(fecha);

  const diff = Math.floor((hoy - f) / (1000 * 60 * 60 * 24));

  if (diff === 0) return "Hoy";
  if (diff === 1) return "Ayer";
  return f.toLocaleDateString('es-MX');
}

function formatearFechaCorta(fecha) {
  const f = fecha?.toDate ? fecha.toDate() : new Date(fecha);
  return f.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });
}

// ===== RENDER =====
function renderTodo(datos) {

  const tipos = ["mensaje", "foto", "cancion", "video", "frase"];

  tipos.forEach(tipo => {
    const filtrados = datos.filter(d => d.tipo === tipo);
    renderPorFecha(tipo, filtrados);
  });

  renderInicio(datos);
}

// ===== RENDER SECCIONES =====
function renderPorFecha(tipo, datos) {

  const contenedorMap = {
    mensaje: "#mensajesContainer",
    foto: "#fotosContainer",
    cancion: "#cancionesContainer",
    video: "#videosContainer",
    frase: "#frasesContainer"
  };

  const cont = document.querySelector(contenedorMap[tipo]);
  if (!cont) return;

  const grupos = {};

  datos.forEach(d => {
    const grupo = obtenerGrupoFecha(d.fecha);
    if (!grupos[grupo]) grupos[grupo] = [];
    grupos[grupo].push(d);
  });

  let html = "";

  Object.keys(grupos).forEach((grupo, index) => {

    const id = `grupo-${tipo}-${index}`;
    const esHoy = grupo === "Hoy";

    html += `
      <div class="mt-4">
        <div onclick="toggleGrupo('${id}', this)"
          class="flex justify-between items-center cursor-pointer">

          <p class="text-sm text-gray-500">${grupo}</p>

          <span class="flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg"
              class="w-5 h-5 text-gray-400 transition-transform duration-300"
              fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round"
                d="M19 9l-7 7-7-7"/>
            </svg>
          </span>
        </div>

        <div id="${id}"
          class="space-y-3 overflow-hidden transition-all duration-500 ease-in-out ${esHoy ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0"}">

          ${grupos[grupo].map(d => crearCard(d)).join("")}

        </div>
      </div>
    `;
  });

  cont.innerHTML = html;
}

// ===== CARDS =====
function crearCard(d) {

  if (d.tipo === "mensaje" || d.tipo === "frase") {
    return `
      <div class="bg-white shadow-lg rounded-xl p-5">
        <p class="text-gray-700 text-lg">"${d.contenido}"</p>
      </div>
    `;
  }

  if (d.tipo === "foto") {
    return `
      <div class="bg-white shadow-lg rounded-xl p-3 cursor-pointer"
        onclick="abrirFoto('${d.contenido}')">
        <img src="${d.contenido}" class="w-full h-48 object-cover rounded-lg">
      </div>
    `;
  }

  if (d.tipo === "cancion") {
    return `
      <div class="bg-white shadow-lg rounded-xl p-5">
        <a href="${d.contenido}" target="_blank" class="text-pink-500 hover:underline">
          Escuchar 💖
        </a>
      </div>
    `;
  }

  if (d.tipo === "video") {
    return `
      <div class="bg-white shadow-lg rounded-xl p-5">
        <a href="${d.contenido}" target="_blank" class="text-pink-500 hover:underline">
          Ver video 🎥
        </a>
      </div>
    `;
  }

  return "";
}

// ===== INICIO =====
function renderInicio(datos) {

  const setHTML = (selector, html) => {
    document.querySelectorAll(selector).forEach(el => {
      el.innerHTML = html;
    });
  };

  const mensajes = datos.filter(d => d.tipo === "mensaje").slice(0, 3);
  const fotos = datos.filter(d => d.tipo === "foto").slice(0, 4);
  const canciones = datos.filter(d => d.tipo === "cancion").slice(0, 3);
  const videos = datos.filter(d => d.tipo === "video").slice(0, 3);
  const frases = datos.filter(d => d.tipo === "frase").slice(0, 3);

  setHTML(".listaMensajes",
    mensajes.map(m => `<li>"${m.contenido}" - ${formatearFechaCorta(m.fecha)}</li>`).join("")
  );

  setHTML(".listaFotos",
    fotos.map(f => `
      <img src="${f.contenido}" 
        class="rounded-lg w-full h-32 object-cover cursor-pointer"
        onclick="abrirFoto('${f.contenido}')">
    `).join("")
  );

  setHTML(".listaCanciones",
    canciones.map(c => `<li><a href="${c.contenido}" target="_blank" class="text-pink-500 hover:underline">Escuchar 💖</a></li>`).join("")
  );

  setHTML(".listaVideos",
    videos.map(v => `<li><a href="${v.contenido}" target="_blank" class="text-pink-500 hover:underline">Ver 🎥</a></li>`).join("")
  );

  setHTML(".listaFrases",
    frases.map(f => `<li>"${f.contenido}"</li>`).join("")
  );
}

// ===== TOGGLE =====
window.toggleGrupo = (id, el) => {
  const contenedor = document.getElementById(id);
  const flecha = el.querySelector("svg");

  const abierto = !contenedor.classList.contains("max-h-0");

  if (abierto) {
    contenedor.classList.add("max-h-0", "opacity-0");
    contenedor.classList.remove("max-h-[2000px]", "opacity-100");
    if (flecha) flecha.style.transform = "rotate(-90deg)";
  } else {
    contenedor.classList.remove("max-h-0", "opacity-0");
    contenedor.classList.add("max-h-[2000px]", "opacity-100");
    if (flecha) flecha.style.transform = "rotate(0deg)";
  }
};

// ===== FOTO MODAL =====
window.abrirFoto = (src) => {
  const modal = document.getElementById("modalFoto");
  const img = document.getElementById("imagenGrande");
  const descargar = document.getElementById("btnDescargar");
  const cerrar = document.getElementById("btnCerrarFoto");

  if (!modal) return;

  img.src = src;
  descargar.href = src;

  modal.classList.remove("hidden");
  modal.classList.add("flex");

  cerrar.onclick = () => {
    modal.classList.add("hidden");
    modal.classList.remove("flex");
  };
};


