import { initializeApp } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-app.js";
import {
  getFirestore, collection, addDoc, deleteDoc, doc,
  onSnapshot, query, orderBy, serverTimestamp,
  setDoc, getDoc, where, limit
} from "https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js";

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
const kpiFirebase = document.getElementById("kpiFirebase");
const kpiProjetos = document.getElementById("kpiProjetos");

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
    Object.values(views).forEach(v => v.classList.add("hidden"));
    views[id].classList.remove("hidden");
  });
});

/* ---------- Helpers ---------- */
function setConn(texto, ok = true) {
  connPill.textContent = texto;
  connPill.style.borderColor = ok ? "rgba(57,217,138,.4)" : "rgba(255,92,92,.4)";
  connPill.style.color = ok ? "#39d98a" : "#ff5c5c";
  if (kpiFirebase) kpiFirebase.textContent = ok ? "Online" : "Erro";
}
function showMsg(el, texto, ok = true) {
  if (!el) return;
  el.textContent = texto;
  el.style.color = ok ? "#39d98a" : "#ff5c5c";
}
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

/* ---------- Active project ---------- */
const activeRef = doc(db, "meta", "active");
let ACTIVE_PROJECT_ID = null;
let ACTIVE_PROJECT = null;

async function setActiveProject(projectId) {
  await setDoc(activeRef, { projectId, updatedAt: serverTimestamp() }, { merge: true });
}
async function loadActiveProjectOnce() {
  const snap = await getDoc(activeRef);
  ACTIVE_PROJECT_ID = snap.exists() ? (snap.data().projectId || null) : null;
}
function updateActivePill() {
  if (!ACTIVE_PROJECT_ID) {
    activeProjPill.textContent = "Projeto ativo: (nenhum)";
    return;
  }
  if (ACTIVE_PROJECT?.nome) {
    activeProjPill.textContent = "Projeto ativo: " + ACTIVE_PROJECT.nome;
  } else {
    activeProjPill.textContent = "Projeto ativo: (definido)";
  }
}

onSnapshot(activeRef, async (snap) => {
  ACTIVE_PROJECT_ID = snap.exists() ? (snap.data().projectId || null) : null;
  ACTIVE_PROJECT = null;
  updateActivePill();
  await refreshActiveProject();
}, (err) => {
  console.error(err);
  updateActivePill();
});

/* ---------- Projects CRUD ---------- */
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
  if (p_mistura) p_mistura.value = "";
  if (p_cap) p_cap.value = "";
  if (sieveBody) Array.from(sieveBody.querySelectorAll("input")).forEach(i => (i.value = ""));
}

const projectsCol = collection(db, "projects");
const qProjects = query(projectsCol, orderBy("createdAt", "desc"));

if (btnSalvarProjeto) {
  btnSalvarProjeto.addEventListener("click", async () => {
    const nome = p_nome.value.trim();
    if (!nome) { showMsg(msgProjeto, "Preencha o Nome do Projeto.", false); return; }
    const data = {
      nome,
      codigo: p_codigo.value.trim() || null,
      cliente: p_cliente.value.trim() || null,
      pbProjeto: nOrNull(p_pb.value),
      mistura: p_mistura.value.trim() || null,
      cap: p_cap.value.trim() || null,
      sieveLimits: readSieveLimits(sieveBody),
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
}

if (listaProjetos) {
  onSnapshot(qProjects, async (snap) => {
    setConn("Online (Firestore)", true);
    if (kpiProjetos) kpiProjetos.textContent = String(snap.size);

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
          <div class="meta">Código: ${escapeHtml(p.codigo || "—")} • CAP proj: ${p.pbProjeto ?? "—"}% • Mistura: ${escapeHtml(p.mistura || "—")}</div>
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
    if (kpiProjetos) kpiProjetos.textContent = "—";
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
      showMsg(msgProjeto, "Falha. Abra o Console (F12).", false);
    }
  });
}

/* ---------- Load active project data ---------- */
async function refreshActiveProject() {
  if (!ACTIVE_PROJECT_ID) { ACTIVE_PROJECT = null; updateActivePill(); rebuildEnsSieveTable(); refreshEnsaiosList(); return; }
  try {
    const pSnap = await getDoc(doc(db, "projects", ACTIVE_PROJECT_ID));
    ACTIVE_PROJECT = pSnap.exists() ? pSnap.data() : null;
    updateActivePill();
    rebuildEnsSieveTable();
    refreshEnsaiosList();
  } catch (e) {
    console.error(e);
    ACTIVE_PROJECT = null;
    updateActivePill();
  }
}

/* ---------- ENSAIOS: Extração + Granulometria ---------- */
const e_data = document.getElementById("e_data");
const e_tecnico = document.getElementById("e_tecnico");
const e_lote = document.getElementById("e_lote");
const e_obs = document.getElementById("e_obs");
const e_mmix = document.getElementById("e_mmix");
const e_kf = document.getElementById("e_kf");
const e_pb = document.getElementById("e_pb");
const e_status = document.getElementById("e_status");
const ensSieveBody = document.getElementById("ensSieveBody");
const btnSalvarEnsaio = document.getElementById("btnSalvarEnsaio");
const msgEnsaio = document.getElementById("msgEnsaio");
const listaEnsaios = document.getElementById("listaEnsaios");

if (e_data && !e_data.value) e_data.value = todayISO();

function rebuildEnsSieveTable() {
  if (!ensSieveBody) return;
  ensSieveBody.innerHTML = "";

  SIEVES.forEach(sv => {
    const lim = (ACTIVE_PROJECT?.sieveLimits && ACTIVE_PROJECT.sieveLimits[sv]) ? ACTIVE_PROJECT.sieveLimits[sv] : {min:null,max:null};
    const key = sv.replace(/[^a-z0-9]/gi,'_');

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><b>${escapeHtml(sv)}</b></td>
      <td><input class="ret" data-sv="${escapeHtml(sv)}" placeholder="0" /></td>
      <td id="pass_${key}">—</td>
      <td>${lim.min ?? "—"}</td>
      <td>${lim.max ?? "—"}</td>
      <td id="ok_${key}">—</td>
    `;
    ensSieveBody.appendChild(tr);
  });

  Array.from(ensSieveBody.querySelectorAll("input.ret")).forEach(inp=>{
    inp.addEventListener("input", calcEnsaio);
  });
  if (e_mmix) e_mmix.addEventListener("input", calcEnsaio);
  if (e_kf) e_kf.addEventListener("input", calcEnsaio);

  calcEnsaio();
}

function getRetidos() {
  const ret = {};
  if (!ensSieveBody) return ret;
  Array.from(ensSieveBody.querySelectorAll("input.ret")).forEach(inp=>{
    const sv = inp.dataset.sv;
    ret[sv] = nOrNull(inp.value) ?? 0;
  });
  return ret;
}

function calcEnsaio() {
  if (!ensSieveBody) return;

  const Mmix = nOrNull(e_mmix?.value) ?? null;
  const kf = nOrNull(e_kf?.value) ?? 0;

  const ret = getRetidos();
  const totalAgg = Object.values(ret).reduce((a,b)=>a+(Number(b)||0),0);

  let Pb = null;
  if (Mmix && Mmix > 0) Pb = ((Mmix - totalAgg) / Mmix) * 100 + (kf || 0);
  if (e_pb) e_pb.textContent = (Pb === null || !Number.isFinite(Pb)) ? "—" : Pb.toFixed(2);

  let allOk = true;
  let anyChecked = false;
  let cumRet = 0;

  SIEVES.forEach(sv => {
    const r = Number(ret[sv] || 0);
    cumRet += r;

    let pass = null;
    if (totalAgg > 0) pass = 100 - (cumRet / totalAgg) * 100;

    const key = sv.replace(/[^a-z0-9]/gi,'_');
    const passCell = document.getElementById("pass_" + key);
    const okCell = document.getElementById("ok_" + key);

    if (passCell) passCell.textContent = (pass === null || !Number.isFinite(pass)) ? "—" : pass.toFixed(1);

    const lim = (ACTIVE_PROJECT?.sieveLimits && ACTIVE_PROJECT.sieveLimits[sv]) ? ACTIVE_PROJECT.sieveLimits[sv] : null;
    if (lim && pass !== null && Number.isFinite(pass)) {
      anyChecked = true;
      const min = (lim.min ?? null);
      const max = (lim.max ?? null);

      let ok = true;
      if (min !== null && pass < min) ok = false;
      if (max !== null && pass > max) ok = false;

      if (okCell) okCell.textContent = ok ? "OK" : "NC";
      if (!ok) allOk = false;
    } else {
      if (okCell) okCell.textContent = "—";
    }
  });

  if (e_status) {
    if (!ACTIVE_PROJECT_ID) {
      e_status.textContent = "Sem Projeto Ativo";
      e_status.style.color = "#ffd166";
    } else if (!anyChecked) {
      e_status.textContent = "Sem limites no projeto";
      e_status.style.color = "#ffd166";
    } else {
      e_status.textContent = allOk ? "CONFORME" : "NÃO CONFORME";
      e_status.style.color = allOk ? "#39d98a" : "#ff5c5c";
    }
  }
}

const ensaiosCol = collection(db, "assays_extr_gran");

async function salvarEnsaio() {
  if (!ACTIVE_PROJECT_ID) { showMsg(msgEnsaio, "Sem Projeto Ativo. Vá em Projetos e clique Ativar.", false); return; }

  const dataISO = e_data?.value || todayISO();
  const tecnico = (e_tecnico?.value || "").trim();
  const lote = (e_lote?.value || "").trim();
  const obs = (e_obs?.value || "").trim();

  const Mmix = nOrNull(e_mmix?.value);
  if (!Mmix || Mmix <= 0) { showMsg(msgEnsaio, "Preencha a Massa da mistura (g).", false); return; }

  const kf = nOrNull(e_kf?.value) ?? 0;
  const ret = getRetidos();
  const totalAgg = Object.values(ret).reduce((a,b)=>a+(Number(b)||0),0);
  const Pb = ((Mmix - totalAgg) / Mmix) * 100 + (kf || 0);

  const passMap = {};
  let cumRet = 0;
  SIEVES.forEach(sv=>{
    cumRet += Number(ret[sv]||0);
    const pass = totalAgg>0 ? 100 - (cumRet/totalAgg)*100 : null;
    passMap[sv] = (pass===null || !Number.isFinite(pass)) ? null : Number(pass.toFixed(2));
  });

  let allOk = true;
  let anyChecked = false;
  SIEVES.forEach(sv=>{
    const lim = (ACTIVE_PROJECT?.sieveLimits && ACTIVE_PROJECT.sieveLimits[sv]) ? ACTIVE_PROJECT.sieveLimits[sv] : null;
    const pass = passMap[sv];
    if (lim && pass !== null) {
      anyChecked = true;
      const min = (lim.min ?? null), max = (lim.max ?? null);
      if (min !== null && pass < min) allOk = false;
      if (max !== null && pass > max) allOk = false;
    }
  });
  const status = !anyChecked ? "SEM_LIMITES" : (allOk ? "CONFORME" : "NAO_CONFORME");

  try {
    await addDoc(ensaiosCol, {
      projectId: ACTIVE_PROJECT_ID,
      projectName: ACTIVE_PROJECT?.nome || null,
      data: dataISO,
      tecnico: tecnico || null,
      lote: lote || null,
      obs: obs || null,
      Mmix,
      kf,
      totalAgg,
      Pb: Number(Pb.toFixed(3)),
      retidos: ret,
      passantes: passMap,
      status,
      createdAt: serverTimestamp()
    });
    showMsg(msgEnsaio, "Ensaio salvo no Firebase!", true);
  } catch (e) {
    console.error(e);
    showMsg(msgEnsaio, "Falha ao salvar. Abra o Console (F12).", false);
  }
}

if (btnSalvarEnsaio) btnSalvarEnsaio.addEventListener("click", salvarEnsaio);

function refreshEnsaiosList() {
  if (!listaEnsaios) return;
  listaEnsaios.innerHTML = `<div class="muted">Carregando…</div>`;

  if (!ACTIVE_PROJECT_ID) {
    listaEnsaios.innerHTML = `<div class="muted">Sem projeto ativo.</div>`;
    return;
  }

  const qEns = query(
    ensaiosCol,
    where("projectId","==", ACTIVE_PROJECT_ID),
    orderBy("createdAt","desc"),
    limit(10)
  );

  onSnapshot(qEns, (snap)=>{
    if (snap.empty) {
      listaEnsaios.innerHTML = `<div class="muted">Nenhum ensaio salvo ainda.</div>`;
      return;
    }
    const wrap = document.createElement("div");
    wrap.className = "list";
    snap.forEach(d=>{
      const a = d.data();
      const el = document.createElement("div");
      el.className = "item";
      el.innerHTML = `
        <div>
          <b>${escapeHtml(a.data || "")} • ${escapeHtml(a.lote || "—")}</b>
          <div class="meta">Téc.: ${escapeHtml(a.tecnico || "—")} • Pb: ${a.Pb ?? "—"}% • Mmix: ${a.Mmix ?? "—"}g</div>
          <div class="meta">Status: ${escapeHtml(a.status || "—")}</div>
        </div>
      `;
      wrap.appendChild(el);
    });
    listaEnsaios.innerHTML = "";
    listaEnsaios.appendChild(wrap);
  }, (err)=>{
    console.error(err);
    listaEnsaios.innerHTML = `<div class="muted">Erro ao carregar ensaios.</div>`;
  });
}

/* ---------- init ---------- */
setConn("Online (Firestore)", true);
if (e_data && !e_data.value) e_data.value = todayISO();
loadActiveProjectOnce().then(refreshActiveProject).catch(()=>{});
