// ===== ELEMENTOS =====
const registerForm = document.getElementById("registerForm");
const loginForm    = document.getElementById("loginForm");
const btnLogin     = document.getElementById("btnLogin");
const btnRegister  = document.getElementById("btnRegister");

const btnHombre    = document.getElementById("btnHombre");
const btnMujer     = document.getElementById("btnMujer");

const inputCodigo  = document.getElementById("codigo");
const msg          = document.getElementById("codigoMsg");
const btnGenerar   = document.getElementById("btnGenerar");

// ===== CAMBIO LOGIN / REGISTER =====
btnLogin.onclick = () => {
  // Limpiar registro
  document.getElementById("usuario").value = "";
  document.getElementById("email").value = "";
  document.getElementById("password").value = "";
  document.getElementById("codigo").value = "";
  window.genero = "";

  registerForm.classList.add("hidden");
  registerForm.classList.remove("flex");
  loginForm.classList.remove("hidden");
  loginForm.classList.add("flex");
};

btnRegister.onclick = () => {
  // Limpiar login
  document.getElementById("loginEmail").value = "";
  document.getElementById("loginPassword").value = "";

  loginForm.classList.add("hidden");
  loginForm.classList.remove("flex");
  registerForm.classList.remove("hidden");
  registerForm.classList.add("flex");
};

// ===== GÉNERO =====
window.genero = "";

function setGeneroActivo(generoSeleccionado) {
  window.genero = generoSeleccionado;

  // Reset ambos botones
  btnHombre.classList.remove("bg-blue-500", "text-white");
  btnHombre.classList.add("bg-blue-100", "text-blue-600");
  btnMujer.classList.remove("bg-pink-500", "text-white");
  btnMujer.classList.add("bg-pink-100", "text-pink-600");

  // Marcar el activo
  if (generoSeleccionado === "hombre") {
    btnHombre.classList.remove("bg-blue-100", "text-blue-600");
    btnHombre.classList.add("bg-blue-500", "text-white");
  } else {
    btnMujer.classList.remove("bg-pink-100", "text-pink-600");
    btnMujer.classList.add("bg-pink-500", "text-white");
  }
}

btnHombre.onclick = () => setGeneroActivo("hombre");
btnMujer.onclick  = () => setGeneroActivo("mujer");

// ===== GENERAR CODIGO =====
btnGenerar.onclick = () => {
  inputCodigo.value = generarCodigo();
  msg.textContent   = "Código generado 🎲";
};

function generarCodigo() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let c = "";
  for (let i = 0; i < 6; i++) {
    c += chars[Math.floor(Math.random() * chars.length)];
  }
  return c;
}