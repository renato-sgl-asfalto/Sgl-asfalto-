import { initializeApp } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-app.js";
import {
  getFirestore, collection, addDoc, deleteDoc, doc,
  onSnapshot, query, orderBy, serverTimestamp,
  setDoc, getDoc, limit
} from "https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js";

/* Firebase */
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

/* Helpers */
function nOrZero(v){
  const x = String(v ?? "").replace(",", ".").trim();
  const num = Number(x);
  return Number.isFinite(num) ? num : 0;
}
function nOrNull(v){
  const x = String(v ?? "").replace(",", ".").trim();
  if (!x) return null;
  const num = Number(x);
  return Number.isFinite(num) ? num : null;
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

/* UI */
const connPill = document.getElementById("connPill");
const activeProjPill = document.getElementById("activeProjPill");
const kpiFirebase = document.getElementById("kpiFirebase");
const kpiProjetos = document.getElementById("kpiProjetos");
const kpiEnsaios = document.getElementById("kpiEnsaios");
const kpiConform = document.getElementById("kpiConform");

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

/* Tabs */
const tabs = Array.from(document.querySelectorAll(".tab"));
const views = {
  painel: document.getElementById("view-painel"),
  projetos: document.getElementById("view-projetos"),
  ensaios: document.getElementById("view-ensaios"),
  relatorios: document.getElementById("view-relatorios"),
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

/* Active project */
const activeRef = doc(db, "meta", "active");
let ACTIVE_PROJECT_ID = null;
let ACTIVE_PROJECT = null;

/* Collections */
const projectsCol = collection(db, "projects");

/* Project form refs */
const sieveBody = document.getElementById("sieveBody");
const p_nome = document.getElementById("p_nome");
const p_codigo = document.getElementById("p_codigo");
const p_cliente = document.getElementById("p_cliente");
const p_mistura = document.getElementById("p_mistura");
const p_cap = document.getElementById("p_cap");
const p_pb = document.getElementById("p_pb");
const p_pbtol = document.getElementById("p_pbtol");
const btnSalvarProjeto = document.getElementById("btnSalvarProjeto");
const msgProjeto = document.getElementById("msgProjeto");
const listaProjetos = document.getElementById("listaProjetos");

/* Ensaios refs */
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

/* Relatório refs */
const r_ini = document.getElementById("r_ini");
const r_fim = document.getElementById("r_fim");
const r_total = document.getElementById("r_total");
const r_conf = document.getElementById("r_conf");
const btnGerarRelatorio = document.getElementById("btnGerarRelatorio");
const msgRel = document.getElementById("msgRel");

/* Default dates */
if (e_data && !e_data.value) e_data.value = todayISO();
if (r_ini && !r_ini.value) r_ini.value = todayISO();
if (r_fim && !r_fim.value) r_fim.value = todayISO();

/* Sieve list (padrão) */
const SIEVES = ['3/4"', '1/2"', '3/8"', '1/4"', '#4', '#8', '#16', '#30', '#50', '#100', '#200'];

/* Build sieve rows for project limits */
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
  [p_nome,p_codigo,p_cliente,p_mistura,p_cap,p_pb,p_pbtol].forEach(i=>{ if(i) i.value=""; });
  if (sieveBody) Array.from(sieveBody.querySelectorAll("input")).forEach(i=>i.value="");
}

/* Create / Update active project */
async function setActiveProject(projectId){
  await setDoc(activeRef, { projectId, updatedAt: serverTimestamp() }, { merge: true });
}

/* Load active project data */
async function refreshActiveProject(){
  if (!ACTIVE_PROJECT_ID){
    ACTIVE_PROJECT = null;
    setActiveText("Projeto ativo: (nenhum)");
    rebuildEnsaioSieveTable();
    calcAll();
    watchEnsaiosList(); // will show “sem projeto”
    return;
  }
  const pSnap = await getDoc(doc(db, "projects", ACTIVE_PROJECT_ID));
  ACTIVE_PROJECT = pSnap.exists() ? pSnap.data() : null;
  setActiveText("Projeto ativo: " + (ACTIVE_PROJECT?.nome || "(sem nome)"));
  rebuildEnsaioSieveTable();
  calcAll();
  watchEnsaiosList();
}

/* Listen active project change */
onSnapshot(activeRef, async (snap)=>{
  ACTIVE_PROJECT_ID = snap.exists() ? (snap.data().projectId || null) : null;
  await refreshActiveProject();
}, (err)=>{
  console.error(err);
  setActiveText("Projeto ativo: (erro)");
});

/* PROJECTS list */
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
        <div class="meta">
          Cliente/Obra: ${escapeHtml(p.cliente || "—")} • Mistura: ${escapeHtml(p.mistura || "—")} • CAP: ${escapeHtml(p.cap || "—")}
        </div>
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

/* Save project */
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

/* Project buttons */
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

/* ===== ENSAIO: Extração + Granu ===== */
function pbLimits(){
  const pbRef = Number(ACTIVE_PROJECT?.pbProjeto ?? NaN);
  const tol = Number(ACTIVE_PROJECT?.pbTol ?? 0.3);
  if (Number.isFinite(pbRef)){
    return { min: pbRef - tol, max: pbRef + tol };
  }
  // fallback (não trava o app)
  return { min: 4.5, max: 6.5 };
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

  // listeners
  Array.from(ensSieveBody.querySelectorAll("input.ret")).forEach(inp=>{
    inp.addEventListener("input", calcAll);
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

/* Core calc */
function calcAll(){
  // Pb
  const mmix = nOrNull(e_mmix?.value);
  const kf = nOrZero(e_kf?.value);
  const ret = getRetidos();
  const totalAgg = Object.values(ret).reduce((a,b)=>a + (Number(b)||0), 0);

  const pb = (mmix && mmix > 0) ? (((mmix - totalAgg) / mmix) * 100 + kf) : null;
  if (e_pb) e_pb.textContent = (pb === null || !Number.isFinite(pb)) ? "—" : pb.toFixed(2);

  const limPb = pbLimits();
  if (e_pb_lim) e_pb_lim.textContent = `Limites: ${limPb.min.toFixed(2)} a ${limPb.max.toFixed(2)}`;

  // Granulometria (passante acumulado)
  let cumRet = 0;
  let anyGranuCheck = false;
  let allGranuOk = true;
  let outOfSpec = [];

  SIEVES.forEach(sv=>{
    const key = sv.replace(/[^a-z0-9]/gi,"_");
    const passCell = document.getElementById("pass_" + key);
    const okCell = document.getElementById("ok_" + key);

    cumRet += Number(ret[sv] || 0);
    const pass = (totalAgg > 0) ? (100 - (cumRet/totalAgg)*100) : null;

    if (passCell) passCell.textContent = (pass === null || !Number.isFinite(pass)) ? "—" : pass.toFixed(1);

    const lim = (ACTIVE_PROJECT?.sieveLimits && ACTIVE_PROJECT.sieveLimits[sv]) ? ACTIVE_PROJECT.sieveLimits[sv] : null;
    if (lim && pass !== null && Number.isFinite(pass)){
      anyGranuCheck = true;
      let ok = true;
      if (lim.min !== null && pass < lim.min) ok = false;
      if (lim.max !== null && pass > lim.max) ok = false;
      if (okCell) okCell.textContent = ok ? "OK" : "NC";
      if (!ok){
        allGranuOk = false;
        outOfSpec.push(`${sv}=${pass.toFixed(1)}%`);
      }
    } else {
      if (okCell) okCell.textContent = "—";
    }
  });

  // Status geral
  if (!ACTIVE_PROJECT_ID){
    if (e_status){ e_status.textContent="SEM PROJETO"; e_status.className="badge warn"; }
    if (e_status_det) e_status_det.textContent="Vá em Projetos e clique Ativar.";
    return;
  }

  // Pb ok?
  let pbOk = null;
  if (pb !== null && Number.isFinite(pb)){
    pbOk = (pb >= limPb.min && pb <= limPb.max);
  }

  const granuOk = anyGranuCheck ? allGranuOk : null;

  let okGeral = true;
  let det = [];

  if (pbOk === false){ okGeral = false; det.push("Pb fora"); }
  if (granuOk === false){ okGeral = false; det.push("Granu fora"); }
  if (pbOk === null) det.push("Pb pendente");
  if (granuOk === null) det.push("Sem limites de granu no projeto");

  if (e_status){
    if (okGeral && pbOk !== false && granuOk !== false){
      e_status.textContent="CONFORME";
      e_status.className="badge ok";
    } else {
      e_status.textContent="NÃO CONFORME";
      e_status.className="badge bad";
    }
  }

  if (e_status_det){
    const extra = outOfSpec.length ? (" • Fora: " + outOfSpec.join(", ")) : "";
    e_status_det.textContent = det.join(" / ") + extra;
  }
}

/* listeners extra */
if (e_mmix) e_mmix.addEventListener("input", calcAll);
if (e_kf) e_kf.addEventListener("input", calcAll);

/* Save ensaio */
async function saveEnsaio(){
  if (!ACTIVE_PROJECT_ID){
    showMsg(msgEnsaio, "Sem projeto ativo. Vá em Projetos e clique Ativar.", false);
    return;
  }
  const mmix = nOrNull(e_mmix?.value);
  if (!mmix || mmix <= 0){
    showMsg(msgEnsaio, "Preencha a massa da mistura.", false);
    return;
  }
  const kf = nOrZero(e_kf?.value);
  const ret = getRetidos();
  const totalAgg = Object.values(ret).reduce((a,b)=>a + (Number(b)||0), 0);
  const pb = ((mmix - totalAgg) / mmix) * 100 + kf;

  const limPb = pbLimits();
  const pbOk = (pb >= limPb.min && pb <= limPb.max);

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
  let allOk = true;
  SIEVES.forEach(sv=>{
    const lim = (ACTIVE_PROJECT?.sieveLimits && ACTIVE_PROJECT.sieveLimits[sv]) ? ACTIVE_PROJECT.sieveLimits[sv] : null;
    const pass = passantes[sv];
    if (lim && pass !== null){
      anyCheck = true;
      if (lim.min !== null && pass < lim.min) allOk = false;
      if (lim.max !== null && pass > lim.max) allOk = false;
    }
  });

  const status = (pbOk && (anyCheck ? allOk : true)) ? "CONFORME" : "NAO_CONFORME";

  try{
    // salva em subcoleção do projeto (evita filtros e índices chatos)
    const ensCol = collection(db, `projects/${ACTIVE_PROJECT_ID}/ensaios_extr_gran`);
    await addDoc(ensCol, {
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

if (btnSalvarEnsaio) btnSalvarEnsaio.addEventListener("click", saveEnsaio);

/* Watch list of ensaios */
let unsubEns = null;

function watchEnsaiosList(){
  if (!listaEnsaios) return;

  if (unsubEns) { unsubEns(); unsubEns = null; }

  if (!ACTIVE_PROJECT_ID){
    listaEnsaios.innerHTML = `<div class="muted">Sem projeto ativo.</div>`;
    if (kpiEnsaios) kpiEnsaios.textContent = "—";
    if (kpiConform) kpiConform.textContent = "—";
    return;
  }

  const ensCol = collection(db, `projects/${ACTIVE_PROJECT_ID}/ensaios_extr_gran`);
  const qEns = query(ensCol, orderBy("createdAtClient","desc"), limit(25));

  unsubEns = onSnapshot(qEns, (snap)=>{
    if (snap.empty){
      listaEnsaios.innerHTML = `<div class="muted">Nenhum ensaio salvo ainda.</div>`;
      if (kpiEnsaios) kpiEnsaios.textContent = "0";
      if (kpiConform) kpiConform.textContent = "—";
      return;
    }

    let total = 0;
    let conf = 0;

    listaEnsaios.innerHTML = "";
    snap.forEach(d=>{
      total++;
      const a = d.data();
      if (a.status === "CONFORME") conf++;

      const el = document.createElement("div");
      el.className = "item";
      el.innerHTML = `
        <div>
          <b>${escapeHtml(a.data || "")} • ${escapeHtml(a.lote || "—")}</b>
          <div class="meta">
            Téc.: ${escapeHtml(a.tecnico || "—")} • Pb: ${a.pb ?? "—"}% (Lim: ${a.pbMin ?? "—"}–${a.pbMax ?? "—"}) • Status: ${escapeHtml(a.status || "—")}
          </div>
          <div class="meta">
            Mmist: ${a.mmix ?? "—"}g • Magg: ${a.totalAgg ?? "—"}g
          </div>
        </div>
      `;
      listaEnsaios.appendChild(el);
    });

    if (kpiEnsaios) kpiEnsaios.textContent = String(total);
    if (kpiConform) kpiConform.textContent = total ? `${Math.round((conf/total)*100)}%` : "—";
  }, (err)=>{
    console.error(err);
    listaEnsaios.innerHTML = `<div class="muted">Erro ao carregar ensaios.</div>`;
  });
}

/* RELATÓRIO (imprimir/salvar PDF) */
async function gerarRelatorio(){
  if (!ACTIVE_PROJECT_ID){
    showMsg(msgRel, "Sem projeto ativo. Vá em Projetos e clique Ativar.", false);
    return;
  }

  const ini = r_ini?.value || todayISO();
  const fim = r_fim?.value || todayISO();

  // puxar últimos (sem query por data no Firestore para não exigir índices/complexidade)
  // e filtrar no navegador pelo campo data (YYYY-MM-DD) que salvamos.
  const ensCol = collection(db, `projects/${ACTIVE_PROJECT_ID}/ensaios_extr_gran`);
  const qEns = query(ensCol, orderBy("createdAtClient","desc"), limit(500));

  let rows = [];
  try{
    const unsub = onSnapshot(qEns, (snap)=>{
      rows = [];
      snap.forEach(d=>{
        const a = d.data();
        if (a.data >= ini && a.data <= fim) rows.push(a);
      });

      const total = rows.length;
      const conf = rows.filter(r=>r.status==="CONFORME").length;
      if (r_total) r_total.textContent = String(total);
      if (r_conf) r_conf.textContent = total ? `${Math.round((conf/total)*100)}%` : "—";

      // montar HTML do relatório e imprimir
      const w = window.open("", "_blank");
      const title = `Relatório SGLAA - ${escapeHtml(ACTIVE_PROJECT?.nome || "")}`;

      const bodyRows = rows.map(r=>`
        <tr>
          <td>${escapeHtml(r.data || "")}</td>
          <td>${escapeHtml(r.lote || "—")}</td>
          <td>${escapeHtml(r.tecnico || "—")}</td>
          <td style="text-align:right">${r.pb ?? "—"}</td>
          <td style="text-align:right">${r.pbMin ?? "—"}–${r.pbMax ?? "—"}</td>
          <td>${escapeHtml(r.status || "—")}</td>
        </tr>
      `).join("");

      w.document.write(`
        <html>
        <head>
          <title>${title}</title>
          <meta charset="utf-8" />
          <style>
            body{font-family:Arial; padding:18px}
            h1{font-size:18px;margin:0}
            .sub{color:#444;margin:6px 0 14px}
            table{width:100%;border-collapse:collapse;font-size:12px}
            th,td{border:1px solid #ccc;padding:6px}
            th{background:#eee;text-align:left}
            .kpi{display:flex;gap:10px;margin:10px 0 12px}
            .k{border:1px solid #ccc;padding:8px;border-radius:8px}
            .k b{display:block}
          </style>
        </head>
        <body>
          <h1>Relatório – Extração + Granulometria</h1>
          <div class="sub">
            Projeto: <b>${escapeHtml(ACTIVE_PROJECT?.nome || "")}</b> • Período: <b>${ini}</b> a <b>${fim}</b>
          </div>

          <div class="kpi">
            <div class="k"><b>Total</b>${total}</div>
            <div class="k"><b>Conformes</b>${conf}</div>
            <div class="k"><b>% Conformidade</b>${total ? Math.round((conf/total)*100) : 0}%</div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Lote</th>
                <th>Técnico</th>
                <th>Pb (%)</th>
                <th>Limites Pb</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${bodyRows || `<tr><td colspan="6">Sem dados no período.</td></tr>`}
            </tbody>
          </table>

          <script>
            window.onload = () => window.print();
          </script>
        </body>
        </html>
      `);
      w.document.close();

      // parar listener (usamos só uma vez)
      unsub();
    });
  }catch(e){
    console.error(e);
    showMsg(msgRel, "Erro ao gerar relatório (ver Console).", false);
  }
}

if (btnGerarRelatorio) btnGerarRelatorio.addEventListener("click", gerarRelatorio);

/* Init */
setConn("Online (Firestore)", true);
setActiveText("Projeto ativo: (carregando)");
calcAll();
watchEnsaiosList();
