import { auth, db } from "./firebase.js";
import {
  onAuthStateChanged,
  signOut,
  updatePassword,
  EmailAuthProvider,
  reauthenticateWithCredential
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  doc, getDoc, updateDoc, setDoc, collection, query, where, getDocs
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { mostrarToast } from "./toast.js";

// ===== ELEMENTOS =====
const fotoPerfil          = document.getElementById("fotoPerfil");
const contenedorFoto      = document.getElementById("contenedorFoto");
const inputFotoPerfil     = document.getElementById("inputFotoPerfil");
const btnEliminarFoto     = document.getElementById("btnEliminarFoto");
const nombrePerfil        = document.getElementById("nombrePerfil");
const correoPerfil        = document.getElementById("correoPerfil");
const generoPerfil        = document.getElementById("generoPerfil");
const parejaPerfil        = document.getElementById("parejaPerfil");
const codigoPerfil        = document.getElementById("codigoPerfil");
const inputNombrePerfil   = document.getElementById("inputNombrePerfil");
const btnEditarPerfil     = document.getElementById("btnEditarPerfil");
const btnGuardarPerfil    = document.getElementById("btnGuardarPerfil");
const btnCancelarPerfil   = document.getElementById("btnCancelarPerfil");
const botonesEdicion      = document.getElementById("botonesEdicion");
const btnCerrarSesionPerfil = document.getElementById("btnCerrarSesionPerfil");
const btnAbrirPassword    = document.getElementById("btnAbrirPassword");

// Modales
const modalFotoPreview       = document.getElementById("modalFotoPreview");
const previewFotoPerfil      = document.getElementById("previewFotoPerfil");
const btnCancelarFotoPreview = document.getElementById("btnCancelarFotoPreview");
const btnConfirmarFotoPreview= document.getElementById("btnConfirmarFotoPreview");

const modalConfirmarGuardar  = document.getElementById("modalConfirmarGuardar");
const btnCancelarGuardar     = document.getElementById("btnCancelarGuardar");
const btnAceptarGuardar      = document.getElementById("btnAceptarGuardar");

const modalPassword          = document.getElementById("modalPassword");
const inputPasswordActual    = document.getElementById("inputPasswordActual");
const inputPasswordNueva     = document.getElementById("inputPasswordNueva");
const errorPasswordActual    = document.getElementById("errorPasswordActual");
const errorPasswordNueva     = document.getElementById("errorPasswordNueva");
const btnCancelarPassword    = document.getElementById("btnCancelarPassword");
const btnGuardarPassword     = document.getElementById("btnGuardarPassword");

// ===== ESTADO =====
let nuevaFotoBase64  = null;
let eliminarFoto     = false;
let fotoOriginal     = null;
let modoEdicion      = false;
let archivoFotoPrev  = null; // archivo temporal antes de confirmar
let uid              = null;
let codigoPareja     = null;

// ===== CARGAR USUARIO =====
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "registro.html";
    return;
  }

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

    // Buscar nombre de la pareja
    await cargarNombrePareja(datos.codigo, user.uid);
  }
});

async function cargarNombrePareja(codigo, miUid) {
  if (!codigo) {
    parejaPerfil.textContent = "Sin pareja registrada";
    return;
  }

  try {
    const parejaSnap = await getDoc(doc(db, "parejas", codigo));
    if (!parejaSnap.exists()) {
      parejaPerfil.textContent = "Sin pareja registrada";
      return;
    }

    const miembros = parejaSnap.data()?.usuarios || [];
    const uidPareja = miembros.find(u => u !== miUid);

    if (!uidPareja) {
      parejaPerfil.textContent = "Sin pareja registrada";
      return;
    }

    const parejaSnap2 = await getDoc(doc(db, "usuarios", uidPareja));
    if (parejaSnap2.exists()) {
      parejaPerfil.textContent = parejaSnap2.data().usuario || "—";
    }
  } catch (e) {
    parejaPerfil.textContent = "—";
  }
}

// ===== MODO EDICIÓN =====
btnEditarPerfil.onclick = () => {
  modoEdicion = true;
  inputNombrePerfil.value = nombrePerfil.textContent;

  nombrePerfil.classList.add("hidden");
  inputNombrePerfil.classList.remove("hidden");
  btnAbrirPassword.classList.remove("hidden");
  btnEliminarFoto.classList.remove("hidden");
  botonesEdicion.classList.remove("hidden");
  btnCerrarSesionPerfil.classList.add("hidden");
  btnEditarPerfil.classList.add("hidden");

  // Activar click en foto
  contenedorFoto.style.pointerEvents = "auto";
  contenedorFoto.style.cursor = "pointer";
};

function salirModoEdicion() {
  modoEdicion = false;
  nuevaFotoBase64 = null;
  eliminarFoto    = false;
  archivoFotoPrev = null;

  nombrePerfil.classList.remove("hidden");
  inputNombrePerfil.classList.add("hidden");
  btnAbrirPassword.classList.add("hidden");
  btnEliminarFoto.classList.add("hidden");
  botonesEdicion.classList.add("hidden");
  btnCerrarSesionPerfil.classList.remove("hidden");
  btnEditarPerfil.classList.remove("hidden");

  fotoPerfil.src = fotoOriginal;
  inputFotoPerfil.value = "";
}

btnCancelarPerfil.onclick = salirModoEdicion;

// ===== FOTO — click en la imagen =====
contenedorFoto.addEventListener("click", () => {
  if (!modoEdicion) return;
  inputFotoPerfil.click();
});

inputFotoPerfil.addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  archivoFotoPrev = file;
  const base64 = await comprimirImagen(file);
  previewFotoPerfil.src = base64;

  // Mostrar modal preview
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

// ===== MODAL CONTRASEÑA =====
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

btnGuardarPassword.onclick = async () => {
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

  try {
    const user = auth.currentUser;
    const credential = EmailAuthProvider.credential(user.email, actual);
    await reauthenticateWithCredential(user, credential);
    await updatePassword(user, nueva);
    mostrarToast("Contraseña editada", "exito");
    modalPassword.classList.add("hidden");
    modalPassword.classList.remove("flex");
  } catch (error) {
    if (error.code === "auth/wrong-password" || error.code === "auth/invalid-credential") {
      errorPasswordActual.textContent = "Contraseña incorrecta";
      errorPasswordActual.classList.remove("hidden");
    } else {
      mostrarToast("Error al cambiar contraseña", "error");
    }
  }
};

// ===== GUARDAR PERFIL =====
btnGuardarPerfil.onclick = () => {
  const nuevoNombre = inputNombrePerfil.value.trim();
  if (!nuevoNombre) {
    mostrarToast("El nombre no puede estar vacío", "error");
    return;
  }
  // Mostrar modal confirmación
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
    const updateData = { usuario: nuevoNombre };

    if (nuevaFotoBase64) {
      updateData.foto = nuevaFotoBase64;
    } else if (eliminarFoto) {
      updateData.foto = null;
    }

    await updateDoc(doc(db, "usuarios", uid), updateData);

    // Actualizar UI en tiempo real
    nombrePerfil.textContent = nuevoNombre;

    if (nuevaFotoBase64) {
      fotoOriginal = nuevaFotoBase64;
    } else if (eliminarFoto) {
      fotoOriginal = generarAvatar(nuevoNombre);
    }

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
