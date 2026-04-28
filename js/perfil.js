import { auth, db } from "./firebase.js";
import {
  onAuthStateChanged,
  signOut,
  updatePassword,
  EmailAuthProvider,
  reauthenticateWithCredential,
  setPersistence,
  browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  doc, getDoc, updateDoc, setDoc, collection, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { mostrarToast } from "./toast.js";

// ===== ELEMENTOS =====
const fotoPerfil             = document.getElementById("fotoPerfil");
const contenedorFoto         = document.getElementById("contenedorFoto");
const overlayFoto            = document.getElementById("overlayFoto");
const inputFotoPerfil        = document.getElementById("inputFotoPerfil");
const btnEliminarFoto        = document.getElementById("btnEliminarFoto");
const nombrePerfil           = document.getElementById("nombrePerfil");
const correoPerfil           = document.getElementById("correoPerfil");
const generoPerfil           = document.getElementById("generoPerfil");
const parejaPerfil           = document.getElementById("parejaPerfil");
const apodoPareja            = document.getElementById("apodoPareja");
const codigoPerfil           = document.getElementById("codigoPerfil");
const inputNombrePerfil      = document.getElementById("inputNombrePerfil");
const btnEditarPerfil        = document.getElementById("btnEditarPerfil");
const btnGuardarPerfil       = document.getElementById("btnGuardarPerfil");
const btnCancelarPerfil      = document.getElementById("btnCancelarPerfil");
const botonesEdicion         = document.getElementById("botonesEdicion");
const btnCerrarSesionPerfil  = document.getElementById("btnCerrarSesionPerfil");
const btnAbrirPassword       = document.getElementById("btnAbrirPassword");
const btnVerPareja           = document.getElementById("btnVerPareja");
const btnAbrirApodo          = document.getElementById("btnAbrirApodo");

// Modal ver foto propia
const modalVerFoto           = document.getElementById("modalVerFoto");
const fotoGrandePerfil       = document.getElementById("fotoGrandePerfil");
const btnCerrarVerFoto       = document.getElementById("btnCerrarVerFoto");

// Modal perfil pareja
const modalPerfilPareja      = document.getElementById("modalPerfilPareja");
const fotoParejaPerfil       = document.getElementById("fotoParejaPerfil");
const nombreParejaModal      = document.getElementById("nombreParejaModal");
const generoParejaModal      = document.getElementById("generoParejaModal");
const codigoParejaModal      = document.getElementById("codigoParejaModal");
const btnCerrarPerfilPareja  = document.getElementById("btnCerrarPerfilPareja");

// Modal ver foto grande de la PAREJA
const modalVerFotoPareja     = document.getElementById("modalVerFotoPareja");
const fotoGrandePareja       = document.getElementById("fotoGrandePareja");
const btnCerrarVerFotoPareja = document.getElementById("btnCerrarVerFotoPareja");

// Modal preview foto nueva
const modalFotoPreview       = document.getElementById("modalFotoPreview");
const previewFotoPerfil      = document.getElementById("previewFotoPerfil");
const btnCancelarFotoPreview = document.getElementById("btnCancelarFotoPreview");
const btnConfirmarFotoPreview= document.getElementById("btnConfirmarFotoPreview");

// Modal confirmar guardar
const modalConfirmarGuardar  = document.getElementById("modalConfirmarGuardar");
const btnCancelarGuardar     = document.getElementById("btnCancelarGuardar");
const btnAceptarGuardar      = document.getElementById("btnAceptarGuardar");

// Modal confirmar cancelar
const modalConfirmarCancelar = document.getElementById("modalConfirmarCancelar");
const btnSeguirEditando      = document.getElementById("btnSeguirEditando");
const btnAceptarCancelar     = document.getElementById("btnAceptarCancelar");

// Modal contraseña
const modalPassword          = document.getElementById("modalPassword");
const inputPasswordActual    = document.getElementById("inputPasswordActual");
const inputPasswordNueva     = document.getElementById("inputPasswordNueva");
const errorPasswordActual    = document.getElementById("errorPasswordActual");
const errorPasswordNueva     = document.getElementById("errorPasswordNueva");
const btnCancelarPassword    = document.getElementById("btnCancelarPassword");
const btnGuardarPassword     = document.getElementById("btnGuardarPassword");

// Modal apodo
const modalApodo             = document.getElementById("modalApodo");
const inputApodo             = document.getElementById("inputApodo");
const btnCancelarApodo       = document.getElementById("btnCancelarApodo");
const btnGuardarApodo        = document.getElementById("btnGuardarApodo");

// ===== ESTADO =====
let nuevaFotoBase64   = null;
let eliminarFoto      = false;
let fotoOriginal      = null;
let modoEdicion       = false;
let archivoFotoPrev   = null;
let uid               = null;
let codigoPareja      = null;
let datosPareja       = null;

let passwordPendiente = null;
let apodoPendiente    = null;
let apodoOriginal     = "";

// Notis in-app
let idsConocidosPerfil     = null;
let unsubscribeNotisPerfil = null;

const mensajesInApp = {
  mensaje: "Recibiste un mensaje nuevo 💬",
  foto:    "Recibiste una foto nueva 📸",
  cancion: "Recibiste una canción nueva 🎵",
  frase:   "Recibiste una frase nueva 💭"
};

function iniciarNotisPerfil(codigoPar, miUidLocal) {
  if (!codigoPar) return;
  const ref = collection(db, "parejas", codigoPar, "contenido");
  unsubscribeNotisPerfil = onSnapshot(ref, (snapshot) => {
    const ids = new Set();
    snapshot.forEach(d => ids.add(d.id));

    if (idsConocidosPerfil === null) {
      idsConocidosPerfil = ids;
    } else {
      snapshot.forEach(d => {
        if (!idsConocidosPerfil.has(d.id) && d.data().autorUid !== miUidLocal) {
          const tipo = d.data().tipo;
          mostrarToast(mensajesInApp[tipo] || "Tu pareja compartió algo nuevo 💕", "info");
        }
        idsConocidosPerfil.add(d.id);
      });
    }
  });
}

window.addEventListener("beforeunload", () => {
  if (unsubscribeNotisPerfil) unsubscribeNotisPerfil();
});

// ===== CARGAR USUARIO =====
setPersistence(auth, browserLocalPersistence).then(() => {
  onAuthStateChanged(auth, async (user) => {
    if (!user) { window.location.href = "registro.html"; return; }

    uid = user.uid;
    const snap = await getDoc(doc(db, "usuarios", user.uid));

    if (snap.exists()) {
      const datos = snap.data();
      codigoPareja = datos.codigo;

      nombrePerfil.textContent = datos.usuario;
      correoPerfil.textContent = user.email;
      generoPerfil.textContent = datos.genero || "—";
      codigoPerfil.textContent = datos.codigo || "—";

      fotoOriginal = datos.foto || generarAvatar(datos.usuario);
      fotoPerfil.src = fotoOriginal;

      apodoOriginal = datos.apodoPareja || "";
      actualizarApodoUI(apodoOriginal);

      await cargarDatosPareja(datos.codigo, user.uid);
      iniciarNotisPerfil(datos.codigo, user.uid);
    } else {
      window.location.href = "registro.html";
    }
  });
});

// ===== APODO UI =====
function actualizarApodoUI(apodo) {
  if (apodo) {
    apodoPareja.textContent = `(${apodo})`;
    apodoPareja.classList.remove("hidden");
  } else {
    apodoPareja.textContent = "";
    apodoPareja.classList.add("hidden");
  }
}

// ===== CARGAR DATOS PAREJA =====
async function cargarDatosPareja(codigo, miUid) {
  if (!codigo) {
    parejaPerfil.textContent = "Sin pareja registrada";
    btnVerPareja.classList.add("hidden");
    return;
  }
  try {
    const parejaDoc = await getDoc(doc(db, "parejas", codigo));
    if (!parejaDoc.exists()) {
      parejaPerfil.textContent = "Sin pareja registrada";
      btnVerPareja.classList.add("hidden");
      return;
    }

    const miembros = parejaDoc.data()?.usuarios || [];
    const uidPareja = miembros.find(u => u !== miUid);
    if (!uidPareja) {
      parejaPerfil.textContent = "Sin pareja registrada";
      btnVerPareja.classList.add("hidden");
      return;
    }

    const parejaSnap = await getDoc(doc(db, "usuarios", uidPareja));
    if (parejaSnap.exists()) {
      datosPareja = { uid: uidPareja, ...parejaSnap.data() };
      parejaPerfil.textContent = datosPareja.usuario || "—";
    }
  } catch {
    parejaPerfil.textContent = "—";
  }
}

// ===== VER PERFIL PAREJA =====
btnVerPareja.onclick = () => {
  if (!datosPareja) return;
  fotoParejaPerfil.src = datosPareja.foto || generarAvatar(datosPareja.usuario);
  nombreParejaModal.textContent = datosPareja.usuario || "—";
  generoParejaModal.textContent = datosPareja.genero  || "—";
  codigoParejaModal.textContent = codigoPareja         || "—";
  modalPerfilPareja.classList.remove("hidden");
  modalPerfilPareja.classList.add("flex");
};

btnCerrarPerfilPareja.onclick = () => {
  modalPerfilPareja.classList.add("hidden");
  modalPerfilPareja.classList.remove("flex");
};

// ===== VER FOTO GRANDE PAREJA =====
fotoParejaPerfil.addEventListener("click", () => {
  if (!fotoParejaPerfil.src) return;
  fotoGrandePareja.src = fotoParejaPerfil.src;
  modalVerFotoPareja.classList.remove("hidden");
  modalVerFotoPareja.classList.add("flex");
});

btnCerrarVerFotoPareja.onclick = () => {
  modalVerFotoPareja.classList.add("hidden");
  modalVerFotoPareja.classList.remove("flex");
};

// ===== FOTO PROPIA =====
contenedorFoto.addEventListener("click", () => {
  if (modoEdicion) {
    inputFotoPerfil.click();
  } else {
    fotoGrandePerfil.src = fotoPerfil.src;
    modalVerFoto.classList.remove("hidden");
    modalVerFoto.classList.add("flex");
  }
});

btnCerrarVerFoto.onclick = () => {
  modalVerFoto.classList.add("hidden");
  modalVerFoto.classList.remove("flex");
};

// ===== PREVIEW FOTO NUEVA =====
inputFotoPerfil.addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  archivoFotoPrev = file;
  const base64 = await comprimirImagen(file);
  previewFotoPerfil.src = base64;
  modalFotoPreview.classList.remove("hidden");
  modalFotoPreview.classList.add("flex");
});

btnCancelarFotoPreview.onclick = () => {
  modalFotoPreview.classList.add("hidden");
  modalFotoPreview.classList.remove("flex");
  archivoFotoPrev = null;
  inputFotoPerfil.value = "";
};

btnConfirmarFotoPreview.onclick = async () => {
  if (!archivoFotoPrev) return;
  nuevaFotoBase64 = await comprimirImagen(archivoFotoPrev);
  eliminarFoto = false;
  fotoPerfil.src = nuevaFotoBase64;
  modalFotoPreview.classList.add("hidden");
  modalFotoPreview.classList.remove("flex");
};

// ===== QUITAR FOTO =====
btnEliminarFoto.onclick = () => {
  nuevaFotoBase64 = null;
  eliminarFoto    = true;
  const nombre = inputNombrePerfil.value || nombrePerfil.textContent;
  fotoPerfil.src = generarAvatar(nombre);
};

// ===== MODO EDICIÓN =====
btnEditarPerfil.onclick = () => {
  modoEdicion       = true;
  passwordPendiente = null;
  apodoPendiente    = null;

  inputNombrePerfil.value = nombrePerfil.textContent;

  nombrePerfil.classList.add("hidden");
  inputNombrePerfil.classList.remove("hidden");
  btnAbrirPassword.classList.remove("hidden");
  btnEliminarFoto.classList.remove("hidden");
  btnAbrirApodo.classList.remove("hidden");
  botonesEdicion.classList.remove("hidden");
  btnCerrarSesionPerfil.classList.add("hidden");
  btnEditarPerfil.classList.add("hidden");

  overlayFoto.classList.remove("opacity-0");
  overlayFoto.classList.add("opacity-100");
  overlayFoto.style.backgroundColor = "rgba(0,0,0,0.35)";
  overlayFoto.style.pointerEvents = "none";
};

function salirModoEdicion() {
  modoEdicion       = false;
  nuevaFotoBase64   = null;
  eliminarFoto      = false;
  archivoFotoPrev   = null;
  passwordPendiente = null;
  apodoPendiente    = null;

  nombrePerfil.classList.remove("hidden");
  inputNombrePerfil.classList.add("hidden");
  btnAbrirPassword.classList.add("hidden");
  btnEliminarFoto.classList.add("hidden");
  btnAbrirApodo.classList.add("hidden");
  botonesEdicion.classList.add("hidden");
  btnCerrarSesionPerfil.classList.remove("hidden");
  btnEditarPerfil.classList.remove("hidden");

  overlayFoto.classList.remove("opacity-100");
  overlayFoto.classList.add("opacity-0");
  overlayFoto.style.backgroundColor = "";

  fotoPerfil.src = fotoOriginal;
  inputFotoPerfil.value = "";

  actualizarApodoUI(apodoOriginal);
}

// ===== CANCELAR PERFIL =====
btnCancelarPerfil.onclick = () => {
  modalConfirmarCancelar.classList.remove("hidden");
  modalConfirmarCancelar.classList.add("flex");
};

btnSeguirEditando.onclick = () => {
  modalConfirmarCancelar.classList.add("hidden");
  modalConfirmarCancelar.classList.remove("flex");
};

btnAceptarCancelar.onclick = () => {
  modalConfirmarCancelar.classList.add("hidden");
  modalConfirmarCancelar.classList.remove("flex");
  salirModoEdicion();
};

// ===== APODO =====
btnAbrirApodo.onclick = () => {
  inputApodo.value = apodoPendiente !== null ? apodoPendiente : apodoOriginal;
  modalApodo.classList.remove("hidden");
  modalApodo.classList.add("flex");
};

btnCancelarApodo.onclick = () => {
  modalApodo.classList.add("hidden");
  modalApodo.classList.remove("flex");
};

btnGuardarApodo.onclick = () => {
  const apodo = inputApodo.value.trim();
  apodoPendiente = apodo;
  actualizarApodoUI(apodo);
  modalApodo.classList.add("hidden");
  modalApodo.classList.remove("flex");
};

// ===== CONTRASEÑA =====
btnAbrirPassword.onclick = () => {
  inputPasswordActual.value = "";
  inputPasswordNueva.value  = "";
  errorPasswordActual.classList.add("hidden");
  errorPasswordNueva.classList.add("hidden");
  modalPassword.classList.remove("hidden");
  modalPassword.classList.add("flex");
};

btnCancelarPassword.onclick = () => {
  modalPassword.classList.add("hidden");
  modalPassword.classList.remove("flex");
};

btnGuardarPassword.onclick = () => {
  const actual = inputPasswordActual.value.trim();
  const nueva  = inputPasswordNueva.value.trim();
  let valido   = true;

  errorPasswordActual.classList.add("hidden");
  errorPasswordNueva.classList.add("hidden");

  if (!actual) {
    errorPasswordActual.textContent = "Ingresa tu contraseña actual";
    errorPasswordActual.classList.remove("hidden");
    valido = false;
  }
  if (nueva.length < 6) {
    errorPasswordNueva.textContent = "Mínimo 6 caracteres";
    errorPasswordNueva.classList.remove("hidden");
    valido = false;
  }
  if (!valido) return;

  passwordPendiente = { actual, nueva };
  modalPassword.classList.add("hidden");
  modalPassword.classList.remove("flex");
};

// ===== GUARDAR PERFIL =====
btnGuardarPerfil.onclick = () => {
  const nuevoNombre = inputNombrePerfil.value.trim();
  if (!nuevoNombre) { mostrarToast("El nombre no puede estar vacío", "error"); return; }
  modalConfirmarGuardar.classList.remove("hidden");
  modalConfirmarGuardar.classList.add("flex");
};

btnCancelarGuardar.onclick = () => {
  modalConfirmarGuardar.classList.add("hidden");
  modalConfirmarGuardar.classList.remove("flex");
};

btnAceptarGuardar.onclick = async () => {
  modalConfirmarGuardar.classList.add("hidden");
  modalConfirmarGuardar.classList.remove("flex");

  const nuevoNombre = inputNombrePerfil.value.trim();

  try {
    if (passwordPendiente) {
      const user = auth.currentUser;
      const credential = EmailAuthProvider.credential(user.email, passwordPendiente.actual);
      try {
        await reauthenticateWithCredential(user, credential);
        await updatePassword(user, passwordPendiente.nueva);
      } catch (error) {
        if (error.code === "auth/wrong-password" || error.code === "auth/invalid-credential") {
          mostrarToast("Contraseña actual incorrecta", "error");
        } else {
          mostrarToast("Error al cambiar contraseña", "error");
        }
        return;
      }
    }

    const updateData = { usuario: nuevoNombre };
    if (nuevaFotoBase64) updateData.foto = nuevaFotoBase64;
    if (eliminarFoto)    updateData.foto = null;

    if (apodoPendiente !== null) {
      updateData.apodoPareja = apodoPendiente;
      apodoOriginal = apodoPendiente;
    }

    await updateDoc(doc(db, "usuarios", uid), updateData);

    nombrePerfil.textContent = nuevoNombre;
    if (nuevaFotoBase64)   fotoOriginal = nuevaFotoBase64;
    else if (eliminarFoto) fotoOriginal = generarAvatar(nuevoNombre);
    fotoPerfil.src = fotoOriginal;

    salirModoEdicion();
    mostrarToast("Perfil actualizado", "exito");
  } catch (error) {
    console.error(error);
    mostrarToast("Error al actualizar perfil", "error");
  }
};

// ===== CERRAR SESIÓN =====
btnCerrarSesionPerfil.onclick = async () => {
  if (uid) {
    await setDoc(doc(db, "usuarios", uid), { oneSignalId: null }, { merge: true });
  }
  await signOut(auth);
  window.location.href = "registro.html";
};

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
        else if (h > max)     { w *= max / h; h = max; }
        canvas.width = w; canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.7));
      };
    };
    reader.readAsDataURL(file);
  });
}

// ===== AVATAR =====
function generarAvatar(nombre) {
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(nombre)}&background=EC4899&color=fff`;
}