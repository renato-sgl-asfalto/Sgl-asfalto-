import { initializeApp } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-app.js";
import {
  getFirestore, collection, addDoc, deleteDoc, doc,
  onSnapshot, query, orderBy, serverTimestamp,
  setDoc, getDoc, where, limit
} from "https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js";

/* ====== Firebase (SEU) ====== */
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

/* ====== Helpers ====== */
function nOrNull(v) {
  const x = String(v ?? "").replace(",", ".").trim();
  if (!x) return null;
  const num = Number(x);
  return Number.isFinite(num) ? num : null;
}
function todayISO() {
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

/* ====== UI refs ====== */
const connPill = document.getElementById("connPill");
const activeProjPill = document.getElementById("activeProjPill");
const kpiFirebase = document.getElementById("kpiFirebase");
const kpiProjetos = document.getElementById("kpiProjetos");

function setConn(texto, ok = true) {
  if (connPill) {
    connPill.textContent = texto;
    connPill.style.borderColor = ok ? "rgba(57,217,138,.4)" : "rgba(255,92,92,.4)";
    connPill.style.color = ok ? "#39d98a" : "#ff5c5c";
  }
  if (kpiFirebase) kpiFirebase.textContent = ok ? "Online" : "Erro";
}
function setActiveText(txt) {
  if (activeProjPill) activeProjPill.textContent = txt;
}
function showMsg(el, texto, ok=true){
  if (!el) return;
  el.textContent = texto;
  el.style.color = ok ? "#39d98a" : "#ff5c5c";
}

/* ====== Tabs ====== */
const tabs = Array.from(document.querySelectorAll(".tab"));
const views = {
  painel: document.getElementById("view-painel"),
  projetos: document.getElementById("view-projetos"),
  ensaios: document.getElementById("view-ensaios"),
  relatorios: document.getElementById("view-relatorios")
};
tabs.forEach(btn => {
  btn.addEventListener("click", () => {
    tabs.forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    const id = btn.dataset.tab;
    Object.values(views).forEach(v => v && v.classList.add("hidden"));
    views[id] && views[id].classList.remove("hidden");
  });
});

/* ====== Active project ====== */
const activeRef = doc(db, "meta", "active");
let ACTIVE_PROJECT_ID = null;
let ACTIVE_PROJECT = null;

async function setActiveProject(projectId) {
  await setDoc(activeRef, { projectId, updatedAt: serverTimestamp() }, { merge: true });
}

async function refreshActiveProject() {
  if (!ACTIVE_PROJECT_ID) {
    ACTIVE_PROJECT = null;
    setActiveText("Projeto ativo: (nenhum)");
    applyProjectToPbRule();
    refreshEnsaiosList();
    return;
  }
  const pSnap = await getDoc(doc(db, "projects", ACTIVE_PROJECT_ID));
  ACTIVE_PROJECT = pSnap.exists() ? pSnap.data() : null;
  setActiveText("Projeto ativo: " + (ACTIVE_PROJECT?.nome || "(sem nome)"));
  applyProjectToPbRule();
  refreshEnsaiosList();
}

onSnapshot(activeRef, async (snap) => {
  ACTIVE_PROJECT_ID = snap.exists() ? (snap.data().projectId || null) : null;
  await refreshActiveProject();
}, (err) => {
  console.error(err);
  setActiveText("Projeto ativo: (erro)");
});

/* ====== PROJETOS ====== */
const sieveBody = document.getElementById("sieveBody");
const p_nome = document.getElementById("p_nome");
const p_codigo = document.getElementById("p_codigo");
const p_cliente = document.getElementById("p_cliente");
const p_pb = document.getElementById("p_pb");
const p_pbtol = document.getElementById("p_pbtol");
const p_mistura = document.getElementById("p_mistura");
const p_cap = document.getElementById("p_cap");

const btnSalvarProjeto = document.getElementById("btnSalvarProjeto");
const msgProjeto = document.getElementById("msgProjeto");
const listaProjetos = document.getElementById("listaProjetos");

const SIEVES = ['3/4"', '1/2"', '3/8"', '1/4"', '#4', '#8', '#16', '#30', '#50', '#100', '#200'];

function buildSieveRows() {
  if (!sieveBody) return;
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

function readSieveLimits(bodyEl) {
  const inputs = Array.from(bodyEl.querySelectorAll("input"));
  const limits = {};
  inputs.forEach(inp => {
    const sv = inp.dataset.sv;
    const k = inp.dataset.k;
    limits[sv] = limits[sv] || { min: null, max: null };
    limits[sv][k] = nOrNull(inp.value);
  });
  Object.keys(limits).forEach(sv => {
    const row = limits[sv];
    if (row.min === null && row.max === null) delete limits[sv];
  });
  return limits;
}

function clearProjectForm() {
  if (p_nome) p_nome.value = "";
  if (p_codigo) p_codigo.value = "";
  if (p_cliente) p_cliente.value = "";
  if (p_pb) p_pb.value = "";
  if (p_pbtol) p_pbtol.value = "";
  if (p_mistura) p_mistura.value = "";
  if (p_cap) p_cap.value = "";
  if (sieveBody) Array.from(sieveBody.querySelectorAll("input")).forEach(i => (i.value = ""));
}

const projectsCol = collection(db, "projects");
const qProjects = query(projectsCol, orderBy("createdAt", "desc"));

if (btnSalvarProjeto) {
  btnSalvarProjeto.addEventListener("click", async () => {
    const nome = (p_nome?.value || "").trim();
    if (!nome) { showMsg(msgProjeto, "Preencha o Nome do Projeto.", false); return; }

    const data = {
      nome,
      codigo: (p_codigo?.value || "").trim() || null,
      cliente: (p_cliente?.value || "").trim() || null,
      mistura: (p_mistura?.value || "").trim() || null,
      cap: (p_cap?.value || "").trim() || null,

      pbProjeto: nOrNull(p_pb?.value),
      pbTol: nOrNull(p_pbtol?.value) ?? 0.3,

      sieveLimits: sieveBody ? readSieveLimits(sieveBody) : {},
      createdAt: serverTimestamp()
    };

    try {
      await addDoc(projectsCol, data);
      showMsg(msgProjeto, "Projeto salvo com sucesso!", true);
      clearProjectForm();
    } catch (e) {
      console.error(e);
      showMsg(msgProjeto, "Falha ao salvar (veja Console).", false);
    }
  });
}

if (listaProjetos) {
  onSnapshot(qProjects, (snap) => {
    setConn("Online (Firestore)", true);
    if (kpiProjetos) kpiProjetos.textContent = String(snap.size);

    if (snap.empty) {
      listaProjetos.innerHTML = `<div class="muted">Nenhum projeto cadastrado ainda.</div>`;
      return;
    }
    listaProjetos.innerHTML = "";

    snap.forEach(d => {
      const p = d.data();
      const isActive = d.id === ACTIVE_PROJECT_ID;

      const el = document.createElement("div");
      el.className = "item";
      el.innerHTML = `
        <div>
          <b>${escapeHtml(p.nome)}</b>
          <div class="meta">
            Código: ${escapeHtml(p.codigo || "—")} • Pb proj: ${p.pbProjeto ?? "—"}% ± ${p.pbTol ?? 0.3} • Mistura: ${escapeHtml(p.mistura || "—")}
          </div>
          <div class="meta">Cliente/Obra: ${escapeHtml(p.cliente || "—")} • CAP: ${escapeHtml(p.cap || "—")}</div>
          <div class="meta">${isActive ? "✅ ATIVO" : ""}</div>
        </div>
        <div class="btns">
          <button class="btn2" data-act="ativar" data-id="${d.id}">${isActive ? "Ativo" : "Ativar"}</button>
          <button class="btn2 danger" data-act="apagar" data-id="${d.id}">Apagar</button>
        </div>
      `;
      listaProjetos.appendChild(el);
    });
  }, (err) => {
    console.error(err);
    setConn("Erro Firestore", false);
  });

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
      }
      if (act === "apagar") {
        if (id === ACTIVE_PROJECT_ID) {
          showMsg(msgProjeto, "Não apague o projeto ativo. Ative outro primeiro.", false);
          return;
        }
        await deleteDoc(doc(db, "projects", id));
        showMsg(msgProjeto, "Projeto apagado.", true);
      }
    } catch (e) {
      console.error(e);
      showMsg(msgProjeto, "Falha (veja Console).", false);
    }
  });
}

/* ====== ENSAIOS: Extração (Pb) ====== */
const e_data = document.getElementById("data");
const e_tecnico = document.getElementById("tecnico");
const e_lote = document.getElementById("lote");
const e_massa = document.getElementById("massa");
const e_agregado = document.getElementById("agregado");
const btnSalvarEnsaio = document.getElementById("btnSalvar");
const pbOut = document.getElementById("pbOut");
const statusOut = document.getElementById("statusOut");
const limitesOut = document.getElementById("limitesOut");
const listaEnsaios = document.getElementById("listaEnsaios");

if (e_data && !e_data.value) e_data.value = todayISO();

let pbMin = 4.5;
let pbMax = 6.5;

function applyProjectToPbRule() {
  const pbRef = Number(ACTIVE_PROJECT?.pbProjeto ?? NaN);
  const tol = Number(ACTIVE_PROJECT?.pbTol ?? 0.3);

  if (Number.isFinite(pbRef)) {
    pbMin = pbRef - tol;
    pbMax = pbRef + tol;
  } else {
    pbMin = 4.5; pbMax = 6.5;
  }
  if (limitesOut) limitesOut.textContent = `Limites Pb: ${pbMin.toFixed(2)} a ${pbMax.toFixed(2)}`;
  calcPbAndStatus();
}

function calcPbAndStatus() {
  const massa = nOrNull(e_massa?.value);
  const agregado = nOrNull(e_agregado?.value);

  if (!massa || massa <= 0 || agregado === null || agregado < 0) {
    if (pbOut) pbOut.textContent = "—";
    if (statusOut) { statusOut.textContent = "—"; statusOut.className = "badge"; }
    return;
  }

  const pb = ((massa - agregado) / massa) * 100;
  if (pbOut) pbOut.textContent = pb.toFixed(2);

  const ok = (pb >= pbMin && pb <= pbMax);
  if (statusOut) {
    statusOut.textContent = ok ? "CONFORME" : "NÃO CONFORME";
    statusOut.className = "badge " + (ok ? "ok" : "bad");
  }
}

if (e_massa) e_massa.addEventListener("input", calcPbAndStatus);
if (e_agregado) e_agregado.addEventListener("input", calcPbAndStatus);

const ensaiosCol = collection(db, "ensaios_extracao");

if (btnSalvarEnsaio) {
  btnSalvarEnsaio.addEventListener("click", async () => {
    if (!ACTIVE_PROJECT_ID) { alert("Sem Projeto Ativo. Vá em Projetos e clique Ativar."); return; }

    const massa = nOrNull(e_massa?.value);
    const agregado = nOrNull(e_agregado?.value);
    if (!massa || massa <= 0 || agregado === null || agregado < 0) { alert("Preencha massa e agregados."); return; }

    const pb = ((massa - agregado) / massa) * 100;
    const ok = (pb >= pbMin && pb <= pbMax);

    try {
      await addDoc(ensaiosCol, {
        projectId: ACTIVE_PROJECT_ID,
        projectName: ACTIVE_PROJECT?.nome || null,
        data: e_data?.value || todayISO(),
        tecnico: (e_tecnico?.value || "").trim() || null,
        lote: (e_lote?.value || "").trim() || null,
        massa,
        agregado,
        pb: Number(pb.toFixed(3)),
        status: ok ? "CONFORME" : "NAO_CONFORME",
        pbMin: Number(pbMin.toFixed(3)),
        pbMax: Number(pbMax.toFixed(3)),
        createdAt: serverTimestamp()
      });
      alert("✅ Ensaio salvo!");
    } catch (e) {
      console.error(e);
      alert("❌ Erro ao salvar (veja Console).");
    }
  });
}

function refreshEnsaiosList() {
  if (!listaEnsaios) return;
  if (!ACTIVE_PROJECT_ID) {
    listaEnsaios.innerHTML = `<div class="muted">Sem projeto ativo.</div>`;
    return;
  }

  const qEns = query(
    ensaiosCol,
    where("projectId", "==", ACTIVE_PROJECT_ID),
    orderBy("createdAt", "desc"),
    limit(15)
  );

  onSnapshot(qEns, (snap) => {
    if (snap.empty) {
      listaEnsaios.innerHTML = `<div class="muted">Nenhum ensaio salvo ainda.</div>`;
      return;
    }
    listaEnsaios.innerHTML = "";
    snap.forEach(d => {
      const a = d.data();
      const el = document.createElement("div");
      el.className = "item";
      el.innerHTML = `
        <div>
          <b>${escapeHtml(a.data || "")} • ${escapeHtml(a.lote || "—")}</b>
          <div class="meta">Téc.: ${escapeHtml(a.tecnico || "—")} • Pb: ${a.pb ?? "—"}% • Massa: ${a.massa ?? "—"}g • Agreg.: ${a.agregado ?? "—"}g</div>
          <div class="meta">Status: ${escapeHtml(a.status || "—")} • Limites: ${a.pbMin ?? "—"} a ${a.pbMax ?? "—"}</div>
        </div>
      `;
      listaEnsaios.appendChild(el);
    });
  }, (err) => {
    console.error(err);
    listaEnsaios.innerHTML = `<div class="muted">Erro ao carregar ensaios.</div>`;
  });
}

/* ====== init ====== */
setConn("Online (Firestore)", true);
setActiveText("Projeto ativo: (carregando)");
getDoc(activeRef).then(s => {
  ACTIVE_PROJECT_ID = s.exists() ? (s.data().projectId || null) : null;
  refreshActiveProject();
}).catch(()=>{});
applyProjectToPbRule();
refreshEnsaiosList();
