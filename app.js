import { initializeApp } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-app.js";import { initializeApp } from "https://www.gstatic.com/firebasejs/12.13.0/firebase9ldc",
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
function mean(arr){ if(!arr.length) return null; return arr.reduce((a,b)=>a+b,0)/arr.length; }
function sdSample(arr){ if(arr.length<2) return null; const m=mean(arr); const v=arr.reduce((a,x)=>a+Math.pow(x-m,2),0)/(arr.length-1); return Math.sqrt(v); }
function kFactor(n){
  const map={2:1.84,3:1.32,4:1.20,5:1.13,6:1.09,7:1.06,8:1.04,9:1.03,10:1.02,11:1.01,12:1.00,13:0.99,14:0.98,15:0.97,16:0.96,17:0.96,18:0.95,19:0.95,20:0.94,25:0.93};
  if(n<=1) return null; if(map[n]) return map[n]; if(n>25) return 0.92;
  let lo=2,hi=25; for(let i=2;i<=25;i++){ if(map[i]) lo=i; if(i>=n && map[i]){hi=i; break;} }
  const t=(n-lo)/(hi-lo); return map[lo]+(map[hi]-map[lo])*t;
}

/* UI */
const connPill = $("#connPill");
const activeProjPill = $("#activeProjPill");
const kpiFirebase = $("#kpiFirebase");
const kpiProjetos = $("#kpiProjetos");
const kpiEnsaios = $("#kpiEnsaios");
const kpiConformes = $("#kpiConformes");
function setConn(texto, ok=true){
  if(connPill){
    connPill.textContent=texto;
    connPill.style.borderColor = ok ? "rgba(57,217,138,.4)" : "rgba(255,92,92,.4)";
    connPill.style.color = ok ? "#39d98a" : "#ff5c5c";
  }
  if(kpiFirebase) kpiFirebase.textContent = ok ? "Online" : "Erro";
}
function setActiveText(t){ if(activeProjPill) activeProjPill.textContent=t; }

/* Tabs */
(() => {
  const tabs = $$(".tab");
  const views = {
    painel: $("#view-painel"),
    projetos: $("#view-projetos"),
    ensaios: $("#view-ensaios"),
    estatistico: $("#view-estatistico"),
    relatorios: $("#view-relatorios"),
  };
  tabs.forEach(btn=>{
    btn.addEventListener("click", ()=>{
      tabs.forEach(b=>b.classList.remove("active"));
      btn.classList.add("active");
      const id=btn.dataset.tab;
      Object.values(views).forEach(v=>v && v.classList.add("hidden"));
      views[id] && views[id].classList.remove("hidden");
    });
  });
})();

/* Subtabs Ensaios */
(() => {
  const subtabs = $$(".subtab");
  const subviews = {
    extrgranu: $("#sub-extrgranu"),
    rice: $("#sub-rice"),
    marshall: $("#sub-marshall"),
    rt: $("#sub-rt"),
    se: $("#sub-se"),
  };
  subtabs.forEach(btn=>{
    btn.addEventListener("click", ()=>{
      subtabs.forEach(b=>b.classList.remove("active"));
      btn.classList.add("active");
      const id=btn.dataset.sub;
      Object.values(subviews).forEach(v=>v && v.classList.add("hidden"));
      subviews[id] && subviews[id].classList.remove("hidden");
    });
  });
})();

/* Active project */
const activeRef = doc(db, "meta", "active");
let ACTIVE_PROJECT_ID = null;
let ACTIVE_PROJECT = null;

/* Collections */
const projectsCol = collection(db, "projects");

/* Project form refs */
const sieveBody = $("#sieveBody");
const p_nome=$("#p_nome"), p_codigo=$("#p_codigo"), p_cliente=$("#p_cliente"), p_mistura=$("#p_mistura"), p_cap=$("#p_cap");
const p_pb=$("#p_pb"), p_pbtol=$("#p_pbtol"), p_gb=$("#p_gb");
const p_vv_min=$("#p_vv_min"), p_vv_max=$("#p_vv_max"), p_vam_min=$("#p_vam_min"), p_rbv_min=$("#p_rbv_min"), p_rbv_max=$("#p_rbv_max");
const p_estab_min=$("#p_estab_min"), p_flow_min=$("#p_flow_min"), p_flow_max=$("#p_flow_max"), p_rt_min=$("#p_rt_min"), p_se_min=$("#p_se_min");
const btnSalvarProjeto=$("#btnSalvarProjeto"), msgProjeto=$("#msgProjeto"), listaProjetos=$("#listaProjetos");

/* Sieve list */
const SIEVES = ['3/4"', '1/2"', '3/8"', '1/4"', '#4', '#8', '#16', '#30', '#50', '#100', '#200'];

function buildProjectSieveRows(){
  if(!sieveBody) return;
  sieveBody.innerHTML="";
  SIEVES.forEach(sv=>{
    const tr=document.createElement("tr");
    tr.innerHTML=`
      <td><b>${escapeHtml(sv)}</b></td>
      <td><input data-sv="${escapeHtml(sv)}" data-k="min" placeholder="min" /></td>
      <td><input data-sv="${escapeHtml(sv)}" data-k="max" placeholder="max" /></td>
    `;
    sieveBody.appendChild(tr);
  });
}
buildProjectSieveRows();

function readSieveLimits(bodyEl){
  const inputs=Array.from(bodyEl.querySelectorAll("input"));
  const limits={};
  inputs.forEach(inp=>{
    const sv=inp.dataset.sv, k=inp.dataset.k;
    limits[sv]=limits[sv]||{min:null,max:null};
    limits[sv][k]=nOrNull(inp.value);
  });
  Object.keys(limits).forEach(sv=>{
    const r=limits[sv];
    if(r.min===null && r.max===null) delete limits[sv];
  });
  return limits;
}
function clearProjectForm(){
  [p_nome,p_codigo,p_cliente,p_mistura,p_cap,p_pb,p_pbtol,p_gb,p_vv_min,p_vv_max,p_vam_min,p_rbv_min,p_rbv_max,p_estab_min,p_flow_min,p_flow_max,p_rt_min,p_se_min]
    .forEach(i=>{ if(i) i.value=""; });
  if(sieveBody) Array.from(sieveBody.querySelectorAll("input")).forEach(i=>i.value="");
}

async function setActiveProject(projectId){
  await setDoc(activeRef, { projectId, updatedAt: serverTimestamp() }, { merge: true });
}

/* Save project */
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
      gb: nOrNull(p_gb?.value) ?? 1.005,
      limits:{
        vvMin:nOrNull(p_vv_min?.value), vvMax:nOrNull(p_vv_max?.value),
        vamMin:nOrNull(p_vam_min?.value),
        rbvMin:nOrNull(p_rbv_min?.value), rbvMax:nOrNull(p_rbv_max?.value),
        estabMin:nOrNull(p_estab_min?.value),
        flowMin:nOrNull(p_flow_min?.value), flowMax:nOrNull(p_flow_max?.value),
        rtMin:nOrNull(p_rt_min?.value), seMin:nOrNull(p_se_min?.value)
      },
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
      showMsg(msgProjeto,"Erro ao salvar (ver Console).",false);
    }
  });
}

/* List projects */
const qProjects = query(projectsCol, orderBy("createdAtClient","desc"), limit(200));
onSnapshot(qProjects, (snap)=>{
  setConn("Online (Firestore)", true);
  if(kpiProjetos) kpiProjetos.textContent=String(snap.size);
  if(!listaProjetos) return;

  if(snap.empty){
    listaProjetos.innerHTML=`<div class="muted">Nenhum projeto cadastrado.</div>`;
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
});

if(listaProjetos){
  listaProjetos.addEventListener("click", async (ev)=>{
    const btn=ev.target.closest("button");
    if(!btn) return;
    const act=btn.dataset.act, id=btn.dataset.id;
    if(!act || !id) return;

    try{
      if(act==="ativar"){ await setActiveProject(id); showMsg(msgProjeto,"Projeto ativo definido!",true); }
      if(act==="apagar"){
        if(id===ACTIVE_PROJECT_ID){ showMsg(msgProjeto,"Não apague o projeto ativo. Ative outro primeiro.",false); return; }
        await deleteDoc(doc(db,"projects",id));
        showMsg(msgProjeto,"Projeto apagado.",true);
      }
    }catch(e){
      console.error(e);
      showMsg(msgProjeto,"Erro (ver Console).",false);
    }
  });
}

/* ---------------- ENSAIOS: Extração + Granu ---------------- */
const e_data=$("#e_data"), e_tecnico=$("#e_tecnico"), e_lote=$("#e_lote"), e_obs=$("#e_obs");
const e_mmix=$("#e_mmix"), e_magg=$("#e_magg"), e_kf=$("#e_kf");
const e_pb=$("#e_pb"), e_pb_lim=$("#e_pb_lim"), e_p200=$("#e_p200");
const e_status=$("#e_status"), e_status_det=$("#e_status_det");
const ensSieveBody=$("#ensSieveBody");
const btnSalvarEnsaio=$("#btnSalvarEnsaio"), msgEnsaio=$("#msgEnsaio"), listaEnsaios=$("#listaEnsaios");

if(e_data && !e_data.value) e_data.value=todayISO();

function pbLimits(){
  const pbRef=Number(ACTIVE_PROJECT?.pbProjeto ?? NaN);
  const tol=Number(ACTIVE_PROJECT?.pbTol ?? 0.3);
  if(Number.isFinite(pbRef)) return {min:pbRef-tol,max:pbRef+tol};
  return {min:4.5,max:6.5};
}

function rebuildEnsaioSieveTable(){
  if(!ensSieveBody) return;
  ensSieveBody.innerHTML="";
  SIEVES.forEach(sv=>{
    const lim=(ACTIVE_PROJECT?.sieveLimits && ACTIVE_PROJECT.sieveLimits[sv]) ? ACTIVE_PROJECT.sieveLimits[sv] : {min:null,max:null};
    const key=sv.replace(/[^a-z0-9]/gi,"_");
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
    ret[inp.dataset.sv]=nOrZero(inp.value);
  });
  return ret;
}

function calcExtrGranu(){
  const Mmix=nOrNull(e_mmix?.value);
  const Magg=nOrNull(e_magg?.value);
  const kf=nOrZero(e_kf?.value);

  const ret=getRetidos();
  const sumRet=Object.values(ret).reduce((a,b)=>a+(Number(b)||0),0);

  // Pb correto 【1-32a14b】
  let pb=null;
  if(Mmix && Mmix>0 && Magg!==null && Magg>=0) pb=((Mmix-Magg)/Mmix)*100 + kf;
  if(e_pb) e_pb.textContent = (pb===null || !Number.isFinite(pb)) ? "—" : pb.toFixed(2);

  const limPb=pbLimits();
  if(e_pb_lim) e_pb_lim.textContent = `Limites: ${limPb.min.toFixed(2)} a ${limPb.max.toFixed(2)}`;

  // % passante #200 (lavado) = 100 - (Σretidos/Msem)*100 【2-9f2f16】【3-c4c41d】
  let p200=null;
  if(Magg && Magg>0) p200 = 100 - (sumRet/Magg)*100;
  if(e_p200) e_p200.textContent = (p200===null || !Number.isFinite(p200)) ? "—" : p200.toFixed(2) + "%";

  // granulometria em cima de Msem 【7-cdac04】
  let cum=0, anyCheck=false, allOk=true, out=[];
  SIEVES.forEach(sv=>{
    const key=sv.replace(/[^a-z0-9]/gi,"_");
    const passCell=$("#pass_"+key);
    const okCell=$("#ok_"+key);

    cum += Number(ret[sv]||0);
    const pass = (Magg && Magg>0) ? (100 - (cum/Magg)*100) : null;
    if(passCell) passCell.textContent = (pass===null || !Number.isFinite(pass)) ? "—" : pass.toFixed(1);

    const lim=(ACTIVE_PROJECT?.sieveLimits && ACTIVE_PROJECT.sieveLimits[sv]) ? ACTIVE_PROJECT.sieveLimits[sv] : null;
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
    if(e_status_det) e_status_det.textContent="Ative um projeto.";
    return;
  }

  const pbOk = (pb!==null && Number.isFinite(pb)) ? (pb>=limPb.min && pb<=limPb.max) : null;

  let okGeral=true, det=[];
  if(pbOk===false){ okGeral=false; det.push("Pb fora"); }
  if(anyCheck && !allOk){ okGeral=false; det.push("Granu fora"); }
  if(pbOk===null) det.push("Pb pendente");
  if(!anyCheck) det.push("Sem limites de granu no projeto");

  setBadge(e_status, okGeral ? "CONFORME" : "NÃO CONFORME", okGeral ? "ok" : "bad");
  if(e_status_det) e_status_det.textContent = det.join(" / ") + (out.length ? (" • Fora: "+out.join(", ")) : "");
}

if(e_mmix) e_mmix.addEventListener("input", calcExtrGranu);
if(e_magg) e_magg.addEventListener("input", calcExtrGranu);
if(e_kf) e_kf.addEventListener("input", calcExtrGranu);

async function saveExtrGranu(){
  if(!ACTIVE_PROJECT_ID){ showMsg(msgEnsaio,"Ative um projeto.",false); return; }
  const Mmix=nOrNull(e_mmix?.value);
  const Magg=nOrNull(e_magg?.value);
  if(!Mmix || Mmix<=0 || !Magg || Magg<=0){ showMsg(msgEnsaio,"Preencha Mcom e Msem.",false); return; }

  const kf=nOrZero(e_kf?.value);
  const ret=getRetidos();
  const sumRet=Object.values(ret).reduce((a,b)=>a+(Number(b)||0),0);

  const pb=((Mmix-Magg)/Mmix)*100 + kf;
  const limPb=pbLimits();
  const pbOk=(pb>=limPb.min && pb<=limPb.max);

  const passantes={};
  let cum=0;
  SIEVES.forEach(sv=>{
    cum += Number(ret[sv]||0);
    const pass=(Magg>0) ? (100 - (cum/Magg)*100) : null;
    passantes[sv] = (pass===null || !Number.isFinite(pass)) ? null : Number(pass.toFixed(2));
  });

  const p200 = 100 - (sumRet/Magg)*100; // passante #200 por lavagem

  let anyCheck=false, granuOk=true;
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

  const col=collection(db, `projects/${ACTIVE_PROJECT_ID}/ensaios_extr_gran`);
  await addDoc(col,{
    projectId: ACTIVE_PROJECT_ID,
    projectName: ACTIVE_PROJECT?.nome || null,
    data: e_data?.value || todayISO(),
    tecnico: (e_tecnico?.value||"").trim() || null,
    lote: (e_lote?.value||"").trim() || null,
    obs: (e_obs?.value||"").trim() || null,

    mmix:Mmix, magg:Magg, kf,
    pb:Number(pb.toFixed(3)),
    pbMin:Number(limPb.min.toFixed(3)),
    pbMax:Number(limPb.max.toFixed(3)),
    pbOk,

    sumRet,
    p200:Number(p200.toFixed(3)),
    retidos:ret,
    passantes,
    status,

    createdAt: serverTimestamp(),
    createdAtClient: Date.now()
  });
  showMsg(msgEnsaio,"Ensaio salvo!",true);
}

if(btnSalvarEnsaio) btnSalvarEnsaio.addEventListener("click", saveExtrGranu);

/* ---------------- Rice (Gmm) ---------------- */
const r_data=$("#r_data"), r_tecnico=$("#r_tecnico"), r_lote=$("#r_lote");
const r_A=$("#r_A"), r_B=$("#r_B"), r_C=$("#r_C"), r_gmm=$("#r_gmm");
const btnSalvarRice=$("#btnSalvarRice"), msgRice=$("#msgRice"), listaRice=$("#listaRice");
if(r_data && !r_data.value) r_data.value=todayISO();

function calcRice(){
  const A=nOrNull(r_A?.value), B=nOrNull(r_B?.value), C=nOrNull(r_C?.value);
  if(!A || !B || !C || (A+B-C)<=0){ if(r_gmm) r_gmm.textContent="—"; return null; }
  const gmm=A/(A+B-C);
  if(r_gmm) r_gmm.textContent=gmm.toFixed(4);
  return gmm;
}
[r_A,r_B,r_C].forEach(i=> i && i.addEventListener("input", calcRice));

let lastRiceByLote=new Map();
async function saveRice(){
  if(!ACTIVE_PROJECT_ID){ showMsg(msgRice,"Ative um projeto.",false); return; }
  const gmm=calcRice();
  if(!gmm){ showMsg(msgRice,"Preencha A, B, C.",false); return; }
  const col=collection(db, `projects/${ACTIVE_PROJECT_ID}/ensaios_rice`);
  await addDoc(col,{
    data: r_data?.value || todayISO(),
    tecnico: (r_tecnico?.value||"").trim()||null,
    lote: (r_lote?.value||"").trim()||null,
    A:nOrNull(r_A?.value), B:nOrNull(r_B?.value), C:nOrNull(r_C?.value),
    gmm:Number(gmm.toFixed(5)),
    createdAt: serverTimestamp(),
    createdAtClient: Date.now()
  });
  showMsg(msgRice,"Rice salvo!",true);
}
if(btnSalvarRice) btnSalvarRice.addEventListener("click", saveRice);

/* ---------------- Marshall ---------------- */
const m_data=$("#m_data"), m_tecnico=$("#m_tecnico"), m_lote=$("#m_lote"), m_gmm_manual=$("#m_gmm_manual");
const m_A=$("#m_A"), m_B=$("#m_B"), m_C=$("#m_C"), m_estab=$("#m_estab"), m_flow=$("#m_flow");
const m_gmb=$("#m_gmb"), m_gmm=$("#m_gmm"), m_vv=$("#m_vv"), m_vb=$("#m_vb"), m_vam=$("#m_vam"), m_rbv=$("#m_rbv");
const m_status=$("#m_status"), m_status_det=$("#m_status_det");
const btnSalvarMarshall=$("#btnSalvarMarshall"), msgMarshall=$("#msgMarshall"), listaMarshall=$("#listaMarshall");
if(m_data && !m_data.value) m_data.value=todayISO();

function getGmmForLote(lote){
  if(lote && lastRiceByLote.has(lote)) return lastRiceByLote.get(lote);
  const man=nOrNull(m_gmm_manual?.value);
  return man || null;
}
function calcMarshall(){
  const A=nOrNull(m_A?.value), B=nOrNull(m_B?.value), C=nOrNull(m_C?.value);
  const lote=(m_lote?.value||"").trim();
  const gmmUse=getGmmForLote(lote);

  let gmb=null;
  if(A && B && C && (B-C)>0) gmb=A/(B-C);
  if(m_gmb) m_gmb.textContent = gmb ? gmb.toFixed(4) : "—";
  if(m_gmm) m_gmm.textContent = gmmUse ? gmmUse.toFixed(4) : "—";

  // Vv
  let vv=null;
  if(gmb && gmmUse && gmmUse>0) vv = 100*(1 - (gmb/gmmUse));
  if(m_vv) m_vv.textContent = vv!==null ? vv.toFixed(2) : "—";

  // Vb, VAM, RBV usando Pb do projeto e densidade do CAP (Gb)
  const pbProj = nOrNull(ACTIVE_PROJECT?.pbProjeto);
  const gb = nOrNull(ACTIVE_PROJECT?.gb) ?? 1.005;
  let vb=null, vam=null, rbv=null;
  if(gmb && pbProj!==null && gb>0 && vv!==null){
    vb = (gmb * (pbProj/100) / gb) * 100; // em %
    vam = vv + vb;
    rbv = (vam>0) ? (vb/vam)*100 : null;
  }
  if(m_vb) m_vb.textContent = vb!==null ? vb.toFixed(2) : "—";
  if(m_vam) m_vam.textContent = vam!==null ? vam.toFixed(2) : "—";
  if(m_rbv) m_rbv.textContent = rbv!==null ? rbv.toFixed(1) : "—";

  // Status por limites do projeto
  const lim=ACTIVE_PROJECT?.limits||{};
  const estab=nOrNull(m_estab?.value);
  const flow=nOrNull(m_flow?.value);

  let ok=true, det=[];
  if(lim.vvMin!==null && vv!==null && vv<lim.vvMin){ ok=false; det.push("Vv<min"); }
  if(lim.vvMax!==null && vv!==null && vv>lim.vvMax){ ok=false; det.push("Vv>max"); }
  if(lim.vamMin!==null && vam!==null && vam<lim.vamMin){ ok=false; det.push("VAM<min"); }
  if(lim.rbvMin!==null && rbv!==null && rbv<lim.rbvMin){ ok=false; det.push("RBV<min"); }
  if(lim.rbvMax!==null && rbv!==null && rbv>lim.rbvMax){ ok=false; det.push("RBV>max"); }
  if(lim.estabMin!==null && estab!==null && estab<lim.estabMin){ ok=false; det.push("Estab<min"); }
  if(lim.flowMin!==null && flow!==null && flow<lim.flowMin){ ok=false; det.push("Flow<min"); }
  if(lim.flowMax!==null && flow!==null && flow>lim.flowMax){ ok=false; det.push("Flow>max"); }

  if(!ACTIVE_PROJECT_ID){
    setBadge(m_status,"SEM PROJETO","warn");
    if(m_status_det) m_status_det.textContent="Ative um projeto.";
  }else{
    setBadge(m_status, ok ? "CONFORME" : "NÃO CONFORME", ok ? "ok" : "bad");
    if(m_status_det) m_status_det.textContent = det.length ? det.join(" / ") : "OK";
  }
  return {gmb,gmmUse,vv,vb,vam,rbv,estab,flow,ok};
}
[m_A,m_B,m_C,m_estab,m_flow,m_lote,m_gmm_manual].forEach(i=> i && i.addEventListener("input", calcMarshall));

async function saveMarshall(){
  if(!ACTIVE_PROJECT_ID){ showMsg(msgMarshall,"Ative um projeto.",false); return; }
  const lote=(m_lote?.value||"").trim();
  const c=calcMarshall();
  if(!c.gmb){ showMsg(msgMarshall,"Preencha A, B, C.",false); return; }
  if(!c.gmmUse){ showMsg(msgMarshall,"Sem Gmm (faça Rice do lote ou digite manual).",false); return; }

  const col=collection(db, `projects/${ACTIVE_PROJECT_ID}/ensaios_marshall`);
  await addDoc(col,{
    data: m_data?.value || todayISO(),
    tecnico:(m_tecnico?.value||"").trim()||null,
    lote: lote||null,
    A:nOrNull(m_A?.value),B:nOrNull(m_B?.value),C:nOrNull(m_C?.value),
    gmb:Number(c.gmb.toFixed(5)),
    gmm:Number(c.gmmUse.toFixed(5)),
    vv: c.vv!==null?Number(c.vv.toFixed(3)):null,
    vb: c.vb!==null?Number(c.vb.toFixed(3)):null,
    vam: c.vam!==null?Number(c.vam.toFixed(3)):null,
    rbv: c.rbv!==null?Number(c.rbv.toFixed(3)):null,
    estab:nOrNull(m_estab?.value),
    flow:nOrNull(m_flow?.value),
    status: c.ok ? "CONFORME" : "NAO_CONFORME",
    createdAt: serverTimestamp(),
    createdAtClient: Date.now()
  });
  showMsg(msgMarshall,"Marshall salvo!",true);
}
if(btnSalvarMarshall) btnSalvarMarshall.addEventListener("click", saveMarshall);

/* ---------------- RT ---------------- */
const t_data=$("#t_data"), t_tecnico=$("#t_tecnico"), t_lote=$("#t_lote");
const t_F=$("#t_F"), t_D=$("#t_D"), t_H=$("#t_H"), t_rt=$("#t_rt"), t_status=$("#t_status"), t_status_det=$("#t_status_det");
const btnSalvarRT=$("#btnSalvarRT"), msgRT=$("#msgRT"), listaRT=$("#listaRT");
if(t_data && !t_data.value) t_data.value=todayISO();

function calcRT(){
  const F=nOrNull(t_F?.value), D=nOrNull(t_D?.value), H=nOrNull(t_H?.value);
  if(!F || !D || !H || D<=0 || H<=0){ if(t_rt) t_rt.textContent="—"; return null; }
  // RT = 2F/(π·D·H) * 0,0981 (MPa) com F kgf, D e H cm
  const rt=(2*F)/(Math.PI*D*H) * 0.0981;
  if(t_rt) t_rt.textContent=rt.toFixed(3);

  const lim=ACTIVE_PROJECT?.limits?.rtMin ?? null;
  if(!ACTIVE_PROJECT_ID){
    setBadge(t_status,"SEM PROJETO","warn");
    if(t_status_det) t_status_det.textContent="Ative um projeto.";
  }else if(lim!==null){
    const ok=rt>=lim;
    setBadge(t_status, ok?"CONFORME":"NÃO CONFORME", ok?"ok":"bad");
    if(t_status_det) t_status_det.textContent=`Limite: ≥ ${lim}`;
  }else{
    setBadge(t_status,"SEM LIMITE","warn");
    if(t_status_det) t_status_det.textContent="Defina RT mín no projeto.";
  }
  return rt;
}
[t_F,t_D,t_H].forEach(i=> i && i.addEventListener("input", calcRT));

async function saveRT(){
  if(!ACTIVE_PROJECT_ID){ showMsg(msgRT,"Ative um projeto.",false); return; }
  const rt=calcRT();
  if(rt===null){ showMsg(msgRT,"Preencha F, D e H.",false); return; }
  const lim=ACTIVE_PROJECT?.limits?.rtMin ?? null;
  const ok=(lim===null)?true:(rt>=lim);

  const col=collection(db, `projects/${ACTIVE_PROJECT_ID}/ensaios_rt`);
  await addDoc(col,{
    data:t_data?.value||todayISO(),
    tecnico:(t_tecnico?.value||"").trim()||null,
    lote:(t_lote?.value||"").trim()||null,
    F:nOrNull(t_F?.value),D:nOrNull(t_D?.value),H:nOrNull(t_H?.value),
    rt:Number(rt.toFixed(5)),
    status: ok?"CONFORME":"NAO_CONFORME",
    createdAt: serverTimestamp(),
    createdAtClient: Date.now()
  });
  showMsg(msgRT,"RT salvo!",true);
}
if(btnSalvarRT) btnSalvarRT.addEventListener("click", saveRT);

/* ---------------- SE ---------------- */
const s_data=$("#s_data"), s_tecnico=$("#s_tecnico"), s_lote=$("#s_lote");
const s_H1=$("#s_H1"), s_H2=$("#s_H2"), s_se=$("#s_se"), s_status=$("#s_status"), s_status_det=$("#s_status_det");
const btnSalvarSE=$("#btnSalvarSE"), msgSE=$("#msgSE"), listaSE=$("#listaSE");
if(s_data && !s_data.value) s_data.value=todayISO();

function calcSE(){
  const H1=nOrNull(s_H1?.value), H2=nOrNull(s_H2?.value);
  if(!H1 || !H2 || H1<=0){ if(s_se) s_se.textContent="—"; return null; }
  const se=(H2/H1)*100;
  if(s_se) s_se.textContent=se.toFixed(1);

  const lim=ACTIVE_PROJECT?.limits?.seMin ?? null;
  if(!ACTIVE_PROJECT_ID){
    setBadge(s_status,"SEM PROJETO","warn");
    if(s_status_det) s_status_det.textContent="Ative um projeto.";
  }else if(lim!==null){
    const ok=se>=lim;
    setBadge(s_status, ok?"CONFORME":"NÃO CONFORME", ok?"ok":"bad");
    if(s_status_det) s_status_det.textContent=`Limite: ≥ ${lim}%`;
  }else{
    setBadge(s_status,"SEM LIMITE","warn");
    if(s_status_det) s_status_det.textContent="Defina SE mín no projeto.";
  }
  return se;
}
[s_H1,s_H2].forEach(i=> i && i.addEventListener("input", calcSE));

async function saveSE(){
  if(!ACTIVE_PROJECT_ID){ showMsg(msgSE,"Ative um projeto.",false); return; }
  const se=calcSE();
  if(se===null){ showMsg(msgSE,"Preencha H1 e H2.",false); return; }
  const lim=ACTIVE_PROJECT?.limits?.seMin ?? null;
  const ok=(lim===null)?true:(se>=lim);

  const col=collection(db, `projects/${ACTIVE_PROJECT_ID}/ensaios_se`);
  await addDoc(col,{
    data:s_data?.value||todayISO(),
    tecnico:(s_tecnico?.value||"").trim()||null,
    lote:(s_lote?.value||"").trim()||null,
    H1:nOrNull(s_H1?.value),H2:nOrNull(s_H2?.value),
    se:Number(se.toFixed(4)),
    status: ok?"CONFORME":"NAO_CONFORME",
    createdAt: serverTimestamp(),
    createdAtClient: Date.now()
  });
  showMsg(msgSE,"SE salvo!",true);
}
if(btnSalvarSE) btnSalvarSE.addEventListener("click", saveSE);

/* ---------------- LISTAS (subcoleções, sem índice) ---------------- */
let unsubExtr=null, unsubRice=null, unsubMar=null, unsubRT=null, unsubSE=null;

function stopLists(){
  [unsubExtr,unsubRice,unsubMar,unsubRT,unsubSE].forEach(u=>{ if(u) u(); });
  unsubExtr=unsubRice=unsubMar=unsubRT=unsubSE=null;
}

function watchLists(){
  stopLists();
  if(!ACTIVE_PROJECT_ID) return;

  // Extração+Granu
  const colExtr=collection(db, `projects/${ACTIVE_PROJECT_ID}/ensaios_extr_gran`);
  unsubExtr=onSnapshot(query(colExtr, orderBy("createdAtClient","desc"), limit(25)), (snap)=>{
    if(!listaEnsaios) return;
    if(snap.empty){
      listaEnsaios.innerHTML=`<div class="muted">Nenhum ensaio salvo.</div>`;
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
          <div class="meta">Pb: ${a.pb ?? "—"}% • P200: ${a.p200 ?? "—"}% • Status: ${escapeHtml(a.status||"—")}</div>
          <div class="meta">Mcom: ${a.mmix ?? "—"}g • Msem: ${a.magg ?? "—"}g</div>
        </div>
      `;
      listaEnsaios.appendChild(el);
    });
    if(kpiEnsaios) kpiEnsaios.textContent=String(total);
    if(kpiConformes) kpiConformes.textContent= total ? `${Math.round((conf/total)*100)}%` : "—";
  });

  // Rice
  const colRice=collection(db, `projects/${ACTIVE_PROJECT_ID}/ensaios_rice`);
  unsubRice=onSnapshot(query(colRice, orderBy("createdAtClient","desc"), limit(25)), (snap)=>{
    if(!listaRice) return;
    listaRice.innerHTML = snap.empty ? `<div class="muted">Nenhum Rice salvo.</div>` : "";
    lastRiceByLote=new Map();
    snap.forEach(d=>{
      const a=d.data();
      if(a.lote && a.gmm) lastRiceByLote.set(a.lote, a.gmm);
      const el=document.createElement("div");
      el.className="item";
      el.innerHTML=`<div><b>${escapeHtml(a.data||"")} • ${escapeHtml(a.lote||"—")}</b><div class="meta">Gmm: ${a.gmm ?? "—"}</div></div>`;
      listaRice.appendChild(el);
    });
    calcMarshall();
  });

  // Marshall
  const colMar=collection(db, `projects/${ACTIVE_PROJECT_ID}/ensaios_marshall`);
  unsubMar=onSnapshot(query(colMar, orderBy("createdAtClient","desc"), limit(25)), (snap)=>{
    if(!listaMarshall) return;
    listaMarshall.innerHTML = snap.empty ? `<div class="muted">Nenhum Marshall salvo.</div>` : "";
    snap.forEach(d=>{
      const a=d.data();
      const el=document.createElement("div");
      el.className="item";
      el.innerHTML=`<div><b>${escapeHtml(a.data||"")} • ${escapeHtml(a.lote||"—")}</b>
        <div class="meta">Gmb:${a.gmb ?? "—"} • Vv:${a.vv ?? "—"} • VAM:${a.vam ?? "—"} • RBV:${a.rbv ?? "—"} • Status:${escapeHtml(a.status||"—")}</div></div>`;
      listaMarshall.appendChild(el);
    });
  });

  // RT
  const colRT=collection(db, `projects/${ACTIVE_PROJECT_ID}/ensaios_rt`);
  unsubRT=onSnapshot(query(colRT, orderBy("createdAtClient","desc"), limit(25)), (snap)=>{
    if(!listaRT) return;
    listaRT.innerHTML = snap.empty ? `<div class="muted">Nenhum RT salvo.</div>` : "";
    snap.forEach(d=>{
      const a=d.data();
      const el=document.createElement("div");
      el.className="item";
      el.innerHTML=`<div><b>${escapeHtml(a.data||"")} • ${escapeHtml(a.lote||"—")}</b><div class="meta">RT:${a.rt ?? "—"} • Status:${escapeHtml(a.status||"—")}</div></div>`;
      listaRT.appendChild(el);
    });
  });

  // SE
  const colSE=collection(db, `projects/${ACTIVE_PROJECT_ID}/ensaios_se`);
  unsubSE=onSnapshot(query(colSE, orderBy("createdAtClient","desc"), limit(25)), (snap)=>{
    if(!listaSE) return;
    listaSE.innerHTML = snap.empty ? `<div class="muted">Nenhum SE salvo.</div>` : "";
    snap.forEach(d=>{
      const a=d.data();
      const el=document.createElement("div");
      el.className="item";
      el.innerHTML=`<div><b>${escapeHtml(a.data||"")} • ${escapeHtml(a.lote||"—")}</b><div class="meta">SE:${a.se ?? "—"}% • Status:${escapeHtml(a.status||"—")}</div></div>`;
      listaSE.appendChild(el);
    });
  });
}

/* ---------------- Controle Estatístico ---------------- */
const c_ini=$("#c_ini"), c_fim=$("#c_fim"), c_total=$("#c_total"), c_conf=$("#c_conf");
const btnGerarCtrl=$("#btnGerarCtrl"), msgCtrl=$("#msgCtrl"), ctrlBody=$("#ctrlBody"), ctrlStats=$("#ctrlStats");
if(c_ini && !c_ini.value) c_ini.value=todayISO();
if(c_fim && !c_fim.value) c_fim.value=todayISO();

async function fetchAll(colPath){
  const col=collection(db, colPath);
  return await new Promise((resolve)=>{
    const unsub=onSnapshot(query(col, orderBy("createdAtClient","desc"), limit(500)), (snap)=>{
      const rows=[]; snap.forEach(d=>rows.push(d.data()));
      unsub(); resolve(rows);
    });
  });
}

async function gerarControle(){
  if(!ACTIVE_PROJECT_ID){ showMsg(msgCtrl,"Ative um projeto.",false); return; }
  const ini=c_ini?.value||todayISO(), fim=c_fim?.value||todayISO();
  const extr=await fetchAll(`projects/${ACTIVE_PROJECT_ID}/ensaios_extr_gran`);
  const rice=await fetchAll(`projects/${ACTIVE_PROJECT_ID}/ensaios_rice`);
  const mar=await fetchAll(`projects/${ACTIVE_PROJECT_ID}/ensaios_marshall`);
  const rt=await fetchAll(`projects/${ACTIVE_PROJECT_ID}/ensaios_rt`);
  const se=await fetchAll(`projects/${ACTIVE_PROJECT_ID}/ensaios_se`);

  const byKey=new Map();
  const key=(d,l)=>`${d||""}__${l||""}`;
  const up=(k,obj)=>{ byKey.set(k,{...(byKey.get(k)||{}),...obj}); };

  extr.forEach(a=>{ if(a.data>=ini && a.data<=fim) up(key(a.data,a.lote), {data:a.data,lote:a.lote,pb:a.pb,p200:a.p200,status:a.status}); });
  rice.forEach(a=>{ if(a.data>=ini && a.data<=fim) up(key(a.data,a.lote), {gmm:a.gmm}); });
  mar.forEach(a=>{ if(a.data>=ini && a.data<=fim) up(key(a.data,a.lote), {gmb:a.gmb,vv:a.vv,vam:a.vam,rbv:a.rbv,estab:a.estab,flow:a.flow,statusM:a.status}); });
  rt.forEach(a=>{ if(a.data>=ini && a.data<=fim) up(key(a.data,a.lote), {rt:a.rt,statusT:a.status}); });
  se.forEach(a=>{ if(a.data>=ini && a.data<=fim) up(key(a.data,a.lote), {se:a.se,statusS:a.status}); });

  const rows=[...byKey.values()].sort((a,b)=>(b.data||"").localeCompare(a.data||""));
  if(ctrlBody) ctrlBody.innerHTML="";

  let total=0, conf=0;
  const pbArr=[];
  rows.forEach(r=>{
    total++;
    const st = r.status || r.statusM || r.statusT || r.statusS || "—";
    if(st==="CONFORME") conf++;
    if(typeof r.pb==="number") pbArr.push(r.pb);

    if(ctrlBody){
      const tr=document.createElement("tr");
      tr.innerHTML=`
        <td>${escapeHtml(r.data||"")}</td>
        <td>${escapeHtml(r.lote||"")}</td>
        <td>${r.pb ?? "—"}</td>
        <td>${r.p200 ?? "—"}</td>
        <td>${r.gmm ?? "—"}</td>
        <td>${r.gmb ?? "—"}</td>
        <td>${r.vv ?? "—"}</td>
        <td>${r.vam ?? "—"}</td>
        <td>${r.rbv ?? "—"}</td>
        <td>${r.rt ?? "—"}</td>
        <td>${r.se ?? "—"}</td>
        <td>${escapeHtml(st)}</td>
      `;
      ctrlBody.appendChild(tr);
    }
  });

  if(c_total) c_total.textContent=String(total);
  if(c_conf) c_conf.textContent= total ? `${Math.round((conf/total)*100)}%` : "—";

  const m=mean(pbArr), s=sdSample(pbArr), k=kFactor(pbArr.length);
  let txt=`Pb: N=${pbArr.length}`;
  if(m!==null && s!==null && k!==null){
    txt += ` • Média=${m.toFixed(3)} • Sd=${s.toFixed(3)} • k=${k.toFixed(2)} • Limites: ${(m-k*s).toFixed(3)} a ${(m+k*s).toFixed(3)}`;
  }
  if(ctrlStats) ctrlStats.textContent=txt;
  showMsg(msgCtrl,"Resumo gerado.",true);
}
if(btnGerarCtrl) btnGerarCtrl.addEventListener("click", gerarControle);

/* ---------------- Relatório (Imprimir/PDF) ---------------- */
const rel_ini=$("#rel_ini"), rel_fim=$("#rel_fim"), rel_total=$("#rel_total"), rel_conf=$("#rel_conf");
const btnRelatorio=$("#btnRelatorio"), msgRelatorio=$("#msgRelatorio");
if(rel_ini && !rel_ini.value) rel_ini.value=todayISO();
if(rel_fim && !rel_fim.value) rel_fim.value=todayISO();

async function gerarRelatorio(){
  if(!ACTIVE_PROJECT_ID){ showMsg(msgRelatorio,"Ative um projeto.",false); return; }
  const ini=rel_ini?.value||todayISO(), fim=rel_fim?.value||todayISO();

  const extr=(await fetchAll(`projects/${ACTIVE_PROJECT_ID}/ensaios_extr_gran`)).filter(a=>a.data>=ini && a.data<=fim);
  const mar=(await fetchAll(`projects/${ACTIVE_PROJECT_ID}/ensaios_marshall`)).filter(a=>a.data>=ini && a.data<=fim);
  const rt=(await fetchAll(`projects/${ACTIVE_PROJECT_ID}/ensaios_rt`)).filter(a=>a.data>=ini && a.data<=fim);
  const se=(await fetchAll(`projects/${ACTIVE_PROJECT_ID}/ensaios_se`)).filter(a=>a.data>=ini && a.data<=fim);

  const total=extr.length+mar.length+rt.length+se.length;
  const conf=[...extr,...mar,...rt,...se].filter(r=>r.status==="CONFORME").length;

  if(rel_total) rel_total.textContent=String(total);
  if(rel_conf) rel_conf.textContent= total ? `${Math.round((conf/total)*100)}%` : "—";

  const w=window.open("", "_blank");
  const proj=escapeHtml(ACTIVE_PROJECT?.nome||"");
  w.document.write(`
    <html><head><meta charset="utf-8"/>
    <title>Relatório SGLAA</title>
    <style>
      body{font-family:Arial;padding:18px}
      h1{font-size:18px;margin:0}
      .sub{margin:6px 0 14px;color:#444}
      table{width:100%;border-collapse:collapse;font-size:12px;margin-top:10px}
      th,td{border:1px solid #ccc;padding:6px}
      th{background:#eee;text-align:left}
    </style></head>
    <body>
      <h1>Relatório – Controle Tecnológico</h1>
      <div class="sub">Projeto: <b>${proj}</b> • Período: <b>${ini}</b> a <b>${fim}</b> • Total: <b>${total}</b> • Conformes: <b>${conf}</b></div>

      <h3>Extração + Granulometria</h3>
      <table>
        <thead><tr><th>Data</th><th>Lote</th><th>Téc.</th><th>Pb</th><th>P200</th><th>Status</th></tr></thead>
        <tbody>
          ${extr.length? extr.map(a=>`<tr><td>${escapeHtml(a.data||"")}</td><td>${escapeHtml(a.lote||"—")}</td><td>${escapeHtml(a.tecnico||"—")}</td><td>${a.pb??"—"}</td><td>${a.p200??"—"}</td><td>${escapeHtml(a.status||"—")}</td></tr>`).join("") : `<tr><td colspan="6">Sem dados</td></tr>`}
        </tbody>
      </table>

      <h3>Marshall</h3>
      <table>
        <thead><tr><th>Data</th><th>Lote</th><th>Gmb</th><th>Gmm</th><th>Vv</th><th>VAM</th><th>RBV</th><th>Status</th></tr></thead>
        <tbody>
          ${mar.length? mar.map(a=>`<tr><td>${escapeHtml(a.data||"")}</td><td>${escapeHtml(a.lote||"—")}</td><td>${a.gmb??"—"}</td><td>${a.gmm??"—"}</td><td>${a.vv??"—"}</td><td>${a.vam??"—"}</td><td>${a.rbv??"—"}</td><td>${escapeHtml(a.status||"—")}</td></tr>`).join("") : `<tr><td colspan="8">Sem dados</td></tr>`}
        </tbody>
      </table>

      <h3>RT</h3>
      <table>
        <thead><tr><th>Data</th><th>Lote</th><th>RT</th><th>Status</th></tr></thead>
        <tbody>
          ${rt.length? rt.map(a=>`<tr><td>${escapeHtml(a.data||"")}</td><td>${escapeHtml(a.lote||"—")}</td><td>${a.rt??"—"}</td><td>${escapeHtml(a.status||"—")}</td></tr>`).join("") : `<tr><td colspan="4">Sem dados</td></tr>`}
        </tbody>
      </table>

      <h3>Equivalente de Areia</h3>
      <table>
        <thead><tr><th>Data</th><th>Lote</th><th>SE</th><th>Status</th></tr></thead>
        <tbody>
          ${se.length? se.map(a=>`<tr><td>${escapeHtml(a.data||"")}</td><td>${escapeHtml(a.lote||"—")}</td><td>${a.se??"—"}</td><td>${escapeHtml(a.status||"—")}</td></tr>`).join("") : `<tr><td colspan="4">Sem dados</td></tr>`}
        </tbody>
      </table>

      <script>window.onload=()=>window.print()</script>
    </body></html>
  `);
  w.document.close();
  showMsg(msgRelatorio,"Relatório gerado (abrindo impressão).",true);
}
if(btnRelatorio) btnRelatorio.addEventListener("click", gerarRelatorio);

/* ---- Active project load ---- */
function updateKPIsEmpty(){
  if(kpiEnsaios) kpiEnsaios.textContent="—";
  if(kpiConformes) kpiConformes.textContent="—";
}

async function refreshActiveProject(){
  const snap = await getDoc(activeRef);
  ACTIVE_PROJECT_ID = snap.exists()? (snap.data().projectId || null) : null;

  if(!ACTIVE_PROJECT_ID){
    ACTIVE_PROJECT=null;
    setActiveText("Projeto ativo: (nenhum)");
    rebuildEnsaioSieveTable();
    calcExtrGranu();
    updateKPIsEmpty();
    stopLists();
    return;
  }

  const pSnap = await getDoc(doc(db,"projects",ACTIVE_PROJECT_ID));
  ACTIVE_PROJECT = pSnap.exists()? pSnap.data() : null;
  setActiveText("Projeto ativo: " + (ACTIVE_PROJECT?.nome || "(sem nome)"));

  rebuildEnsaioSieveTable();
  calcExtrGranu();
  calcRice();
  calcMarshall();
  calcRT();
  calcSE();
  watchLists();
}

/* connect state */
setConn("Online (Firestore)", true);
setActiveText("Projeto ativo: (carregando)");
refreshActiveProject().catch(()=>{});

onSnapshot(activeRef, async ()=>{ await refreshActiveProject(); });
import {
  getFirestore, collection, addDoc, deleteDoc, doc,
  onSnapshot, query, orderBy, serverTimestamp,
  setDoc, getDoc, limit
} from "https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js";

/* Firebase */
const firebaseConfig = {
