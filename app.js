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

/* k simplificado por N (para controle estatístico no relatório) */
function kFactor(n){
  // tabela compacta (aprox) apenas para uso interno do resumo
  const map = {
    2: 1.84, 3: 1.32, 4: 1.20, 5: 1.13, 6: 1.09, 7: 1.06, 8: 1.04, 9: 1.03, 10: 1.02,
    11: 1.01, 12: 1.00, 13: 0.99, 14: 0.98, 15: 0.97, 16: 0.96, 17: 0.96, 18: 0.95,
    19: 0.95, 20: 0.94, 25: 0.93
  };
  if (n <= 1) return null;
  if (map[n]) return map[n];
  if (n > 25) return 0.92;
  // interpolação simples
  let lo = 2, hi = 25;
  for (let i=2;i<=25;i++){ if(map[i]) lo=i; if(i>=n && map[i]) {hi=i; break;} }
  const klo = map[lo], khi = map[hi];
  const t = (n-lo)/(hi-lo);
  return klo + (khi-klo)*t;
}

/* ===================== UI refs ===================== */
const connPill = document.getElementById("connPill");
const activeProjPill = document.getElementById("activeProjPill");
const kpiFirebase = document.getElementById("kpiFirebase");
const kpiProjetos = document.getElementById("kpiProjetos");
const kpiEnsaios = document.getElementById("kpiEnsaios");
const kpiConformes = document.getElementById("kpiConformes");

function setConn(texto, ok=true){
  if (connPill){
    connPill.textContent = texto;
    connPill.style.borderColor = ok ? "rgba(57,217,138,.4)" : "rgba(255,92,92,.4)";
    connPill.style.color = ok ? "#39d98a" : "#ff5c5c";
  }
  if (kpiFirebase) kpiFirebase.textContent = ok ? "Online" : "Erro";
}
function setActiveText(t){ if (activeProjPill) activeProjPill.textContent = t; }
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
const tabs = Array.from(document.querySelectorAll(".tab"));
const views = {
  painel: document.getElementById("view-painel"),
  projetos: document.getElementById("view-projetos"),
  ensaios: document.getElementById("view-ensaios"),
  estatistico: document.getElementById("view-estatistico"),
  relatorios: document.getElementById("view-relatorios")
};
tabs.forEach(btn=>{
  btn.addEventListener("click", ()=>{
    tabs.forEach(b=>b.classList.remove("active"));
    btn.classList.add("active");
    const id = btn.dataset.tab;
    Object.values(views).forEach(v=>v?.classList.add("hidden"));
    views[id]?.classList.remove("hidden");
  });
});

/* ===================== Ensaios subtabs ===================== */
const subtabs = Array.from(document.querySelectorAll(".subtab"));
const subviews = {
  extrgranu: document.getElementById("sub-extrgranu"),
  rice: document.getElementById("sub-rice"),
  marshall: document.getElementById("sub-marshall"),
  rt: document.getElementById("sub-rt"),
  se: document.getElementById("sub-se")
};
subtabs.forEach(btn=>{
  btn.addEventListener("click", ()=>{
    subtabs.forEach(b=>b.classList.remove("active"));
    btn.classList.add("active");
    const id = btn.dataset.sub;
    Object.values(subviews).forEach(v=>v?.classList.add("hidden"));
    subviews[id]?.classList.remove("hidden");
  });
});

/* ===================== Active project ===================== */
const activeRef = doc(db, "meta", "active");
let ACTIVE_PROJECT_ID = null;
let ACTIVE_PROJECT = null;

/* ===================== Projects ===================== */
const projectsCol = collection(db, "projects");

const sieveBody = document.getElementById("sieveBody");
const p_nome = document.getElementById("p_nome");
const p_codigo = document.getElementById("p_codigo");
const p_cliente = document.getElementById("p_cliente");
const p_mistura = document.getElementById("p_mistura");
const p_cap = document.getElementById("p_cap");
const p_pb = document.getElementById("p_pb");
const p_pbtol = document.getElementById("p_pbtol");

const p_vv_min = document.getElementById("p_vv_min");
const p_vv_max = document.getElementById("p_vv_max");
const p_vam_min = document.getElementById("p_vam_min");
const p_rbv_min = document.getElementById("p_rbv_min");
const p_rbv_max = document.getElementById("p_rbv_max");
const p_estab_min = document.getElementById("p_estab_min");
const p_flow_min = document.getElementById("p_flow_min");
const p_flow_max = document.getElementById("p_flow_max");
const p_rt_min = document.getElementById("p_rt_min");
const p_se_min = document.getElementById("p_se_min");

const btnSalvarProjeto = document.getElementById("btnSalvarProjeto");
const msgProjeto = document.getElementById("msgProjeto");
const listaProjetos = document.getElementById("listaProjetos");

/* peneiras padrão */
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

/* list projects */
const qProjects = query(projectsCol, orderBy("createdAt","desc"));
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
        <div class="meta">
          Código: ${escapeHtml(p.codigo || "—")} • Pb: ${p.pbProjeto ?? "—"}% ± ${p.pbTol ?? 0.3}
        </div>
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

/* save project */
if (btnSalvarProjeto){
  btnSalvarProjeto.addEventListener("click", async ()=>{
    const nome = (p_nome?.value || "").trim();
    if (!nome){ showMsg(msgProjeto, "Preencha o Nome do Projeto.", false); return; }

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
        seMin: nOrNull(p_se_min?.value)
      },

      sieveLimits: sieveBody ? readSieveLimits(sieveBody) : {},
      createdAt: serverTimestamp()
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

/* project buttons */
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

/* load active project */
async function refreshActiveProject(){
  if (!ACTIVE_PROJECT_ID){
    ACTIVE_PROJECT = null;
    setActiveText("Projeto ativo: (nenhum)");
    rebuildEnsaioSieveTable();
    calcExtrGranu();
    stopAllLists();
    updateKPIsEmpty();
    return;
  }
  const pSnap = await getDoc(doc(db, "projects", ACTIVE_PROJECT_ID));
  ACTIVE_PROJECT = pSnap.exists() ? pSnap.data() : null;
  setActiveText("Projeto ativo: " + (ACTIVE_PROJECT?.nome || "(sem nome)"));
  rebuildEnsaioSieveTable();
  calcExtrGranu();
  startAllLists();
}

onSnapshot(activeRef, async (snap)=>{
  ACTIVE_PROJECT_ID = snap.exists() ? (snap.data().projectId || null) : null;
  await refreshActiveProject();
}, (err)=>{
  console.error(err);
  setActiveText("Projeto ativo: (erro)");
});

/* ===================== Ensaios: Extração + Granu ===================== */
const e_data = document.getElementById("e_data");
const e_tecnico = document.getElementById("e_tecnico");
const e_lote = document.getElementById("e_lote");
const e_obs = document.getElementById("e_obs");
const e_mmix = document.getElementById("e_mmix");
const e_kf = document.getElementById("e_kf");
const e_pb = document.getElementById("e_pb");
const e_pb_lim = document.getElementById("e_pb_lim");
const e_status = document.getElementById("e_status");
const e_status_det = document.getElementById("e_status_det");
const ensSieveBody = document.getElementById("ensSieveBody");
const btnSalvarEnsaio = document.getElementById("btnSalvarEnsaio");
const msgEnsaio = document.getElementById("msgEnsaio");
const listaEnsaios = document.getElementById("listaEnsaios");

if (e_data && !e_data.value) e_data.value = todayISO();

function pbLimits(){
  const pbRef = Number(ACTIVE_PROJECT?.pbProjeto ?? NaN);
  const tol = Number(ACTIVE_PROJECT?.pbTol ?? 0.3);
  if (Number.isFinite(pbRef)) return { min: pbRef - tol, max: pbRef + tol };
  return { min: 4.5, max: 6.5 }; // fallback
}

function rebuildEnsaioSieveTable(){
  if (!ensSieveBody) return;
  ensSieveBody.innerHTML = "";

  SIEVES.forEach(sv=>{
    const lim = (ACTIVE_PROJECT?.sieveLimits && ACTIVE_PROJECT.sieveLimits[sv])
      ? ACTIVE_PROJECT.sieveLimits[sv]
      : { min: null, max: null };

    const key = sv.replace(/[^a-z0-9]/gi,"_");

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
    inp.addEventListener("input", calcExtrGranu);
  });
}

function getRetidos(){
  const ret = {};
  if (!ensSieveBody) return ret;
  Array.from(ensSieveBody.querySelectorAll("input.ret")).forEach(inp=>{
    const sv = inp.dataset.sv;
    ret[sv] = nOrZero(inp.value);
  });
  return ret;
}

function calcExtrGranu(){
  const mmix = nOrNull(e_mmix?.value);
  const kf = nOrZero(e_kf?.value);
  const ret = getRetidos();
  const totalAgg = Object.values(ret).reduce((a,b)=>a+(Number(b)||0),0);

  const pb = (mmix && mmix>0) ? (((mmix - totalAgg)/mmix)*100 + kf) : null;
  if (e_pb) e_pb.textContent = (pb===null || !Number.isFinite(pb)) ? "—" : pb.toFixed(2);

  const limPb = pbLimits();
  if (e_pb_lim) e_pb_lim.textContent = `Limites: ${limPb.min.toFixed(2)} a ${limPb.max.toFixed(2)}`;

  // granulometria
  let cumRet = 0;
  let anyCheck = false;
  let allOk = true;
  let out = [];

  SIEVES.forEach(sv=>{
    const key = sv.replace(/[^a-z0-9]/gi,"_");
    const passCell = document.getElementById("pass_"+key);
    const okCell = document.getElementById("ok_"+key);

    cumRet += Number(ret[sv]||0);
    const pass = (totalAgg>0) ? (100 - (cumRet/totalAgg)*100) : null;

    if (passCell) passCell.textContent = (pass===null || !Number.isFinite(pass)) ? "—" : pass.toFixed(1);

    const lim = (ACTIVE_PROJECT?.sieveLimits && ACTIVE_PROJECT.sieveLimits[sv]) ? ACTIVE_PROJECT.sieveLimits[sv] : null;
    if (lim && pass !== null && Number.isFinite(pass)){
      anyCheck = true;
      let ok = true;
      if (lim.min !== null && pass < lim.min) ok = false;
      if (lim.max !== null && pass > lim.max) ok = false;
      if (okCell) okCell.textContent = ok ? "OK" : "NC";
      if (!ok){ allOk = false; out.push(`${sv}=${pass.toFixed(1)}%`); }
    } else {
      if (okCell) okCell.textContent = "—";
    }
  });

  if (!ACTIVE_PROJECT_ID){
    setBadge(e_status, "SEM PROJETO", "warn");
    if (e_status_det) e_status_det.textContent = "Vá em Projetos e clique Ativar.";
    return;
  }

  let pbOk = null;
  if (pb !== null && Number.isFinite(pb)) pbOk = (pb>=limPb.min && pb<=limPb.max);

  let okGeral = true;
  let det = [];

  if (pbOk === false){ okGeral=false; det.push("Pb fora"); }
  if (anyCheck && !allOk){ okGeral=false; det.push("Granu fora"); }
  if (pbOk === null) det.push("Pb pendente");
  if (!anyCheck) det.push("Sem limites de granu no projeto");

  if (okGeral && pbOk !== false && (anyCheck ? allOk : true)){
    setBadge(e_status, "CONFORME", "ok");
  } else {
    setBadge(e_status, "NÃO CONFORME", "bad");
  }

  if (e_status_det){
    e_status_det.textContent = det.join(" / ") + (out.length ? (" • Fora: "+out.join(", ")) : "");
  }
}

if (e_mmix) e_mmix.addEventListener("input", calcExtrGranu);
if (e_kf) e_kf.addEventListener("input", calcExtrGranu);

async function saveExtrGranu(){
  if (!ACTIVE_PROJECT_ID){
    showMsg(msgEnsaio, "Sem projeto ativo. Vá em Projetos e clique Ativar.", false);
    return;
  }

  const mmix = nOrNull(e_mmix?.value);
  if (!mmix || mmix<=0){
    showMsg(msgEnsaio, "Preencha a massa da mistura.", false);
    return;
  }

  const kf = nOrZero(e_kf?.value);
  const ret = getRetidos();
  const totalAgg = Object.values(ret).reduce((a,b)=>a+(Number(b)||0),0);
  const pb = ((mmix-totalAgg)/mmix)*100 + kf;

  const limPb = pbLimits();
  const pbOk = (pb>=limPb.min && pb<=limPb.max);

  // passantes
  const passantes = {};
  let cumRet = 0;
  SIEVES.forEach(sv=>{
    cumRet += Number(ret[sv]||0);
    const pass = (totalAgg>0) ? (100 - (cumRet/totalAgg)*100) : null;
    passantes[sv] = (pass===null || !Number.isFinite(pass)) ? null : Number(pass.toFixed(2));
  });

  // granu ok?
  let anyCheck = false;
  let granuOk = true;
  SIEVES.forEach(sv=>{
    const lim = (ACTIVE_PROJECT?.sieveLimits && ACTIVE_PROJECT.sieveLimits[sv]) ? ACTIVE_PROJECT.sieveLimits[sv] : null;
    const pass = passantes[sv];
    if (lim && pass !== null){
      anyCheck = true;
      if (lim.min !== null && pass < lim.min) granuOk = false;
      if (lim.max !== null && pass > lim.max) granuOk = false;
    }
  });

  const status = (pbOk && (anyCheck ? granuOk : true)) ? "CONFORME" : "NAO_CONFORME";

  try{
    const colEns = collection(db, `projects/${ACTIVE_PROJECT_ID}/ensaios_extr_gran`);
    await addDoc(colEns, {
      projectId: ACTIVE_PROJECT_ID,
      projectName: ACTIVE_PROJECT?.nome || null,

      data: e_data?.value || todayISO(),
      tecnico: (e_tecnico?.value || "").trim() || null,
      lote: (e_lote?.value || "").trim() || null,
      obs: (e_obs?.value || "").trim() || null,

      mmix,
      kf,
      totalAgg,
      pb: Number(pb.toFixed(3)),
      pbMin: Number(limPb.min.toFixed(3)),
      pbMax: Number(limPb.max.toFixed(3)),
      pbOk,
      retidos: ret,
      passantes,
      status,

      createdAt: serverTimestamp(),
      createdAtClient: Date.now()
    });

    showMsg(msgEnsaio, "Ensaio salvo!", true);
  }catch(e){
    console.error(e);
    showMsg(msgEnsaio, "Erro ao salvar (ver Console).", false);
  }
}

if (btnSalvarEnsaio) btnSalvarEnsaio.addEventListener("click", saveExtrGranu);

/* ===================== Rice (Gmm) ===================== */
const r_data = document.getElementById("r_data");
const r_tecnico = document.getElementById("r_tecnico");
const r_lote = document.getElementById("r_lote");
const r_A = document.getElementById("r_A");
const r_B = document.getElementById("r_B");
const r_C = document.getElementById("r_C");
const r_gmm = document.getElementById("r_gmm");
const btnSalvarRice = document.getElementById("btnSalvarRice");
const msgRice = document.getElementById("msgRice");
const listaRice = document.getElementById("listaRice");

if (r_data && !r_data.value) r_data.value = todayISO();

function calcRice(){
  const A = nOrNull(r_A?.value);
  const B = nOrNull(r_B?.value);
  const C = nOrNull(r_C?.value);
  if (!A || !B || !C || (A + B - C) <= 0){
    if (r_gmm) r_gmm.textContent = "—";
    return null;
  }
  const gmm = A / (A + B - C);
  if (r_gmm) r_gmm.textContent = gmm.toFixed(4);
  return gmm;
}
[r_A,r_B,r_C].forEach(i=> i && i.addEventListener("input", calcRice));

async function saveRice(){
  if (!ACTIVE_PROJECT_ID){
    showMsg(msgRice, "Sem projeto ativo. Vá em Projetos e clique Ativar.", false);
    return;
  }
  const gmm = calcRice();
  if (!gmm){
    showMsg(msgRice, "Preencha A, B e C corretamente.", false);
    return;
  }
  try{
    const col = collection(db, `projects/${ACTIVE_PROJECT_ID}/ensaios_rice`);
    await addDoc(col, {
      projectId: ACTIVE_PROJECT_ID,
      projectName: ACTIVE_PROJECT?.nome || null,
      data: r_data?.value || todayISO(),
      tecnico: (r_tecnico?.value || "").trim() || null,
      lote: (r_lote?.value || "").trim() || null,
      A: nOrNull(r_A?.value),
      B: nOrNull(r_B?.value),
      C: nOrNull(r_C?.value),
      gmm: Number(gmm.toFixed(5)),
      createdAt: serverTimestamp(),
      createdAtClient: Date.now()
    });
    showMsg(msgRice, "Rice salvo!", true);
  }catch(e){
    console.error(e);
    showMsg(msgRice, "Erro ao salvar (ver Console).", false);
  }
}
if (btnSalvarRice) btnSalvarRice.addEventListener("click", saveRice);

/* ===================== Marshall ===================== */
const m_data = document.getElementById("m_data");
const m_tecnico = document.getElementById("m_tecnico");
const m_lote = document.getElementById("m_lote");
const m_gmm_manual = document.getElementById("m_gmm_manual");
const m_A = document.getElementById("m_A");
const m_B = document.getElementById("m_B");
const m_C = document.getElementById("m_C");
const m_estab = document.getElementById("m_estab");
const m_flow = document.getElementById("m_flow");
const m_h = document.getElementById("m_h");

const m_gmb = document.getElementById("m_gmb");
const m_gmm = document.getElementById("m_gmm");
const m_vv = document.getElementById("m_vv");
const m_vam = document.getElementById("m_vam");
const m_rbv = document.getElementById("m_rbv");
const m_status = document.getElementById("m_status");
const m_status_det = document.getElementById("m_status_det");
const btnSalvarMarshall = document.getElementById("btnSalvarMarshall");
const msgMarshall = document.getElementById("msgMarshall");
const listaMarshall = document.getElementById("listaMarshall");

if (m_data && !m_data.value) m_data.value = todayISO();

/* cache do último Gmm por lote (para usar no Marshall) */
let lastRiceByLote = new Map();

function calcMarshall(){
  const A = nOrNull(m_A?.value);
  const B = nOrNull(m_B?.value);
  const C = nOrNull(m_C?.value);
  let gmbCalc = null;
  if (A && B && C && (B-C) > 0){
    gmbCalc = A/(B-C);
    if (m_gmb) m_gmb.textContent = gmbCalc.toFixed(4);
  } else {
    if (m_gmb) m_gmb.textContent = "—";
  }

  // Gmm: tenta do Rice por lote; senão manual
  const lote = (m_lote?.value || "").trim();
  let gmmUse = null;
  if (lote && lastRiceByLote.has(lote)) gmmUse = lastRiceByLote.get(lote);
  const gmmManual = nOrNull(m_gmm_manual?.value);
  if (gmmUse === null && gmmManual) gmmUse = gmmManual;

  if (m_gmm) m_gmm.textContent = gmmUse ? gmmUse.toFixed(4) : "—";

  // volumétricos simplificados
  // Vv = 100*(1 - Gmb/Gmm)
  let vv = null;
  if (gmbCalc && gmmUse && gmmUse>0){
    vv = 100*(1 - (gmbCalc/gmmUse));
    if (m_vv) m_vv.textContent = vv.toFixed(2);
  } else {
    if (m_vv) m_vv.textContent = "—";
  }

  // VAM e RBV dependem de Gsb/Ps, aqui deixamos aproximado:
  // Para manter “app completo” sem exigir Gsb, vamos calcular VAM/RBV como campos opcionais no futuro.
  // Mas ainda assim, para não ficar vazio, vamos permitir digitar manual no projeto? (não agora)
  // Aqui usamos placeholders: se vv existe, setamos VAM/RBV como "—" e status baseado em vv/estab/flow.
  if (m_vam) m_vam.textContent = "—";
  if (m_rbv) m_rbv.textContent = "—";

  // status (usando limites do projeto onde existirem)
  const lim = ACTIVE_PROJECT?.limits || {};
  const estab = nOrNull(m_estab?.value);
  const flow = nOrNull(m_flow?.value);

  let ok = true;
  let det = [];

  if (lim.vvMin !== null && vv !== null && vv < lim.vvMin){ ok=false; det.push("Vv<min"); }
  if (lim.vvMax !== null && vv !== null && vv > lim.vvMax){ ok=false; det.push("Vv>max"); }

  if (lim.estabMin !== null && estab !== null && estab < lim.estabMin){ ok=false; det.push("Estab<min"); }
  if (lim.flowMin !== null && flow !== null && flow < lim.flowMin){ ok=false; det.push("Flow<min"); }
  if (lim.flowMax !== null && flow !== null && flow > lim.flowMax){ ok=false; det.push("Flow>max"); }

  if (!ACTIVE_PROJECT_ID){
    setBadge(m_status, "SEM PROJETO", "warn");
    if (m_status_det) m_status_det.textContent = "Ative um projeto.";
  } else {
    setBadge(m_status, ok ? "CONFORME" : "NÃO CONFORME", ok ? "ok" : "bad");
    if (m_status_det) m_status_det.textContent = det.length ? det.join(" / ") : "OK";
  }

  return { gmbCalc, gmmUse, vv, estab, flow, ok };
}

[m_A,m_B,m_C,m_estab,m_flow,m_lote,m_gmm_manual].forEach(i=> i && i.addEventListener("input", calcMarshall));

async function saveMarshall(){
  if (!ACTIVE_PROJECT_ID){
    showMsg(msgMarshall, "Sem projeto ativo. Vá em Projetos e clique Ativar.", false);
    return;
  }
  const lote = (m_lote?.value || "").trim();
  const c = calcMarshall();
  if (!c.gmbCalc){
    showMsg(msgMarshall, "Preencha A, B e C (Gmb).", false);
    return;
  }
  if (!c.gmmUse){
    showMsg(msgMarshall, "Sem Gmm. Faça Rice para este lote ou digite Gmm manual.", false);
    return;
  }

  try{
    const col = collection(db, `projects/${ACTIVE_PROJECT_ID}/ensaios_marshall`);
    await addDoc(col, {
      projectId: ACTIVE_PROJECT_ID,
      projectName: ACTIVE_PROJECT?.nome || null,
      data: m_data?.value || todayISO(),
      tecnico: (m_tecnico?.value || "").trim() || null,
      lote: lote || null,

      A: nOrNull(m_A?.value), B: nOrNull(m_B?.value), C: nOrNull(m_C?.value),
      gmb: Number(c.gmbCalc.toFixed(5)),
      gmm: Number(c.gmmUse.toFixed(5)),
      vv: c.vv !== null ? Number(c.vv.toFixed(3)) : null,

      estab: c.estab,
      flow: c.flow,
      h: nOrNull(m_h?.value),

      status: c.ok ? "CONFORME" : "NAO_CONFORME",
      createdAt: serverTimestamp(),
      createdAtClient: Date.now()
    });

    showMsg(msgMarshall, "Marshall salvo!", true);
  }catch(e){
    console.error(e);
    showMsg(msgMarshall, "Erro ao salvar (ver Console).", false);
  }
}

if (btnSalvarMarshall) btnSalvarMarshall.addEventListener("click", saveMarshall);

/* ===================== RT ===================== */
const t_data = document.getElementById("t_data");
const t_tecnico = document.getElementById("t_tecnico");
const t_lote = document.getElementById("t_lote");
const t_F = document.getElementById("t_F");
const t_D = document.getElementById("t_D");
const t_H = document.getElementById("t_H");
const t_rt = document.getElementById("t_rt");
const t_status = document.getElementById("t_status");
const t_status_det = document.getElementById("t_status_det");
const btnSalvarRT = document.getElementById("btnSalvarRT");
const msgRT = document.getElementById("msgRT");
const listaRT = document.getElementById("listaRT");

if (t_data && !t_data.value) t_data.value = todayISO();

function calcRT(){
  const F = nOrNull(t_F?.value);
  const D = nOrNull(t_D?.value);
  const H = nOrNull(t_H?.value);
  if (!F || !D || !H || D<=0 || H<=0){
    if (t_rt) t_rt.textContent = "—";
    return null;
  }
  const rt = (2*F)/(Math.PI*D*H) * 0.0981;
  if (t_rt) t_rt.textContent = rt.toFixed(3);

  const lim = ACTIVE_PROJECT?.limits?.rtMin ?? null;
  if (!ACTIVE_PROJECT_ID){
    setBadge(t_status, "SEM PROJETO", "warn");
    if (t_status_det) t_status_det.textContent = "Ative um projeto.";
  } else if (lim !== null){
    const ok = rt >= lim;
    setBadge(t_status, ok ? "CONFORME" : "NÃO CONFORME", ok ? "ok" : "bad");
    if (t_status_det) t_status_det.textContent = `Limite: ≥ ${lim}`;
  } else {
    setBadge(t_status, "SEM LIMITE", "warn");
    if (t_status_det) t_status_det.textContent = "Defina RT mín no projeto.";
  }

  return rt;
}
[t_F,t_D,t_H].forEach(i=> i && i.addEventListener("input", calcRT));

async function saveRT(){
  if (!ACTIVE_PROJECT_ID){
    showMsg(msgRT, "Sem projeto ativo. Vá em Projetos e clique Ativar.", false);
    return;
  }
  const rt = calcRT();
  if (rt === null){
    showMsg(msgRT, "Preencha F, D e H corretamente.", false);
    return;
  }
  const lim = ACTIVE_PROJECT?.limits?.rtMin ?? null;
  const ok = (lim === null) ? true : (rt >= lim);

  try{
    const col = collection(db, `projects/${ACTIVE_PROJECT_ID}/ensaios_rt`);
    await addDoc(col, {
      projectId: ACTIVE_PROJECT_ID,
      projectName: ACTIVE_PROJECT?.nome || null,
      data: t_data?.value || todayISO(),
      tecnico: (t_tecnico?.value || "").trim() || null,
      lote: (t_lote?.value || "").trim() || null,
      F: nOrNull(t_F?.value), D: nOrNull(t_D?.value), H: nOrNull(t_H?.value),
      rt: Number(rt.toFixed(5)),
      status: ok ? "CONFORME" : "NAO_CONFORME",
      createdAt: serverTimestamp(),
      createdAtClient: Date.now()
    });
    showMsg(msgRT, "RT salvo!", true);
  }catch(e){
    console.error(e);
    showMsg(msgRT, "Erro ao salvar (ver Console).", false);
  }
}
if (btnSalvarRT) btnSalvarRT.addEventListener("click", saveRT);

/* ===================== Equiv. Areia ===================== */
const s_data = document.getElementById("s_data");
const s_tecnico = document.getElementById("s_tecnico");
const s_lote = document.getElementById("s_lote");
const s_H1 = document.getElementById("s_H1");
const s_H2 = document.getElementById("s_H2");
const s_se = document.getElementById("s_se");
const s_status = document.getElementById("s_status");
const s_status_det = document.getElementById("s_status_det");
const btnSalvarSE = document.getElementById("btnSalvarSE");
const msgSE = document.getElementById("msgSE");
const listaSE = document.getElementById("listaSE");

if (s_data && !s_data.value) s_data.value = todayISO();

function calcSE(){
  const H1 = nOrNull(s_H1?.value);
  const H2 = nOrNull(s_H2?.value);
  if (!H1 || !H2 || H1<=0){
    if (s_se) s_se.textContent = "—";
    return null;
  }
  const se = (H2/H1)*100;
  if (s_se) s_se.textContent = se.toFixed(1);

  const lim = ACTIVE_PROJECT?.limits?.seMin ?? null;
  if (!ACTIVE_PROJECT_ID){
    setBadge(s_status, "SEM PROJETO", "warn");
    if (s_status_det) s_status_det.textContent = "Ative um projeto.";
  } else if (lim !== null){
    const ok = se >= lim;
    setBadge(s_status, ok ? "CONFORME" : "NÃO CONFORME", ok ? "ok" : "bad");
    if (s_status_det) s_status_det.textContent = `Limite: ≥ ${lim}%`;
  } else {
    setBadge(s_status, "SEM LIMITE", "warn");
    if (s_status_det) s_status_det.textContent = "Defina SE mín no projeto.";
  }

  return se;
}
[s_H1,s_H2].forEach(i=> i && i.addEventListener("input", calcSE));

async function saveSE(){
  if (!ACTIVE_PROJECT_ID){
    showMsg(msgSE, "Sem projeto ativo. Vá em Projetos e clique Ativar.", false);
    return;
  }
  const se = calcSE();
  if (se === null){
    showMsg(msgSE, "Preencha H1 e H2 corretamente.", false);
    return;
  }
  const lim = ACTIVE_PROJECT?.limits?.seMin ?? null;
  const ok = (lim === null) ? true : (se >= lim);

  try{
    const col = collection(db, `projects/${ACTIVE_PROJECT_ID}/ensaios_se`);
    await addDoc(col, {
      projectId: ACTIVE_PROJECT_ID,
      projectName: ACTIVE_PROJECT?.nome || null,
      data: s_data?.value || todayISO(),
      tecnico: (s_tecnico?.value || "").trim() || null,
      lote: (s_lote?.value || "").trim() || null,
      H1: nOrNull(s_H1?.value), H2: nOrNull(s_H2?.value),
      se: Number(se.toFixed(4)),
      status: ok ? "CONFORME" : "NAO_CONFORME",
      createdAt: serverTimestamp(),
      createdAtClient: Date.now()
    });
    showMsg(msgSE, "SE salvo!", true);
  }catch(e){
    console.error(e);
    showMsg(msgSE, "Erro ao salvar (ver Console).", false);
  }
}
if (btnSalvarSE) btnSalvarSE.addEventListener("click", saveSE);

/* ===================== LISTAS (sem índices: subcoleções + createdAtClient) ===================== */
let unsub = { extr:null, rice:null, mar:null, rt:null, se:null };

function stopAllLists(){
  Object.keys(unsub).forEach(k=>{ if (unsub[k]) {unsub[k](); unsub[k]=null;} });
}

function updateKPIsEmpty(){
  if (kpiEnsaios) kpiEnsaios.textContent = "—";
  if (kpiConformes) kpiConformes.textContent = "—";
}

function startAllLists(){
  stopAllLists();
  if (!ACTIVE_PROJECT_ID){
    if (listaEnsaios) listaEnsaios.innerHTML = `<div class="muted">Sem projeto ativo.</div>`;
    if (listaRice) listaRice.innerHTML = `<div class="muted">Sem projeto ativo.</div>`;
    if (listaMarshall) listaMarshall.innerHTML = `<div class="muted">Sem projeto ativo.</div>`;
    if (listaRT) listaRT.innerHTML = `<div class="muted">Sem projeto ativo.</div>`;
    if (listaSE) listaSE.innerHTML = `<div class="muted">Sem projeto ativo.</div>`;
    updateKPIsEmpty();
    return;
  }

  // EXTRAÇÃO+GRANU
  const colExtr = collection(db, `projects/${ACTIVE_PROJECT_ID}/ensaios_extr_gran`);
  const qExtr = query(colExtr, orderBy("createdAtClient","desc"), limit(25));
  unsub.extr = onSnapshot(qExtr, (snap)=>{
    if (!listaEnsaios) return;
    if (snap.empty){
      listaEnsaios.innerHTML = `<div class="muted">Nenhum ensaio salvo.</div>`;
      if (kpiEnsaios) kpiEnsaios.textContent = "0";
      if (kpiConformes) kpiConformes.textContent = "—";
      return;
    }
    listaEnsaios.innerHTML = "";
    let total=0, conf=0;
    snap.forEach(d=>{
      const a = d.data();
      total++;
      if (a.status === "CONFORME") conf++;
      const el = document.createElement("div");
      el.className = "item";
      el.innerHTML = `
        <div>
          <b>${escapeHtml(a.data || "")} • ${escapeHtml(a.lote || "—")}</b>
          <div class="meta">Téc.: ${escapeHtml(a.tecnico || "—")} • Pb: ${a.pb ?? "—"}% (Lim: ${a.pbMin ?? "—"}–${a.pbMax ?? "—"}) • Status: ${escapeHtml(a.status || "—")}</div>
          <div class="meta">Mmist: ${a.mmix ?? "—"}g • Magg: ${a.totalAgg ?? "—"}g</div>
        </div>
      `;
      listaEnsaios.appendChild(el);
    });
    if (kpiEnsaios) kpiEnsaios.textContent = String(total);
    if (kpiConformes) kpiConformes.textContent = total ? `${Math.round((conf/total)*100)}%` : "—";
  });

  // RICE
  const colRice = collection(db, `projects/${ACTIVE_PROJECT_ID}/ensaios_rice`);
  const qRice = query(colRice, orderBy("createdAtClient","desc"), limit(25));
  unsub.rice = onSnapshot(qRice, (snap)=>{
    if (!listaRice) return;
    listaRice.innerHTML = snap.empty ? `<div class="muted">Nenhum Rice salvo.</div>` : "";
    // atualizar cache por lote
    lastRiceByLote = new Map();
    snap.forEach(d=>{
      const a = d.data();
      if (a.lote && a.gmm) lastRiceByLote.set(a.lote, a.gmm);
      const el = document.createElement("div");
      el.className = "item";
      el.innerHTML = `
        <div>
          <b>${escapeHtml(a.data || "")} • ${escapeHtml(a.lote || "—")}</b>
          <div class="meta">Téc.: ${escapeHtml(a.tecnico || "—")} • Gmm: ${a.gmm ?? "—"}</div>
        </div>
      `;
      listaRice.appendChild(el);
    });
    // recalcular marshall se estiver na tela
    calcMarshall();
  });

  // MARSHALL
  const colMar = collection(db, `projects/${ACTIVE_PROJECT_ID}/ensaios_marshall`);
  const qMar = query(colMar, orderBy("createdAtClient","desc"), limit(25));
  unsub.mar = onSnapshot(qMar, (snap)=>{
    if (!listaMarshall) return;
    listaMarshall.innerHTML = snap.empty ? `<div class="muted">Nenhum Marshall salvo.</div>` : "";
    snap.forEach(d=>{
      const a = d.data();
      const el = document.createElement("div");
      el.className = "item";
      el.innerHTML = `
        <div>
          <b>${escapeHtml(a.data || "")} • ${escapeHtml(a.lote || "—")}</b>
          <div class="meta">Gmb: ${a.gmb ?? "—"} • Gmm: ${a.gmm ?? "—"} • Vv: ${a.vv ?? "—"} • Estab: ${a.estab ?? "—"} • Flow: ${a.flow ?? "—"} • Status: ${escapeHtml(a.status || "—")}</div>
        </div>
      `;
      listaMarshall.appendChild(el);
    });
  });

  // RT
  const colRT = collection(db, `projects/${ACTIVE_PROJECT_ID}/ensaios_rt`);
  const qRT = query(colRT, orderBy("createdAtClient","desc"), limit(25));
  unsub.rt = onSnapshot(qRT, (snap)=>{
    if (!listaRT) return;
    listaRT.innerHTML = snap.empty ? `<div class="muted">Nenhum RT salvo.</div>` : "";
    snap.forEach(d=>{
      const a = d.data();
      const el = document.createElement("div");
      el.className = "item";
      el.innerHTML = `
        <div>
          <b>${escapeHtml(a.data || "")} • ${escapeHtml(a.lote || "—")}</b>
          <div class="meta">RT: ${a.rt ?? "—"} MPa • Status: ${escapeHtml(a.status || "—")}</div>
        </div>
      `;
      listaRT.appendChild(el);
    });
  });

  // SE
  const colSE = collection(db, `projects/${ACTIVE_PROJECT_ID}/ensaios_se`);
  const qSE = query(colSE, orderBy("createdAtClient","desc"), limit(25));
  unsub.se = onSnapshot(qSE, (snap)=>{
    if (!listaSE) return;
    listaSE.innerHTML = snap.empty ? `<div class="muted">Nenhum SE salvo.</div>` : "";
    snap.forEach(d=>{
      const a = d.data();
      const el = document.createElement("div");
      el.className = "item";
      el.innerHTML = `
        <div>
          <b>${escapeHtml(a.data || "")} • ${escapeHtml(a.lote || "—")}</b>
          <div class="meta">SE: ${a.se ?? "—"}% • Status: ${escapeHtml(a.status || "—")}</div>
        </div>
      `;
      listaSE.appendChild(el);
    });
  });
}

/* ===================== Controle Estatístico ===================== */
const c_ini = document.getElementById("c_ini");
const c_fim = document.getElementById("c_fim");
const c_total = document.getElementById("c_total");
const c_conf = document.getElementById("c_conf");
const btnGerarCtrl = document.getElementById("btnGerarCtrl");
const msgCtrl = document.getElementById("msgCtrl");
const ctrlBody = document.getElementById("ctrlBody");
const ctrlStats = document.getElementById("ctrlStats");

if (c_ini && !c_ini.value) c_ini.value = todayISO();
if (c_fim && !c_fim.value) c_fim.value = todayISO();

async function gerarControle(){
  if (!ACTIVE_PROJECT_ID){
    showMsg(msgCtrl, "Sem projeto ativo. Ative um projeto.", false);
    return;
  }
  const ini = c_ini?.value || todayISO();
  const fim = c_fim?.value || todayISO();

  // pega bastante coisa e filtra no navegador
  const colExtr = collection(db, `projects/${ACTIVE_PROJECT_ID}/ensaios_extr_gran`);
  const colMar = collection(db, `projects/${ACTIVE_PROJECT_ID}/ensaios_marshall`);
  const colRice = collection(db, `projects/${ACTIVE_PROJECT_ID}/ensaios_rice`);
  const colRT = collection(db, `projects/${ACTIVE_PROJECT_ID}/ensaios_rt`);

  const rows = [];

  // helpers para “mapear por data+lote”
  const key = (d,l)=> `${d||""}__${l||""}`;

  const map = new Map();

  function upsert(k, obj){
    const cur = map.get(k) || {};
    map.set(k, { ...cur, ...obj });
  }

  // extr
  await new Promise((resolve)=>{
    const q1 = query(colExtr, orderBy("createdAtClient","desc"), limit(500));
    const unsubOnce = onSnapshot(q1, (snap)=>{
      snap.forEach(d=>{
        const a = d.data();
        if (a.data >= ini && a.data <= fim){
          upsert(key(a.data,a.lote), { data:a.data, lote:a.lote, pb:a.pb, status:a.status });
        }
      });
      unsubOnce();
      resolve();
    });
  });

  // rice
  await new Promise((resolve)=>{
    const q1 = query(colRice, orderBy("createdAtClient","desc"), limit(500));
    const unsubOnce = onSnapshot(q1, (snap)=>{
      snap.forEach(d=>{
        const a = d.data();
        if (a.data >= ini && a.data <= fim){
          upsert(key(a.data,a.lote), { gmm:a.gmm });
        }
      });
      unsubOnce();
      resolve();
    });
  });

  // marshall
  await new Promise((resolve)=>{
    const q1 = query(colMar, orderBy("createdAtClient","desc"), limit(500));
    const unsubOnce = onSnapshot(q1, (snap)=>{
      snap.forEach(d=>{
        const a = d.data();
        if (a.data >= ini && a.data <= fim){
          upsert(key(a.data,a.lote), { gmb:a.gmb, vv:a.vv, vam:a.vam, rbv:a.rbv, estab:a.estab, flow:a.flow, statusM:a.status });
        }
      });
      unsubOnce();
      resolve();
    });
  });

  // rt
  await new Promise((resolve)=>{
    const q1 = query(colRT, orderBy("createdAtClient","desc"), limit(500));
    const unsubOnce = onSnapshot(q1, (snap)=>{
      snap.forEach(d=>{
        const a = d.data();
        if (a.data >= ini && a.data <= fim){
          upsert(key(a.data,a.lote), { rt:a.rt, statusT:a.status });
        }
      });
      unsubOnce();
      resolve();
    });
  });

  // transforma em lista
  map.forEach(v=> rows.push(v));
  rows.sort((a,b)=> (b.data||"").localeCompare(a.data||"") );

  if (ctrlBody) ctrlBody.innerHTML = "";
  let total = 0, conf = 0;
  const pbArr=[], gmmArr=[], gmbArr=[], vvArr=[];

  rows.forEach(r=>{
    total++;
    const st = r.status || r.statusM || r.statusT || "—";
    if (st === "CONFORME") conf++;

    if (typeof r.pb === "number") pbArr.push(r.pb);
    if (typeof r.gmm === "number") gmmArr.push(r.gmm);
    if (typeof r.gmb === "number") gmbArr.push(r.gmb);
    if (typeof r.vv === "number") vvArr.push(r.vv);

    if (ctrlBody){
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${escapeHtml(r.data||"")}</td>
        <td>${escapeHtml(r.lote||"")}</td>
        <td>${r.pb ?? "—"}</td>
        <td>${r.gmm ?? "—"}</td>
        <td>${r.gmb ?? "—"}</td>
        <td>${r.vv ?? "—"}</td>
        <td>${r.vam ?? "—"}</td>
        <td>${r.rbv ?? "—"}</td>
        <td>${r.estab ?? "—"}</td>
        <td>${r.flow ?? "—"}</td>
        <td>${r.rt ?? "—"}</td>
        <td>${escapeHtml(st)}</td>
      `;
      ctrlBody.appendChild(tr);
    }
  });

  if (c_total) c_total.textContent = String(total);
  if (c_conf) c_conf.textContent = total ? `${Math.round((conf/total)*100)}%` : "—";

  // estatística básica
  const n = pbArr.length;
  const m = mean(pbArr);
  const s = sdSample(pbArr);
  const k = kFactor(n);
  let statTxt = `Pb: N=${n}`;
  if (m !== null && s !== null && k !== null){
    statTxt += ` • Média=${m.toFixed(3)} • Sd=${s.toFixed(3)} • k=${k.toFixed(2)} • Limites estatísticos: ${ (m-k*s).toFixed(3) } a ${ (m+k*s).toFixed(3) }`;
  }
  if (ctrlStats) ctrlStats.textContent = statTxt;

  showMsg(msgCtrl, "Resumo gerado.", true);
}

if (btnGerarCtrl) btnGerarCtrl.addEventListener("click", gerarControle);

/* ===================== Relatórios (Impressão/PDF) ===================== */
const rel_ini = document.getElementById("rel_ini");
const rel_fim = document.getElementById("rel_fim");
const rel_total = document.getElementById("rel_total");
const rel_conf = document.getElementById("rel_conf");
const btnRelatorio = document.getElementById("btnRelatorio");
const msgRelatorio = document.getElementById("msgRelatorio");

if (rel_ini && !rel_ini.value) rel_ini.value = todayISO();
if (rel_fim && !rel_fim.value) rel_fim.value = todayISO();

async function gerarRelatorio(){
  if (!ACTIVE_PROJECT_ID){
    showMsg(msgRelatorio, "Sem projeto ativo. Ative um projeto.", false);
    return;
  }

  const ini = rel_ini?.value || todayISO();
  const fim = rel_fim?.value || todayISO();

  const colExtr = collection(db, `projects/${ACTIVE_PROJECT_ID}/ensaios_extr_gran`);
  const colRice = collection(db, `projects/${ACTIVE_PROJECT_ID}/ensaios_rice`);
  const colMar = collection(db, `projects/${ACTIVE_PROJECT_ID}/ensaios_marshall`);
  const colRT = collection(db, `projects/${ACTIVE_PROJECT_ID}/ensaios_rt`);
  const colSE = collection(db, `projects/${ACTIVE_PROJECT_ID}/ensaios_se`);

  const fetchList = (col) => new Promise((resolve)=>{
    const q1 = query(col, orderBy("createdAtClient","desc"), limit(500));
    const unsubOnce = onSnapshot(q1, (snap)=>{
      const rows = [];
      snap.forEach(d=>{
        const a = d.data();
        if (a.data >= ini && a.data <= fim) rows.push(a);
      });
      unsubOnce();
      resolve(rows);
    });
  });

  const extr = await fetchList(colExtr);
  const rice = await fetchList(colRice);
  const mar = await fetchList(colMar);
  const rt = await fetchList(colRT);
  const se = await fetchList(colSE);

  const total = extr.length + rice.length + mar.length + rt.length + se.length;
  const conf = [...extr,...mar,...rt,...se].filter(r=>r.status==="CONFORME").length;

  if (rel_total) rel_total.textContent = String(total);
  if (rel_conf) rel_conf.textContent = total ? `${Math.round((conf/total)*100)}%` : "—";

  // monta HTML simples (impressão)
  const w = window.open("", "_blank");
  const title = `Relatório SGLAA - ${escapeHtml(ACTIVE_PROJECT?.nome || "")}`;

  const table = (title, rows, cols) => {
    const thead = cols.map(c=>`<th>${c.h}</th>`).join("");
    const tbody = rows.length ? rows.map(r=>{
      return `<tr>` + cols.map(c=>`<td>${c.f(r)}</td>`).join("") + `</tr>`;
    }).join("") : `<tr><td colspan="${cols.length}">Sem dados</td></tr>`;
    return `
      <h3>${title}</h3>
      <table>
        <thead><tr>${thead}</tr></thead>
        <tbody>${tbody}</tbody>
      </table>
    `;
  };

  w.document.write(`
    <html>
    <head>
      <title>${title}</title>
      <meta charset="utf-8" />
      <style>
        body{font-family:Arial; padding:18px}
        h1{font-size:18px;margin:0}
        .sub{color:#444;margin:6px 0 14px}
        h3{margin:16px 0 8px}
        table{width:100%;border-collapse:collapse;font-size:12px;margin-bottom:14px}
        th,td{border:1px solid #ccc;padding:6px}
        th{background:#eee;text-align:left}
        .kpi{display:flex;gap:10px;margin:10px 0 12px}
        .k{border:1px solid #ccc;padding:8px;border-radius:8px}
        .k b{display:block}
      </style>
    </head>
    <body>
      <h1>Relatório – Laboratório de Asfalto</h1>
      <div class="sub">
        Projeto: <b>${escapeHtml(ACTIVE_PROJECT?.nome || "")}</b> • Período: <b>${ini}</b> a <b>${fim}</b>
      </div>

      <div class="kpi">
        <div class="k"><b>Total itens</b>${total}</div>
        <div class="k"><b>Conformes</b>${conf}</div>
        <div class="k"><b>% Conformidade</b>${total ? Math.round((conf/total)*100) : 0}%</div>
      </div>

      ${table("Extração + Granulometria", extr, [
        {h:"Data", f:r=>escapeHtml(r.data||"")},
        {h:"Lote", f:r=>escapeHtml(r.lote||"—")},
        {h:"Técnico", f:r=>escapeHtml(r.tecnico||"—")},
        {h:"Pb (%)", f:r=>r.pb ?? "—"},
        {h:"Lim Pb", f:r=> (r.pbMin!=null && r.pbMax!=null) ? `${r.pbMin}–${r.pbMax}` : "—"},
        {h:"Status", f:r=>escapeHtml(r.status||"—")}
      ])}

      ${table("Rice (Gmm)", rice, [
        {h:"Data", f:r=>escapeHtml(r.data||"")},
        {h:"Lote", f:r=>escapeHtml(r.lote||"—")},
        {h:"Gmm", f:r=>r.gmm ?? "—"}
      ])}

      ${table("Marshall", mar, [
        {h:"Data", f:r=>escapeHtml(r.data||"")},
        {h:"Lote", f:r=>escapeHtml(r.lote||"—")},
        {h:"Gmb", f:r=>r.gmb ?? "—"},
        {h:"Gmm", f:r=>r.gmm ?? "—"},
        {h:"Vv", f:r=>r.vv ?? "—"},
        {h:"Estab", f:r=>r.estab ?? "—"},
        {h:"Flow", f:r=>r.flow ?? "—"},
        {h:"Status", f:r=>escapeHtml(r.status||"—")}
      ])}

      ${table("RT", rt, [
        {h:"Data", f:r=>escapeHtml(r.data||"")},
        {h:"Lote", f:r=>escapeHtml(r.lote||"—")},
        {h:"RT (MPa)", f:r=>r.rt ?? "—"},
        {h:"Status", f:r=>escapeHtml(r.status||"—")}
      ])}

      ${table("Equivalente de Areia", se, [
        {h:"Data", f:r=>escapeHtml(r.data||"")},
        {h:"Lote", f:r=>escapeHtml(r.lote||"—")},
        {h:"SE (%)", f:r=>r.se ?? "—"},
        {h:"Status", f:r=>escapeHtml(r.status||"—")}
      ])}

      <script>window.onload=()=>window.print()</script>
    </body>
    </html>
  `);
  w.document.close();

  showMsg(msgRelatorio, "Relatório gerado (abrindo impressão).", true);
}

if (btnRelatorio) btnRelatorio.addEventListener("click", gerarRelatorio);

/* ===================== init ===================== */
setConn("Online (Firestore)", true);
setActiveText("Projeto ativo: (carregando)");

calcExtrGranu();
calcRice();
calcMarshall();
calcRT();
calcSE();

function updateKPIsEmpty(){
  if (kpiEnsaios) kpiEnsaios.textContent = "—";
  if (kpiConformes) kpiConformes.textContent = "—";
}

/* start lists depending active project */
function stopAllLists(){ /* handled by startAllLists/stop in refresh */ }
function startAllLists(){
  // lists start inside refreshActiveProject() which calls startAllLists()
  // but we need initial attempt:
}
updateKPIsEmpty();

/* initial load */
getDoc(activeRef).then(s=>{
  ACTIVE_PROJECT_ID = s.exists() ? (s.data().projectId || null) : null;
  refreshActiveProject();
}).catch(()=>{});
``
