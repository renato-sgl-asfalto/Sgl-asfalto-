import { initializeApp } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-app.js";
import {
  getFirestore, collection, addDoc, deleteDoc, doc,
  onSnapshot, query, orderBy, serverTimestamp,
  setDoc, getDoc, limit
} from "https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js";

/* ===================== Firebase (SEU) ===================== */
const firebaseConfig = {
  apiKey: "AIzaSyCvYQYm9vZpkZ2tKMm-4zouYoI71Wb9ldc",
  authDomain: "sgq-asfalto.firebaseapp.com",
  projectId: "sgq-asfalto",
  storageBucket: "sgq-asfalto.firebasestorage.app",
  messagingSenderId: "159792875402",
  appId: "1:159792875402:web:e54a3e554bdfa736226a73"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

/* ===================== Helpers ===================== */
function nOrNull(v){
  const x = String(v ?? "").replace(",", ".").trim();
  if (!x) return null;
  const num = Number(x);
  return Number.isFinite(num) ? num : null;
}
function nOrZero(v){
  const x = String(v ?? "").replace(",", ".").trim();
  const num = Number(x);
  return Number.isFinite(num) ? num : 0;
}
function todayISO(){
  const d = new Date();
  const mm = String(d.getMonth()+1).padStart(2,"0");
  const dd = String(d.getDate()).padStart(2,"0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}
function escapeHtml(s){
  return String(s ?? "").replace(/[&<>"']/g, (c)=>({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[c]));
}
function mean(arr){
  if (!arr.length) return null;
  return arr.reduce((a,b)=>a+b,0) / arr.length;
}
function sdSample(arr){
  if (arr.length < 2) return null;
  const m = mean(arr);
  const v = arr.reduce((a,x)=>a + Math.pow(x-m,2),0) / (arr.length-1);
  return Math.sqrt(v);
}

/* k simplificado por N */
function kFactor(n){
  const map = {
    2: 1.84, 3: 1.32, 4: 1.20, 5: 1.13, 6: 1.09, 7: 1.06, 8: 1.04, 9: 1.03, 10: 1.02,
    11: 1.01, 12: 1.00, 13: 0.99, 14: 0.98, 15: 0.97, 16: 0.96, 17: 0.96, 18: 0.95,
    19: 0.95, 20: 0.94, 25: 0.93
  };
  if (n <= 1) return null;
  if (map[n]) return map[n];
  if (n > 25) return 0.92;
  let lo = 2, hi = 25;
  for (let i=2;i<=25;i++){
    if (map[i]) lo = i;
    if (i>=n && map[i]) {hi = i; break;}
  }
  const klo = map[lo], khi = map[hi];
  const t = (n-lo)/(hi-lo);
  return klo + (khi-klo)*t;
}

/* ===================== UI refs ===================== */
const connPill = document.getElementById("connPill");
const activeProjPill = document.getElementById("activeProjPill");
const kpiFirebase = document.getElementById("kpiFirebase");
const kpiProjetos = document.getElementById("kpiProjetos");
