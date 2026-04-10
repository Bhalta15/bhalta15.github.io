// 🔥 IMPORTS
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import { 
  getAuth, 
  setPersistence, 
  browserLocalPersistence 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import { getFirestore } 
from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";


// 🔥 CONFIG
const firebaseConfig = {
  apiKey: "AIzaSyAw876DtiEejLudWjA766pK8ZpFlUaRoSo",
  authDomain: "daily-love-9830e.firebaseapp.com",
  projectId: "daily-love-9830e",
  storageBucket: "daily-love-9830e.firebasestorage.app",
  messagingSenderId: "42599876322",
  appId: "1:42599876322:web:ea3f2451650ca628e900bb",
  measurementId: "G-VJ244V6QZN"
};


// 🔥 INICIALIZAR APP
const app = initializeApp(firebaseConfig);


// 🔥 AUTH + PERSISTENCIA (LA CLAVE 🔥)
export const auth = getAuth(app);

// Forzar que la sesión se quede guardada SIEMPRE
setPersistence(auth, browserLocalPersistence)
  .then(() => {
    console.log("🔥 Persistencia LOCAL activada");
  })
  .catch((error) => {
    console.error("❌ Error en persistencia:", error);
  });


// 🔥 FIRESTORE
export const db = getFirestore(app);