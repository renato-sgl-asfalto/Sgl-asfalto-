import { initializeApp } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-app.js";import { initializeApp } from "https://import {
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
const $ = (s)=>document.querySelector(s);
const $$ = (s)=>Array.from(document.querySelectorAll(s));
function nOrNull(v){ const x=String(v??"").replace(",",".").trim(); if(!x) return null; const n=Number(x); return Number.isFinite(n)?n:null; }
function nOrZero(v){ const x=String(v??"").replace(",",".").trim(); const n=Number(x); return Number.isFinite(n)?n:0; }
function todayISO(){ const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; }
function escapeHtml(s){ return String(s??"").replace(/[&<>"']/g,(c)=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c])); }
function showMsg(el, txt, ok=true){ if(!el) return; el.textContent=txt; el.style.color= ok ? "#39d98a" : "#ff5c5c"; }
function setBadge(el, txt, kind){ if(!el) return; el.textContent=txt; el.className="badge "+(kind||""); }

/* UI */
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
function setActiveText(t){ if(activeProjPill) activeProjPill.textContent=t; }

/* Tabs */
(() => {
  const tabs = $$(".tab");
  const views = { painel: $("#view-painel"), projetos: $("#view-projetos"), ensaios: $("#view-ensaios") };
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

/* Active project */
const activeRef = doc(db, "meta", "active");
let ACTIVE_PROJECT_ID = null;
let ACTIVE_PROJECT = null;

async function setActiveProject(projectId){
  await setDoc(activeRef, { projectId, updatedAt: serverTimestamp() }, { merge: true });
}

/* Projects */
const projectsCol = collection(db, "projects");
const sieveBody = $("#sieveBody");
const p_nome = $("#p_nome");
const p_codigo = $("#p_codigo");
const p_cliente = $("#p_cliente");
const p_mistura = $("#p_mistura");
const p_cap = $("#p_cap");
const p_pb = $("#p_pb");
const p_pbtol = $("#p_pbtol");
const btnSalvarProjeto = $("#btnSalvarProjeto");
const msgProjeto = $("#msgProjeto");
const listaProjetos = $("#listaProjetos");

/* peneiras */
const SIEVES = ['3/4"', '1/2"', '3/8"', '1/4"', '#4', '#8', '#16', '#30', '#50', '#100', '#200'];

function buildProjectSieveRows(){
  if(!sieveBody) return;
  sieveBody.innerHTML="";
  SIEVES.forEach(sv=>{
    const tr=document.createElement("tr");
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
    limits[sv] = limits[sv] || { min:null, max:null };
    limits[sv][k] = nOrNull(inp.value);
  });
  Object.keys(limits).forEach(sv=>{
    const r=limits[sv];
    if(r.min===null && r.max===null) delete limits[sv];
  });
  return limits;
}

function clearProjectForm(){
  [p_nome,p_codigo,p_cliente,p_mistura,p_cap,p_pb,p_pbtol].forEach(i=>{ if(i) i.value=""; });
  if(sieveBody) Array.from(sieveBody.querySelectorAll("input")).forEach(i=>i.value="");
}

if(btnSalvarProjeto){
  btnSalvarProjeto.addEventListener("click", async ()=>{
    const nome=(p_nome?.value||"").trim();
    if(!nome){ showMsg(msgProjeto,"Preencha o Nome do Projeto.",false); return; }

    const data={
      nome,
      codigo:(p_codigo?.value||"").trim()||null,
      cliente:(p_cliente?.value||"").trim()||null,
      mistura:(p_mistura?.value||"").trim()||null,
      cap:(p_cap?.value||"").trim()||null,
      pbProjeto:nOrNull(p_pb?.value),
      pbTol:nOrNull(p_pbtol?.value) ?? 0.3,
      sieveLimits: sieveBody ? readSieveLimits(sieveBody) : {},
      createdAt: serverTimestamp(),
      createdAtClient: Date.now()
    };

    try{
      await addDoc(projectsCol, data);
      showMsg(msgProjeto,"Projeto salvo!",true);
      clearProjectForm();
    }catch(e){
      console.error(e);
      showMsg(msgProjeto,"Erro ao salvar (veja Console).",false);
    }
  });
}

/* listar projetos */
const qProjects = query(projectsCol, orderBy("createdAtClient","desc"), limit(200));
onSnapshot(qProjects, (snap)=>{
  setConn("Online (Firestore)", true);
  if(kpiProjetos) kpiProjetos.textContent=String(snap.size);
  if(!listaProjetos) return;

  if(snap.empty){
    listaProjetos.innerHTML = `<div class="muted">Nenhum projeto cadastrado.</div>`;
    return;
  }
  listaProjetos.innerHTML="";

  snap.forEach(d=>{
    const p=d.data();
    const isActive = d.id === ACTIVE_PROJECT_ID;
    const el=document.createElement("div");
    el.className="item";
    el.innerHTML=`
      <div>
        <b>${escapeHtml(p.nome)}</b>
        <div class="meta">Código: ${escapeHtml(p.codigo||"—")} • Pb: ${p.pbProjeto ?? "—"}% ± ${p.pbTol ?? 0.3}</div>
        <div class="meta">Cliente/Obra: ${escapeHtml(p.cliente||"—")} • Mistura: ${escapeHtml(p.mistura||"—")} • CAP: ${escapeHtml(p.cap||"—")}</div>
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

/* ações projeto */
if(listaProjetos){
  listaProjetos.addEventListener("click", async (ev)=>{
    const btn=ev.target.closest("button");
    if(!btn) return;
    const act=btn.dataset.act;
    const id=btn.dataset.id;
    if(!act || !id) return;

    try{
      if(act==="ativar"){
        await setActiveProject(id);
        showMsg(msgProjeto,"Projeto ativo definido!",true);
      }
      if(act==="apagar"){
        if(id===ACTIVE_PROJECT_ID){
          showMsg(msgProjeto,"Não apague o projeto ativo. Ative outro primeiro.",false);
          return;
        }
        await deleteDoc(doc(db,"projects",id));
        showMsg(msgProjeto,"Projeto apagado.",true);
      }
    }catch(e){
      console.error(e);
      showMsg(msgProjeto,"Erro (veja Console).",false);
    }
  });
}

/* ENSAIOS - Extração + Granu */
const e_data=$("#e_data");
const e_tecnico=$("#e_tecnico");
const e_lote=$("#e_lote");
const e_obs=$("#e_obs");
const e_mmix=$("#e_mmix");   // COM betume
const e_magg=$("#e_magg");   // SEM betume (após extração)
const e_kf=$("#e_kf");
const e_pb=$("#e_pb");
const e_pb_lim=$("#e_pb_lim");
const e_fech=$("#e_fech");
const e_status=$("#e_status");
const e_status_det=$("#e_status_det");
const ensSieveBody=$("#ensSieveBody");
const btnSalvarEnsaio=$("#btnSalvarEnsaio");
const msgEnsaio=$("#msgEnsaio");
const listaEnsaios=$("#listaEnsaios");

if(e_data && !e_data.value) e_data.value=todayISO();

function pbLimits(){
  const pbRef = Number(ACTIVE_PROJECT?.pbProjeto ?? NaN);
  const tol = Number(ACTIVE_PROJECT?.pbTol ?? 0.3);
  if(Number.isFinite(pbRef)) return {min: pbRef - tol, max: pbRef + tol};
  return {min: 4.5, max: 6.5};
}

function rebuildEnsaioSieveTable(){
  if(!ensSieveBody) return;
  ensSieveBody.innerHTML="";
  SIEVES.forEach(sv=>{
    const lim = (ACTIVE_PROJECT?.sieveLimits && ACTIVE_PROJECT.sieveLimits[sv]) ? ACTIVE_PROJECT.sieveLimits[sv] : {min:null,max:null};
    const key = sv.replace(/[^a-z0-9]/gi,"_");
    const tr=document.createElement("tr");
    tr.innerHTML=`
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
  const ret={};
  if(!ensSieveBody) return ret;
  Array.from(ensSieveBody.querySelectorAll("input.ret")).forEach(inp=>{
    const sv=inp.dataset.sv;
    ret[sv]=nOrZero(inp.value);
  });
  return ret;
}

/* ✅ CÁLCULO CORRIGIDO */
function calcExtrGranu(){
  const Mmix = nOrNull(e_mmix?.value);  // COM betume
  const Magg = nOrNull(e_magg?.value);  // SEM betume (após extração)
  const kf   = nOrZero(e_kf?.value);

  const ret = getRetidos();
  const sumRet = Object.values(ret).reduce((a,b)=>a+(Number(b)||0),0);

  // Pb usando Mmix e Magg (correto) 【1-21ba13】
  let pb = null;
  if (Mmix && Mmix > 0 && Magg !== null && Magg >= 0) {
    pb = ((Mmix - Magg) / Mmix) * 100 + kf;
  }
  if(e_pb) e_pb.textContent = (pb===null || !Number.isFinite(pb)) ? "—" : pb.toFixed(2);

  // Fechamento (%): controle do peneiramento
  let fech = null;
  if (Magg && Magg > 0) {
    fech = ((Magg - sumRet) / Magg) * 100;
  }
  if (e_fech) e_fech.textContent = (fech===null || !Number.isFinite(fech)) ? "—" : fech.toFixed(2) + "%";

  const limPb=pbLimits();
  if(e_pb_lim) e_pb_lim.textContent = `Limites: ${limPb.min.toFixed(2)} a ${limPb.max.toFixed(2)}`;

  // Granulometria sobre Magg (massa sem betume) 【2-9d5854】
  let cum=0;
  let anyCheck=false;
  let allOk=true;
  let out=[];

  SIEVES.forEach(sv=>{
    const key=sv.replace(/[^a-z0-9]/gi,"_");
    const passCell=$("#pass_"+key);
    const okCell=$("#ok_"+key);

    cum += Number(ret[sv]||0);
    const pass = (Magg && Magg>0) ? (100 - (cum/Magg)*100) : null;
    if(passCell) passCell.textContent = (pass===null || !Number.isFinite(pass)) ? "—" : pass.toFixed(1);

    const lim = (ACTIVE_PROJECT?.sieveLimits && ACTIVE_PROJECT.sieveLimits[sv]) ? ACTIVE_PROJECT.sieveLimits[sv] : null;
    if(lim && pass!==null && Number.isFinite(pass)){
      anyCheck=true;
      let ok=true;
      if(lim.min!==null && pass<lim.min) ok=false;
      if(lim.max!==null && pass>lim.max) ok=false;
      if(okCell) okCell.textContent = ok ? "OK" : "NC";
      if(!ok){ allOk=false; out.push(`${sv}=${pass.toFixed(1)}%`); }
    } else {
      if(okCell) okCell.textContent="—";
    }
  });

  if(!ACTIVE_PROJECT_ID){
    setBadge(e_status,"SEM PROJETO","warn");
    if(e_status_det) e_status_det.textContent="Vá em Projetos e clique Ativar.";
    return;
  }

  const pbOk = (pb!==null && Number.isFinite(pb)) ? (pb>=limPb.min && pb<=limPb.max) : null;

  let okGeral=true;
  let det=[];
  if(pbOk===false){ okGeral=false; det.push("Pb fora"); }
  if(anyCheck && !allOk){ okGeral=false; det.push("Granu fora"); }
  if(pbOk===null) det.push("Pb pendente");
  if(!anyCheck) det.push("Sem limites de granu no projeto");

  if(okGeral && pbOk!==false && (anyCheck ? allOk : true)){
    setBadge(e_status,"CONFORME","ok");
  } else {
    setBadge(e_status,"NÃO CONFORME","bad");
  }
  if(e_status_det) e_status_det.textContent = det.join(" / ") + (out.length ? (" • Fora: "+out.join(", ")) : "");
}

if(e_mmix) e_mmix.addEventListener("input", calcExtrGranu);
if(e_magg) e_magg.addEventListener("input", calcExtrGranu);
if(e_kf)   e_kf.addEventListener("input", calcExtrGranu);

async function saveExtrGranu(){
  if(!ACTIVE_PROJECT_ID){
    showMsg(msgEnsaio,"Sem projeto ativo. Vá em Projetos e clique Ativar.",false);
    return;
  }

  const Mmix=nOrNull(e_mmix?.value);
  const Magg=nOrNull(e_magg?.value);
  if(!Mmix || Mmix<=0 || Magg===null || Magg<=0){
    showMsg(msgEnsaio,"Preencha Massa COM betume e Massa SEM betume.",false);
    return;
  }

  const kf=nOrZero(e_kf?.value);
  const ret=getRetidos();
  const sumRet = Object.values(ret).reduce((a,b)=>a+(Number(b)||0),0);

  const pb=((Mmix - Magg)/Mmix)*100 + kf; // correto 【1-21ba13】
  const limPb=pbLimits();
  const pbOk=(pb>=limPb.min && pb<=limPb.max);

  const passantes={};
  let cum=0;
  SIEVES.forEach(sv=>{
    cum += Number(ret[sv]||0);
    const pass=(Magg>0) ? (100 - (cum/Magg)*100) : null;
    passantes[sv] = (pass===null || !Number.isFinite(pass)) ? null : Number(pass.toFixed(2));
  });

  const fech = ((Magg - sumRet)/Magg)*100;

  let anyCheck=false;
  let granuOk=true;
  SIEVES.forEach(sv=>{
    const lim=(ACTIVE_PROJECT?.sieveLimits && ACTIVE_PROJECT.sieveLimits[sv]) ? ACTIVE_PROJECT.sieveLimits[sv] : null;
    const pass=passantes[sv];
    if(lim && pass!==null){
      anyCheck=true;
      if(lim.min!==null && pass<lim.min) granuOk=false;
      if(lim.max!==null && pass>lim.max) granuOk=false;
    }
  });

  const status=(pbOk && (anyCheck ? granuOk : true)) ? "CONFORME" : "NAO_CONFORME";

  try{
    const col=collection(db, `projects/${ACTIVE_PROJECT_ID}/ensaios_extr_gran`);
    await addDoc(col,{
      projectId: ACTIVE_PROJECT_ID,
      projectName: ACTIVE_PROJECT?.nome || null,
      data: e_data?.value || todayISO(),
      tecnico: (e_tecnico?.value||"").trim() || null,
      lote: (e_lote?.value||"").trim() || null,
      obs: (e_obs?.value||"").trim() || null,

      mmix: Mmix,
      magg: Magg,
      kf,
      pb: Number(pb.toFixed(3)),
      pbMin: Number(limPb.min.toFixed(3)),
      pbMax: Number(limPb.max.toFixed(3)),
      pbOk,

      sumRet,
      fechamento: Number(fech.toFixed(3)),
      retidos: ret,
      passantes,
      status,

      createdAt: serverTimestamp(),
      createdAtClient: Date.now()
    });

    showMsg(msgEnsaio,"Ensaio salvo!",true);
  }catch(e){
    console.error(e);
    showMsg(msgEnsaio,"Erro ao salvar (veja Console).",false);
  }
}
if(btnSalvarEnsaio) btnSalvarEnsaio.addEventListener("click", saveExtrGranu);

/* lista */
let unsubExtr=null;
function watchExtrList(){
  if(!listaEnsaios) return;
  if(unsubExtr){ unsubExtr(); unsubExtr=null; }

  if(!ACTIVE_PROJECT_ID){
    listaEnsaios.innerHTML = `<div class="muted">Sem projeto ativo.</div>`;
    if(kpiEnsaios) kpiEnsaios.textContent="—";
    if(kpiConformes) kpiConformes.textContent="—";
    return;
  }
  const col=collection(db, `projects/${ACTIVE_PROJECT_ID}/ensaios_extr_gran`);
  const q=query(col, orderBy("createdAtClient","desc"), limit(25));
  unsubExtr=onSnapshot(q, (snap)=>{
    if(snap.empty){
      listaEnsaios.innerHTML = `<div class="muted">Nenhum ensaio salvo.</div>`;
      if(kpiEnsaios) kpiEnsaios.textContent="0";
      if(kpiConformes) kpiConformes.textContent="—";
      return;
    }
    let total=0, conf=0;
    listaEnsaios.innerHTML="";
    snap.forEach(d=>{
      total++;
      const a=d.data();
      if(a.status==="CONFORME") conf++;
      const el=document.createElement("div");
      el.className="item";
      el.innerHTML=`
        <div>
          <b>${escapeHtml(a.data||"")} • ${escapeHtml(a.lote||"—")}</b>
          <div class="meta">Téc.: ${escapeHtml(a.tecnico||"—")} • Pb: ${a.pb ?? "—"}% • Status: ${escapeHtml(a.status||"—")}</div>
          <div class="meta">Mcom: ${a.mmix ?? "—"}g • Msem: ${a.magg ?? "—"}g • Fech: ${a.fechamento ?? "—"}%</div>
        </div>
      `;
      listaEnsaios.appendChild(el);
    });
    if(kpiEnsaios) kpiEnsaios.textContent=String(total);
    if(kpiConformes) kpiConformes.textContent = total ? `${Math.round((conf/total)*100)}%` : "—";
  });
}

/* carregar projeto ativo */
async function refreshActiveProject(){
  const snap = await getDoc(activeRef);
  ACTIVE_PROJECT_ID = snap.exists()? (snap.data().projectId || null) : null;

  if(!ACTIVE_PROJECT_ID){
    ACTIVE_PROJECT=null;
    setActiveText("Projeto ativo: (nenhum)");
    rebuildEnsaioSieveTable();
    calcExtrGranu();
    watchExtrList();
    return;
  }

  const pSnap = await getDoc(doc(db,"projects",ACTIVE_PROJECT_ID));
  ACTIVE_PROJECT = pSnap.exists()? pSnap.data() : null;
  setActiveText("Projeto ativo: " + (ACTIVE_PROJECT?.nome || "(sem nome)"));

  rebuildEnsaioSieveTable();
  calcExtrGranu();
  watchExtrList();
}

onSnapshot(activeRef, async ()=>{
  await refreshActiveProject();
});

/* init */
setConn("Online (Firestore)", true);
setActiveText("Projeto ativo: (carregando)");
refreshActiveProject().catch(()=>{});

