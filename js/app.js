// ===== FIREBASE =====
import { db, auth } from "./firebase.js";
import { onAuthStateChanged, signOut }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, getDoc, getDocs, collection, addDoc, updateDoc, onSnapshot, query, where }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { mostrarToast } from "./toast.js";

// ===== ESTADO GLOBAL =====
let codigoPareja  = null;
let miUid         = null;
let miGenero      = null;
let unsubscribe   = null;
let cardActual    = null; // card seleccionada con long press
let docActual     = null; // documento de Firestore de la card seleccionada
let timerPress    = null;
let gruposAbiertos = {};

// ===== ELEMENTOS =====
const menuBtn          = document.getElementById('menuBtn');
const sideMenu         = document.getElementById('sideMenu');
const overlay          = document.getElementById('overlay');
const btnCerrarSesion  = document.getElementById('btnCerrarSesion');
const modal            = document.getElementById('modal');
const inputTexto       = document.getElementById('inputTexto');
const inputCancionDiv  = document.getElementById('inputCancionDiv');
const inputDescCancion = document.getElementById('inputDescCancion');
const inputLinkCancion = document.getElementById('inputLinkCancion');
const inputFile        = document.getElementById('inputFile');
const previewImagen    = document.getElementById('previewImagen');
const cancelar         = document.getElementById('cancelar');
const guardar          = document.getElementById('guardar');
const modalFoto        = document.getElementById('modalFoto');
const imagenGrande     = document.getElementById('imagenGrande');
const btnDescargar     = document.getElementById('btnDescargar');
const btnCerrarFoto    = document.getElementById('btnCerrarFoto');
const modalEditar      = document.getElementById('modalEditar');
const editTexto        = document.getElementById('editTexto');
const editCancionDiv   = document.getElementById('editCancionDiv');
const editDescCancion  = document.getElementById('editDescCancion');
const editLinkCancion  = document.getElementById('editLinkCancion');
const cancelarEditar   = document.getElementById('cancelarEditar');
const guardarEditar    = document.getElementById('guardarEditar');
const menuFlotante     = document.getElementById('menuFlotante');
const btnReaccionar    = document.getElementById('btnReaccionar');
const btnEditar        = document.getElementById('btnEditar');

// ===== SESIÓN =====
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

      document.getElementById("userName").textContent     = datos.usuario;
      document.getElementById("userNameMain").textContent = datos.usuario;
      mostrarToast(`¡Bienvenido ${datos.usuario}!`, "info");
    }
    iniciarTiempoReal();
  } catch (error) {
    console.error("Error cargando usuario:", error);
  }
});

// ===== CERRAR SESIÓN =====
btnCerrarSesion.onclick = async () => {
  if (unsubscribe) unsubscribe();
  await signOut(auth);
  window.location.href = "registro.html";
};

// ===== MENÚ =====
menuBtn.onclick = () => {
  sideMenu.classList.remove('-translate-x-full');
  overlay.classList.remove('hidden');
};

overlay.onclick = () => {
  cerrarMenu();
  cerrarMenuFlotante();
};

function cerrarMenu() {
  sideMenu.classList.add('-translate-x-full');
  overlay.classList.add('hidden');
}

document.querySelectorAll('.itemMenu').forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll('.section').forEach(s => s.classList.add('hidden'));
    document.getElementById(btn.dataset.section).classList.remove('hidden');
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
window.abrirFoto = (src) => {
  imagenGrande.src  = src;
  btnDescargar.href = src;
  modalFoto.classList.remove('hidden');
  modalFoto.classList.add('flex');
};

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

// ===== PREVIEW IMAGEN =====
inputFile.addEventListener("change", async () => {
  const archivo = inputFile.files[0];
  if (archivo) {
    const img = await comprimirImagen(archivo);
    previewImagen.src = img;
    previewImagen.classList.remove("hidden");
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
      tipo:      tipoActual,
      contenido: contenido,
      fecha:     new Date(),
      autorUid:  miUid,
      autorGenero: miGenero,
       reacciones: {}
    });
    mostrarToast("¡Guardado!", "exito");
    cerrarModal();
  } catch (error) {
    mostrarToast("Tu pareja aún no se ha registrado, intenta más tarde", "info");
    console.error(error);
  }
}

// ===== MENÚ FLOTANTE (long press) =====
function cerrarMenuFlotante() {
  menuFlotante.classList.add('hidden');
  cardActual = null;
  docActual  = null;
}

function mostrarMenuFlotante(e, cardEl, d) {
  cardActual = cardEl;
  docActual  = d;

  // Mostrar u ocultar botón editar según si es mío
  if (d.autorUid === miUid) {
    btnEditar.classList.remove('hidden');
  } else {
    btnEditar.classList.add('hidden');
  }

  // Posicionar el menú cerca del toque
  const x = e.clientX || (e.touches?.[0]?.clientX) || 100;
  const y = e.clientY || (e.touches?.[0]?.clientY) || 100;

  menuFlotante.style.left = `${Math.min(x, window.innerWidth - 160)}px`;
  menuFlotante.style.top  = `${Math.min(y, window.innerHeight - 120)}px`;
  menuFlotante.classList.remove('hidden');
}

// Cerrar menú flotante al tocar fuera
document.addEventListener('click', (e) => {
  if (!menuFlotante.contains(e.target)) {
    cerrarMenuFlotante();
  }
});

// ===== REACCIONAR =====
async function toggleReaccion(d) {
  if (d.autorUid === miUid) {
    mostrarToast("No puedes reaccionar a tu propio contenido", "info");
    return;
  }

  try {
    const ref = doc(db, "parejas", codigoPareja, "contenido", d.id);

    const yaReacciono = d.reacciones?.[miUid];

    await updateDoc(ref, {
      [`reacciones.${miUid}`]: yaReacciono ? false : true
    });

  } catch (error) {
    console.error(error);
  }
}

function agregarDobleTap(el, d) {
  let lastTap = 0;
  let tapTimeout = null;

  const handler = (e) => {
    e.stopPropagation();

    const now = Date.now();
    const diff = now - lastTap;

    if (diff < 300 && diff > 0) {
      clearTimeout(tapTimeout);

      // DOBLE TAP CONFIRMADO 💖
      toggleReaccion(d);

      lastTap = 0;
    } else {
      lastTap = now;

      tapTimeout = setTimeout(() => {
        lastTap = 0;
      }, 350);
    }
  };

  // móvil
  el.addEventListener("touchend", handler, { passive: true });

  // PC (mouse)
  el.addEventListener("click", handler);
}

// ===== EDITAR =====
btnEditar.onclick = () => {
  if (!docActual) return;
  cerrarMenuFlotante();
  abrirModalEditar(docActual);
};

function abrirModalEditar(d) {
  editTexto.classList.add('hidden');
  editCancionDiv.classList.add('hidden');
  editTexto.value        = "";
  editDescCancion.value  = "";
  editLinkCancion.value  = "";

  if (d.tipo === "mensaje" || d.tipo === "frase") {
    editTexto.classList.remove('hidden');
    editTexto.value = d.contenido;
  } else if (d.tipo === "cancion") {
    editCancionDiv.classList.remove('hidden');
    try {
      const parsed = JSON.parse(d.contenido);
      editDescCancion.value = parsed.desc || "";
      editLinkCancion.value = parsed.link || "";
    } catch {
      editLinkCancion.value = d.contenido;
    }
  }

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
  if (!docActual) return;
  let nuevoContenido = "";

  if (docActual.tipo === "mensaje" || docActual.tipo === "frase") {
    nuevoContenido = editTexto.value.trim();
    if (!nuevoContenido) return mostrarToast("Escribe algo", "error");
  } else if (docActual.tipo === "cancion") {
    const desc = editDescCancion.value.trim();
    const link = editLinkCancion.value.trim();
    if (!desc) return mostrarToast("Escribe la descripción", "error");
    if (!link) return mostrarToast("Escribe el link", "error");
    nuevoContenido = JSON.stringify({ desc, link });
  }

  try {
    await updateDoc(doc(db, "parejas", codigoPareja, "contenido", docActual.id), {
      contenido: nuevoContenido
    });
    mostrarToast("¡Editado!", "exito");
    cerrarModalEditar();
  } catch (error) {
    mostrarToast("Error al editar", "error");
    console.error(error);
  }
};

// ===== TIEMPO REAL =====
function iniciarTiempoReal() {
  if (!codigoPareja) return;
  if (unsubscribe) unsubscribe();

  const ref = collection(db, "parejas", codigoPareja, "contenido");

  unsubscribe = onSnapshot(ref, (snapshot) => {
    const datos = [];
    snapshot.forEach(d => datos.push({ id: d.id, ...d.data() }));

    datos.sort((a, b) => {
      const fa = a.fecha?.toDate ? a.fecha.toDate() : new Date(a.fecha);
      const fb = b.fecha?.toDate ? b.fecha.toDate() : new Date(b.fecha);
      return fb - fa;
    });

    renderTodo(datos);

    
  });
}

// ===== SCROLL Y ANIMAR REACCIÓN =====
async function scrollYAnimarReaccion(docId) {
  const cardEl = document.querySelector(`[data-id="${docId}"]`);
  if (!cardEl) return;

  cardEl.scrollIntoView({ behavior: "smooth", block: "center" });

  setTimeout(() => {
    cardEl.classList.add('rebote-card');
    setTimeout(() => cardEl.classList.remove('rebote-card'), 700);
  }, 600);

  // Marcar como vista
  try {
    await updateDoc(doc(db, "parejas", codigoPareja, "contenido", docId), {
      reaccionVistaPor: miUid
    });
  } catch (error) {
    console.error("Error marcando reacción vista:", error);
  }
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

// ===== BRILLO GIRATORIO (solo lo ve la contraparte) =====
function brilloClass(d) {
  return "";
}

// ===== REACCIÓN HEART =====
function heartClass(d) {
  const reacciono = d.reacciones?.[miUid];

  if (!reacciono) return "";

  return miGenero === "hombre"
    ? "💙"
    : "❤️";
}

// ===== LONG PRESS EN CARDS =====
function agregarLongPress(el, d) {
  let timer = null;

  const iniciar = (e) => {
    timer = setTimeout(() => {
      mostrarMenuFlotante(e, el, d);
    }, 500);
  };

  const cancelar = () => {
    clearTimeout(timer);
  };

  el.addEventListener('mousedown',  iniciar);
  el.addEventListener('touchstart', iniciar, { passive: true });
  el.addEventListener('mouseup',    cancelar);
  el.addEventListener('mouseleave', cancelar);
  el.addEventListener('touchend',   cancelar);
}

// ===== CREAR CARD =====
function crearCardHTML(d) {
  const borde   = borderPorGenero(d.autorGenero);
  const brillo  = brilloClass(d);
  const corazon = heartClass(d);
  const esReciente = brillo !== "";

  if (d.tipo === "mensaje" || d.tipo === "frase") {
    return `
      <div data-id="${d.id}"
        class="bg-white shadow-lg rounded-xl p-5 ${borde} ${brillo} relative transition-all duration-300">
        <p class="text-gray-700 text-lg">"${d.contenido}"</p>
        ${corazon ? `<span class="absolute bottom-1 right-1 text-lg">${corazon}</span>` : ""}
      </div>`;
  }

  if (d.tipo === "foto") {
    return `
      <div data-id="${d.id}"
        class="bg-white shadow-lg rounded-xl p-3 cursor-pointer ${borde} ${brillo} relative transition-all duration-300"
        onclick="abrirFoto('${d.contenido}')">
        <img src="${d.contenido}" alt="Foto" class="w-full h-48 object-cover rounded-lg hover:opacity-90 transition">
        ${corazon ? `<span class="absolute bottom-1 right-1 text-lg">${corazon}</span>` : ""}
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
        class="bg-white shadow-lg rounded-xl p-5 ${borde} ${brillo} relative transition-all duration-300">
        ${desc ? `<p class="text-gray-700 text-base mb-3">"${desc}"</p>` : ""}
        <div class="flex items-center justify-between">
          <a href="${link}" target="_blank" class="text-sky-500 hover:underline text-sm truncate max-w-[70%]">${link}</a>
          <a href="${link}" target="_blank"
            class="ml-2 px-3 py-1.5 bg-sky-400 hover:bg-sky-500 text-white text-sm rounded-lg transition whitespace-nowrap">
            Escuchar ▶
          </a>
        </div>
        ${corazon ? `<span class="absolute bottom-1 right-1 text-lg">${corazon}</span>` : ""}
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

  const grupos = {};
  datos.forEach(d => {
    const grupo = obtenerGrupoFecha(d.fecha);
    if (!grupos[grupo]) grupos[grupo] = [];
    grupos[grupo].push(d);
  });

  let html = "";
  Object.keys(grupos).forEach((grupo, index) => {
    const id    = `grupo-${tipo}-${index}`;
    const abiertoGuardado = gruposAbiertos[id];
    const esHoy = grupo === "Hoy" || abiertoGuardado;

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
          ${grupos[grupo].map(d => crearCardHTML(d)).join("")}
        </div>
      </div>`;
  });

  cont.innerHTML = html;

  // Agregar long press a cada card
  datos.forEach(d => {
  const cardEl = cont.querySelector(`[data-id="${d.id}"]`);
  if (cardEl) {
    agregarLongPress(cardEl, d); // lo puedes dejar o quitar luego
    agregarDobleTap(cardEl, d);  // 👈 nuevo
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
    gruposAbiertos[id] = false; // 🔥 guardar estado
  } else {
    contenedor.classList.remove("max-h-0", "opacity-0");
    contenedor.classList.add("max-h-[2000px]", "opacity-100");
    if (flecha) flecha.style.transform = "rotate(0deg)";
    gruposAbiertos[id] = true; // 🔥 guardar estado
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
    mensajes.map(m => `<li class="text-gray-700 text-sm mb-1">"${m.contenido}" - ${formatearFechaCorta(m.fecha)}</li>`).join("")
  );
  setHTML(".listaFotos",
    fotos.map(f => `
      <img src="${f.contenido}" alt="Foto"
        class="rounded-lg w-full h-32 object-cover cursor-pointer hover:opacity-90 transition"
        onclick="abrirFoto('${f.contenido}')">`
    ).join("")
  );
  setHTML(".listaCanciones",
    canciones.map(c => {
      let desc = "", link = "";
      try { const p = JSON.parse(c.contenido); desc = p.desc; link = p.link; }
      catch { link = c.contenido; }
      return `
        <li class="mb-2">
          ${desc ? `<p class="text-gray-600 text-sm">"${desc}"</p>` : ""}
          <a href="${link}" target="_blank" class="text-sky-500 hover:underline text-sm">
            ${link.length > 35 ? link.substring(0, 35) + "..." : link}
          </a>
        </li>`;
    }).join("")
  );
  setHTML(".listaFrases",
    frases.map(f => `<li class="text-gray-700 text-sm mb-1">"${f.contenido}"</li>`).join("")
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
