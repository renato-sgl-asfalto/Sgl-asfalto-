import { initializeApp } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-app.js";
import {
  getFirestore, collection, addDoc, serverTimestamp,
  onSnapshot, query, orderBy, limit
} from "https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js";

// SUA CONFIG (a que você já tem)
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

// UI
const pill = document.getElementById("connPill");
const msg = document.getElementById("msg");
const lista = document.getElementById("lista");
const obra = document.getElementById("obra");
const tecnico = document.getElementById("tecnico");
const btnSalvar = document.getElementById("btnSalvar");

function setPill(texto, ok=true){
  pill.textContent = texto;
  pill.style.borderColor = ok ? "rgba(57,217,138,.4)" : "rgba(255,92,92,.4)";
  pill.style.color = ok ? "#39d98a" : "#ff5c5c";
}

function showMsg(t, ok=true){
  msg.textContent = t;
  msg.style.color = ok ? "#39d98a" : "#ff5c5c";
}

async function salvarTeste(){
  const obraV = obra.value.trim();
  const tecV = tecnico.value.trim();
  if(!obraV || !tecV){
    showMsg("Preencha Obra e Técnico.", false);
    return;
  }
  try{
    await addDoc(collection(db, "sglaa_testes"), {
      obra: obraV,
      tecnico: tecV,
      createdAt: serverTimestamp(),
      origem: "vercel"
    });
    showMsg("Salvo no Firebase com sucesso!", true);
  }catch(e){
    console.error(e);
    showMsg("Falha ao salvar (ver Console).", false);
  }
}

btnSalvar.addEventListener("click", salvarTeste);

// LISTAGEM AO VIVO (prova que sincroniza)
try{
  const q = query(collection(db, "sglaa_testes"), orderBy("createdAt","desc"), limit(20));
  onSnapshot(q, (snap)=>{
    setPill("Online (Firestore)", true);
    if(snap.empty){
      lista.innerHTML = `<div class="muted">Ainda não há registros.</div>`;
      return;
    }
    lista.innerHTML = "";
    snap.forEach(doc=>{
      const d = doc.data();
      const el = document.createElement("div");
      el.className = "item";
      el.innerHTML = `
        <div class="t">
          <b>${escapeHtml(d.obra || "")}</b>
          <span>${escapeHtml(d.tecnico || "")}</span>
        </div>
        <div class="muted">id: ${doc.id}</div>
      `;
      lista.appendChild(el);
    });
  }, (err)=>{
    console.error(err);
    setPill("Erro Firestore", false);
    showMsg("Sem acesso ao Firestore. Verifique Regras/Console.", false);
  });

}catch(e){
  console.error(e);
  setPill("Erro JS", false);
  showMsg("Erro no JavaScript. Abra o Console (F12).", false);
}

function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, (c)=>({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[c]));
}
