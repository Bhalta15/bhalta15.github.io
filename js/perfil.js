import { auth, db } from "./firebase.js";
import {
  onAuthStateChanged,
  signOut,
  updatePassword,
  EmailAuthProvider,
  reauthenticateWithCredential
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  doc,
  getDoc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { mostrarToast } from "./toast.js";

// ===== ELEMENTOS =====
const nombrePerfil = document.getElementById("nombrePerfil");
const correoPerfil = document.getElementById("correoPerfil");
const fotoPerfil   = document.getElementById("fotoPerfil");

const inputNombrePerfil = document.getElementById("inputNombrePerfil");
const inputFotoPerfil   = document.getElementById("inputFotoPerfil");
const inputPasswordPerfil = document.getElementById("inputPasswordPerfil");
const inputPasswordActual = document.getElementById("inputPasswordActual");

const btnEditarPerfil   = document.getElementById("btnEditarPerfil");
const btnGuardarPerfil  = document.getElementById("btnGuardarPerfil");
const btnCancelarPerfil = document.getElementById("btnCancelarPerfil");
const btnCambiarFoto    = document.getElementById("btnCambiarFoto");
const btnEliminarFoto   = document.getElementById("btnEliminarFoto");

const btnCerrarSesionPerfil = document.getElementById("btnCerrarSesionPerfil");

// ===== ESTADO =====
let nuevaFoto = null;
let eliminarFoto = false;
let fotoOriginal = null;

// ===== CARGAR USUARIO =====
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "registro.html";
    return;
  }

  const snap = await getDoc(doc(db, "usuarios", user.uid));

  if (snap.exists()) {
    const datos = snap.data();

    nombrePerfil.textContent = datos.usuario;
    correoPerfil.textContent = user.email;

    fotoOriginal = datos.foto
      ? datos.foto
      : generarAvatar(datos.usuario);

    fotoPerfil.src = fotoOriginal;
  }
});

// ===== ANIMACIÓN =====
function mostrarElemento(el) {
  el.classList.remove("hidden");
}

function ocultarElemento(el) {
  el.classList.add("hidden");
}

// ===== SALIR EDICIÓN =====
function salirModoEdicion() {
  nombrePerfil.classList.remove("hidden");

  ocultarElemento(inputNombrePerfil);
  ocultarElemento(inputPasswordPerfil);
  ocultarElemento(inputPasswordActual);

  btnEditarPerfil.classList.remove("hidden");
  btnGuardarPerfil.classList.add("hidden");
  btnCancelarPerfil.classList.add("hidden");
  btnCambiarFoto.classList.add("hidden");
  btnEliminarFoto.classList.add("hidden");

  inputPasswordPerfil.value = "";
  inputPasswordActual.value = "";

  fotoPerfil.src = fotoOriginal;

  nuevaFoto = null;
  eliminarFoto = false;
}

// ===== ACTIVAR EDICIÓN =====
btnEditarPerfil.onclick = () => {
  inputNombrePerfil.value = nombrePerfil.textContent;

  nombrePerfil.classList.add("hidden");

  mostrarElemento(inputNombrePerfil);
  mostrarElemento(inputPasswordPerfil);
  mostrarElemento(inputPasswordActual);

  btnEditarPerfil.classList.add("hidden");
  btnGuardarPerfil.classList.remove("hidden");
  btnCancelarPerfil.classList.remove("hidden");
  btnCambiarFoto.classList.remove("hidden");
  btnEliminarFoto.classList.remove("hidden");

  fotoPerfil.classList.add("scale-110");
  setTimeout(() => fotoPerfil.classList.remove("scale-110"), 200);
};

// ===== CANCELAR =====
btnCancelarPerfil.onclick = salirModoEdicion;

// ===== CAMBIAR FOTO =====
btnCambiarFoto.onclick = () => inputFotoPerfil.click();

// ===== PREVIEW FOTO =====
inputFotoPerfil.addEventListener("change", (e) => {
  const file = e.target.files[0];

  if (file) {
    nuevaFoto = file;
    eliminarFoto = false;
    fotoPerfil.src = URL.createObjectURL(file);
  }
});

// ===== ELIMINAR FOTO =====
btnEliminarFoto.onclick = () => {
  nuevaFoto = null;
  eliminarFoto = true;

  const nombre = inputNombrePerfil.value || nombrePerfil.textContent;
  fotoPerfil.src = generarAvatar(nombre);
};

// ===== GUARDAR =====
btnGuardarPerfil.onclick = async () => {
  const nuevoNombre = inputNombrePerfil.value.trim();
  const nuevaPassword = inputPasswordPerfil.value.trim();
  const passwordActual = inputPasswordActual.value.trim();

  if (!nuevoNombre) {
    mostrarToast("El nombre no puede estar vacío", "error");
    return;
  }

  const user = auth.currentUser;

  try {
    // ===== VALIDAR PASSWORD PRIMERO =====
    if (nuevaPassword) {
      if (!passwordActual) {
        mostrarToast("Ingresa tu contraseña actual", "error");
        return;
      }

      const credential = EmailAuthProvider.credential(
        user.email,
        passwordActual
      );

      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, nuevaPassword);
    }

    // ===== FOTO =====
    let fotoFinal = null;

    if (nuevaFoto) {
      fotoFinal = await comprimirImagen(nuevaFoto);
    }

    const updateData = { usuario: nuevoNombre };

    if (fotoFinal) updateData.foto = fotoFinal;
    if (eliminarFoto) updateData.foto = null;

    await updateDoc(doc(db, "usuarios", user.uid), updateData);

    // ===== UI =====
    nombrePerfil.textContent = nuevoNombre;

    if (fotoFinal) {
      fotoOriginal = fotoFinal;
      fotoPerfil.src = fotoFinal;
    } else if (eliminarFoto) {
      fotoOriginal = generarAvatar(nuevoNombre);
      fotoPerfil.src = fotoOriginal;
    }

    salirModoEdicion();

    if (nuevaPassword) {
      mostrarToast("Perfil y contraseña actualizados 🔐", "exito");
    } else {
      mostrarToast("Perfil actualizado", "exito");
    }

  } catch (error) {
    console.error(error);

    if (error.code === "auth/wrong-password") {
      mostrarToast("Contraseña actual incorrecta", "error");
    } else if (error.code === "auth/weak-password") {
      mostrarToast("La contraseña debe tener al menos 6 caracteres", "error");
    } else {
      mostrarToast("Error al actualizar perfil", "error");
    }
  }
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

        let w = img.width;
        let h = img.height;

        if (w > h && w > max) {
          h *= max / w;
          w = max;
        } else if (h > max) {
          w *= max / h;
          h = max;
        }

        canvas.width = w;
        canvas.height = h;

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

// ===== CERRAR SESIÓN =====
btnCerrarSesionPerfil.onclick = async () => {
  await signOut(auth);
  window.location.href = "registro.html";
};
