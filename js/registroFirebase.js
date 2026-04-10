import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import { auth, db } from "./firebase.js";

import { setDoc, getDoc, doc, collection, query, where, getDocs }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { mostrarToast } from "./toast.js";

// ===== ELEMENTOS =====
const btnRegistrar = document.getElementById("btnRegistrar");
const btnIniciar   = document.getElementById("btnIniciar");

// ===== ERRORES INLINE =====
const camposRegistro = ["usuario", "email", "password", "codigo"];
const camposLogin    = ["loginEmail", "loginPassword"];

function mostrarPrimerError(campos) {
  for (const id of campos) {
    const input = document.getElementById(id);
    if (!input) continue;
    if (input.offsetParent === null) continue;
    const valor = input.value.trim();
    if (!valor) {
      mostrarErrorInline(id, mensajeVacio(id));
      input.focus();
      return true;
    }
  }
  return false;
}

function mensajeVacio(id) {
  const mensajes = {
    usuario:       "El usuario es requerido",
    email:         "El correo es requerido",
    password:      "La contraseña es requerida",
    codigo:        "El código es requerido",
  };
  return mensajes[id] || "Este campo es requerido";
}

function mostrarErrorInline(inputId, mensaje) {
  limpiarError(inputId);
  const input   = document.getElementById(inputId);
  const errorEl = document.createElement("p");
  errorEl.id          = `error-${inputId}`;
  errorEl.className   = "text-red-500 text-xs mt-0.5 ml-1";
  errorEl.textContent = mensaje;
  input.classList.add("border-red-400");
  input.parentNode.insertBefore(errorEl, input.nextSibling);
}

function limpiarError(inputId) {
  const viejo = document.getElementById(`error-${inputId}`);
  if (viejo) viejo.remove();
  const input = document.getElementById(inputId);
  if (input) input.classList.remove("border-red-400");
}

function limpiarTodos() {
  [...camposRegistro, ...camposLogin].forEach(id => limpiarError(id));
}

function esEmailValido(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function codigoEstaLleno(codigo) {
  const q = query(collection(db, "usuarios"), where("codigo", "==", codigo));
  const snap = await getDocs(q);
  return snap.size >= 2;
}

// ===== REGISTRO =====
btnRegistrar.addEventListener("click", async () => {
  limpiarTodos();

  if (mostrarPrimerError(camposRegistro)) return;
  if (!window.genero) return mostrarToast("Selecciona tu género primero", "error");

  const usuario  = document.getElementById("usuario").value.trim();
  const email    = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  const codigo   = document.getElementById("codigo").value.trim();

  if (!esEmailValido(email)) {
    mostrarErrorInline("email", "El formato del correo no es válido");
    return;
  }

  try {
    const lleno = await codigoEstaLleno(codigo);
    if (lleno) {
      mostrarErrorInline("codigo", "Este código ya está completo 💔");
      return;
    }

    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    await sendEmailVerification(user);

    await setDoc(doc(db, "usuarios", user.uid), {
      usuario: usuario,
      email:   email,
      genero:  window.genero,
      codigo:  codigo
    });

    // 🔥 Buscar si ya hay alguien con ese código para crear la pareja
    const q = query(collection(db, "usuarios"), where("codigo", "==", codigo));
    const querySnapshot = await getDocs(q);

    querySnapshot.forEach(async (docSnap) => {
      if (docSnap.id !== user.uid) {
        await setDoc(doc(db, "parejas", codigo), {
          usuarios:      [user.uid, docSnap.id],
          fechaCreacion: new Date()
        });
        console.log("Pareja creada 💖");
      }
    });

   mostrarToast("Te enviamos un correo para verificar tu cuenta 💌", "info");
   // Limpiar formulario de registro
document.getElementById("usuario").value = "";
document.getElementById("email").value = "";
document.getElementById("password").value = "";
document.getElementById("codigo").value = "";
document.getElementById("codigoMsg").textContent = "";

// Resetear género
window.genero = "";

// Resetear estilos de botones
document.getElementById("btnHombre").classList.remove("bg-blue-500", "text-white");
document.getElementById("btnHombre").classList.add("bg-blue-100", "text-blue-600");

document.getElementById("btnMujer").classList.remove("bg-pink-500", "text-white");
document.getElementById("btnMujer").classList.add("bg-pink-100", "text-pink-600");

// Cambiar a login sin recargar
document.getElementById("registerForm").classList.add("hidden");
document.getElementById("registerForm").classList.remove("flex");

document.getElementById("loginForm").classList.remove("hidden");
document.getElementById("loginForm").classList.add("flex");

  } catch (error) {
    manejarErrorFirebase(error.code);
  }
});

// ===== LOGIN =====
btnIniciar.addEventListener("click", async () => {
  limpiarTodos();

  if (mostrarPrimerError(camposLogin)) return;

  const email    = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value;

  if (!esEmailValido(email)) {
    mostrarErrorInline("loginEmail", "El formato del correo no es válido");
    return;
  }

  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    if (!user.emailVerified) {
      mostrarToast("Verifica tu correo primero 💌", "error");
      return;
    }

    const snap = await getDoc(doc(db, "usuarios", user.uid));

    if (snap.exists()) {
      // 🔥 Ahora ambos van a la misma página
      window.location.href = "app.html";
    }

  } catch (error) {
    manejarErrorFirebase(error.code);
  }
});

// ===== ERRORES FIREBASE =====
function manejarErrorFirebase(code) {
  const errores = {
    "auth/email-already-in-use": { campo: "email",    msg: "Este correo ya está registrado" },
    "auth/invalid-email":        { campo: "email",    msg: "El correo no es válido" },
    "auth/weak-password":        { campo: "password", msg: "Mínimo 6 caracteres" },
    "auth/user-not-found":       { campo: null,       msg: "No encontramos ese usuario" },
    "auth/wrong-password":       { campo: null,       msg: "Correo o contraseña incorrectos" },
    "auth/invalid-credential":   { campo: null,       msg: "Correo o contraseña incorrectos" },
    "auth/too-many-requests":    { campo: null,       msg: "Demasiados intentos, intenta más tarde" },
  };

  const err = errores[code];

  if (err?.campo) {
    mostrarErrorInline(err.campo, err.msg);
  } else {
    mostrarToast(err?.msg || "Ocurrió un error, intenta de nuevo", "error");
  }
}