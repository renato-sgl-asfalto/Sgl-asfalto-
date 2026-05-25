import { initializeApp } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-app.js";
import {
  getFirestore, collection, addDoc, deleteDoc, doc,
  onSnapshot, query, orderBy, serverTimestamp,
  setDoc, getDoc
} from "https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js";

/** Firebase config (o seu) */
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

/* ---------- UI refs ---------- */
const connPill = document.getElementById("connPill");
const activeProjPill = document.getElementById("activeProjPill");

const tabs = Array.from(document.querySelectorAll(".tab"));
const views = {
  painel: document.getElementById("view-painel"),
  projetos: document.getElementById("view-projetos"),
  ensaios: document.getElementById("view-ensaios"),
  relatorios: document.getElementById("view-relatorios")
};

const kpiFirebase = document.getElementById("kpiFirebase");
const kpiProjetos = document.getElementById("kpiProjetos");

const sieveBody = document.getElementById("sieveBody");
const p_nome = document.getElementById("p_nome");
const p_codigo = document.getElementById("p_codigo");
const p_cliente = document.getElementById("p_cliente");
const p_pb = document.getElementById("p_pb");
const p_mistura = document.getElementById("p_mistura");
const p_cap = document.getElementById("p_cap");

const btnSalvarProjeto = document.getElementById("btnSalvarProjeto");
const msgProjeto = document.getElementById("msgProjeto");
const listaProjetos = document.getElementById("listaProjetos");

/* ---------- Helpers ---------- */
function setConn(texto, ok = true) {
  connPill.textContent = texto;
  connPill.style.borderColor = ok ? "rgba(57,217,138,.4)" : "rgba(255,92,92,.4)";
  connPill.style.color = ok ? "#39d98a" : "#ff5c5c";
  kpiFirebase.textContent = ok ? "Online" : "Erro";
}
function showMsg(el, texto, ok = true) {
  el.textContent = texto;
  el.style.color = ok ? "#39d98a" : "#ff5c5c";
}
function nOrNull(v) {
  const x = String(v ?? "").replace(",", ".").trim();
  if (!x) return null;
  const num = Number(x);
  return Number.isFinite(num) ? num : null;
}
function escapeHtml(s){
  return String(s ?? "").replace(/[&<>"']/g, (c)=>({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[c]));
}

/* ---------- Tabs ---------- */
tabs.forEach(btn => {
  btn.addEventListener("click", () => {
    tabs.forEach(b => b.classList.remove("active"));
    btn.classList.add("active");

    const id = btn.dataset.tab;
    Object.values(views).forEach(v => v.classList.add("hidden"));
    views[id].classList.remove("hidden");
  });
});

/* ---------- Sieve table (editable) ---------- */
const SIEVES = [
  '3/4"', '1/2"', '3/8"', '1/4"', '#4', '#8', '#16', '#30', '#50', '#100', '#200'
];

function buildSieveRows() {
  sieveBody.innerHTML = "";
  SIEVES.forEach(sv => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><b>${escapeHtml(sv)}</b></td>
      <td><input data-sv="${escapeHtml(sv)}" data-k="min" placeholder="min" /></td>
      <td><input data-sv="${escapeHtml(sv)}" data-k="max" placeholder="max" /></td>
    `;
    sieveBody.appendChild(tr);
  });
}
buildSieveRows();

function readSieveLimits() {
  const inputs = Array.from(sieveBody.querySelectorAll("input"));
  const limits = {};
  inputs.forEach(inp => {
    const sv = inp.dataset.sv;
    const k = inp.dataset.k;
    limits[sv] = limits[sv] || { min: null, max: null };
    limits[sv][k] = nOrNull(inp.value);
  });
  // remove empty rows
  Object.keys(limits).forEach(sv => {
    const row = limits[sv];
    if (row.min === null && row.max === null) delete limits[sv];
  });
  return limits;
}

function clearProjectForm() {
  p_nome.value = "";
  p_codigo.value = "";
  p_cliente.value = "";
  p_pb.value = "";
  p_mistura.value = "";
  p_cap.value = "";
  Array.from(sieveBody.querySelectorAll("input")).forEach(i => (i.value = ""));
}

/* ---------- Active project (meta/active) ---------- */
const activeRef = doc(db, "meta", "active");
let ACTIVE_PROJECT_ID = null;

async function setActiveProject(projectId) {
  await setDoc(activeRef, { projectId, updatedAt: serverTimestamp() }, { merge: true });
}

async function loadActiveProjectOnce() {
  const snap = await getDoc(activeRef);
  if (snap.exists()) {
    ACTIVE_PROJECT_ID = snap.data().projectId || null;
  } else {
    ACTIVE_PROJECT_ID = null;
  }
}

onSnapshot(activeRef, (snap) => {
  ACTIVE_PROJECT_ID = snap.exists() ? (snap.data().projectId || null) : null;
  updateActivePill();
}, (err) => {
  console.error(err);
  updateActivePill("(erro)");
});

function updateActivePill(name = null) {
  if (!ACTIVE_PROJECT_ID && !name) {
    activeProjPill.textContent = "Projeto ativo: (nenhum)";
    return;
  }
  if (name) {
    activeProjPill.textContent = "Projeto ativo: " + name;
  } else {
    activeProjPill.textContent = "Projeto ativo: (definido)";
  }
}

/* ---------- Projects CRUD ---------- */
const projectsCol = collection(db, "projects");
const qProjects = query(projectsCol, orderBy("createdAt", "desc"));

btnSalvarProjeto.addEventListener("click", async () => {
  const nome = p_nome.value.trim();
  if (!nome) {
    showMsg(msgProjeto, "Preencha o Nome do Projeto.", false);
    return;
  }

  const data = {
    nome,
    codigo: p_codigo.value.trim() || null,
    cliente: p_cliente.value.trim() || null,
    pbProjeto: nOrNull(p_pb.value),
    mistura: p_mistura.value.trim() || null,
    cap: p_cap.value.trim() || null,
    sieveLimits: readSieveLimits(),
    createdAt: serverTimestamp()
  };

  try {
    await addDoc(projectsCol, data);
    showMsg(msgProjeto, "Projeto salvo com sucesso!", true);
    clearProjectForm();
  } catch (e) {
    console.error(e);
    showMsg(msgProjeto, "Falha ao salvar. Abra o Console (F12).", false);
  }
});

onSnapshot(qProjects, async (snap) => {
  setConn("Online (Firestore)", true);
  kpiProjetos.textContent = String(snap.size);

  // Identify active project name (if present in this snapshot)
  let activeName = null;
  snap.forEach(d => {
    if (d.id === ACTIVE_PROJECT_ID) activeName = d.data().nome || "(sem nome)";
  });
  if (ACTIVE_PROJECT_ID && activeName) updateActivePill(activeName);
  if (!ACTIVE_PROJECT_ID) updateActivePill(null);

  // Render list
  if (snap.empty) {
    listaProjetos.innerHTML = `<div class="muted">Nenhum projeto cadastrado ainda.</div>`;
    return;
  }

  const items = [];
  snap.forEach(d => {
    const p = d.data();
    const isActive = d.id === ACTIVE_PROJECT_ID;

    const el = document.createElement("div");
    el.className = "item";
    el.innerHTML = `
      <div>
        <b>${escapeHtml(p.nome)}</b>
        <div class="meta">
          Código: ${escapeHtml(p.codigo || "—")} • CAP proj: ${p.pbProjeto ?? "—"}% • Mistura: ${escapeHtml(p.mistura || "—")}
        </div>
        <div class="meta">Cliente/Obra: ${escapeHtml(p.cliente || "—")} • CAP: ${escapeHtml(p.cap || "—")}</div>
        <div class="meta">${isActive ? "✅ ATIVO" : ""}</div>
      </div>
      <div class="btns">
        <button class="btn2" data-act="ativar" data-id="${d.id}">${isActive ? "Ativo" : "Ativar"}</button>
        <button class="btn2 danger" data-act="apagar" data-id="${d.id}">Apagar</button>
      </div>
    `;
    items.push(el);
  });

  listaProjetos.innerHTML = "";
  items.forEach(el => listaProjetos.appendChild(el));

}, (err) => {
  console.error(err);
  setConn("Erro Firestore", false);
  kpiProjetos.textContent = "—";
});

/* list click handlers */
listaProjetos.addEventListener("click", async (ev) => {
  const btn = ev.target.closest("button");
  if (!btn) return;

  const act = btn.dataset.act;
  const id = btn.dataset.id;
  if (!act || !id) return;

  try {
    if (act === "ativar") {
      await setActiveProject(id);
      showMsg(msgProjeto, "Projeto ativo definido!", true);
      // switch to Ensaios tab later; for now remain
    }

    if (act === "apagar") {
      // prevent deleting active project by mistake
      if (id === ACTIVE_PROJECT_ID) {
        showMsg(msgProjeto, "Não apague o projeto ativo. Ative outro primeiro.", false);
        return;
      }
      await deleteDoc(doc(db, "projects", id));
      showMsg(msgProjeto, "Projeto apagado.", true);
    }
  } catch (e) {
    console.error(e);
    showMsg(msgProjeto, "Falha. Abra o Console (F12).", false);
  }
});

/* initial status */
setConn("Conectando…", true);
kpiFirebase.textContent = "—";
kpiProjetos.textContent = "—";
loadActiveProjectOnce().catch(()=>{});
