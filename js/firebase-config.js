// Firebase SDKs para ES Modules CDN
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, onValue, push, remove, set } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyDFwECdwELB_wPHR_9rkkY9MRcNBjQSUks",
  authDomain: "viaz-1e406.firebaseapp.com",
  databaseURL: "https://viaz-1e406-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "viaz-1e406",
  storageBucket: "viaz-1e406.firebasestorage.app",
  messagingSenderId: "73407200033",
  appId: "1:73407200033:web:ba4a55ff672252e2645c60"
};

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

// Adicionado o 'set' que é usado no app.js para injetar dados do Weather
export { database, ref, onValue, push, remove, set };
