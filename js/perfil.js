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

const btnEditarPassword = document.getElementById("btnEditarPassword");
const btnCerrarSesionPerfil = document.getElementById("btnCerrarSesionPerfil");

// MODAL
const modalPassword = document.getElementById("modalPassword");
const inputPasswordActual = document.getElementById("inputPasswordActual");
const inputPasswordNueva = document.getElementById("inputPasswordNueva");
const btnConfirmarPassword = document.getElementById("btnConfirmarPassword");
const btnCancelarPassword = document.getElementById("btnCancelarPassword");
const errorPassword = document.getElementById("errorPassword");

// ===== USER =====
let currentUser = null;

// ===== CARGAR USUARIO =====
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "registro.html";
    return;
  }

  currentUser = user;

  const snap = await getDoc(doc(db, "usuarios", user.uid));

  if (snap.exists()) {
    const datos = snap.data();

    nombrePerfil.textContent = datos.usuario;
    correoPerfil.textContent = user.email;
  }
});

// ===== ABRIR MODAL =====
btnEditarPassword.onclick = () => {
  modalPassword.classList.remove("hidden");
  modalPassword.classList.add("flex");
};

// ===== CERRAR MODAL =====
btnCancelarPassword.onclick = () => {
  modalPassword.classList.add("hidden");
  modalPassword.classList.remove("flex");

  inputPasswordActual.value = "";
  inputPasswordNueva.value = "";
  errorPassword.classList.add("hidden");
};

// ===== CAMBIAR PASSWORD =====
btnConfirmarPassword.onclick = async () => {
  const actual = inputPasswordActual.value.trim();
  const nueva = inputPasswordNueva.value.trim();

  if (!actual || !nueva) {
    mostrarToast("Completa todos los campos", "error");
    return;
  }

  try {
    const credential = EmailAuthProvider.credential(
      currentUser.email,
      actual
    );

    await reauthenticateWithCredential(currentUser, credential);
    await updatePassword(currentUser, nueva);

    mostrarToast("Contraseña actualizada 🔐", "exito");

    btnCancelarPassword.onclick();

  } catch (error) {
    console.error(error);

    errorPassword.classList.remove("hidden");
    mostrarToast("Contraseña incorrecta", "error");
  }
};

// ===== CERRAR SESIÓN =====
btnCerrarSesionPerfil.onclick = async () => {
  await signOut(auth);
  window.location.href = "registro.html";
};
