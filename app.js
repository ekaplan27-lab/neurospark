// ════════════════════════════════════════
//  FIREBASE CONFIG — fill in your values here
// ════════════════════════════════════════
const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyAADvCeIajFPJyP1KWFHIK7Nhue2rtRuRo",
  authDomain:        "neurospark-5f11f.firebaseapp.com",
  projectId:         "neurospark-5f11f",
  storageBucket:     "neurospark-5f11f.firebasestorage.app",
  messagingSenderId: "537112070026",
  appId:             "1:537112070026:web:2174ab27029ba0d9806a73"
};

const _configOk = Object.values(FIREBASE_CONFIG).every(v => !String(v).includes('PASTE_YOUR'));
let db = null;
if (_configOk && typeof firebase !== 'undefined') {
  try { firebase.initializeApp(FIREBASE_CONFIG); db = firebase.firestore(); }
  catch(e) { console.warn('Firebase init failed, using localStorage:', e); }
}

// ════════════════════════════════════════
//  STORAGE HELPERS — Firebase or localStorage fallback
// ════════════════════════════════════════
async function fsGet(collection, docId) {
  if (db) {
    try {
      const snap = await db.collection(collection).doc(docId).get();
      return snap.exists ? snap.data().value : null;
    } catch(e) { return null; }
  }
  return localStorage.getItem('ns::' + collection + '::' + docId);
}

async function fsSet(collection, docId, value) {
  if (db) {
    try { await db.collection(collection).doc(docId).set({ value, updatedAt: Date.now() }); }
    catch(e) { console.warn('fsSet error', e); }
  } else {
    localStorage.setItem('ns::' + collection + '::' + docId, value);
  }
}

async function fsList(collection) {
  if (db) {
    try {
      const snap = await db.collection(collection).get();
      return snap.docs.map(d => ({ id: d.id, value: d.data().value }));
    } catch(e) { return []; }
  }
  const prefix = 'ns::' + collection + '::';
  return Object.keys(localStorage)
    .filter(k => k.startsWith(prefix))
    .map(k => ({ id: k.replace(prefix, ''), value: localStorage.getItem(k) }));
}

async function fsDelete(collection, docId) {
  if (db) {
    try { await db.collection(collection).doc(docId).delete(); } catch(e) {}
  } else {
    localStorage.removeItem('ns::' + collection + '::' + docId);
  }
}

// ════════════════════════════════════════
//  AUTH & PERSISTENT STORAGE
// ════════════════════════════════════════
const RESEARCHER_PASSWORD = 'research2024';
let currentUser = null;
let isResearcher = false;
let isDemoMode = false;

function switchAuthTab(tab) {
  document.querySelectorAll('.auth-tab').forEach((t,i)=>{
    t.classList.toggle('active',['login','register','researcher'][i]===tab);
  });
  ['login','register','researcher'].forEach(f=>document.getElementById('form-'+f).classList.toggle('hidden',f!==tab));
  document.querySelectorAll('.auth-tab')[1].style.display = tab==='researcher'?'none':'';
}

async function doLogin() {
  const pid=document.getElementById('l-pid').value.trim();
  const pass=document.getElementById('l-pass').value;
  const err=document.getElementById('l-err');
  err.textContent='';
  if(!pid||!pass){err.textContent='Please fill in all fields.';return;}
  try {
    const stored = await fsGet('ns-users', pid.toLowerCase());
    if(!stored){err.textContent='❌ No account found with that Participant ID.';return;}
    const user = JSON.parse(stored);
    if(user.password!==btoa(pass)){err.textContent='❌ Incorrect password.';return;}
    currentUser=user;
    await loadUserData(pid.toLowerCase());
    enterApp();
  } catch(e){err.textContent='❌ Error signing in. Please try again.';console.error(e);}
}

async function doRegister() {
  const pid=document.getElementById('r-pid').value.trim();
  const name=document.getElementById('r-name').value.trim();
  const age=document.getElementById('r-age').value.trim();
  const gender=document.getElementById('r-gender').value;
  const pass=document.getElementById('r-pass').value;
  const pass2=document.getElementById('r-pass2').value;
  const err=document.getElementById('r-err');
  err.textContent='';
  if(!pid||!name||!age||!gender||!pass){err.textContent='Please fill in all required fields.';return;}
  if(pass!==pass2){err.textContent='❌ Passwords do not match.';return;}
  if(pass.length<4){err.textContent='❌ Password must be at least 4 characters.';return;}
  try {
    const existing = await fsGet('ns-users', pid.toLowerCase());
    if(existing){err.textContent='❌ That Participant ID is already taken.';return;}
    const user={pid:pid.toLowerCase(),displayPid:pid,name,age:parseInt(age),gender,password:btoa(pass),joinedTs:new Date().toISOString()};
    await fsSet('ns-users', pid.toLowerCase(), JSON.stringify(user));
    const idxRaw = await fsGet('ns-meta', 'participant-index');
    let index = idxRaw ? JSON.parse(idxRaw) : [];
    if(!index.includes(pid.toLowerCase())) index.push(pid.toLowerCase());
    await fsSet('ns-meta', 'participant-index', JSON.stringify(index));
    currentUser=user;
    enterApp();
  } catch(e){err.textContent='❌ Error creating account. Please try again.';}
}

function doResearcherLogin() {
  const pass=document.getElementById('res-pass').value;
  const err=document.getElementById('res-err');
  err.textContent='';
  if(pass!==RESEARCHER_PASSWORD){err.textContent='❌ Incorrect researcher password.';return;}
  isResearcher=true;
  document.getElementById('auth-screen').style.display='none';
  showResearcherDashboard();
}

async function loadUserData(pidKey) {
  try {
    const saved = await fsGet('ns-sessions', pidKey);
    if(saved){
      const data = JSON.parse(saved);
      sessionLog=data.sessionLog||[];
      brainScore=data.brainScore||0;
      sessionLog.forEach(r=>{playCount[r.key]=(playCount[r.key]||0)+1;});
    }
  } catch(e){sessionLog=[];brainScore=0;}
}

async function saveUserData() {
  if(!currentUser || isDemoMode) return;
  try {
    await fsSet('ns-sessions', currentUser.pid, JSON.stringify({sessionLog, brainScore}));
    const summary={pid:currentUser.displayPid,name:currentUser.name,age:currentUser.age,
      gender:currentUser.gender,joinedTs:currentUser.joinedTs,
      sessionCount:sessionLog.length,
      bestScore:sessionLog.length?Math.max(...sessionLog.map(r=>r.score)):0,
      sessions:sessionLog};
    await fsSet('ns-summaries', currentUser.pid, JSON.stringify(summary));
  } catch(e){}
}

function enterApp() {
  document.getElementById('auth-screen').style.display='none';
  playerName=currentUser.name;
  document.getElementById('header-user').style.display='flex';
  document.getElementById('header-username').textContent=currentUser.displayPid+' · '+currentUser.name;
  document.getElementById('pname').textContent=currentUser.name;
  document.getElementById('pjoined').textContent='Joined '+new Date(currentUser.joinedTs).toLocaleDateString();
  refreshTrainStats();
  updateGameCardButtons();
  if(brainScore>0){
    document.getElementById('bscore').textContent=brainScore;
    document.getElementById('ring').style.strokeDashoffset=CIRC-Math.min(brainScore/2000,1)*CIRC;
  }
  checkGameLock('memory',document.getElementById('mbtn'),document.getElementById('mem-limit'));
  checkGameLock('sequence',document.getElementById('sbtn'),document.getElementById('seq-limit'));
  checkGameLock('speed',document.getElementById('fbtn'),document.getElementById('spd-limit'));
}

function logout(){currentUser=null;isResearcher=false;isDemoMode=false;window.location.reload();}

function enterDemoMode() {
  isDemoMode = true;
  isResearcher = false;
  currentUser = {
    pid: 'demo',
    displayPid: 'DEMO',
    name: 'Demo Researcher',
    age: '',
    gender: '',
    joinedTs: Date.now()
  };
  sessionLog = [];
  brainScore = 0;
  Object.keys(playCount).forEach(k => playCount[k] = 0);
  document.querySelector('nav').style.display = '';
  // Hide researcher dashboard and all pages before entering
  document.getElementById('page-researcher').style.display = 'none';
  document.querySelectorAll('.page').forEach(p => { p.style.display = 'none'; p.classList.remove('active'); });
  // Call the exact same function a real participant login calls
  enterApp();
  // Swap Sign Out for Back to Dashboard — same spot, same style
  document.getElementById('signout-btn').style.display = 'none';
  document.getElementById('demo-back-btn').style.display = 'inline-block';
  // Make train page active like a fresh login
  document.getElementById('page-train').style.display = 'block';
  document.getElementById('page-train').classList.add('active');
}

function exitDemoMode() {
  isDemoMode = false;
  currentUser = null;
  isResearcher = true;
  sessionLog = [];
  brainScore = 0;
  Object.keys(playCount).forEach(k => playCount[k] = 0);
  const exitBtn = document.getElementById('demo-exit-float');
  if (exitBtn) exitBtn.style.display = 'none';
  document.getElementById('demo-back-btn').style.display = 'none';
  document.getElementById('signout-btn').style.display = 'inline-block';
  document.getElementById('header-username').textContent = '🔬 Researcher';
  document.querySelector('nav').style.display = 'none';
  document.querySelectorAll('.page').forEach(p => p.style.display = 'none');
  document.getElementById('page-researcher').style.display = 'block';
  showResearcherDashboard();
}

// ── auto-refresh interval handle ──
let _rInterval = null;
let _rCharts = {};

async function showResearcherDashboard() {
  document.querySelectorAll('.page').forEach(p=>p.style.display='none');
  document.getElementById('page-researcher').style.display='block';
  document.getElementById('header-user').style.display='flex';
  document.getElementById('header-username').textContent='🔬 Researcher';
  document.querySelector('nav').style.display='none';
  await _loadAndRender();
  // auto-refresh every 30 seconds while researcher is viewing
  if(_rInterval) clearInterval(_rInterval);
  _rInterval = setInterval(_loadAndRender, 30000);
  // update the countdown badge
  _startRefreshCountdown();
}

async function _loadAndRender() {
  const idxRaw = await fsGet('ns-meta', 'participant-index');
  const index = idxRaw ? JSON.parse(idxRaw) : [];
  const participants = [];
  for(const pid of index){
    const s = await fsGet('ns-summaries', pid);
    if(s) participants.push(JSON.parse(s));
  }
  renderResearcherDashboard(participants);
}

let _countdownHandle = null;
function _startRefreshCountdown() {
  if(_countdownHandle) clearInterval(_countdownHandle);
  let secs = 30;
  const el = document.getElementById('r-refresh-badge');
  if(!el) return;
  el.textContent = `🔄 Refreshes in ${secs}s`;
  _countdownHandle = setInterval(()=>{
    secs--;
    if(secs <= 0) secs = 30;
    if(el) el.textContent = `🔄 Refreshes in ${secs}s`;
  }, 1000);
}

function rManualRefresh() {
  _loadAndRender();
  let secs = 30;
  const el = document.getElementById('r-refresh-badge');
  if(_countdownHandle) clearInterval(_countdownHandle);
  if(el) el.textContent = `🔄 Refreshes in ${secs}s`;
  _countdownHandle = setInterval(()=>{
    secs--;
    if(secs <= 0) secs = 30;
    if(el) el.textContent = `🔄 Refreshes in ${secs}s`;
  }, 1000);
}

function stopResearcherRefresh() {
  if(_rInterval) { clearInterval(_rInterval); _rInterval = null; }
  if(_countdownHandle) { clearInterval(_countdownHandle); _countdownHandle = null; }
}

function renderResearcherDashboard(participants) {
  // ── summary numbers ──
  const totalSessions = participants.reduce((a,p)=>a+p.sessionCount,0);
  const allScores = participants.flatMap(p=>p.sessions.map(s=>s.score));
  const bestScore = allScores.length ? Math.max(...allScores) : 0;
  const avgScore  = allScores.length ? Math.round(allScores.reduce((a,b)=>a+b,0)/allScores.length) : 0;
  const totalSecs = participants.flatMap(p=>p.sessions.map(s=>s.duration||0)).reduce((a,b)=>a+b,0);

  document.getElementById('r-summary').innerHTML=`
    <div class="sum-card"><div class="sc-label">Participants</div><div class="sc-val c-accent">${participants.length}</div><div class="sc-sub">registered</div></div>
    <div class="sum-card"><div class="sc-label">Total Sessions</div><div class="sc-val c-green">${totalSessions}</div><div class="sc-sub">across all users</div></div>
    <div class="sum-card"><div class="sc-label">Best Score</div><div class="sc-val" style="color:var(--gold)">${bestScore.toLocaleString()}</div><div class="sc-sub">all participants</div></div>
    <div class="sum-card"><div class="sc-label">Avg Score</div><div class="sc-val c-orange">${avgScore.toLocaleString()}</div><div class="sc-sub">per session</div></div>
    <div class="sum-card"><div class="sc-label">Total Play Time</div><div class="sc-val c-accent">${Math.floor(totalSecs/60)}m</div><div class="sc-sub">${totalSecs}s total</div></div>`;

  // ── charts ──
  _renderCharts(participants);

  // ── participants table ──
  const tbody = document.getElementById('r-tbody');
  const empty = document.getElementById('r-empty');
  tbody.innerHTML='';
  if(!participants.length){empty.style.display='block';}
  else {
    empty.style.display='none';
    participants.forEach((p,pi)=>{
      const joinDate=new Date(p.joinedTs).toLocaleDateString();
      const avgP = p.sessions.length ? Math.round(p.sessions.reduce((a,s)=>a+s.score,0)/p.sessions.length) : 0;
      tbody.innerHTML+=`<tr>
        <td><span class="user-chip">🆔 ${p.pid}</span></td>
        <td style="font-weight:600">${p.name}</td><td>${p.age}</td><td>${p.gender}</td>
        <td>${p.sessionCount}</td>
        <td class="hi-score">${p.bestScore.toLocaleString()}</td>
        <td style="color:var(--muted)">${avgP.toLocaleString()}</td>
        <td style="color:var(--muted);font-size:0.75rem">${joinDate}</td>
        <td style="display:flex;gap:6px;align-items:center;">
          <button class="r-expand-btn" onclick="toggleDetail(${pi})">▶ Details</button>
          <button class="r-expand-btn" style="color:var(--warn);border-color:rgba(255,107,74,0.3);" onclick="clearParticipantData('${p.pid}','${p.name}')">🗑 Clear</button>
        </td>
      </tr>
      <tr class="r-detail-row" id="detail-row-${pi}"><td colspan="9"><div class="r-detail-inner" id="detail-${pi}">${buildDetailTable(p)}</div></td></tr>`;
    });
  }

  // ── all sessions table ──
  const allSessions=participants.flatMap(p=>p.sessions.map(s=>({...s,pName:p.name,pPid:p.pid})));
  allSessions.sort((a,b)=>new Date(b.ts)-new Date(a.ts));
  const stbody=document.getElementById('r-sessions-tbody');
  const sempty=document.getElementById('r-sessions-empty');
  stbody.innerHTML='';
  if(!allSessions.length){sempty.style.display='block';}
  else {
    sempty.style.display='none';
    allSessions.forEach((r,i)=>{
      const m=GM[r.key]||{name:r.key,icon:'🎮',badge:'b-mem',extraLbl:'Detail'};
      const timeStr=new Date(r.ts).toLocaleString([],{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'});
      stbody.innerHTML+=`<tr>
        <td style="color:var(--muted);font-size:0.75rem">#${allSessions.length-i}</td>
        <td><span class="user-chip">🆔 ${r.pPid}</span> ${r.pName}</td>
        <td><span class="badge ${m.badge}">${m.icon} ${m.name}</span></td>
        <td class="hi-score">${r.score.toLocaleString()}</td>
        <td style="color:var(--muted)">${fmtT(r.duration)}</td>
        <td style="color:var(--muted);font-size:0.78rem">${m.extraLbl}: <strong style="color:var(--text)">${r.extra}</strong></td>
        <td style="color:var(--muted);font-size:0.75rem">${timeStr}</td>
      </tr>`;
    });
  }
  window._researcherParticipants=participants;
}

function _renderCharts(participants) {
  const allSessions = participants.flatMap(p=>p.sessions.map(s=>({...s,pName:p.name,pPid:p.pid,age:p.age,gender:p.gender})));
  if(!allSessions.length) {
    document.getElementById('r-charts').style.display='none';
    return;
  }
  document.getElementById('r-charts').style.display='block';

  // destroy old charts
  Object.values(_rCharts).forEach(c=>{try{c.destroy();}catch(e){}});
  _rCharts={};

  Chart.defaults.color='#6b7a99';
  Chart.defaults.borderColor='rgba(255,255,255,0.06)';

  // 1. Scores over time (line)
  const sorted=[...allSessions].sort((a,b)=>new Date(a.ts)-new Date(b.ts));
  const timeLabels=sorted.map((_,i)=>`#${i+1}`);
  const timeScores=sorted.map(s=>s.score);
  const avgLine=timeScores.map((_,i)=>Math.round(timeScores.slice(0,i+1).reduce((a,b)=>a+b,0)/(i+1)));
  _rCharts.timeline=new Chart(document.getElementById('r-chart-timeline'),{
    type:'line',
    data:{labels:timeLabels,datasets:[
      {label:'Score',data:timeScores,borderColor:'#4f8aff',backgroundColor:'rgba(79,138,255,0.08)',pointRadius:3,pointBackgroundColor:'#4f8aff',tension:0.3,fill:true},
      {label:'Running Avg',data:avgLine,borderColor:'#00e5b0',borderDash:[5,4],pointRadius:0,tension:0.3,fill:false}
    ]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{boxWidth:12,font:{family:'DM Sans',size:11}}}},scales:{x:{ticks:{maxTicksLimit:10,font:{size:10}}},y:{beginAtZero:true,ticks:{font:{size:10}}}}}
  });

  // 2. Sessions per game (bar)
  const gameCounts={};
  allSessions.forEach(s=>{const n=GM[s.key]?GM[s.key].name:s.key; gameCounts[n]=(gameCounts[n]||0)+1;});
  const gameNames=Object.keys(gameCounts);
  const gameColors=gameNames.map(n=>{const e=Object.values(GM).find(g=>g.name===n);return e?e.color:'#4f8aff';});
  _rCharts.games=new Chart(document.getElementById('r-chart-games'),{
    type:'bar',
    data:{labels:gameNames,datasets:[{label:'Sessions',data:Object.values(gameCounts),backgroundColor:gameColors.map(c=>c+'33'),borderColor:gameColors,borderWidth:2,borderRadius:6}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{ticks:{font:{size:10}}},y:{beginAtZero:true,ticks:{stepSize:1,font:{size:10}}}}}
  });

  // 3. Avg score per game (horizontal bar)
  const gameScores={};
  allSessions.forEach(s=>{const n=GM[s.key]?GM[s.key].name:s.key;if(!gameScores[n])gameScores[n]=[];gameScores[n].push(s.score);});
  const avgGameNames=Object.keys(gameScores);
  const avgGameVals=avgGameNames.map(n=>Math.round(gameScores[n].reduce((a,b)=>a+b,0)/gameScores[n].length));
  const avgGameColors=avgGameNames.map(n=>{const e=Object.values(GM).find(g=>g.name===n);return e?e.color:'#4f8aff';});
  _rCharts.avgGame=new Chart(document.getElementById('r-chart-avggame'),{
    type:'bar',
    data:{labels:avgGameNames,datasets:[{label:'Avg Score',data:avgGameVals,backgroundColor:avgGameColors.map(c=>c+'33'),borderColor:avgGameColors,borderWidth:2,borderRadius:6}]},
    options:{indexAxis:'y',responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{beginAtZero:true,ticks:{font:{size:10}}},y:{ticks:{font:{size:10}}}}}
  });

  // 4. Score distribution by gender (grouped bar)
  const genders=[...new Set(participants.map(p=>p.gender).filter(Boolean))];
  const genderAvgs=genders.map(g=>{
    const sc=participants.filter(p=>p.gender===g).flatMap(p=>p.sessions.map(s=>s.score));
    return sc.length?Math.round(sc.reduce((a,b)=>a+b,0)/sc.length):0;
  });
  const gColors=['#4f8aff','#a259ff','#00e5b0','#ff6bc8','#ffcc44'];
  _rCharts.gender=new Chart(document.getElementById('r-chart-gender'),{
    type:'doughnut',
    data:{labels:genders,datasets:[{data:genderAvgs,backgroundColor:gColors.slice(0,genders.length).map(c=>c+'55'),borderColor:gColors.slice(0,genders.length),borderWidth:2}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom',labels:{boxWidth:12,font:{family:'DM Sans',size:11}}}}}
  });

  // 5. Score improvement: first vs last session per participant (scatter)
  const scatterData=participants.filter(p=>p.sessions.length>=2).map(p=>{
    const sorted=[...p.sessions].sort((a,b)=>new Date(a.ts)-new Date(b.ts));
    return{x:sorted[0].score, y:sorted[sorted.length-1].score, label:p.pid};
  });
  _rCharts.improve=new Chart(document.getElementById('r-chart-improve'),{
    type:'scatter',
    data:{datasets:[
      {label:'Participants',data:scatterData,backgroundColor:'rgba(162,89,255,0.5)',borderColor:'#a259ff',pointRadius:7,pointHoverRadius:9},
      {label:'No change line',data:[{x:0,y:0},{x:Math.max(...scatterData.map(d=>Math.max(d.x,d.y)),100)+200,y:Math.max(...scatterData.map(d=>Math.max(d.x,d.y)),100)+200}],type:'line',borderColor:'rgba(255,255,255,0.15)',borderDash:[4,4],pointRadius:0,fill:false}
    ]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{boxWidth:12,font:{family:'DM Sans',size:11}}},tooltip:{callbacks:{label:d=>d.raw.label?`${d.raw.label}: first=${d.raw.x} → last=${d.raw.y}`:''}}},scales:{x:{title:{display:true,text:'First Session Score',font:{size:10}},beginAtZero:true},y:{title:{display:true,text:'Most Recent Score',font:{size:10}},beginAtZero:true}}}
  });
}

function buildDetailTable(p) {
  if(!p.sessions.length)return'<p style="color:var(--muted);font-size:0.82rem;padding:8px 0">No sessions yet.</p>';
  const rows=p.sessions.map((r,i)=>{
    const m=GM[r.key]||{name:r.key,icon:'🎮',badge:'b-mem',extraLbl:'Detail'};
    const dt=new Date(r.ts).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
    return`<tr><td style="color:var(--muted);font-size:0.75rem">#${i+1}</td><td><span class="badge ${m.badge}">${m.icon} ${m.name}</span></td><td class="hi-score">${r.score.toLocaleString()}</td><td style="color:var(--muted)">${fmtT(r.duration)}</td><td style="color:var(--muted);font-size:0.75rem">${dt}</td></tr>`;
  }).join('');
  return`<table style="width:100%;border-collapse:collapse;font-size:0.8rem"><thead><tr><th style="text-align:left;padding:6px 10px;color:var(--muted);font-size:0.68rem">#</th><th style="text-align:left;padding:6px 10px;color:var(--muted);font-size:0.68rem">Game</th><th style="text-align:left;padding:6px 10px;color:var(--muted);font-size:0.68rem">Score</th><th style="text-align:left;padding:6px 10px;color:var(--muted);font-size:0.68rem">Duration</th><th style="text-align:left;padding:6px 10px;color:var(--muted);font-size:0.68rem">Time</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function toggleDetail(pi){
  const el=document.getElementById('detail-'+pi);
  const btn=document.querySelector(`#detail-row-${pi}`).previousElementSibling.querySelector('.r-expand-btn');
  el.classList.toggle('open');
  btn.textContent=el.classList.contains('open')?'▼ Hide':'▶ Details';
}

async function clearParticipantData(pid, name) {
  if(!confirm(`Clear all game data for ${name} (${pid})?\n\nTheir account will be kept, but all scores and sessions will be permanently deleted.`)) return;
  const pidLower = pid.toLowerCase();
  const blankSessions = JSON.stringify({sessionLog:[], brainScore:0});
  let user = {displayPid:pid, name, age:'—', gender:'—', joinedTs:new Date().toISOString()};
  try {
    const r = await fsGet('ns-users', pidLower);
    if(r) user = JSON.parse(r);
  } catch(e){}
  const blankSummary = JSON.stringify({
    pid: user.displayPid||pid, name: user.name||name,
    age: user.age, gender: user.gender, joinedTs: user.joinedTs,
    sessionCount:0, bestScore:0, sessions:[]
  });
  await fsSet('ns-sessions', pidLower, blankSessions);
  await fsSet('ns-summaries', pidLower, blankSummary);
  await showResearcherDashboard();
  alert(`✅ Data cleared for ${name}. Their account is still active and they can continue playing.`);
}

async function exportAllCSV(){
  const participants=window._researcherParticipants||[];
  if(!participants.length){alert('No data yet.');return;}
  const rows=[['Session','Participant_ID','Name','Age','Gender','Game','Score','Duration_s','Extra','Timestamp']];
  let n=1;
  participants.forEach(p=>{p.sessions.forEach(r=>{rows.push([n++,p.pid,p.name,p.age,p.gender,GM[r.key]?GM[r.key].name:r.key,r.score,r.duration,`${GM[r.key]?GM[r.key].extraLbl:'Detail'}: ${r.extra}`,r.ts]);});});
  const csv=rows.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));
  a.download=`neurospark_all_${new Date().toISOString().slice(0,10)}.csv`;a.click();
}

// ════════════════════════════════════════
//  DATA & GAME METADATA
// ════════════════════════════════════════
const GM={
  memory:{name:'Memory Match',icon:'🃏',color:'#4f8aff',badge:'b-mem',extraLbl:'Pairs Found'},
  sequence:{name:'Sequence',icon:'🔮',color:'#a259ff',badge:'b-seq',extraLbl:'Level Reached'},
  speed:{name:'Speed Find',icon:'⚡',color:'#00e5b0',badge:'b-spd',extraLbl:'Max Combo'},
  pv:{name:'Pattern Vault',icon:'🧩',color:'#4f8aff',badge:'b-pv',extraLbl:'Level Reached'},
  ff:{name:'Focus Filter',icon:'🔮',color:'#a259ff',badge:'b-ff',extraLbl:'Targets Hit'},
  rr:{name:'Rapid Recall',icon:'🌀',color:'#00e5b0',badge:'b-rr',extraLbl:'Questions'},
  ll:{name:'Logic Ladder',icon:'🎯',color:'#ff6b4a',badge:'b-ll',extraLbl:'Puzzles Solved'},
  np:{name:'Number Path',icon:'🔢',color:'#00cccc',badge:'b-np',extraLbl:'Level Reached'},
  ar:{name:'Arrow Rush',icon:'⬆️',color:'#ff6bc8',badge:'b-ar',extraLbl:'Best Streak'},
};
let sessionLog=[];
let brainScore=0;
let playerName='Player';
const CIRC=308;
const MAX_PLAYS=3;
const playCount={};
Object.keys(GM).forEach(k=>playCount[k]=0);

function getPlaysLeft(key){if(isDemoMode)return 999;return MAX_PLAYS-(playCount[key]||0);}
function isGameLocked(key){if(isDemoMode)return false;return(playCount[key]||0)>=MAX_PLAYS;}

function checkGameLock(key,btnEl,msgEl){
  if(isDemoMode){
    if(btnEl){btnEl.disabled=false;btnEl.style.opacity='';btnEl.style.cursor='';btnEl.textContent='▶ Start Game';}
    if(msgEl)msgEl.style.display='none';
    return false;
  }
  const left=getPlaysLeft(key);
  if(left<=0){
    if(btnEl){btnEl.disabled=true;btnEl.textContent='🔒 Limit Reached (3/3)';btnEl.style.opacity='0.45';btnEl.style.cursor='not-allowed';}
    if(msgEl)msgEl.style.display='block';
    return true;
  }
  if(btnEl){
    btnEl.disabled=false;btnEl.style.opacity='';btnEl.style.cursor='';
    if((playCount[key]||0)>0)btnEl.textContent=`↺ Play Again (${left} left)`;
  }
  return false;
}

function updateGameCardButtons(){
  document.querySelectorAll('[onclick^="openOv("]').forEach(btn=>{
    const m=btn.getAttribute('onclick').match(/openOv\('(\w+)'\)/);
    if(!m)return;
    const g=m[1];const left=getPlaysLeft(g);
    if(left<=0){btn.disabled=true;btn.textContent='🔒 Limit Reached';btn.style.opacity='0.45';btn.style.cursor='not-allowed';}
    else{btn.disabled=false;btn.style.opacity='';btn.style.cursor='';if((playCount[g]||0)>0)btn.textContent=`▶ Play (${left} left)`;}
  });
}

function recordSession(key,score,durSecs,extra){
  // Guard against accidentally storing milliseconds instead of seconds
  // Any duration over 3600s (1 hour) per session is almost certainly ms
  const safeDur = durSecs > 3600 ? Math.round(durSecs/1000) : Math.round(durSecs);
  if(!isDemoMode) playCount[key]=(playCount[key]||0)+1;
  sessionLog.push({key,score,duration:safeDur,extra,ts:new Date().toISOString()});
  refreshTrainStats();updateGameCardButtons();checkAchievements();saveUserData();
  const _todayStr = new Date().toDateString();
  const _todayCount = sessionLog.filter(r => new Date(r.ts).toDateString() === _todayStr).length;
  document.getElementById('streakDays').textContent = _todayCount;
  const bests={pvb:'pv',ffb:'ff',rrb:'rr',llb:'ll',npb:'np',arb:'ar'};
  Object.entries(bests).forEach(([elId,k])=>{
    const rows=sessionLog.filter(r=>r.key===k);
    if(rows.length)document.getElementById(elId).textContent=Math.max(...rows.map(r=>r.score));
  });
  checkGameLock('memory',document.getElementById('mbtn'),document.getElementById('mem-limit'));
  checkGameLock('sequence',document.getElementById('sbtn'),document.getElementById('seq-limit'));
  checkGameLock('speed',document.getElementById('fbtn'),document.getElementById('spd-limit'));
}

function getStats(key){
  const rows=sessionLog.filter(r=>r.key===key);if(!rows.length)return null;
  const scores=rows.map(r=>r.score);
  return{plays:rows.length,best:Math.max(...scores),avg:Math.round(scores.reduce((a,b)=>a+b,0)/scores.length),totalSecs:rows.reduce((a,r)=>a+r.duration,0),history:scores.slice(-12)};
}
function totalSecs(){return sessionLog.reduce((a,r)=>a+r.duration,0);}
function fmtT(s){if(s<60)return s+'s';const h=Math.floor(s/3600),m=Math.floor((s%3600)/60),r=s%60;if(h>0)return h+'h '+(m?m+'m':'');return m+'m'+(r?' '+r+'s':'');}

function refreshTrainStats(){
  const n=sessionLog.length;const best=n?Math.max(...sessionLog.map(r=>r.score)):0;const tot=sessionLog.reduce((a,r)=>a+r.score,0);
  document.getElementById('t-games').textContent=n;document.getElementById('t-best').textContent=best;
  document.getElementById('t-total').textContent=tot;document.getElementById('t-time').textContent=fmtT(totalSecs());
}

function checkAchievements(){
  const n=sessionLog.length;
  document.getElementById('ach-1').classList.toggle('locked',n<1);
  document.getElementById('ach-5').classList.toggle('locked',n<5);
  document.getElementById('ach-10').classList.toggle('locked',n<10);
  document.getElementById('ach-bs').classList.toggle('locked',brainScore<1000);
}

// ════════════ NAVIGATION ════════════
function showPage(name,el){
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('nav a').forEach(a=>a.classList.remove('active'));
  document.getElementById('page-'+name).classList.add('active');
  if(el)el.classList.add('active');
  if(name==='insights')renderInsights();
  if(name==='profile')renderProfile();
}

// ════════════ INSIGHTS ════════════
function renderInsights(){
  const n=sessionLog.length;const best=n?Math.max(...sessionLog.map(r=>r.score)):0;const avg=n?Math.round(sessionLog.reduce((a,r)=>a+r.score,0)/n):0;
  document.getElementById('i-total').textContent=n;document.getElementById('i-best').textContent=best;
  document.getElementById('i-avg').textContent=avg;document.getElementById('i-time').textContent=fmtT(totalSecs());
  const gc=document.getElementById('game-cards');gc.innerHTML='';let any=false;
  Object.keys(GM).forEach(k=>{
    const st=getStats(k);if(!st)return;any=true;const m=GM[k];const mx=st.best||1;
    const bars=st.history.map(s=>`<div style="height:${Math.max(8,Math.round(s/mx*100))}%;background:${m.color};opacity:0.75;flex:1;border-radius:3px 3px 0 0;min-height:3px"></div>`).join('');
    const _playsLabel = k==='ar' ? `${st.plays} plays` : `${st.plays}/3 plays`;
    gc.innerHTML+=`<div class="gcard"><div class="gcard-top"><div class="gcard-name">${m.icon} ${m.name}</div><div class="gcard-plays">${_playsLabel}</div></div>
      <div class="gcard-stats">
        <div class="gcs"><div class="gcs-val" style="color:${m.color}">${st.best}</div><div class="gcs-lbl">Best</div></div>
        <div class="gcs"><div class="gcs-val">${st.avg}</div><div class="gcs-lbl">Avg</div></div>
        <div class="gcs"><div class="gcs-val">${fmtT(st.totalSecs)}</div><div class="gcs-lbl">Time</div></div>
      </div>
      <div class="spark-label">Score history:</div>
      <div class="spark" style="height:42px;align-items:flex-end">${bars}</div></div>`;
  });
  document.getElementById('no-game-data').style.display=any?'none':'block';
  const tbody=document.getElementById('hist-body');const empty=document.getElementById('hist-empty');
  tbody.innerHTML='';if(!n){empty.style.display='block';return;}empty.style.display='none';
  [...sessionLog].reverse().forEach((r,i)=>{
    const m=GM[r.key];const timeStr=new Date(r.ts).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
    tbody.innerHTML+=`<tr><td style="color:var(--muted);font-size:0.75rem">#${n-i}</td>
      <td><span class="badge ${m.badge}">${m.icon} ${m.name}</span></td>
      <td class="hi-score">${r.score.toLocaleString()}</td>
      <td style="color:var(--muted)">${fmtT(r.duration)}</td>
      <td style="color:var(--muted);font-size:0.78rem">${m.extraLbl}: <strong style="color:var(--text)">${r.extra}</strong></td>
      <td style="color:var(--muted);font-size:0.75rem">${timeStr}</td></tr>`;
  });
}

// ════════════ PROFILE ════════════
function renderProfile(){
  const n=sessionLog.length;const best=n?Math.max(...sessionLog.map(r=>r.score)):0;const tot=sessionLog.reduce((a,r)=>a+r.score,0);
  document.getElementById('p-games').textContent=n;document.getElementById('p-best').textContent=best;
  document.getElementById('p-total').textContent=tot;document.getElementById('p-time').textContent=fmtT(totalSecs());
  document.getElementById('pname').textContent=playerName;
  const pl=document.getElementById('perf-list');pl.innerHTML='';
  const withData=Object.keys(GM).map(k=>({k,m:GM[k],st:getStats(k)})).filter(x=>x.st);
  if(!withData.length){pl.innerHTML='<p style="color:var(--muted);font-size:0.85rem">Play some games to see your performance!</p>';}
  else{
    const mx=Math.max(...withData.map(x=>x.st.best));
    withData.sort((a,b)=>b.st.best-a.st.best).forEach(x=>{
      const pct=Math.round(x.st.best/mx*100);
      pl.innerHTML+=`<div class="perf-item"><div class="perf-em">${x.m.icon}</div>
        <div class="perf-mid"><div class="perf-name-row"><span class="perf-name-txt">${x.m.name}</span>
          <span class="perf-plays">${x.st.plays}/3 plays · avg ${x.st.avg}</span></div>
          <div class="perf-bar-bg"><div class="perf-bar-fg" style="width:${pct}%;background:${x.m.color}"></div></div>
        </div><div class="perf-best" style="color:${x.m.color}">${x.st.best}</div></div>`;
    });
  }
  const pbl=document.getElementById('pb-list');pbl.innerHTML='';
  const medals=['🥇','🥈','🥉'];
  const top3=[...withData].sort((a,b)=>b.st.best-a.st.best).slice(0,3);
  if(!top3.length){pbl.innerHTML='<p style="color:var(--muted);font-size:0.85rem">Your top scores will appear here after playing!</p>';return;}
  top3.forEach((x,i)=>{
    pbl.innerHTML+=`<div class="pb-card"><div class="pb-medal">${medals[i]}</div>
      <div class="pb-info"><h3>${x.m.icon} ${x.m.name}</h3><p>${x.st.plays} sessions · avg ${x.st.avg}</p></div>
      <div class="pb-score"><div class="pb-score-val">${x.st.best.toLocaleString()}</div><div class="pb-score-lbl">best score</div></div></div>`;
  });
}

function exportCSV(){
  if(!sessionLog.length){alert('No data yet!');return;}
  const rows=[['Session','Player','Game','Score','Duration_s','Extra','Timestamp']];
  sessionLog.forEach((r,i)=>rows.push([i+1,playerName,GM[r.key].name,r.score,r.duration,`${GM[r.key].extraLbl}: ${r.extra}`,r.ts]));
  const csv=rows.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));
  a.download=`neurospark_${playerName.replace(/\s+/g,'_')}_${new Date().toISOString().slice(0,10)}.csv`;a.click();
}

// ════════════ BRAIN RING ════════════
function addBrain(pts){
  if(!pts||pts<=0)return;
  const prev=brainScore;brainScore+=Math.round(pts*0.1);
  const el=document.getElementById('bscore'),ring=document.getElementById('ring');
  const t0=Date.now(),from=prev,to=brainScore;
  (function tick(){const p=Math.min((Date.now()-t0)/1200,1),e=1-Math.pow(1-p,3),cur=Math.round(from+(to-from)*e);el.textContent=cur;ring.style.strokeDashoffset=CIRC-Math.min(cur/2000,1)*CIRC;if(p<1)requestAnimationFrame(tick);})();
  const toast=document.createElement('div');toast.textContent='+'+Math.round(pts*0.1)+' pts';
  toast.style.cssText='position:fixed;top:76px;right:50px;z-index:9999;background:linear-gradient(135deg,#4f8aff,#a259ff);color:#fff;font-family:Syne,sans-serif;font-weight:800;font-size:1rem;padding:8px 18px;border-radius:28px;pointer-events:none;transition:transform 1.4s ease,opacity 1.4s ease;';
  document.body.appendChild(toast);
  requestAnimationFrame(()=>requestAnimationFrame(()=>{toast.style.transform='translateY(-55px)';toast.style.opacity='0';}));
  setTimeout(()=>toast.remove(),1500);
}

// ════════════ MODAL ════════════
let _replay=null;
function showModal(emoji,title,score,sub,replayFn){
  document.getElementById('me').textContent=emoji;document.getElementById('mt2').textContent=title;
  document.getElementById('msc').textContent=score;document.getElementById('msub').textContent=sub;
  document.getElementById('modal').classList.add('show');_replay=replayFn;addBrain(score);
  const replayBtn=document.getElementById('modal-replay');
  if(replayBtn&&curGame){
    const left=getPlaysLeft(curGame);
    if(left<=0){replayBtn.disabled=true;replayBtn.textContent='🔒 Limit Reached (3/3)';replayBtn.style.opacity='0.45';replayBtn.style.cursor='not-allowed';}
    else{replayBtn.disabled=false;replayBtn.textContent=`Play Again ↺ (${left} left)`;replayBtn.style.opacity='';replayBtn.style.cursor='';}
  }
}
function closeModal(){document.getElementById('modal').classList.remove('show');}
function replayModal(){if(curGame&&isGameLocked(curGame))return;closeModal();if(_replay){const fn=_replay;_replay=null;fn();}}

// ════════════ GAME SWITCHER ════════════
function switchGame(n){
  clearInterval(mState.iv);mState.iv=null;clearInterval(fState.iv);fState.iv=null;sState.playing=false;
  ['memory','sequence','speed'].forEach(g=>document.getElementById('g-'+g).style.display=g===n?'block':'none');
  document.querySelectorAll('.tab').forEach((t,i)=>t.classList.toggle('active',['memory','sequence','speed'][i]===n));
}

// ════════════ MEMORY MATCH ════════════
const EMOJIS=['🦊','🐬','🦁','🦋','🍓','🌙','⭐','🔥'];
let mState={fl:[],ma:[],ok:true,score:0,timer:90,iv:null,t0:0};
function buildMem(){
  const g=document.getElementById('mg');g.innerHTML='';
  [...EMOJIS,...EMOJIS].sort(()=>Math.random()-0.5).forEach((e,i)=>{
    const c=document.createElement('div');c.className='mc';c.dataset.e=e;c.dataset.i=i;
    c.innerHTML=`<div class="cb">?</div><div class="cf" style="display:none">${e}</div>`;
    c.addEventListener('click',()=>flipMem(c));g.appendChild(c);
  });
}
function startMem(){
  if(checkGameLock('memory',document.getElementById('mbtn'),document.getElementById('mem-limit')))return;
  clearInterval(mState.iv);mState={fl:[],ma:[],ok:true,score:0,timer:90,iv:null,t0:Date.now()};
  document.getElementById('ms').textContent=0;document.getElementById('mp').textContent='0/8';
  document.getElementById('mpb').style.width='0%';document.getElementById('mbtn').textContent='↺ Restart';
  buildMem();
  mState.iv=setInterval(()=>{
    mState.timer--;const m=Math.floor(mState.timer/60),s=mState.timer%60;
    document.getElementById('mt').textContent=m+':'+(s<10?'0':'')+s;
    if(mState.timer<=0){clearInterval(mState.iv);const dur=Math.round((Date.now()-mState.t0)/1000);recordSession('memory',mState.score,dur,`${mState.ma.length/2}/8 pairs`);showModal('⏰',"Time's Up!",mState.score,`Found ${mState.ma.length/2} of 8 pairs.`,startMem);}
  },1000);
}
function flipMem(c){
  if(!mState.ok)return;if(mState.ma.includes(c.dataset.i))return;if(mState.fl.find(x=>x.dataset.i===c.dataset.i))return;
  c.classList.add('revealed');c.querySelector('.cb').style.display='none';c.querySelector('.cf').style.display='flex';mState.fl.push(c);
  if(mState.fl.length===2){
    mState.ok=false;const[a,b]=mState.fl;
    if(a.dataset.e===b.dataset.e){
      setTimeout(()=>{
        [a,b].forEach(x=>{x.classList.remove('revealed');x.classList.add('matched');});
        mState.ma.push(a.dataset.i,b.dataset.i);mState.score+=100+mState.timer;
        document.getElementById('ms').textContent=mState.score;
        const p=mState.ma.length/2;document.getElementById('mp').textContent=p+'/8';
        document.getElementById('mpb').style.width=(p/8*100)+'%';mState.fl=[];mState.ok=true;
        if(p===8){clearInterval(mState.iv);const dur=Math.round((Date.now()-mState.t0)/1000);recordSession('memory',mState.score,dur,'8/8 pairs');showModal('🧠','Memory Master!',mState.score,'All 8 pairs matched!',startMem);}
      },500);
    }else{
      setTimeout(()=>{
        [a,b].forEach(x=>x.classList.add('wrong'));
        setTimeout(()=>{[a,b].forEach(x=>{x.classList.remove('revealed','wrong');x.querySelector('.cb').style.display='flex';x.querySelector('.cf').style.display='none';});mState.fl=[];mState.ok=true;},600);
      },700);
    }
  }
}
buildMem();

// ════════════ SEQUENCE ════════════
const SEQE=['🔴','🟡','🟢','🔵','🟣','🟠','⚪','🟤','🩷'];
let sState={seq:[],pl:[],lv:1,score:0,lives:3,watching:false,playing:false,t0:0};
function buildSeq(){
  const g=document.getElementById('sg');g.innerHTML='';
  SEQE.forEach((e,i)=>{const b=document.createElement('button');b.className='sb';b.textContent=e;b.addEventListener('click',()=>seqInput(i));g.appendChild(b);});
}
function startSeq(){
  if(checkGameLock('sequence',document.getElementById('sbtn'),document.getElementById('seq-limit')))return;
  sState={seq:[],pl:[],lv:1,score:0,lives:3,watching:false,playing:false,t0:Date.now()};
  updateSeqHUD();document.getElementById('sbtn').textContent='↺ Restart';buildSeq();nextSeq();
}
function nextSeq(){sState.pl=[];sState.seq.push(Math.floor(Math.random()*9));sState.watching=true;sState.playing=false;document.getElementById('si').innerHTML='Watch the sequence…';playSeq();}
let seqGen=0;
function playSeq(){
  const btns=document.querySelectorAll('.sb');let i=0;const d=Math.max(400,700-sState.lv*40);
  const gen=++seqGen;
  function fl(idx){
    if(gen!==seqGen)return;
    btns[sState.seq[idx]].classList.add('lit');
    setTimeout(()=>{
      if(gen!==seqGen)return;
      btns[sState.seq[idx]].classList.remove('lit');i++;
      if(i<sState.seq.length)setTimeout(()=>fl(i),d/2);
      else{sState.watching=false;sState.playing=true;document.getElementById('si').innerHTML=`Repeat it! <strong>(${sState.seq.length} steps)</strong>`;}
    },d);
  }
  setTimeout(()=>fl(0),500);
}
function seqInput(idx){
  if(!sState.playing)return;const btns=document.querySelectorAll('.sb');const exp=sState.seq[sState.pl.length];sState.pl.push(idx);
  if(idx===exp){
    btns[idx].classList.add('active');setTimeout(()=>btns[idx].classList.remove('active'),200);
    if(sState.pl.length===sState.seq.length){sState.score+=sState.lv*50;sState.lv++;updateSeqHUD();document.getElementById('si').innerHTML='✅ Correct!';setTimeout(nextSeq,1200);}
  }else{
    btns[idx].style.background='rgba(255,107,74,0.3)';btns[idx].style.borderColor='var(--warn)';sState.lives--;updateSeqHUD();
    setTimeout(()=>{btns[idx].style.background='';btns[idx].style.borderColor='';
      if(sState.lives<=0){const dur=Math.round((Date.now()-sState.t0)/1000);recordSession('sequence',sState.score,dur,`Level ${sState.lv}`);showModal('💀','Game Over',sState.score,`Reached level ${sState.lv}.`,startSeq);sState.playing=false;}
      else{sState.pl=[];document.getElementById('si').innerHTML='❌ Wrong! Watch again…';setTimeout(playSeq,800);}
    },500);
  }
}
function updateSeqHUD(){document.getElementById('ss').textContent=sState.score;document.getElementById('sl').textContent=sState.lv;document.getElementById('sv').textContent='♥'.repeat(sState.lives)||'—';document.getElementById('spb').style.width=Math.min(sState.lv/20*100,100)+'%';}
buildSeq();

// ════════════ SPEED FIND ════════════
let fState={score:0,timer:60,combo:1,tgt:0,iv:null,active:false,t0:0};
function buildSpd(){
  const g=document.getElementById('fgrid');g.innerHTML='';
  const nums=Array.from({length:25},()=>Math.floor(Math.random()*9)+1);
  nums[Math.floor(Math.random()*25)]=fState.tgt;nums[Math.floor(Math.random()*25)]=fState.tgt;
  nums.forEach(n=>{const c=document.createElement('div');c.className='sc'+(n===fState.tgt?' tgt':'');c.textContent=n;c.addEventListener('click',()=>spdClick(c,n));g.appendChild(c);});
}
function startSpd(){
  if(checkGameLock('speed',document.getElementById('fbtn'),document.getElementById('spd-limit')))return;
  clearInterval(fState.iv);fState={score:0,timer:60,combo:1,tgt:Math.floor(Math.random()*9)+1,iv:null,active:true,t0:Date.now()};
  document.getElementById('ftgt').textContent=fState.tgt;document.getElementById('fbtn').textContent='↺ Restart';
  document.getElementById('fs').textContent=0;document.getElementById('fc').textContent='x1';buildSpd();
  fState.iv=setInterval(()=>{fState.timer--;document.getElementById('ft').textContent=fState.timer;document.getElementById('fpb').style.width=(fState.timer/60*100)+'%';
    if(fState.timer<=0){clearInterval(fState.iv);fState.active=false;const dur=Math.round((Date.now()-fState.t0)/1000);recordSession('speed',fState.score,dur,`x${fState.combo} combo`);showModal('⏱️','Time!',fState.score,`Score: ${fState.score} | Best Combo: ${fState.combo}x`,startSpd);}
  },1000);
}
function spdClick(c,n){
  if(!fState.active)return;
  if(n===fState.tgt){c.classList.remove('tgt');c.classList.add('hit');c.style.pointerEvents='none';fState.score+=10*fState.combo;fState.combo=Math.min(fState.combo+1,8);document.getElementById('fs').textContent=fState.score;document.getElementById('fc').textContent='x'+fState.combo;
    if(!document.querySelectorAll('.sc.tgt').length){fState.tgt=Math.floor(Math.random()*9)+1;document.getElementById('ftgt').textContent=fState.tgt;buildSpd();}
  }else{c.style.background='rgba(255,107,74,0.15)';c.style.borderColor='var(--warn)';fState.combo=1;document.getElementById('fc').textContent='x1';setTimeout(()=>{c.style.background='';c.style.borderColor='';},400);}
}
fState.tgt=5;document.getElementById('ftgt').textContent=5;buildSpd();

// ════════════ OVERLAY ════════════
let ovTimer=null,llTimer=null,curGame=null;
let pvS=null,ffS=null,rrS=null,llS=null,npS=null;
const OV_INSTRUCTIONS = {
  pv: {icon:'🧩', text:'<strong>Pattern Vault</strong><br>A grid of cells will light up one by one. Watch carefully, then tap the cells in the same order to recreate the pattern. The grid grows larger as you advance!'},
  ff: {icon:'🔮', text:'<strong>Focus Filter</strong><br>A target emoji will appear at the top. Tap ONLY that emoji in the grid — ignore all the distractors. You have 60 seconds. Every correct tap scores points!'},
  rr: {icon:'🌀', text:'<strong>Rapid Recall</strong><br>A word will appear on screen. Choose its correct definition from 4 options as fast as you can. Build a streak for bonus points — but wrong answers reset your streak and cost points!'},
  ll: {icon:'🎯', text:'<strong>Logic Ladder</strong><br>Solve math and logic puzzles before the timer runs out. You have 3 lives — a wrong answer or running out of time costs one life. Score bonus points for answering quickly!'},
  np: {icon:'🔢', text:'<strong>Number Path</strong><br>Numbers will appear on a grid. Memorize their positions, then tap them in order from 1 to the highest number after they disappear. Wrong taps cost time and points!'},
  ar: {icon:'⬆️', text:'<strong>Arrow Rush</strong><br>An arrow (↑ ↓ ← →) will flash on screen. Press the matching arrow key on your keyboard before the time window closes! Your window shrinks as your streak grows — how fast can you go?<br><br><em style="color:var(--muted)">Use the arrow keys on your keyboard.</em>'}
};
let instrTimer=null, instrCallback=null;
function showInstructions(g, onDone){
  const info = OV_INSTRUCTIONS[g];
  document.getElementById('ov-instructions').style.display='block';
  document.getElementById('ov-game-content').style.display='none';
  document.getElementById('ov-instr-icon').textContent=info.icon;
  document.getElementById('ov-instr-text').innerHTML=info.text;
  let t=30; document.getElementById('ov-countdown').textContent=t;
  instrCallback=onDone;
  clearInterval(instrTimer);
  instrTimer=setInterval(()=>{t--;document.getElementById('ov-countdown').textContent=t;if(t<=0){skipInstructions();}},1000);
}
function skipInstructions(){
  clearInterval(instrTimer);instrTimer=null;
  document.getElementById('ov-instructions').style.display='none';
  document.getElementById('ov-game-content').style.display='block';
  if(instrCallback){instrCallback();instrCallback=null;}
}
function openOv(g){
  if(isGameLocked(g)){
    const gName=({pv:'Pattern Vault',ff:'Focus Filter',rr:'Rapid Recall',ll:'Logic Ladder',np:'Number Path'})[g]||g;
    alert(`🔒 You've played ${gName} 3 times!\n\nCheck the Insights tab to review your scores.`);return;
  }
  closeOv();curGame=g;
  document.getElementById('overlay').classList.add('show');document.body.style.overflow='hidden';
  ['pv','ff','rr','ll','np','ar'].forEach(x=>document.getElementById('ov-'+x).style.display='none');
  document.getElementById('ov-'+g).style.display='block';
  document.getElementById('ovs').textContent=0;document.getElementById('ovt').textContent='—';document.getElementById('ovx').textContent='—';document.getElementById('ovp').style.width='0%';
  // Set game title/subtitle before instructions screen
  const initFn=({pv:pvInit,ff:ffInit,rr:rrInit,ll:llInit,np:npInit,ar:arInit})[g];
  showInstructions(g, initFn);
}
function closeOv(){
  clearInterval(ovTimer);ovTimer=null;clearInterval(llTimer);llTimer=null;clearInterval(instrTimer);instrTimer=null;instrCallback=null;
  if(pvS)pvS.phase='idle';if(ffS)ffS.active=false;if(rrS)rrS.active=false;if(llS)llS.active=false;if(npS)npS.phase='idle';if(arS){arS.active=false;arRemoveKeyListener();}
  document.getElementById('ov-instructions').style.display='none';
  document.getElementById('ov-game-content').style.display='block';
  document.getElementById('overlay').classList.remove('show');document.body.style.overflow='';
}
function setOvHUD(s,t,x){document.getElementById('ovs').textContent=s;document.getElementById('ovt').textContent=t;document.getElementById('ovx').textContent=x;}
function ovModal(e,ti,sc,su,fn){closeOv();showModal(e,ti,sc,su,fn);}

// ── PATTERN VAULT ──
function pvInit(){
  document.getElementById('ot').textContent='🧩 Pattern Vault';document.getElementById('os').textContent='Memorize the lit cells, then recreate the pattern';
  document.getElementById('ovtl').textContent='Time';document.getElementById('ovxl').textContent='Level';
  pvS={phase:'idle',lv:1,sz:3,pat:[],inp:[],score:0,timer:0,t0:Date.now()};pvBuild(3);
  document.getElementById('pvbtn').style.display='inline-block';document.getElementById('pvbtn').textContent='▶ Start';
  document.getElementById('ovinstr').textContent='Press Start to begin!';setOvHUD(0,'—',1);
}
function pvBuild(sz){
  const g=document.getElementById('pvgrid');g.style.gridTemplateColumns=`repeat(${sz},1fr)`;g.style.maxWidth=(sz*68+(sz-1)*7)+'px';g.innerHTML='';
  for(let i=0;i<sz*sz;i++){const c=document.createElement('div');c.className='pvc';c.addEventListener('click',()=>pvClick(i));g.appendChild(c);}
}
function pvGo(){if(pvS.phase==='idle')pvRound();}
function pvRound(){
  const sz=pvS.sz,cnt=Math.min(3+pvS.lv,sz*sz-1);
  pvS.pat=Array.from({length:sz*sz},(_,i)=>i).sort(()=>Math.random()-0.5).slice(0,cnt);pvS.inp=[];pvS.phase='show';
  document.getElementById('pvbtn').style.display='none';document.getElementById('ovinstr').textContent='Memorize the pattern…';
  let i=0;const cells=()=>document.querySelectorAll('.pvc');cells().forEach(c=>c.className='pvc');
  function fl(){if(i>0)cells()[pvS.pat[i-1]].classList.remove('lit');if(i<pvS.pat.length){cells()[pvS.pat[i]].classList.add('lit');i++;setTimeout(fl,600);}else{setTimeout(()=>{cells().forEach(c=>c.classList.remove('lit'));pvS.phase='input';document.getElementById('ovinstr').textContent=`Tap the ${cnt} lit cells!`;pvS.timer=10+pvS.lv*2;clearInterval(ovTimer);ovTimer=setInterval(()=>{pvS.timer--;setOvHUD(pvS.score,pvS.timer,pvS.lv);document.getElementById('ovp').style.width=(pvS.timer/(10+pvS.lv*2)*100)+'%';if(pvS.timer<=0){clearInterval(ovTimer);pvEnd();}},1000);setOvHUD(pvS.score,pvS.timer,pvS.lv);},400);}}
  setTimeout(fl,300);
}
function pvClick(i){
  if(pvS.phase!=='input')return;const cells=document.querySelectorAll('.pvc');
  if(pvS.pat.includes(i)){cells[i].classList.add('ok');pvS.inp.push(i);
    if(pvS.inp.length===pvS.pat.length){clearInterval(ovTimer);pvS.score+=pvS.lv*100+pvS.timer*10;pvS.lv++;if(pvS.lv%3===0)pvS.sz=Math.min(pvS.sz+1,6);pvS.phase='idle';document.getElementById('ovinstr').textContent='✅ Perfect!';setOvHUD(pvS.score,'—',pvS.lv);document.getElementById('ovp').style.width=Math.min(pvS.lv/15*100,100)+'%';setTimeout(()=>{pvBuild(pvS.sz);document.getElementById('pvbtn').style.display='inline-block';document.getElementById('pvbtn').textContent='▶ Next Round';},900);}
  }else{cells[i].classList.add('bad');setTimeout(()=>cells[i].classList.remove('bad'),500);pvS.score=Math.max(0,pvS.score-30);setOvHUD(pvS.score,pvS.timer,pvS.lv);}
}
function pvEnd(){pvS.phase='idle';const dur=Math.round((Date.now()-pvS.t0)/1000);recordSession('pv',pvS.score,dur,`Level ${pvS.lv}`);ovModal('🧩','Pattern Vault!',pvS.score,`Reached level ${pvS.lv}.`,()=>openOv('pv'));}

// ── FOCUS FILTER ──
const FFP=['🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐨','🐯','🦁','🐮','🐷','🐸','🐵','🐔','🐧','🐦','🦆','🦅','🦉','🦇','🐺','🐗','🐴','🦄','🐝','🐛','🦋','🐌','🐞','🐜'];
function ffInit(){
  document.getElementById('ot').textContent='🔮 Focus Filter';document.getElementById('os').textContent='Tap only the target emoji!';
  document.getElementById('ovtl').textContent='Seconds';document.getElementById('ovxl').textContent='Hits';
  ffS={active:true,tgt:'',score:0,timer:60,hits:0,round:0,t0:Date.now()};ffRound();
  clearInterval(ovTimer);ovTimer=setInterval(()=>{ffS.timer--;setOvHUD(ffS.score,ffS.timer,ffS.hits);document.getElementById('ovp').style.width=(ffS.timer/60*100)+'%';
    if(ffS.timer<=0){clearInterval(ovTimer);ffS.active=false;const dur=Math.round((Date.now()-ffS.t0)/1000);recordSession('ff',ffS.score,dur,`${ffS.hits} targets`);ovModal('🔮','Focus Filter!',ffS.score,`Found ${ffS.hits} targets!`,()=>openOv('ff'));}
  },1000);
}
function ffRound(){
  ffS.round++;const sh=[...FFP].sort(()=>Math.random()-0.5);ffS.tgt=sh[0];const dis=sh.slice(1,18);
  const tc=Math.min(2+Math.floor(ffS.round/3),6);const all=[...Array(tc).fill(ffS.tgt),...dis.slice(0,24-tc)].sort(()=>Math.random()-0.5);
  document.getElementById('ffshow').innerHTML=`<div class="ff-lbl">Find this:</div>${ffS.tgt}`;
  document.getElementById('ovinstr').textContent=`Tap every ${ffS.tgt}!`;
  const g=document.getElementById('ffgrid');g.innerHTML='';
  all.forEach(e=>{const c=document.createElement('div');c.className='ffc';c.textContent=e;
    c.addEventListener('click',()=>{if(!ffS.active)return;
      if(e===ffS.tgt){c.classList.add('hit','gone');ffS.hits++;ffS.score+=15;setOvHUD(ffS.score,ffS.timer,ffS.hits);if([...document.querySelectorAll('.ffc:not(.gone)')].every(x=>x.textContent!==ffS.tgt))setTimeout(ffRound,400);}
      else{c.classList.add('miss');ffS.score=Math.max(0,ffS.score-10);setTimeout(()=>c.classList.remove('miss'),400);setOvHUD(ffS.score,ffS.timer,ffS.hits);}
    });g.appendChild(c);});
}

// ── RAPID RECALL ──
const RRW=[
  {w:'Ephemeral',d:'Lasting for a very short time',x:['Very large','Deeply rooted','Extremely loud']},
  {w:'Benevolent',d:'Well-meaning and kindly',x:['Hostile and cruel','Easily confused','Physically strong']},
  {w:'Laconic',d:'Using very few words',x:['Overly talkative','Highly emotional','Musically gifted']},
  {w:'Pragmatic',d:'Dealing with things sensibly',x:['Idealistic and dreamy','Recklessly impulsive','Quietly secretive']},
  {w:'Ubiquitous',d:'Present everywhere at once',x:['Extremely rare','Deeply hidden','Slowly moving']},
  {w:'Enigmatic',d:'Mysterious and hard to understand',x:['Completely obvious','Loudly expressive','Simply structured']},
  {w:'Resilient',d:'Recovering quickly from difficulties',x:['Easily defeated','Completely rigid','Deeply pessimistic']},
  {w:'Verbose',d:'Using more words than needed',x:['Extremely brief','Totally silent','Vaguely worded']},
  {w:'Tenacious',d:'Holding firmly to a purpose',x:['Easily giving up','Wildly unpredictable','Reluctantly slow']},
  {w:'Ambiguous',d:'Open to more than one interpretation',x:['Perfectly clear','Extremely specific','Completely false']},
  {w:'Diligent',d:'Showing care and effort in work',x:['Carelessly lazy','Wildly impulsive','Completely random']},
  {w:'Eloquent',d:'Fluent and persuasive in speech',x:['Stumbling awkwardly','Painfully shy','Harshly blunt']},
  {w:'Meticulous',d:'Showing great attention to detail',x:['Carelessly sloppy','Broadly general','Hastily done']},
  {w:'Impeccable',d:'In accordance with highest standards',x:['Full of mistakes','Loosely defined','Completely average']},
  {w:'Frivolous',d:'Not having any serious purpose',x:['Deeply meaningful','Utterly solemn','Critically important']},
];
function rrInit(){
  document.getElementById('ot').textContent='🌀 Rapid Recall';document.getElementById('os').textContent='Match the word to its definition';
  document.getElementById('ovtl').textContent='Seconds';document.getElementById('ovxl').textContent='Streak';
  rrS={active:true,score:0,timer:60,streak:0,qi:0,pool:[...RRW].sort(()=>Math.random()-0.5),t0:Date.now()};rrQ();
  clearInterval(ovTimer);ovTimer=setInterval(()=>{rrS.timer--;setOvHUD(rrS.score,rrS.timer,rrS.streak+'🔥');document.getElementById('ovp').style.width=(rrS.timer/60*100)+'%';
    if(rrS.timer<=0){clearInterval(ovTimer);rrS.active=false;const dur=Math.round((Date.now()-rrS.t0)/1000);recordSession('rr',rrS.score,dur,`${rrS.qi} questions`);ovModal('🌀','Rapid Recall!',rrS.score,`Answered ${rrS.qi} questions!`,()=>openOv('rr'));}
  },1000);
}
function rrQ(){
  if(!rrS.active)return;if(rrS.qi>=rrS.pool.length){rrS.pool=[...RRW].sort(()=>Math.random()-0.5);rrS.qi=0;}
  const q=rrS.pool[rrS.qi];document.getElementById('rrword').textContent=q.w;document.getElementById('rrfb').textContent='';document.getElementById('ovinstr').textContent='What does this word mean?';
  const opts=[q.d,...q.x].sort(()=>Math.random()-0.5);const con=document.getElementById('rropts');con.innerHTML='';
  opts.forEach(o=>{const b=document.createElement('button');b.className='rro';b.textContent=o;
    b.addEventListener('click',()=>{if(!rrS.active)return;con.querySelectorAll('.rro').forEach(x=>x.style.pointerEvents='none');
      if(o===q.d){b.classList.add('ok');rrS.streak++;rrS.score+=50+rrS.streak*10;document.getElementById('rrfb').textContent='✅ Correct!';document.getElementById('rrfb').style.color='var(--accent3)';}
      else{b.classList.add('bad');con.querySelectorAll('.rro').forEach(x=>{if(x.textContent===q.d)x.classList.add('ok');});rrS.streak=0;rrS.score=Math.max(0,rrS.score-10);document.getElementById('rrfb').textContent='❌ Wrong!';document.getElementById('rrfb').style.color='var(--warn)';}
      rrS.qi++;setOvHUD(rrS.score,rrS.timer,rrS.streak+'🔥');setTimeout(rrQ,900);
    });con.appendChild(b);});
}

// ── LOGIC LADDER ──
function makeLL(){
  const qs=[];
  for(let v=1;v<=20;v++){const a=Math.floor(Math.random()*10*v)+1,b=Math.floor(Math.random()*10*v)+1;
    qs.push({q:`${a} + ${b} = ?`,a:a+b,w:[a+b+1,a+b-1,Math.abs(a-b)]},{q:`${a} × ${b} = ?`,a:a*b,w:[a*b+b,a*b-a,(a+1)*b]},{q:`What comes next? ${v*2}, ${v*4}, ${v*6}, ?`,a:v*8,w:[v*8+2,v*7,v*9]},{q:`${a+b} − ${b} = ?`,a:a,w:[a+1,a-1,b]});}
  qs.push({q:'NOT a prime: 2, 3, 5, 9?',a:'9',w:['2','3','5']},{q:'NOT a vowel: A, E, I, P?',a:'P',w:['A','E','I']},{q:'Largest: 0.5, 1/3, 0.4, 2/5?',a:'0.5',w:['1/3','0.4','2/5']},{q:'Smallest: 1/2, 0.6, 3/4, 0.45?',a:'0.45',w:['1/2','0.6','3/4']});
  return qs.sort(()=>Math.random()-0.5);
}
function llInit(){
  document.getElementById('ot').textContent='🎯 Logic Ladder';document.getElementById('os').textContent='Solve each puzzle before time runs out';
  document.getElementById('ovtl').textContent='Seconds';document.getElementById('ovxl').textContent='Lives';
  clearInterval(llTimer);llTimer=null;llS={active:true,score:0,timer:0,lives:3,lv:0,pool:makeLL(),t0:Date.now()};llQ();
}
function llQ(){
  if(!llS.active)return;clearInterval(llTimer);llTimer=null;
  if(llS.lv>=llS.pool.length){llS.pool=makeLL();llS.lv=0;}
  const q=llS.pool[llS.lv];llS.timer=Math.max(8,20-Math.floor(llS.lv/3));
  document.getElementById('llq').textContent=q.q;document.getElementById('llfb').textContent='';document.getElementById('ovinstr').textContent='Choose the correct answer:';
  setOvHUD(llS.score,llS.timer,'♥'.repeat(llS.lives));document.getElementById('ovp').style.width=Math.min(llS.lv/30*100,100)+'%';
  const opts=[String(q.a),...q.w.map(String)].filter((v,i,a)=>a.indexOf(v)===i).sort(()=>Math.random()-0.5);
  const con=document.getElementById('llopts');con.innerHTML='';
  opts.forEach(o=>{const b=document.createElement('button');b.className='llo';b.textContent=o;
    b.addEventListener('click',()=>{if(!llS.active)return;clearInterval(llTimer);llTimer=null;con.querySelectorAll('.llo').forEach(x=>x.style.pointerEvents='none');
      if(o===String(q.a)){b.classList.add('ok');llS.score+=50+llS.timer*5;document.getElementById('llfb').textContent='✅ Correct!';document.getElementById('llfb').style.color='var(--accent3)';llS.lv++;setOvHUD(llS.score,'—','♥'.repeat(llS.lives));setTimeout(llQ,800);}
      else{b.classList.add('bad');con.querySelectorAll('.llo').forEach(x=>{if(x.textContent===String(q.a))x.classList.add('ok');});llS.lives--;document.getElementById('llfb').textContent='❌ Wrong!';document.getElementById('llfb').style.color='var(--warn)';setOvHUD(llS.score,'—','♥'.repeat(Math.max(llS.lives,0)));
        if(llS.lives<=0){llS.active=false;const dur=Math.round((Date.now()-llS.t0)/1000);recordSession('ll',llS.score,dur,`${llS.lv} puzzles`);setTimeout(()=>ovModal('🎯','Logic Ladder!',llS.score,`Solved ${llS.lv} puzzles!`,()=>openOv('ll')),700);}else{llS.lv++;setTimeout(llQ,900);}
      }});con.appendChild(b);});
  llTimer=setInterval(()=>{llS.timer--;setOvHUD(llS.score,llS.timer,'♥'.repeat(llS.lives));
    if(llS.timer<=0){clearInterval(llTimer);llTimer=null;document.getElementById('llfb').textContent='⏰ Too slow!';document.getElementById('llfb').style.color='var(--warn)';con.querySelectorAll('.llo').forEach(x=>{x.style.pointerEvents='none';if(x.textContent===String(q.a))x.classList.add('ok');});llS.lives--;setOvHUD(llS.score,'—','♥'.repeat(Math.max(llS.lives,0)));
      if(llS.lives<=0){llS.active=false;const dur=Math.round((Date.now()-llS.t0)/1000);recordSession('ll',llS.score,dur,`${llS.lv} puzzles`);setTimeout(()=>ovModal('🎯','Logic Ladder!',llS.score,`Solved ${llS.lv} puzzles!`,()=>openOv('ll')),700);}else{llS.lv++;setTimeout(llQ,1000);}
    }},1000);
}

// ── NUMBER PATH ──
function npInit(){
  document.getElementById('ot').textContent='🔢 Number Path';document.getElementById('os').textContent='Memorize positions, tap in order 1→N';
  document.getElementById('ovtl').textContent='Seconds';document.getElementById('ovxl').textContent='Level';
  npS={phase:'show',lv:1,sz:4,nums:[],next:1,score:0,timer:0,t0:Date.now()};npRound();
}
function npRound(){
  clearInterval(ovTimer);const sz=npS.sz,cnt=Math.min(4+npS.lv,sz*sz);
  const pos=Array.from({length:sz*sz},(_,i)=>i).sort(()=>Math.random()-0.5).slice(0,cnt);
  npS.nums=Array(sz*sz).fill(null);pos.forEach((p,i)=>npS.nums[p]=i+1);npS.next=1;npS.phase='show';
  document.getElementById('nplbl').textContent=`Memorize ${cnt} positions!`;document.getElementById('ovinstr').textContent='Remember where each number is!';
  document.getElementById('npbtn').style.display='inline-block';document.getElementById('npbtn').textContent="👁 I've memorized it!";
  setOvHUD(npS.score,'—',npS.lv);document.getElementById('ovp').style.width=Math.min((npS.lv-1)/10*100,100)+'%';
  const g=document.getElementById('npgrid');g.style.gridTemplateColumns=`repeat(${sz},1fr)`;g.style.maxWidth=(sz*78+(sz-1)*9)+'px';g.innerHTML='';
  npS.nums.forEach((n)=>{const c=document.createElement('div');c.className='npc'+(n?' show':'');c.textContent=n||'';g.appendChild(c);});
}
function npGo(){
  if(npS.phase!=='show')return;npS.phase='recall';document.getElementById('npbtn').style.display='none';
  document.getElementById('nplbl').textContent='Tap in order: 1, 2, 3…';document.getElementById('ovinstr').textContent='Next: 1';
  const g=document.getElementById('npgrid');g.innerHTML='';const sz=npS.sz;g.style.gridTemplateColumns=`repeat(${sz},1fr)`;
  npS.nums.forEach((n)=>{const c=document.createElement('div');c.className='npc'+(n?' hidden':'');c.style.opacity=n?'1':'0.12';c.style.pointerEvents=n?'auto':'none';
    if(n)c.addEventListener('click',()=>npClick(c,n));g.appendChild(c);});
  npS.timer=5+npS.lv*3;clearInterval(ovTimer);ovTimer=setInterval(()=>{npS.timer--;setOvHUD(npS.score,npS.timer,npS.lv);if(npS.timer<=0){clearInterval(ovTimer);const dur=Math.round((Date.now()-npS.t0)/1000);recordSession('np',npS.score,dur,`Level ${npS.lv}`);ovModal('🔢','Number Path!',npS.score,`Reached level ${npS.lv}!`,()=>openOv('np'));}},1000);
  setOvHUD(npS.score,npS.timer,npS.lv);
}
function npClick(c,n){
  if(npS.phase!=='recall')return;
  if(n===npS.next){c.classList.remove('hidden');c.classList.add('ok');c.textContent=n;c.style.pointerEvents='none';npS.next++;
    const total=npS.nums.filter(x=>x!==null).length;document.getElementById('ovinstr').textContent=npS.next<=total?`Next: ${npS.next}`:'🎉 All done!';
    if(npS.next>total){clearInterval(ovTimer);npS.score+=npS.lv*100+npS.timer*15;npS.lv++;if(npS.lv%3===0)npS.sz=Math.min(npS.sz+1,6);setOvHUD(npS.score,'—',npS.lv);setTimeout(()=>{npS.phase='show';npRound();},1000);}
  }else{c.classList.add('bad');setTimeout(()=>c.classList.remove('bad'),500);npS.score=Math.max(0,npS.score-20);npS.timer=Math.max(1,npS.timer-3);setOvHUD(npS.score,npS.timer,npS.lv);}
}

// ── ARROW RUSH ──
const AR_ARROWS = [
  {key:'ArrowUp',   dir:'up',    emoji:'⬆️'},
  {key:'ArrowDown', dir:'down',  emoji:'⬇️'},
  {key:'ArrowLeft', dir:'left',  emoji:'⬅️'},
  {key:'ArrowRight',dir:'right', emoji:'➡️'},
];
const AR_KEY_IDS = {ArrowUp:'ark-up',ArrowDown:'ark-down',ArrowLeft:'ark-left',ArrowRight:'ark-right'};
let arS = null;
let arKeyListener = null;
let arWindowTimer = null;
let arWindowRaf = null;

function arRemoveKeyListener() {
  if(arKeyListener) {
    document.removeEventListener('keydown', arKeyListener);
    arKeyListener = null;
  }
}

function arInit() {
  document.getElementById('ot').textContent = '⬆️ Arrow Rush';
  document.getElementById('os').textContent = 'Press the matching arrow key before time runs out!';
  document.getElementById('ovtl').textContent = 'Time';
  document.getElementById('ovxl').textContent = 'Streak';
  arS = {active:false, score:0, streak:0, bestStreak:0, lives:3, totalTime:60, timeLeft:60, arrow:null, windowMs:1200, t0:Date.now(), windowStart:0};
  arRemoveKeyListener();
  clearInterval(arWindowTimer); arWindowTimer = null;
  cancelAnimationFrame(arWindowRaf);
  document.getElementById('ar-startbtn').style.display = 'inline-block';
  document.getElementById('ar-display').className = 'ar-arrow-display idle';
  document.getElementById('ar-display').textContent = '⬆️';
  arBuildPips();
  setOvHUD(0, '60', '0🔥');
  document.getElementById('ovp').style.width = '100%';
  document.getElementById('ar-wfill').style.width = '100%';
  document.getElementById('ar-wfill').style.transition = 'none';
}

function arBuildPips() {
  const bar = document.getElementById('ar-pips');
  bar.innerHTML = '';
  for(let i=0;i<10;i++){
    const p=document.createElement('div');
    p.className='ar-pip'+(i<arS.streak?' on':'');
    bar.appendChild(p);
  }
}

function arStart() {
  if(!arS) return;
  document.getElementById('ar-startbtn').style.display = 'none';
  arS.active = true;
  arS.t0 = Date.now();

  // Main 60-second countdown
  arS.timeLeft = 60;
  clearInterval(arWindowTimer);
  arWindowTimer = setInterval(() => {
    if(!arS.active) return;
    arS.timeLeft--;
    document.getElementById('ovp').style.width = (arS.timeLeft/60*100)+'%';
    setOvHUD(arS.score, arS.timeLeft, arS.streak+'🔥');
    if(arS.timeLeft <= 0) {
      arEnd();
    }
  }, 1000);

  arKeyListener = (e) => {
    if(!arS || !arS.active || !arS.arrow) return;
    if(!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)) return;
    e.preventDefault();
    // Flash key visual
    const keyEl = document.getElementById(AR_KEY_IDS[e.key]);
    if(keyEl){ keyEl.classList.add('pressed'); setTimeout(()=>keyEl.classList.remove('pressed'),180); }
    arHandleKey(e.key);
  };
  document.addEventListener('keydown', arKeyListener);

  arNextArrow();
}

function arNextArrow() {
  if(!arS || !arS.active) return;
  // Pick a random arrow (avoid immediate repeat)
  let picks = AR_ARROWS;
  if(arS.arrow) picks = AR_ARROWS.filter(a=>a.key!==arS.arrow.key);
  arS.arrow = picks[Math.floor(Math.random()*picks.length)];

  const display = document.getElementById('ar-display');
  display.className = 'ar-arrow-display';
  display.textContent = arS.arrow.emoji;
  document.getElementById('ovinstr').textContent = 'Press the matching arrow key!';

  // Window duration: starts at 1200ms, shrinks to 400ms minimum based on streak
  const winMs = Math.max(400, 1200 - arS.streak * 60);
  arS.windowMs = winMs;
  arS.windowStart = performance.now();

  // Animate window bar
  const wfill = document.getElementById('ar-wfill');
  wfill.style.transition = 'none';
  wfill.style.width = '100%';
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      wfill.style.transition = `width ${winMs}ms linear`;
      wfill.style.width = '0%';
    });
  });

  // Auto-miss if window expires
  cancelAnimationFrame(arWindowRaf);
  const deadline = arS.windowStart + winMs;
  function checkDeadline() {
    if(!arS || !arS.active || !arS.arrow) return;
    if(performance.now() >= deadline) {
      arMiss();
    } else {
      arWindowRaf = requestAnimationFrame(checkDeadline);
    }
  }
  arWindowRaf = requestAnimationFrame(checkDeadline);
}

function arHandleKey(key) {
  if(!arS || !arS.arrow) return;
  cancelAnimationFrame(arWindowRaf);
  const wfill = document.getElementById('ar-wfill');
  wfill.style.transition = 'none';

  if(key === arS.arrow.key) {
    // HIT
    const reactionMs = performance.now() - arS.windowStart;
    const speedBonus = Math.round(Math.max(0, (arS.windowMs - reactionMs) / arS.windowMs * 50));
    const pts = 10 + speedBonus + arS.streak * 2;
    arS.score += pts;
    arS.streak++;
    if(arS.streak > arS.bestStreak) arS.bestStreak = arS.streak;

    const display = document.getElementById('ar-display');
    display.className = 'ar-arrow-display hit';

    // Streak combo flash
    const flash = document.getElementById('ar-combo-flash');
    if(arS.streak >= 3) {
      flash.textContent = arS.streak+'x COMBO! +'+pts;
      flash.classList.add('show');
      setTimeout(()=>flash.classList.remove('show'), 600);
    } else {
      flash.textContent = '+'+pts;
      flash.classList.add('show');
      setTimeout(()=>flash.classList.remove('show'), 400);
    }

    arS.arrow = null;
    setOvHUD(arS.score, arS.timeLeft, arS.streak+'🔥');
    arBuildPips();
    document.getElementById('ovinstr').textContent = arS.streak>=5 ? '🔥 On fire! Keep going!' : '✅ Nice!';
    setTimeout(()=>{ if(arS.active) arNextArrow(); }, 220);
  } else {
    // WRONG KEY
    arS.streak = 0;
    arBuildPips();
    const display = document.getElementById('ar-display');
    display.className = 'ar-arrow-display miss';
    document.getElementById('ovinstr').textContent = '❌ Wrong key!';
    arS.arrow = null;
    setTimeout(()=>{ if(arS.active) arNextArrow(); }, 500);
  }
}

function arMiss() {
  if(!arS) return;
  arS.streak = 0;
  arBuildPips();
  arS.arrow = null;
  const display = document.getElementById('ar-display');
  display.className = 'ar-arrow-display miss';
  document.getElementById('ar-wfill').style.width = '0%';
  document.getElementById('ovinstr').textContent = '⏰ Too slow!';
  setTimeout(()=>{ if(arS.active) arNextArrow(); }, 500);
}

function arEnd() {
  if(!arS) return;
  arS.active = false;
  arRemoveKeyListener();
  clearInterval(arWindowTimer); arWindowTimer = null;
  cancelAnimationFrame(arWindowRaf);
  const dur = Math.round((Date.now() - arS.t0) / 1000);
  recordSession('ar', arS.score, dur, `${arS.bestStreak} streak`);
  ovModal('⬆️','Arrow Rush!', arS.score, `Best streak: ${arS.bestStreak}x | Score: ${arS.score}`, ()=>openOv('ar'));
}

// Enter key support
document.addEventListener('keydown',e=>{
  if(e.key!=='Enter')return;
  const authScreen=document.getElementById('auth-screen');
  if(!authScreen||authScreen.style.display==='none')return;
  if(!document.getElementById('form-login').classList.contains('hidden'))doLogin();
  else if(!document.getElementById('form-register').classList.contains('hidden'))doRegister();
  else if(!document.getElementById('form-researcher').classList.contains('hidden'))doResearcherLogin();
});

// ════════════════════════════════════════
//  ISEF ASSENT MODAL
// ════════════════════════════════════════
function showAssentModal() {
  document.getElementById('assent-modal').classList.add('show');
  // Reset all checkboxes
  ['assent-c1','assent-c2','assent-c3','assent-c4','assent-c5'].forEach(id => {
    document.getElementById(id).checked = false;
  });
  updateAssentButton();
}
function updateAssentButton() {
  const allChecked = ['assent-c1','assent-c2','assent-c3','assent-c4','assent-c5']
    .every(id => document.getElementById(id).checked);
  const btn = document.getElementById('assent-agree-btn');
  btn.classList.toggle('ready', allChecked);
  btn.disabled = !allChecked;
}
function acceptAssent() {
  document.getElementById('assent-modal').classList.remove('show');
  switchAuthTab('register');
}
function declineAssent() {
  document.getElementById('assent-modal').classList.remove('show');
  switchAuthTab('login');
}
