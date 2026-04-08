import { GoogleAuthProvider, signInWithPopup,
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
const btnGoogle    = document.getElementById("btnGoogle");

// ===== ERRORES INLINE =====

// Campos en orden para registro y login
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
    usuario:       "El nombre es requerido",
    email:         "El correo es requerido",
    password:      "La contraseña es requerida",
    codigo:        "El código es requerido",
    loginEmail:    "El correo es requerido",
    loginPassword: "La contraseña es requerida",
  };
  return mensajes[id] || "Este campo es requerido";
}

function mostrarErrorInline(inputId, mensaje) {
  limpiarError(inputId);

  const input   = document.getElementById(inputId);
  const errorEl = document.createElement("p");

  errorEl.id        = `error-${inputId}`;
  errorEl.className = "text-red-500 text-xs mt-0.5 ml-1";
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

// ===== REGISTRO =====
btnRegistrar.addEventListener("click", async () => {
  limpiarTodos();

  if (mostrarPrimerError(camposRegistro)) return;

  if (!window.rol) {
    mostrarToast("Selecciona un rol primero", "error");
    return;
  }

  const usuario  = document.getElementById("usuario").value.trim();
  const email    = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  const codigo   = document.getElementById("codigo").value.trim();

  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    await sendEmailVerification(user);

    await setDoc(doc(db, "usuarios", user.uid), {
      usuario: usuario,
      email:   email,
      rol:     window.rol,
      codigo:  codigo
    });

    // 🔥 BUSCAR SI YA EXISTE ALGUIEN CON ESE CODIGO
    const q = query(collection(db, "usuarios"), where("codigo", "==", codigo));
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      querySnapshot.forEach(async (docSnap) => {
        if (docSnap.id !== user.uid) {

          const uidPareja = docSnap.id;

          // 🔥 CREAR PAREJA AUTOMÁTICAMENTE
          await setDoc(doc(db, "parejas", codigo), {
            usuarios: [user.uid, uidPareja],
            fechaCreacion: new Date()
          });

          console.log("Pareja creada automáticamente 💖");
        }
      });
    }

    mostrarToast("Te enviamos un correo para verificar tu cuenta 💌", "info");
    setTimeout(() => window.location.href = "registro.html", 2500);

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

  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    if (!user.emailVerified) {
      mostrarToast("Verifica tu correo primero 💌", "error");
      return;
    }

    const snap = await getDoc(doc(db, "usuarios", user.uid));

    if (snap.exists()) {
      const datos = snap.data();
      window.location.href = datos.rol === "enviara"
        ? "secundario.html"
        : "principal.html";
    }

  } catch (error) {
    manejarErrorFirebase(error.code);
  }
});

// ===== GOOGLE =====
btnGoogle.addEventListener("click", async () => {
  limpiarTodos();

  if (!window.rol) return mostrarToast("Selecciona un rol primero", "error");

  const codigo = document.getElementById("codigo").value.trim();
  if (!codigo)  return mostrarToast("Agrega un código", "error");

  const provider = new GoogleAuthProvider();

  try {
    const result   = await signInWithPopup(auth, provider);
    const user     = result.user;
    const userRef  = doc(db, "usuarios", user.uid);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      await setDoc(userRef, {
        usuario: user.displayName || "Usuario",
        email:   user.email,
        rol:     window.rol,
        codigo:  codigo
      });
    }

    const snapFinal = await getDoc(userRef);
    const datos     = snapFinal.data();

    window.location.href = datos.rol === "enviara"
      ? "secundario.html"
      : "principal.html";

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
    "auth/popup-closed-by-user": { campo: null,       msg: "Cerraste la ventana de Google" },
  };

  const err = errores[code];

  if (err?.campo) {
    mostrarErrorInline(err.campo, err.msg);
  } else {
    mostrarToast(err?.msg || "Ocurrió un error, intenta de nuevo", "error");
  }
}