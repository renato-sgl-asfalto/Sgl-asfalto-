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

/* ===================== Util ===================== */
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

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
    "&":"&amp;",
    "<":"&lt;",
    ">":"&gt;",
    '"':"&quot;",
    "'":"&#039;"
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
    if (i>=n && map[i]) { hi = i; break; }
  }
  const klo = map[lo], khi = map[hi];
  const t = (n-lo)/(hi-lo);
  return klo + (khi-klo)*t;
}

/* ===================== UI refs ===================== */
const connPill = $("#connPill");
const activeProjPill = $("#activeProjPill");
const kpiFirebase = $("#kpiFirebase");
const kpiProjetos = $("#kpiProjetos");
const kpiEnsaios = $("#kpiEnsaios");
const kpiConformes = $("#kpiConformes");

function setConn(texto, ok=true){
  if (connPill){
    connPill.textContent = texto;
    connPill.style.borderColor = ok ? "rgba(57,217,138,.4)" : "rgba(255,92,92,.4)";
    connPill.style.color = ok ? "#39d98a" : "#ff5c5c";
  }
  if (kpiFirebase) kpiFirebase.textContent = ok ? "Online" : "Erro";
}
function setActiveText(t){
  if (activeProjPill) activeProjPill.textContent = t;
}
function showMsg(el, txt, ok=true){
  if (!el) return;
  el.textContent = txt;
  el.style.color = ok ? "#39d98a" : "#ff5c5c";
}
function setBadge(el, txt, kind){
  if (!el) return;
  el.textContent = txt;
  el.className = "badge " + (kind || "");
}

/* ===================== Tabs ===================== */
(() => {
  const tabs = $$(".tab");
  if (!tabs.length) return;

  const views = {
    painel: $("#view-painel"),
    projetos: $("#view-projetos"),
    ensaios: $("#view-ensaios"),
    estatistico: $("#view-estatistico"),
    relatorios: $("#view-relatorios")
  };

  tabs.forEach(btn=>{
    btn.addEventListener("click", ()=>{
      tabs.forEach(b=>b.classList.remove("active"));
      btn.classList.add("active");
      const id = btn.dataset.tab;
      Object.values(views).forEach(v=>v && v.classList.add("hidden"));
      views[id] && views[id].classList.remove("hidden");
    });
  });
})();

/* ===================== Ensaios Subtabs ===================== */
(() => {
  const subtabs = $$(".subtab");
  if (!subtabs.length) return;

  const subviews = {
    extrgranu: $("#sub-extrgranu"),
    rice: $("#sub-rice"),
    marshall: $("#sub-marshall"),
    rt: $("#sub-rt"),
    se: $("#sub-se")
  };

  subtabs.forEach(btn=>{
    btn.addEventListener("click", ()=>{
      subtabs.forEach(b=>b.classList.remove("active"));
      btn.classList.add("active");
      const id = btn.dataset.sub;
      Object.values(subviews).forEach(v=>v && v.classList.add("hidden"));
      subviews[id] && subviews[id].classList.remove("hidden");
    });
  });
})();

/* ===================== Active Project ===================== */
const activeRef = doc(db, "meta", "active");
let ACTIVE_PROJECT_ID = null;
let ACTIVE_PROJECT = null;

/* ===================== Projects (CRUD) ===================== */
const projectsCol = collection(db, "projects");

const sieveBody = $("#sieveBody");
const p_nome = $("#p_nome");
const p_codigo = $("#p_codigo");
const p_cliente = $("#p_cliente");
const p_mistura = $("#p_mistura");
const p_cap = $("#p_cap");
const p_pb = $("#p_pb");
const p_pbtol = $("#p_pbtol");

const p_vv_min = $("#p_vv_min");
const p_vv_max = $("#p_vv_max");
const p_vam_min = $("#p_vam_min");
const p_rbv_min = $("#p_rbv_min");
const p_rbv_max = $("#p_rbv_max");
const p_estab_min = $("#p_estab_min");
const p_flow_min = $("#p_flow_min");
const p_flow_max = $("#p_flow_max");
const p_rt_min = $("#p_rt_min");
const p_se_min = $("#p_se_min");

const btnSalvarProjeto = $("#btnSalvarProjeto");
const msgProjeto = $("#msgProjeto");
const listaProjetos = $("#listaProjetos");

const SIEVES = ['3/4"', '1/2"', '3/8"', '1/4"', '#4', '#8', '#16', '#30', '#50', '#100', '#200'];

function buildProjectSieveRows(){
  if (!sieveBody) return;
  sieveBody.innerHTML = "";
  SIEVES.forEach(sv=>{
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><b>${escapeHtml(sv)}</b></td>
      <td><input data-sv="${escapeHtml(sv)}" data-k="min" placeholder="min" /></td>
      <td><input data-sv="${escapeHtml(sv)}" data-k="max" placeholder="max" /></td>
    `;
    sieveBody.appendChild(tr);
  });
}
buildProjectSieveRows();

function readSieveLimits(bodyEl){
  const inputs = Array.from(bodyEl.querySelectorAll("input"));
  const limits = {};
  inputs.forEach(inp=>{
    const sv = inp.dataset.sv;
    const k = inp.dataset.k;
    limits[sv] = limits[sv] || { min: null, max: null };
    limits[sv][k] = nOrNull(inp.value);
  });
  Object.keys(limits).forEach(sv=>{
    const r = limits[sv];
    if (r.min === null && r.max === null) delete limits[sv];
  });
  return limits;
}

function clearProjectForm(){
  [
    p_nome,p_codigo,p_cliente,p_mistura,p_cap,p_pb,p_pbtol,
    p_vv_min,p_vv_max,p_vam_min,p_rbv_min,p_rbv_max,p_estab_min,p_flow_min,p_flow_max,p_rt_min,p_se_min
  ].forEach(i=>{ if(i) i.value=""; });
  if (sieveBody) Array.from(sieveBody.querySelectorAll("input")).forEach(i=>i.value="");
}

async function setActiveProject(projectId){
  await setDoc(activeRef, { projectId, updatedAt: serverTimestamp() }, { merge: true });
}

if (btnSalvarProjeto){
  btnSalvarProjeto.addEventListener("click", async ()=>{
    const nome = (p_nome?.value || "").trim();
    if (!nome){
      showMsg(msgProjeto, "Preencha o Nome do Projeto.", false);
      return;
    }

    const data = {
      nome,
      codigo: (p_codigo?.value || "").trim() || null,
      cliente: (p_cliente?.value || "").trim() || null,
      mistura: (p_mistura?.value || "").trim() || null,
      cap: (p_cap?.value || "").trim() || null,
      pbProjeto: nOrNull(p_pb?.value),
      pbTol: nOrNull(p_pbtol?.value) ?? 0.3,
      limits: {
        vvMin: nOrNull(p_vv_min?.value),
        vvMax: nOrNull(p_vv_max?.value),
        vamMin: nOrNull(p_vam_min?.value),
        rbvMin: nOrNull(p_rbv_min?.value),
        rbvMax: nOrNull(p_rbv_max?.value),
        estabMin: nOrNull(p_estab_min?.value),
        flowMin: nOrNull(p_flow_min?.value),
        flowMax: nOrNull(p_flow_max?.value),
        rtMin: nOrNull(p_rt_min?.value),
        seMin: nOrNull(p_se_min?.value),
      },
      sieveLimits: sieveBody ? readSieveLimits(sieveBody) : {},
      createdAt: serverTimestamp(),
      createdAtClient: Date.now()
    };

    try{
      await addDoc(projectsCol, data);
      showMsg(msgProjeto, "Projeto salvo!", true);
      clearProjectForm();
    }catch(e){
      console.error(e);
      showMsg(msgProjeto, "Erro ao salvar (ver Console).", false);
    }
  });
}

const qProjects = query(projectsCol, orderBy("createdAtClient","desc"), limit(200));
onSnapshot(qProjects, (snap)=>{
  setConn("Online (Firestore)", true);
  if (kpiProjetos) kpiProjetos.textContent = String(snap.size);
  if (!listaProjetos) return;

  if (snap.empty){
    listaProjetos.innerHTML = `<div class="muted">Nenhum projeto cadastrado ainda.</div>`;
    return;
  }

  listaProjetos.innerHTML = "";
  snap.forEach(d=>{
    const p = d.data();
    const isActive = d.id === ACTIVE_PROJECT_ID;

    const el = document.createElement("div");
    el.className = "item";
    el.innerHTML = `
      <div>
        <b>${escapeHtml(p.nome)}</b>
        <div class="meta">Código: ${escapeHtml(p.codigo || "—")} • Pb: ${p.pbProjeto ?? "—"}% ± ${p.pbTol ?? 0.3}</div>
        <div class="meta">Cliente/Obra: ${escapeHtml(p.cliente || "—")} • Mistura: ${escapeHtml(p.mistura || "—")} • CAP: ${escapeHtml(p.cap || "—")}</div>
        <div class="meta">${isActive ? "✅ ATIVO" : ""}</div>
      </div>
      <div class="btns">
        <button class="btn2" data-act="ativar" data-id="${d.id}">${isActive ? "Ativo" : "Ativar"}</button>
        <button class="btn2 danger" data-act="apagar" data-id="${d.id}">Apagar</button>
      </div>
    `;
    listaProjetos.appendChild(el);
  });
}, (err)=>{
  console.error(err);
  setConn("Erro Firestore", false);
});

if (listaProjetos){
  listaProjetos.addEventListener("click", async (ev)=>{
    const btn = ev.target.closest("button");
    if (!btn) return;
    const act = btn.dataset.act;
    const id = btn.dataset.id;
    if (!act || !id) return;

    try{
      if (act === "ativar"){
        await setActiveProject(id);
        showMsg(msgProjeto, "Projeto ativo definido!", true);
      }
      if (act === "apagar"){
        if (id === ACTIVE_PROJECT_ID){
          showMsg(msgProjeto, "Não apague o projeto ativo. Ative outro primeiro.", false);
          return;
        }
        await deleteDoc(doc(db, "projects", id));
        showMsg(msgProjeto, "Projeto apagado.", true);
      }
    }catch(e){
      console.error(e);
      showMsg(msgProjeto, "Erro (ver Console).", false);
    }
  });
}

/* ===================== KPIs (SEM DUPLICAR FUNÇÕES) ===================== */
function updateKPIsEmpty(){
  if (kpiEnsaios) kpiEnsaios.textContent = "—";
  if (kpiConformes) kpiConformes.textContent = "—";
}

/* ===================== Active Project Load ===================== */
let unsubEnsExtr = null;

async function refreshActiveProject(){
  if (!ACTIVE_PROJECT_ID){
    ACTIVE_PROJECT = null;
    setActiveText("Projeto ativo: (nenhum)");
    if (unsubEnsExtr) { unsubEnsExtr(); unsubEnsExtr = null; }
    updateKPIsEmpty();
    return;
  }

  const pSnap = await getDoc(doc(db, "projects", ACTIVE_PROJECT_ID));
  ACTIVE_PROJECT = pSnap.exists() ? pSnap.data() : null;
  setActiveText("Projeto ativo: " + (ACTIVE_PROJECT?.nome || "(sem nome)"));

  // aqui você pluga listas por subcoleção do projeto ativo (sem índice)
  const colExtr = collection(db, `projects/${ACTIVE_PROJECT_ID}/ensaios_extr_gran`);
  const qExtr = query(colExtr, orderBy("createdAtClient","desc"), limit(50));
  if (unsubEnsExtr) unsubEnsExtr();
  unsubEnsExtr = onSnapshot(qExtr, (snap)=>{
    let total = 0;
    let conf = 0;
    snap.forEach(d=>{
      total++;
      const a = d.data();
      if (a.status === "CONFORME") conf++;
    });
    if (kpiEnsaios) kpiEnsaios.textContent = String(total);
    if (kpiConformes) kpiConformes.textContent = total ? `${Math.round((conf/total)*100)}%` : "—";
  });
}

onSnapshot(activeRef, async (snap)=>{
  ACTIVE_PROJECT_ID = snap.exists() ? (snap.data().projectId || null) : null;
  await refreshActiveProject();
}, (err)=>{
  console.error(err);
  setActiveText("Projeto ativo: (erro)");
});

/* ===================== init ===================== */
setConn("Online (Firestore)", true);
setActiveText("Projeto ativo: (carregando)");
updateKPIsEmpty();

getDoc(activeRef).then(s=>{
  ACTIVE_PROJECT_ID = s.exists() ? (s.data().projectId || null) : null;
  refreshActiveProject();
}).catch(()=>{});
``
