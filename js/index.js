// inicio.js

console.log("Inicio cargado correctamente 💖");

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js")
    .then(() => console.log("PWA lista 💖"))
    .catch(err => console.log("Error SW:", err));
}

// 🔔 PEDIR PERMISO
if ("Notification" in window) {
  Notification.requestPermission().then((permission) => {
    if (permission === "granted") {
      console.log("Permiso concedido 💌");
      obtenerToken();
    } else {
      console.log("Permiso denegado");
    }
  });
}


import { initializeApp } from "firebase/app";
import { getMessaging, getToken } from "firebase/messaging";

const firebaseConfig = {
  // tu config aquí
};

const app = initializeApp(firebaseConfig);
const messaging = getMessaging(app);

function obtenerToken() {
  getToken(messaging, {
    vapidKey: "TU_VAPID_KEY"
  }).then((currentToken) => {
    if (currentToken) {
      console.log("🔥 TOKEN:", currentToken);

      // Aquí puedes copiarlo o guardarlo
    } else {
      console.log("No se pudo obtener token");
    }
  }).catch((err) => {
    console.log("Error al obtener token:", err);
  });
}