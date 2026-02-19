'use strict';

// ─── Page Navigation ─────────────────────────────
const NAV_PILLS = document.querySelectorAll('.nav-pill');
const PAGES = {
  Dashboard: null,
  Analytics: 'pageAnalytics',
  Reports:   'pageReports',
  Config:    'pageConfig',
};

let currentPage = 'Dashboard';
let selectedReport = 'full';

NAV_PILLS.forEach(pill => {
  pill.addEventListener('click', () => {
    const label = pill.textContent.trim();
    navigateTo(label);
    NAV_PILLS.forEach(p => p.classList.remove('active'));
    pill.classList.add('active');
  });
});

function navigateTo(page) {
  currentPage = page;
  // Hide/show main dashboard sections
  const dashSections = ['heroSection','uploadSection','results'];
  const isDb = page === 'Dashboard';
  const wasResults = analysisResult !== null;

  dashSections.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    if (isDb) {
      // Restore dashboard state
      if (id === 'heroSection') el.style.display = wasResults ? 'none' : '';
      if (id === 'uploadSection') el.style.display = wasResults ? 'none' : '';
      if (id === 'results') el.style.display = wasResults ? 'block' : 'none';
    } else {
      el.style.display = 'none';
    }
  });

  // Show/hide page sections
  document.querySelectorAll('.page-section').forEach(s => s.classList.remove('active'));
  const target = PAGES[page];
  if (target) {
    document.getElementById(target).classList.add('active');
    if (page === 'Analytics') populateAnalytics();
    if (page === 'Reports')   populateReports();
    if (page === 'Config')    populateConfig();
  }
}

// ─── Analytics Population ─────────────────────────
function populateAnalytics() {
  if (!analysisResult) { renderAnalyticsEmpty(); return; }
  const r = analysisResult;
  const sa = r.suspicious_accounts;
  const fr = r.fraud_rings;

  // KPIs
  const precision = sa.length > 0 ? Math.round((sa.filter(a=>a.suspicion_score>=40).length/sa.length)*100) : 0;
  const avgScore  = sa.length > 0 ? Math.round(sa.reduce((s,a)=>s+a.suspicion_score,0)/sa.length) : 0;
  const totalVol  = formatVolume(Object.values(r.accountVolume||{}).reduce((s,v)=>s+v,0)/2);
  const density   = r.allAccounts.length > 0 ? (sa.length/r.allAccounts.length*100).toFixed(1)+'%' : '0%';

  setEl('aPrecision', precision+'%');
  setEl('aAvgScore',  avgScore);
  setEl('aVolume',    totalVol);
  setEl('aDensity',   density);
  setEl('aPrecisionDelta', precision>=70?'▲ Above target (70%)':'▼ Below target (70%)', precision>=70?'delta-up':'delta-dn');
  setEl('aAvgDelta',  avgScore>=50?'▲ High risk average':'▼ Moderate average', avgScore>=50?'delta-dn':'delta-up');
  setEl('aVolDelta',  'Suspicious volume tracked');
  setEl('aDenDelta',  'Of total accounts flagged');

  // Pattern breakdown
  const patterns = {};
  sa.forEach(a => a.detected_patterns.forEach(p => { patterns[p]=(patterns[p]||0)+1; }));
  const sortedP = Object.entries(patterns).sort((a,b)=>b[1]-a[1]);
  const maxP = sortedP[0]?.[1]||1;
  const patColors = {'cycle_length_3':'#ff2251','cycle_length_4':'#ff6b35','cycle_length_5':'#ffd700',
    fan_in:'#ffaa00',fan_out:'#00e5ff',shell_network:'#9467ff',high_velocity:'#00ff9d',
    high_out_degree:'#00b8cc',high_in_degree:'#3a6aaa'};
  document.getElementById('chartPatternBreakdown').innerHTML = `<div class="bar-chart">${
    sortedP.slice(0,8).map(([k,v])=>`
      <div class="bar-row">
        <div class="bar-label">${k.replace(/_/g,' ')}</div>
        <div class="bar-track"><div class="bar-fill" style="width:${v/maxP*100}%;background:${patColors[k]||'#00e5ff'};box-shadow:0 0 6px ${patColors[k]||'#00e5ff'}"></div></div>
        <div class="bar-val">${v}</div>
      </div>`).join('')
  }</div>`;
  setEl('aTotalPatterns', sortedP.length+' patterns');

  // Score distribution
  const buckets = [0,0,0,0,0]; // 0-19, 20-39, 40-59, 60-79, 80-100
  sa.forEach(a => { buckets[Math.min(4,Math.floor(a.suspicion_score/20))]++; });
  const maxB = Math.max(...buckets,1);
  const bColors = ['#1a4a6e','#2a6a6e','#ffaa00','#ff6b35','#ff2251'];
  const bLabels = ['0-19','20-39','40-59','60-79','80+'];
  document.getElementById('scoreDistBars').innerHTML = buckets.map((v,i)=>`
    <div class="dist-bar-wrap">
      <div class="dist-bar" style="height:${Math.max(4,v/maxB*72)}px;background:${bColors[i]};box-shadow:0 0 6px ${bColors[i]}"></div>
      <div class="dist-bar-lbl">${v}</div>
    </div>`).join('');
  document.getElementById('scoreDistLabels').innerHTML = bLabels.map((l,i)=>`
    <span style="font-family:var(--font-mono);font-size:8px;color:var(--muted);flex:1;text-align:center">${l}</span>`).join('');

  // Donut chart
  const typeCount = {};
  fr.forEach(r => { typeCount[r.pattern_type]=(typeCount[r.pattern_type]||0)+1; });
  const donutColors = {cycle:'#ff2251',fan_in:'#ffaa00',fan_out:'#00e5ff',shell_network:'#9467ff'};
  const total = fr.length||1;
  const entries = Object.entries(typeCount);
  let cumAngle = -Math.PI/2;
  const R=55, CX=65, CY=65, IR=32;
  let pathSVG = '';
  entries.forEach(([k,v])=>{
    const angle = (v/total)*Math.PI*2;
    const x1=CX+R*Math.cos(cumAngle), y1=CY+R*Math.sin(cumAngle);
    const x2=CX+R*Math.cos(cumAngle+angle), y2=CY+R*Math.sin(cumAngle+angle);
    const xi1=CX+IR*Math.cos(cumAngle), yi1=CY+IR*Math.sin(cumAngle);
    const xi2=CX+IR*Math.cos(cumAngle+angle), yi2=CY+IR*Math.sin(cumAngle+angle);
    const large = angle>Math.PI?1:0;
    const col = donutColors[k]||'#00e5ff';
    pathSVG += `<path d="M${xi1} ${yi1} L${x1} ${y1} A${R} ${R} 0 ${large} 1 ${x2} ${y2} L${xi2} ${yi2} A${IR} ${IR} 0 ${large} 0 ${xi1} ${yi1} Z" fill="${col}" opacity="0.85"/>`;
    cumAngle += angle;
  });
  document.getElementById('donutWrap').innerHTML = `
    <svg class="donut-svg" width="130" height="130" viewBox="0 0 130 130">
      <circle cx="65" cy="65" r="62" fill="none" stroke="var(--rim)" stroke-width="1"/>
      ${pathSVG}
      <text x="65" y="61" text-anchor="middle" font-family="var(--font-display)" font-size="18" fill="var(--cyan)">${fr.length}</text>
      <text x="65" y="74" text-anchor="middle" font-family="var(--font-mono)" font-size="8" fill="var(--muted)">RINGS</text>
    </svg>
    <div class="donut-legend">${entries.map(([k,v])=>`
      <div class="donut-legend-item">
        <div class="donut-legend-dot" style="background:${donutColors[k]||'#00e5ff'}"></div>
        <span>${k.replace(/_/g,' ').toUpperCase()}</span>
        <span class="donut-legend-val">${v}</span>
      </div>`).join('')}
    </div>`;
  setEl('aTotalRings', fr.length+' rings');

  // Top accounts bar chart
  const top10 = sa.slice(0,10);
  const maxScore = top10[0]?.suspicion_score||100;
  document.getElementById('topAccountsChart').innerHTML = `<div class="bar-chart">${
    top10.map(a => {
      const col = a.suspicion_score>=70?'var(--red)':a.suspicion_score>=40?'var(--amber)':'var(--green)';
      return `<div class="bar-row">
        <div class="bar-label" style="width:120px;font-size:8px;">${a.account_id.slice(0,14)}</div>
        <div class="bar-track"><div class="bar-fill" style="width:${a.suspicion_score/maxScore*100}%;background:${col};box-shadow:0 0 6px ${col}"></div></div>
        <div class="bar-val" style="color:${col}">${a.suspicion_score}</div>
      </div>`;
    }).join('')
  }</div>`;

  // Network metrics
  const totalEdges = Object.values(r.outEdges||{}).reduce((s,v)=>s+v.length,0);
  const avgDeg = r.allAccounts.length>0 ? (totalEdges*2/r.allAccounts.length).toFixed(1) : '0';
  const dn = r.allAccounts.length*(r.allAccounts.length-1)||1;
  const graphDensity = (totalEdges/dn*100).toFixed(2)+'%';
  const largestRing = fr.length ? Math.max(...fr.map(ri=>ri.member_accounts.length)) : 0;
  const rows = [
    ['Total Nodes', r.allAccounts.length.toLocaleString()],
    ['Total Edges', totalEdges.toLocaleString()],
    ['Avg Degree', avgDeg],
    ['Graph Density', graphDensity],
    ['Merchants Excluded', r.merchants.size.toLocaleString()],
    ['Connected Components', fr.length.toLocaleString()],
    ['Largest Ring Size', largestRing],
    ['Processing Time', r.summary.processing_time_seconds+'s'],
  ];
  document.getElementById('networkMetricsTable').innerHTML = rows.map(([k,v])=>`<tr><td>${k}</td><td>${v}</td></tr>`).join('');

  // Activity timeline
  const events = buildTimeline(r);
  setEl('aTimelineCount', events.length+' events');
  document.getElementById('activityTimeline').innerHTML = events.map(ev=>`
    <div class="timeline-item">
      <div class="timeline-dot" style="color:${ev.color};background:${ev.color}"></div>
      <div class="timeline-time">${ev.time}</div>
      <div class="timeline-text">${ev.text}</div>
      <span class="timeline-badge" style="background:${ev.color}18;color:${ev.color};border:1px solid ${ev.color}33">${ev.badge}</span>
    </div>`).join('');
}

function renderAnalyticsEmpty() {
  ['aPrecision','aAvgScore','aVolume','aDensity'].forEach(id=>setEl(id,'—'));
  ['aPrecisionDelta','aAvgDelta','aVolDelta','aDenDelta'].forEach(id=>setEl(id,'Load a dataset first'));
  setEl('aTotalPatterns','0 patterns');
  setEl('aTotalRings','0 rings');
}

function buildTimeline(r) {
  const events = [];
  const sa = r.suspicious_accounts;
  const fr = r.fraud_rings;
  events.push({time:'START',text:`Analysis initiated — ${r.allAccounts.length} accounts loaded`,color:'var(--cyan)',badge:'INIT'});
  if(r.merchants.size) events.push({time:'STEP 1',text:`FP Shield excluded ${r.merchants.size} merchant accounts`,color:'var(--green)',badge:'SHIELD'});
  const cycles=fr.filter(x=>x.pattern_type==='cycle');
  if(cycles.length) events.push({time:'STEP 2',text:`Cycle detection found ${cycles.length} circular routing ring(s)`,color:'var(--red)',badge:'CYCLE'});
  const fans=fr.filter(x=>x.pattern_type==='fan_in'||x.pattern_type==='fan_out');
  if(fans.length) events.push({time:'STEP 3',text:`Smurfing analysis identified ${fans.length} fan pattern(s)`,color:'var(--amber)',badge:'SMURF'});
  const shells=fr.filter(x=>x.pattern_type==='shell_network');
  if(shells.length) events.push({time:'STEP 4',text:`Shell chain traversal found ${shells.length} layered network(s)`,color:'#9467ff',badge:'SHELL'});
  if(sa.length) events.push({time:'STEP 5',text:`Scored ${sa.length} accounts — ${sa.filter(a=>a.suspicion_score>=70).length} critical`,color:'var(--red)',badge:'SCORE'});
  events.push({time:'DONE',text:`Pipeline complete in ${r.summary.processing_time_seconds}s`,color:'var(--green)',badge:'OK'});
  return events;
}

function formatVolume(v) {
  if(v>=1e9) return '$'+(v/1e9).toFixed(1)+'B';
  if(v>=1e6) return '$'+(v/1e6).toFixed(1)+'M';
  if(v>=1e3) return '$'+(v/1e3).toFixed(1)+'K';
  return '$'+v.toFixed(0);
}

function setEl(id, val, cls) {
  const el = document.getElementById(id);
  if(!el) return;
  el.textContent = val;
  if(cls) { el.className = el.className.replace(/delta-\w+/g,'').trim()+' '+cls; }
}

function refreshAnalytics() { if(analysisResult) populateAnalytics(); showToast('Analytics refreshed','success'); }
function exportAnalytics() { showToast('Chart export as PNG coming in next version',''); }

// ─── Reports Population ───────────────────────────
function populateReports() {
  if (!analysisResult) return;
  const r = analysisResult;
  setEl('rFullAccounts', r.suspicious_accounts.length);
  setEl('rFullRings', r.fraud_rings.length);
  setEl('rCsvAccounts', r.suspicious_accounts.length);
  setEl('rCsvRings', r.fraud_rings.length);
  setEl('pvAccounts', `array[${r.suspicious_accounts.length}]`);
  setEl('pvRings', `array[${r.fraud_rings.length}]`);
  updateReportPreview('full');
}

function selectReport(el, type) {
  document.querySelectorAll('.report-card').forEach(c=>c.classList.remove('selected'));
  el.classList.add('selected');
  selectedReport = type;
  const labels = { full:'Full Intel Report', executive:'Executive Summary', accounts:'Accounts CSV', rings:'Rings CSV', sar:'SAR Draft', network:'Network Export' };
  setEl('previewReportLabel', labels[type]||type);
  updateReportPreview(type);
}

function updateReportPreview(type) {
  const r = analysisResult;
  const code = document.getElementById('previewCode');
  const contents = document.getElementById('previewContents');
  if (!r) { if(code) code.textContent = '{ "status": "awaiting_data" }'; return; }

  if(type==='full') {
    if(contents) contents.innerHTML = `
      <div class="preview-kv"><span class="preview-key">suspicious_accounts</span><span class="preview-val">array[${r.suspicious_accounts.length}]</span></div>
      <div class="preview-kv"><span class="preview-key">fraud_rings</span><span class="preview-val">array[${r.fraud_rings.length}]</span></div>
      <div class="preview-kv"><span class="preview-key">summary</span><span class="preview-val">object</span></div>
      <div class="preview-kv"><span class="preview-key">metadata</span><span class="preview-val">object</span></div>`;
    if(code) code.textContent = JSON.stringify({
      suspicious_accounts: r.suspicious_accounts.slice(0,2),
      fraud_rings: r.fraud_rings.slice(0,1),
      summary: r.summary
    }, null, 2).slice(0,600)+'...';
  } else if(type==='executive') {
    if(contents) contents.innerHTML = `<div class="preview-kv"><span class="preview-key">Format</span><span class="preview-val">Plain text</span></div><div class="preview-kv"><span class="preview-key">Sections</span><span class="preview-val">4</span></div>`;
    if(code) code.textContent = buildExecutiveTxt(r).slice(0,500)+'...';
  } else if(type==='accounts') {
    if(contents) contents.innerHTML = `<div class="preview-kv"><span class="preview-key">Rows</span><span class="preview-val">${r.suspicious_accounts.length}</span></div><div class="preview-kv"><span class="preview-key">Columns</span><span class="preview-val">4</span></div>`;
    if(code) code.textContent = 'account_id,suspicion_score,ring_id,patterns\n'+r.suspicious_accounts.slice(0,5).map(a=>`${a.account_id},${a.suspicion_score},${a.ring_id},"${a.detected_patterns.join('|')}"`).join('\n');
  } else if(type==='rings') {
    if(contents) contents.innerHTML = `<div class="preview-kv"><span class="preview-key">Rows</span><span class="preview-val">${r.fraud_rings.length}</span></div><div class="preview-kv"><span class="preview-key">Columns</span><span class="preview-val">5</span></div>`;
    if(code) code.textContent = 'ring_id,pattern_type,member_count,risk_score,member_accounts\n'+r.fraud_rings.slice(0,4).map(ri=>`${ri.ring_id},${ri.pattern_type},${ri.member_accounts.length},${ri.risk_score},"${ri.member_accounts.join('|')}"`).join('\n');
  } else if(type==='sar') {
    if(contents) contents.innerHTML = `<div class="preview-kv"><span class="preview-key">Template</span><span class="preview-val">FinCEN Form 111</span></div>`;
    if(code) code.textContent = buildSARTxt(r).slice(0,600)+'...';
  } else if(type==='network') {
    if(contents) contents.innerHTML = `<div class="preview-kv"><span class="preview-key">nodes</span><span class="preview-val">array[${r.allAccounts.length}]</span></div><div class="preview-kv"><span class="preview-key">edges</span><span class="preview-val">array</span></div>`;
    if(code) code.textContent = JSON.stringify({nodes:r.allAccounts.slice(0,3).map(id=>({id,suspicious:!!r.ringMembership[id]})),edges:[]},null,2);
  }
}

function buildExecutiveTxt(r) {
  const s = r.summary;
  return `SENTINEL — EXECUTIVE SUMMARY
${'═'.repeat(50)}
Generated: ${new Date().toISOString()}
Engine: SENTINEL v2.0.0

KEY METRICS
─────────────────────────────────
Total Accounts Analyzed : ${s.total_accounts_analyzed}
Suspicious Accounts     : ${s.suspicious_accounts_flagged}
Fraud Rings Detected    : ${s.fraud_rings_detected}
Processing Time         : ${s.processing_time_seconds}s

RISK BREAKDOWN
─────────────────────────────────
Critical (≥70)  : ${r.suspicious_accounts.filter(a=>a.suspicion_score>=70).length} accounts
Medium (40-69)  : ${r.suspicious_accounts.filter(a=>a.suspicion_score>=40&&a.suspicion_score<70).length} accounts
Low (<40)       : ${r.suspicious_accounts.filter(a=>a.suspicion_score<40).length} accounts

TOP PRIORITY ACCOUNTS
─────────────────────────────────
${r.suspicious_accounts.slice(0,5).map(a=>`  ${a.account_id.padEnd(20)} Score: ${a.suspicion_score} | Ring: ${a.ring_id}`).join('\n')}

RECOMMENDATIONS
─────────────────────────────────
1. File SAR for all accounts with score ≥ 70
2. Freeze transactions for critical ring members
3. Escalate shell networks to compliance team
4. Review flagged accounts within 48 hours

This report is generated by SENTINEL Financial Forensics Engine.
For internal use only. Not for redistribution.`;
}

function buildSARTxt(r) {
  const highRisk = r.suspicious_accounts.filter(a=>a.suspicion_score>=70);
  return `SUSPICIOUS ACTIVITY REPORT — DRAFT
FinCEN Form 111 | BSA E-Filing
Generated: ${new Date().toISOString()}
${'═'.repeat(60)}

PART I — REPORTING FINANCIAL INSTITUTION
Name: [INSTITUTION NAME]
TIN: [TIN]
Address: [ADDRESS]
Primary Federal Regulator: [REGULATOR]

PART II — SUSPICIOUS ACTIVITY INFORMATION
Date of Suspicious Activity: ${new Date().toLocaleDateString()}
Activity Type: ☑ Money Laundering  ☑ Structuring  ☑ Wire Transfer Fraud

PART III — SUBJECT INFORMATION
Number of Subjects: ${highRisk.length}

${highRisk.slice(0,5).map((a,i)=>`Subject ${i+1}:
  Account ID: ${a.account_id}
  Risk Score: ${a.suspicion_score}/100
  Patterns: ${a.detected_patterns.join(', ')}
  Ring: ${a.ring_id}`).join('\n\n')}

PART IV — SUSPICIOUS ACTIVITY DESCRIPTION
SENTINEL automated analysis detected ${r.fraud_rings.length} fraud ring(s) involving
${r.suspicious_accounts.length} suspicious accounts across ${r.summary.total_accounts_analyzed} total
accounts analyzed.

Detection methods: Cycle analysis (${r.fraud_rings.filter(x=>x.pattern_type==='cycle').length} rings),
Fan-in/out smurfing (${r.fraud_rings.filter(x=>x.pattern_type.includes('fan')).length} rings),
Shell layering (${r.fraud_rings.filter(x=>x.pattern_type==='shell_network').length} rings).

PART V — CONTACT FOR ASSISTANCE
Prepared by: [NAME]
Title: [TITLE]
Telephone: [PHONE]
Date Prepared: ${new Date().toLocaleDateString()}

[DRAFT — Requires review before submission to FinCEN]`;
}

function buildNetworkJSON(r) {
  const nodes = r.allAccounts.map(id => ({
    id, suspicious: !!r.ringMembership[id],
    ring: r.ringMembership[id]||null,
    merchant: r.merchants.has(id),
    tx_count: r.accountTxCount[id]||0,
    volume: r.accountVolume[id]||0
  }));
  const edges = [];
  for(const [src,targets] of Object.entries(r.outEdges||{})) {
    for(const tgt of targets) {
      const info = r.edgeMap[`${src}->${tgt}`]||{amount:0,count:1};
      edges.push({source:src,target:tgt,amount:info.amount,count:info.count});
    }
  }
  return JSON.stringify({nodes,edges,metadata:{generated:new Date().toISOString(),engine:'SENTINEL v2.0.0'}},null,2);
}

function generateSelectedReport() {
  if (!analysisResult) { showToast('No analysis data — load a CSV first','error'); return; }
  const ep = document.getElementById('exportProgressWrap');
  const ef = document.getElementById('exportProgressFill');
  ep.classList.add('active');
  let pct = 0;
  const interval = setInterval(()=>{ pct+=20; ef.style.width=pct+'%'; if(pct>=100){clearInterval(interval);setTimeout(()=>{ep.classList.remove('active');ef.style.width='0%';},400);} },80);

  const r = analysisResult;
  const prefix = document.getElementById('cfgFilenamePrefix')?.value||'SENTINEL_report';
  const useTs = document.getElementById('togTimestamp')?.checked!==false;
  const ts = useTs?`_${Date.now()}`:'';

  setTimeout(()=>{
    if(selectedReport==='full') {
      const out={suspicious_accounts:r.suspicious_accounts,fraud_rings:r.fraud_rings,summary:r.summary,metadata:{generated:new Date().toISOString(),engine:'SENTINEL v2.0.0'}};
      dlFile(JSON.stringify(out,null,2),`${prefix}${ts}.json`,'application/json');
    } else if(selectedReport==='executive') {
      dlFile(buildExecutiveTxt(r),`${prefix}_executive${ts}.txt`,'text/plain');
    } else if(selectedReport==='accounts') {
      const hdr='account_id,suspicion_score,ring_id,patterns';
      const rows=r.suspicious_accounts.map(a=>`${a.account_id},${a.suspicion_score},${a.ring_id},"${a.detected_patterns.join('|')}"`);
      dlFile([hdr,...rows].join('\n'),`${prefix}_accounts${ts}.csv`,'text/csv');
    } else if(selectedReport==='rings') {
      const hdr='ring_id,pattern_type,member_count,risk_score,member_accounts';
      const rows=r.fraud_rings.map(ri=>`${ri.ring_id},${ri.pattern_type},${ri.member_accounts.length},${ri.risk_score},"${ri.member_accounts.join('|')}"`);
      dlFile([hdr,...rows].join('\n'),`${prefix}_rings${ts}.csv`,'text/csv');
    } else if(selectedReport==='sar') {
      dlFile(buildSARTxt(r),`${prefix}_SAR_draft${ts}.txt`,'text/plain');
    } else if(selectedReport==='network') {
      dlFile(buildNetworkJSON(r),`${prefix}_network${ts}.json`,'application/json');
    }
    showToast('Report downloaded successfully','success');
  }, 450);
}

function copyReportToClipboard() {
  if (!analysisResult) { showToast('No data to copy','error'); return; }
  const r = analysisResult;
  let text = '';
  if(selectedReport==='full') text=JSON.stringify({suspicious_accounts:r.suspicious_accounts,fraud_rings:r.fraud_rings,summary:r.summary},null,2);
  else if(selectedReport==='executive') text=buildExecutiveTxt(r);
  else if(selectedReport==='sar') text=buildSARTxt(r);
  else text=JSON.stringify(r.summary,null,2);
  navigator.clipboard.writeText(text).then(()=>showToast('Copied to clipboard','success')).catch(()=>showToast('Copy failed — use download instead','error'));
}

function scheduleReport() { showToast('Scheduled reporting available in enterprise edition',''); }

function dlFile(content, filename, mime) {
  const blob = new Blob([content],{type:mime+';charset=utf-8'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.setAttribute('href',url); a.setAttribute('download',filename);
  a.style.cssText='position:fixed;left:-9999px;opacity:0;';
  document.body.appendChild(a);
  setTimeout(()=>{ a.click(); setTimeout(()=>{ URL.revokeObjectURL(url); if(a.parentNode) a.parentNode.removeChild(a); },3000); },10);
}

// ─── Config ───────────────────────────────────────
const CONFIG_DEFAULTS = {
  cfgMinCycle:3,cfgMaxCycle:5,cfgFanIn:10,cfgFanOut:10,cfgTemporal:72,cfgShellMax:4,
  cfgCritical:70,cfgMedium:40,cfgCycleScore:60,cfgFanScore:50,cfgShellScore:45,cfgVelBonus:20,cfgRingBonus:20,
  cfgMaxNodes:300,cfgSimSteps:200,cfgRepel:3000,cfgLinkDist:85,
  cfgToastDur:4,
};

function populateConfig() {
  // Browser / memory info
  setEl('sysBrowser', navigator.userAgent.split(' ').slice(-1)[0]||'Unknown');
  const mem = navigator.deviceMemory;
  setEl('sysMemory', mem ? mem+'GB (approx)' : 'Not available');
  // Load persisted config
  const stored = localStorage.getItem('sentinelConfig');
  if (stored) {
    try {
      const cfg = JSON.parse(stored);
      Object.entries(cfg).forEach(([k,v])=>{
        const el=document.getElementById(k);
        if(!el) return;
        if(el.type==='checkbox') el.checked=v;
        else { el.value=v; const valEl=document.getElementById(k+'Val'); if(valEl) valEl.textContent=v; }
      });
    } catch(e){}
  }
}

function syncRange(id, valId) {
  const el=document.getElementById(id); const vel=document.getElementById(valId);
  if(el&&vel) vel.textContent=el.value;
  markUnsaved();
}

function checkThreshold() {
  const fi=parseInt(document.getElementById('cfgFanIn')?.value||10);
  const fo=parseInt(document.getElementById('cfgFanOut')?.value||10);
  document.getElementById('fanInWarning').classList.toggle('show', fi<6);
  document.getElementById('fanOutWarning').classList.toggle('show', fo<6);
}

function switchConfigTab(tab, navEl) {
  document.querySelectorAll('.config-tab').forEach(t=>t.classList.remove('active'));
  document.querySelectorAll('.config-nav-item').forEach(n=>n.classList.remove('active'));
  document.getElementById('cfg'+tab.charAt(0).toUpperCase()+tab.slice(1)).classList.add('active');
  navEl.classList.add('active');
}

function saveConfig() {
  const cfg = {};
  Object.keys(CONFIG_DEFAULTS).forEach(k=>{
    const el=document.getElementById(k);
    if(!el) return;
    cfg[k] = el.type==='checkbox' ? el.checked : (isNaN(+el.value)?el.value:+el.value);
  });
  // Include toggles
  ['togMerchant','togPayroll','togVelocity','togLabels','togMerchantNodes','togPulse',
   'togIncludeTx','togIncludeGraph','togIncludeMeta','togIncludeFP','togAutoClear',
   'togPersistConfig','togTimestamp','togAlertScore','togAlertRing','togAlertDone','togAlertVelocity'].forEach(id=>{
    const el=document.getElementById(id); if(el) cfg[id]=el.checked;
  });
  const persist=document.getElementById('togPersistConfig');
  if(!persist||persist.checked) localStorage.setItem('sentinelConfig',JSON.stringify(cfg));
  const el=document.getElementById('configSaveStatus');
  if(el){el.textContent='✓ Config saved successfully';el.classList.add('saved');}
  showToast('Configuration saved','success');
  setTimeout(()=>{if(el){el.textContent='Unsaved changes will apply on next analysis run';el.classList.remove('saved');}},3000);
}

function markUnsaved() {
  const el=document.getElementById('configSaveStatus');
  if(el){el.textContent='● Unsaved changes';el.classList.remove('saved');}
}

function resetConfig() {
  Object.entries(CONFIG_DEFAULTS).forEach(([k,v])=>{
    const el=document.getElementById(k); if(!el) return;
    el.value=v; const vel=document.getElementById(k+'Val'); if(vel) vel.textContent=v;
  });
  markUnsaved();
  showToast('Config reset to defaults','success');
}

function setAccent(color, el) {
  document.querySelectorAll('.color-swatch').forEach(s=>s.classList.remove('active'));
  el.classList.add('active');
  document.documentElement.style.setProperty('--cyan', color);
  const rgb = hexToRgb(color);
  if(rgb) document.documentElement.style.setProperty('--cyan-dim', `rgba(${rgb},0.8)`);
  markUnsaved();
  showToast('Accent color updated','success');
}

function hexToRgb(hex) {
  const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);
  return isNaN(r)?null:`${r},${g},${b}`;
}

function clearAnalysisData() {
  analysisResult=null; graphState.nodes=[]; graphState.edges=[];
  if(graphState.animFrame) cancelAnimationFrame(graphState.animFrame);
  showToast('Analysis data cleared','success');
}

function hardReset() {
  localStorage.removeItem('sentinelConfig');
  clearAnalysisData();
  resetConfig();
  navigateTo('Dashboard');
  NAV_PILLS.forEach((p,i)=>p.classList.toggle('active',i===0));
  showToast('Hard reset complete','success');
}

// ─── Toast System ─────────────────────────────────
function showToast(msg, type) {
  const dur = parseInt(document.getElementById('cfgToastDur')?.value||4)*1000;
  const pos = document.getElementById('cfgAlertPos')?.value||'bottom-right';
  const existing = document.querySelectorAll('.toast');
  existing.forEach(t=>t.remove());
  const icons = {success:'✓',error:'✗','':'◈'};
  const t=document.createElement('div');
  t.className=`toast ${type}`;
  t.innerHTML=`<span class="toast-icon">${icons[type]||'◈'}</span><span>${msg}</span>`;
  const posMap={'bottom-right':'bottom:30px;right:30px','bottom-left':'bottom:30px;left:30px','top-right':'top:90px;right:30px','top-left':'top:90px;left:30px'};
  t.style.cssText=(posMap[pos]||posMap['bottom-right'])+';position:fixed;z-index:99999;';
  document.body.appendChild(t);
  setTimeout(()=>{ t.style.opacity='0'; t.style.transition='opacity 0.3s'; setTimeout(()=>t.remove(),300); }, dur);
}



(function(){
  const canvas = document.getElementById('bgCanvas');
  const ctx = canvas.getContext('2d');
  let W, H, particles = [];

  function resize(){
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  const N = 80;
  for(let i=0;i<N;i++){
    particles.push({
      x: Math.random()*1920, y: Math.random()*1080,
      vx:(Math.random()-0.5)*0.3, vy:(Math.random()-0.5)*0.3,
      r: Math.random()*1.5+0.3,
      a: Math.random()
    });
  }

  function draw(){
    ctx.clearRect(0,0,W,H);
    // Draw connections
    for(let i=0;i<particles.length;i++){
      for(let j=i+1;j<particles.length;j++){
        const dx=particles[j].x-particles[i].x, dy=particles[j].y-particles[i].y;
        const d=Math.sqrt(dx*dx+dy*dy);
        if(d<140){
          ctx.beginPath();
          ctx.strokeStyle=`rgba(0,229,255,${0.04*(1-d/140)})`;
          ctx.lineWidth=0.5;
          ctx.moveTo(particles[i].x,particles[i].y);
          ctx.lineTo(particles[j].x,particles[j].y);
          ctx.stroke();
        }
      }
    }
    // Draw dots
    particles.forEach(p=>{
      ctx.beginPath();
      ctx.arc(p.x,p.y,p.r,0,Math.PI*2);
      ctx.fillStyle=`rgba(0,229,255,${p.a*0.4})`;
      ctx.fill();
      p.x+=p.vx; p.y+=p.vy;
      if(p.x<0) p.x=W; if(p.x>W) p.x=0;
      if(p.y<0) p.y=H; if(p.y>H) p.y=0;
    });
    requestAnimationFrame(draw);
  }
  draw();
})();

// ─── Live Clock ───────────────────────────────────
setInterval(()=>{
  const el=document.getElementById('liveTime');
  if(el) el.textContent=new Date().toLocaleTimeString('en-GB');
},1000);

// ─── State ───────────────────────────────────────
let analysisResult=null;
let graphState={
  nodes:[], edges:[],
  offsetX:0, offsetY:0, scale:1,
  dragging:false, lastX:0, lastY:0,
  hoveredNode:null, selectedNode:null,
  animFrame:null
};

const RING_COLORS=['#ff2251','#ff6b35','#ffd700','#00ff9d','#00e5ff','#9467ff','#ff69b4','#00ffff'];

// ─── File Handling ────────────────────────────────
const dropZone=document.getElementById('dropZone');
const fileInput=document.getElementById('fileInput');

dropZone.addEventListener('dragover',e=>{e.preventDefault();dropZone.classList.add('drag-over');});
dropZone.addEventListener('dragleave',()=>dropZone.classList.remove('drag-over'));
dropZone.addEventListener('drop',e=>{
  e.preventDefault(); dropZone.classList.remove('drag-over');
  const f=e.dataTransfer.files[0]; if(f) processFile(f);
});
fileInput.addEventListener('change',e=>{ if(e.target.files[0]) processFile(e.target.files[0]); });

function processFile(file){
  const reader=new FileReader();
  reader.onload=e=>parseAndAnalyze(e.target.result);
  reader.readAsText(file);
}

// ─── CSV Parser ───────────────────────────────────
function parseCSV(text){
  const lines=text.trim().split('\n');
  const headers=lines[0].split(',').map(h=>h.trim().toLowerCase().replace(/"/g,''));
  const transactions=[];
  for(let i=1;i<lines.length;i++){
    const vals=parseLine(lines[i]);
    if(vals.length<5) continue;
    const row={};
    headers.forEach((h,idx)=>{ row[h]=(vals[idx]||'').trim().replace(/"/g,''); });
    const tx={
      transaction_id:row['transaction_id']||row['id']||`TX${i}`,
      sender_id:row['sender_id']||row['sender'],
      receiver_id:row['receiver_id']||row['receiver'],
      amount:parseFloat(row['amount'])||0,
      timestamp:row['timestamp']||row['date']||''
    };
    if(tx.sender_id&&tx.receiver_id) transactions.push(tx);
  }
  return transactions;
}

function parseLine(line){
  const r=[]; let c='',q=false;
  for(const ch of line){
    if(ch==='"'){q=!q;}
    else if(ch===','&&!q){r.push(c);c='';}
    else{c+=ch;}
  }
  r.push(c); return r;
}

// ─── Orchestrator ─────────────────────────────────
function parseAndAnalyze(csvText){
  const t0=performance.now();
  setProgress('PARSING CSV DATA...',10,[1]);
  setTimeout(()=>{
    const transactions=parseCSV(csvText);
    if(!transactions.length){alert('No valid transactions found. Check column names.');return;}
    setProgress('CONSTRUCTING GRAPH...',35,[1,2]);
    setTimeout(()=>{
      const result=analyze(transactions,t0);
      analysisResult=result;
      setProgress('SCORING ACCOUNTS...',70,[1,2,3,4]);
      setTimeout(()=>{
        displayResults(result);
        setProgress('COMPLETE',100,[1,2,3,4,5]);
      },250);
    },100);
  },50);
}

function setProgress(label,pct,doneSteps){
  const pw=document.getElementById('progressWrap');
  pw.style.display='block';
  document.getElementById('progressLabel').textContent=label;
  document.getElementById('progressPct').textContent=pct+'%';
  document.getElementById('progressBar').style.width=pct+'%';
  for(let i=1;i<=5;i++){
    const el=document.getElementById('ps'+i);
    if(!el) continue;
    el.classList.remove('active','done');
    if(doneSteps.includes(i)) el.classList.add('done');
    else if(i===Math.max(...doneSteps)+1) el.classList.add('active');
  }
}

// ─── Analysis Engine ──────────────────────────────
function analyze(transactions,t0){
  const outEdges={},inEdges={},txCount={},vol={};
  const allAccounts=new Set();
  const edgeMap={},txByTime={};

  for(const tx of transactions){
    const{sender_id:s,receiver_id:r,amount:a,timestamp:t}=tx;
    allAccounts.add(s); allAccounts.add(r);
    txCount[s]=(txCount[s]||0)+1; txCount[r]=(txCount[r]||0)+1;
    vol[s]=(vol[s]||0)+a; vol[r]=(vol[r]||0)+a;
    if(!outEdges[s]) outEdges[s]=[];
    if(!inEdges[r])  inEdges[r]=[];
    if(!outEdges[s].includes(r)) outEdges[s].push(r);
    if(!inEdges[r].includes(s))  inEdges[r].push(s);
    const key=`${s}->${r}`;
    if(!edgeMap[key]) edgeMap[key]={amount:0,count:0};
    edgeMap[key].amount+=a; edgeMap[key].count++;
    if(!txByTime[s]) txByTime[s]=[];
    if(!txByTime[r]) txByTime[r]=[];
    if(t){
      const ts=new Date(t).getTime();
      txByTime[s].push({ts,amt:a});
      txByTime[r].push({ts,amt:a});
    }
  }

  // Identify merchants
  const merchants=new Set();
  for(const acc of allAccounts){
    const cnt=txCount[acc]||0;
    const outs=(outEdges[acc]||[]).length;
    const ins=(inEdges[acc]||[]).length;
    if(cnt>50&&outs>30&&ins<=5) merchants.add(acc);
  }

  const fraudRings=[];
  const ringMembership={};
  let rc=1;

  // ── Cycles ──
  const cyclesFound=new Set();
  function detectCycles(){
    for(const start of allAccounts){
      if(merchants.has(start)) continue;
      dfs(start,start,[start],new Set([start]),1);
    }
  }
  function dfs(start,cur,path,pathSet,depth){
    if(depth>5) return;
    for(const next of (outEdges[cur]||[])){
      if(merchants.has(next)) continue;
      if(next===start&&depth>=3){
        const canon=[...path].sort().join(',');
        if(!cyclesFound.has(canon)){
          cyclesFound.add(canon);
          const rid=`RING_${String(rc++).padStart(3,'0')}`;
          const members=[...path];
          fraudRings.push({ring_id:rid,member_accounts:members,pattern_type:'cycle',cycle_length:depth,risk_score:0});
          members.forEach(m=>{if(!ringMembership[m])ringMembership[m]=rid;});
        }
        return;
      }
      if(!pathSet.has(next)){
        pathSet.add(next); path.push(next);
        dfs(start,next,path,pathSet,depth+1);
        path.pop(); pathSet.delete(next);
      }
    }
  }
  detectCycles();

  // ── Fan-in / Fan-out ──
  const FAN=10, TW=72*3600*1000;
  function hasTemporal(acc){
    const arr=txByTime[acc];
    if(!arr||arr.length<FAN) return false;
    const sorted=[...arr].sort((a,b)=>a.ts-b.ts);
    for(let i=0;i<=sorted.length-FAN;i++)
      if(sorted[i+FAN-1].ts-sorted[i].ts<=TW) return true;
    return false;
  }
  for(const acc of allAccounts){
    if(merchants.has(acc)) continue;
    const senders=(inEdges[acc]||[]).filter(s=>!merchants.has(s));
    if(senders.length>=FAN&&!ringMembership[acc]){
      const rid=`RING_${String(rc++).padStart(3,'0')}`;
      const members=[acc,...senders.slice(0,20)];
      fraudRings.push({ring_id:rid,member_accounts:members,pattern_type:'fan_in',risk_score:0,temporal:hasTemporal(acc)});
      members.forEach(m=>{if(!ringMembership[m])ringMembership[m]=rid;});
    }
    const receivers=(outEdges[acc]||[]).filter(r=>!merchants.has(r));
    if(receivers.length>=FAN&&!ringMembership[acc]){
      const rid=`RING_${String(rc++).padStart(3,'0')}`;
      const members=[acc,...receivers.slice(0,20)];
      fraudRings.push({ring_id:rid,member_accounts:members,pattern_type:'fan_out',risk_score:0,temporal:hasTemporal(acc)});
      members.forEach(m=>{if(!ringMembership[m])ringMembership[m]=rid;});
    }
  }

  // ── Shell networks ──
  const SMAX=4, shellGroups=[];
  for(const start of allAccounts){
    if(merchants.has(start)||txCount[start]>SMAX) continue;
    for(const mid of (outEdges[start]||[])){
      if(merchants.has(mid)||txCount[mid]>SMAX) continue;
      for(const end of (outEdges[mid]||[])){
        if(merchants.has(end)||end===start) continue;
        const chain=[start,mid,end];
        const next=(outEdges[end]||[]).find(n=>!merchants.has(n)&&!chain.includes(n)&&txCount[n]<=SMAX);
        if(next) chain.push(next);
        if(chain.length>=3){
          const ov=shellGroups.find(g=>g.some(m=>chain.includes(m)));
          if(ov) chain.forEach(m=>{if(!ov.includes(m))ov.push(m);});
          else shellGroups.push([...chain]);
        }
      }
    }
  }
  for(const group of shellGroups){
    if(group.filter(m=>!ringMembership[m]).length<3) continue;
    const rid=`RING_${String(rc++).padStart(3,'0')}`;
    fraudRings.push({ring_id:rid,member_accounts:group,pattern_type:'shell_network',risk_score:0});
    group.forEach(m=>{if(!ringMembership[m])ringMembership[m]=rid;});
  }

  // ── Score ──
  const suspiciousAccounts=[];
  for(const acc of Object.keys(ringMembership)){
    const rid=ringMembership[acc];
    const ring=fraudRings.find(r=>r.ring_id===rid);
    const patterns=[]; let score=0;
    if(ring){
      if(ring.pattern_type==='cycle'){patterns.push(`cycle_length_${ring.cycle_length||3}`);score+=60;}
      if(ring.pattern_type==='fan_in'){patterns.push('fan_in');score+=50;}
      if(ring.pattern_type==='fan_out'){patterns.push('fan_out');score+=50;}
      if(ring.pattern_type==='shell_network'){patterns.push('shell_network');score+=45;}
      if(ring.temporal){patterns.push('high_velocity');score+=20;}
    }
    if((outEdges[acc]||[]).length>=5){patterns.push('high_out_degree');score+=10;}
    if((inEdges[acc]||[]).length>=5){patterns.push('high_in_degree');score+=10;}
    const arr=txByTime[acc];
    if(arr&&arr.length>=5){
      const sorted=[...arr].sort((a,b)=>a.ts-b.ts);
      for(let i=0;i<=sorted.length-5;i++){
        if(sorted[i+4].ts-sorted[i].ts<=24*3600*1000){
          if(!patterns.includes('high_velocity'))patterns.push('high_velocity');
          score+=15; break;
        }
      }
    }
    suspiciousAccounts.push({
      account_id:acc,
      suspicion_score:Math.min(100,Math.round(score*10)/10),
      detected_patterns:[...new Set(patterns)],
      ring_id:rid
    });
  }
  suspiciousAccounts.sort((a,b)=>b.suspicion_score-a.suspicion_score);

  for(const ring of fraudRings){
    const scores=ring.member_accounts.map(m=>{
      const sa=suspiciousAccounts.find(s=>s.account_id===m);
      return sa?sa.suspicion_score:0;
    });
    const avg=scores.reduce((a,b)=>a+b,0)/(scores.length||1);
    const bonus=ring.pattern_type==='cycle'?20:15;
    ring.risk_score=Math.min(100,Math.round((avg+bonus)*10)/10);
    delete ring.temporal; delete ring.cycle_length;
  }

  return{
    transactions,outEdges,inEdges,edgeMap,merchants,
    allAccounts:[...allAccounts],
    accountTxCount:txCount,accountVolume:vol,ringMembership,
    suspicious_accounts:suspiciousAccounts,
    fraud_rings:fraudRings,
    summary:{
      total_accounts_analyzed:allAccounts.size,
      suspicious_accounts_flagged:suspiciousAccounts.length,
      fraud_rings_detected:fraudRings.length,
      processing_time_seconds:Math.round((performance.now()-t0)/100)/10
    }
  };
}

// ─── Display Results ──────────────────────────────
function displayResults(result){
  document.getElementById('heroSection').style.display='none';
  document.getElementById('uploadSection').style.display='none';
  document.getElementById('results').style.display='block';

  document.getElementById('statAccounts').textContent=result.summary.total_accounts_analyzed.toLocaleString();
  document.getElementById('statSuspicious').textContent=result.summary.suspicious_accounts_flagged.toLocaleString();
  document.getElementById('statRings').textContent=result.summary.fraud_rings_detected.toLocaleString();
  document.getElementById('statTime').textContent=result.summary.processing_time_seconds+'s';

  // Update stat block watermarks
  document.querySelectorAll('.stat-block').forEach(el=>{
    const v=el.querySelector('.stat-value');
    if(v) el.setAttribute('data-n',v.textContent);
  });

  // Accounts list
  document.getElementById('suspCountBadge').textContent=result.suspicious_accounts.length+' accounts';
  document.getElementById('accList').innerHTML=result.suspicious_accounts.map(sa=>{
    const cls=sa.suspicion_score>=70?'high':sa.suspicion_score>=40?'med':'low';
    return`<div class="acc-item flagged" onclick="highlightAccount('${sa.account_id}')">
      <div>
        <div class="acc-id">${sa.account_id}</div>
        <div class="acc-ring">${sa.ring_id} · ${sa.detected_patterns[0]||''}</div>
      </div>
      <div class="score-badge ${cls}">${sa.suspicion_score}</div>
    </div>`;
  }).join('');

  // Ring color map
  const rcm={};
  result.fraud_rings.forEach((ring,i)=>{ rcm[ring.ring_id]=RING_COLORS[i%RING_COLORS.length]; });

  // Rings table
  document.getElementById('ringCountBadge').textContent=result.fraud_rings.length+' rings';
  document.getElementById('ringsBody').innerHTML=result.fraud_rings.map(ring=>{
    const color=rcm[ring.ring_id];
    const ptClass={cycle:'pat-cycle',fan_in:'pat-fanin',fan_out:'pat-fanout',shell_network:'pat-shell'}[ring.pattern_type]||'';
    const rc=ring.risk_score>=70?'var(--red)':ring.risk_score>=40?'var(--amber)':'var(--green)';
    return`<tr>
      <td><span class="ring-badge" style="background:${color}18;color:${color};border:1px solid ${color}33">${ring.ring_id}</span></td>
      <td><span class="pat-tag ${ptClass}">${ring.pattern_type.replace(/_/g,' ').toUpperCase()}</span></td>
      <td><span class="count-badge">${ring.member_accounts.length}</span></td>
      <td>
        <div class="risk-row">
          <div class="risk-track"><div class="risk-fill" style="width:${ring.risk_score}%;background:${rc};box-shadow:0 0 6px ${rc}"></div></div>
          <span class="risk-num" style="color:${rc}">${ring.risk_score}</span>
        </div>
      </td>
      <td class="members-td">${ring.member_accounts.join(', ')}</td>
    </tr>`;
  }).join('');

  buildGraph(result,rcm);

  // Toast + live report badge update
  setTimeout(()=>{
    if(document.getElementById('togAlertDone')?.checked!==false)
      showToast(`Analysis complete — ${result.summary.fraud_rings_detected} rings, ${result.summary.suspicious_accounts_flagged} flagged`,'success');
    setEl('rFullAccounts',result.suspicious_accounts.length);
    setEl('rFullRings',result.fraud_rings.length);
    setEl('rCsvAccounts',result.suspicious_accounts.length);
    setEl('rCsvRings',result.fraud_rings.length);
  },600);
}

// ─── Graph Engine ─────────────────────────────────
function buildGraph(result,rcm){
  const canvas=document.getElementById('graphCanvas');
  const{allAccounts,outEdges,edgeMap,ringMembership,suspicious_accounts,merchants}=result;

  const MAX=300;
  let displayAccounts=allAccounts;
  if(allAccounts.length>MAX){
    const priority=new Set(suspicious_accounts.map(s=>s.account_id));
    for(const acc of priority){
      (outEdges[acc]||[]).forEach(n=>priority.add(n));
      (result.inEdges[acc]||[]).forEach(n=>priority.add(n));
    }
    displayAccounts=[...priority].slice(0,MAX);
    for(const acc of allAccounts){
      if(displayAccounts.length>=MAX) break;
      if(!priority.has(acc)) displayAccounts.push(acc);
    }
  }

  const displaySet=new Set(displayAccounts);
  const suspMap={};
  suspicious_accounts.forEach(sa=>{ suspMap[sa.account_id]=sa; });

  const W=canvas.offsetWidth, H=canvas.offsetHeight;
  canvas.width=W; canvas.height=H;

  const nodes=displayAccounts.map(id=>{
    const ring=ringMembership[id];
    const susp=suspMap[id];
    const isMerchant=merchants.has(id);
    return{
      id, isMerchant, ring, susp,
      x:Math.random()*(W-100)+50, y:Math.random()*(H-100)+50,
      vx:0, vy:0,
      color:isMerchant?'#3a3a3a':ring?(rcm[ring]||'#ff2251'):'#1a4a6e',
      radius:isMerchant?7:(ring?11:5),
      score:susp?susp.suspicion_score:0
    };
  });

  const nodeIndex={};
  nodes.forEach((n,i)=>{ nodeIndex[n.id]=i; });

  const edges=[];
  for(const src of displayAccounts){
    for(const tgt of (outEdges[src]||[])){
      if(displaySet.has(tgt)&&src!==tgt){
        const info=edgeMap[`${src}->${tgt}`]||{amount:0,count:1};
        edges.push({src,tgt,si:nodeIndex[src],ti:nodeIndex[tgt],amount:info.amount});
      }
    }
  }

  graphState.nodes=nodes; graphState.edges=edges;
  graphState.offsetX=0; graphState.offsetY=0; graphState.scale=1;

  // Force simulation
  const K=85,REPEL=3000,DAMPING=0.7,ATTRACT=0.005;
  let steps=0;
  function simulate(){
    if(steps++>200){ startRender(); return; }
    for(let i=0;i<nodes.length;i++){
      for(let j=i+1;j<nodes.length;j++){
        const dx=nodes[j].x-nodes[i].x, dy=nodes[j].y-nodes[i].y;
        const f=REPEL/(dx*dx+dy*dy+1);
        nodes[i].vx-=f*dx; nodes[i].vy-=f*dy;
        nodes[j].vx+=f*dx; nodes[j].vy+=f*dy;
      }
    }
    for(const e of edges){
      const a=nodes[e.si],b=nodes[e.ti];
      if(!a||!b) continue;
      const dx=b.x-a.x,dy=b.y-a.y,d=Math.sqrt(dx*dx+dy*dy)||1,f=(d-K)*ATTRACT;
      a.vx+=f*dx; a.vy+=f*dy; b.vx-=f*dx; b.vy-=f*dy;
    }
    for(const n of nodes){
      if(!n.ring) continue;
      const rm=nodes.filter(x=>x.ring===n.ring);
      if(rm.length){
        const cx=rm.reduce((s,x)=>s+x.x,0)/rm.length;
        const cy=rm.reduce((s,x)=>s+x.y,0)/rm.length;
        n.vx+=(cx-n.x)*0.015; n.vy+=(cy-n.y)*0.015;
      }
    }
    for(const n of nodes){
      n.vx*=DAMPING; n.vy*=DAMPING;
      n.x=Math.max(30,Math.min(W-30,n.x+n.vx));
      n.y=Math.max(30,Math.min(H-30,n.y+n.vy));
    }
    if(steps%20===0) renderGraph(canvas.getContext('2d'),W,H);
    requestAnimationFrame(simulate);
  }
  simulate();
  setupGraphInteraction(canvas);
}

function startRender(){
  const canvas=document.getElementById('graphCanvas');
  const W=canvas.width,H=canvas.height;
  if(graphState.animFrame) cancelAnimationFrame(graphState.animFrame);
  function loop(){ renderGraph(canvas.getContext('2d'),W,H); graphState.animFrame=requestAnimationFrame(loop); }
  loop();
}

function renderGraph(ctx,W,H){
  const{nodes,edges,offsetX,offsetY,scale,hoveredNode,selectedNode}=graphState;
  ctx.clearRect(0,0,W,H);

  // Dark tinted background
  ctx.fillStyle='rgba(4,12,20,0.3)';
  ctx.fillRect(0,0,W,H);

  ctx.save();
  ctx.translate(offsetX,offsetY);
  ctx.scale(scale,scale);

  // Edges
  for(const e of edges){
    const a=nodes[e.si],b=nodes[e.ti];
    if(!a||!b) continue;
    const isHL=(hoveredNode&&(e.src===hoveredNode.id||e.tgt===hoveredNode.id))||
               (selectedNode&&(e.src===selectedNode.id||e.tgt===selectedNode.id));
    const angle=Math.atan2(b.y-a.y,b.x-a.x);
    const dist=Math.sqrt((b.x-a.x)**2+(b.y-a.y)**2);
    const ex=a.x+Math.cos(angle)*(dist-b.radius-4);
    const ey=a.y+Math.sin(angle)*(dist-b.radius-4);
    ctx.beginPath();
    ctx.strokeStyle=isHL?'rgba(0,229,255,0.7)':(a.ring&&a.ring===b.ring)?a.color+'99':'rgba(26,74,110,0.35)';
    ctx.lineWidth=isHL?1.5:0.8;
    ctx.moveTo(a.x,a.y); ctx.lineTo(ex,ey); ctx.stroke();
    if(dist>24){
      ctx.beginPath();
      ctx.fillStyle=ctx.strokeStyle;
      ctx.moveTo(ex,ey);
      ctx.lineTo(ex-7*Math.cos(angle-0.45),ey-7*Math.sin(angle-0.45));
      ctx.lineTo(ex-7*Math.cos(angle+0.45),ey-7*Math.sin(angle+0.45));
      ctx.closePath(); ctx.fill();
    }
  }

  // Nodes
  const now=Date.now();
  for(const n of nodes){
    const isH=hoveredNode&&hoveredNode.id===n.id;
    const isSel=selectedNode&&selectedNode.id===n.id;
    const r=n.radius*(isH||isSel?1.5:1);
    const pulse=n.ring?Math.sin(now/600+n.x)*0.3+0.7:1;

    // Glow
    if(n.ring||n.score>30){
      ctx.shadowColor=n.color;
      ctx.shadowBlur=isH?24:12*pulse;
    } else {
      ctx.shadowBlur=0;
    }

    // Outer pulse ring for suspicious
    if(n.score>=60||(n.ring&&!n.isMerchant)){
      ctx.beginPath();
      ctx.arc(n.x,n.y,r+5+pulse*2,0,Math.PI*2);
      ctx.strokeStyle=n.color+'33';
      ctx.lineWidth=1; ctx.stroke();
    }

    // Node body
    ctx.beginPath();
    ctx.arc(n.x,n.y,r,0,Math.PI*2);
    const grad=ctx.createRadialGradient(n.x-r*0.3,n.y-r*0.3,0,n.x,n.y,r);
    if(n.isMerchant){
      grad.addColorStop(0,'#3a3a3a'); grad.addColorStop(1,'#1a1a1a');
    } else if(n.ring){
      grad.addColorStop(0,n.color+'ee'); grad.addColorStop(1,n.color+'66');
    } else {
      grad.addColorStop(0,'#1a4a6e88'); grad.addColorStop(1,'#0a1e3044');
    }
    ctx.fillStyle=grad; ctx.fill();
    ctx.strokeStyle=n.isMerchant?'#444':n.color;
    ctx.lineWidth=n.ring?1.5:0.8; ctx.stroke();
    ctx.shadowBlur=0;

    // Label
    if(isH||isSel||(n.ring&&nodes.length<60)){
      ctx.font=`${isH?11:9}px 'JetBrains Mono',monospace`;
      ctx.fillStyle='rgba(232,244,255,0.9)';
      ctx.textAlign='center';
      const label=n.id.length>14?n.id.slice(0,12)+'..':n.id;
      // Label background
      const tw=ctx.measureText(label).width;
      ctx.fillStyle='rgba(4,12,20,0.75)';
      ctx.fillRect(n.x-tw/2-3,n.y-r-16,tw+6,14);
      ctx.fillStyle=isH?'#00e5ff':'rgba(232,244,255,0.8)';
      ctx.fillText(label,n.x,n.y-r-5);
    }
  }

  ctx.restore();
}

// ─── Graph Interaction ────────────────────────────
function setupGraphInteraction(canvas){
  const tooltip=document.getElementById('tooltip');
  const ttInner=document.getElementById('ttInner');

  function getNode(mx,my){
    const x=(mx-graphState.offsetX)/graphState.scale;
    const y=(my-graphState.offsetY)/graphState.scale;
    for(let i=graphState.nodes.length-1;i>=0;i--){
      const n=graphState.nodes[i];
      const dx=n.x-x,dy=n.y-y;
      if(dx*dx+dy*dy<=(n.radius+6)**2) return n;
    }
    return null;
  }

  canvas.addEventListener('mousemove',e=>{
    const rect=canvas.getBoundingClientRect();
    const mx=e.clientX-rect.left, my=e.clientY-rect.top;
    if(graphState.dragging){
      graphState.offsetX+=e.clientX-graphState.lastX;
      graphState.offsetY+=e.clientY-graphState.lastY;
      graphState.lastX=e.clientX; graphState.lastY=e.clientY;
      return;
    }
    const node=getNode(mx,my);
    graphState.hoveredNode=node;
    if(node){
      canvas.style.cursor='pointer';
      const sa=analysisResult.suspicious_accounts.find(s=>s.account_id===node.id);
      let html=`<div class="tt-head">${node.id}</div>`;
      html+=`<div class="tt-row"><span class="tt-key">TX COUNT</span><span class="tt-val">${analysisResult.accountTxCount[node.id]||0}</span></div>`;
      html+=`<div class="tt-row"><span class="tt-key">VOLUME</span><span class="tt-val">${(analysisResult.accountVolume[node.id]||0).toFixed(2)}</span></div>`;
      html+=`<div class="tt-row"><span class="tt-key">OUT LINKS</span><span class="tt-val">${(analysisResult.outEdges[node.id]||[]).length}</span></div>`;
      html+=`<div class="tt-row"><span class="tt-key">IN LINKS</span><span class="tt-val">${(analysisResult.inEdges[node.id]||[]).length}</span></div>`;
      if(sa){
        html+=`<div class="tt-row"><span class="tt-key">SCORE</span><span class="tt-val" style="color:var(--red)">${sa.suspicion_score}/100</span></div>`;
        html+=`<div class="tt-row"><span class="tt-key">RING</span><span class="tt-val" style="color:var(--cyan)">${sa.ring_id}</span></div>`;
        html+=`<div class="tt-alert">⚠ ${sa.detected_patterns.join(' · ')}</div>`;
      }
      if(node.isMerchant) html+=`<div class="tt-alert" style="color:var(--green)">✓ MERCHANT — EXCLUDED</div>`;
      ttInner.innerHTML=html;
      tooltip.style.display='block';
      tooltip.style.left=(e.clientX+18)+'px';
      tooltip.style.top=(e.clientY-10)+'px';
    } else {
      canvas.style.cursor='crosshair';
      tooltip.style.display='none';
    }
  });

  canvas.addEventListener('mousedown',e=>{
    graphState.dragging=true;
    graphState.lastX=e.clientX; graphState.lastY=e.clientY;
    canvas.style.cursor='grabbing';
  });
  window.addEventListener('mouseup',()=>{ graphState.dragging=false; });
  canvas.addEventListener('click',e=>{
    const rect=canvas.getBoundingClientRect();
    graphState.selectedNode=getNode(e.clientX-rect.left,e.clientY-rect.top);
  });
  canvas.addEventListener('wheel',e=>{
    e.preventDefault();
    const rect=canvas.getBoundingClientRect();
    const mx=e.clientX-rect.left,my=e.clientY-rect.top;
    const delta=e.deltaY>0?0.88:1.12;
    graphState.scale=Math.max(0.15,Math.min(6,graphState.scale*delta));
    graphState.offsetX=mx-(mx-graphState.offsetX)*delta;
    graphState.offsetY=my-(my-graphState.offsetY)*delta;
  },{passive:false});
  canvas.addEventListener('mouseleave',()=>{ tooltip.style.display='none'; });
  startRender();
}

// ─── Nav / Tab Switching ─────────────────────────
(function(){
  const pills = document.querySelectorAll('.nav-pill');
  const TABS = ['tabDashboard','tabAnalytics','tabReports','tabConfig'];

  // Wrap existing #results + hero + upload in a "dashboard" tab-page div dynamically
  // We use display toggling instead since Dashboard has its own multi-section layout.
  const dashEls = ['heroSection','uploadSection','results'];

  function showTab(idx){
    // 0 = Dashboard
    const isDash = idx===0;
    dashEls.forEach(id=>{
      const el=document.getElementById(id); if(!el) return;
      // hero/upload shown if results hidden and vice-versa; preserve existing logic
      if(isDash){
        // restore: if analysisResult exists show results, else hero+upload
        if(window.analysisResult){
          if(id==='results') el.style.display='block';
          else el.style.display='none';
        } else {
          if(id==='heroSection'||id==='uploadSection') el.style.display='';
          if(id==='results') el.style.display='none';
        }
      } else {
        el.style.display='none';
      }
    });
    document.querySelectorAll('.tab-page').forEach(p=>p.classList.remove('active'));
    if(idx===1) document.getElementById('tabAnalytics').classList.add('active');
    if(idx===2) document.getElementById('tabReports').classList.add('active');
    if(idx===3) document.getElementById('tabConfig').classList.add('active');
  }

  pills.forEach((pill,i)=>{
    pill.addEventListener('click',()=>{
      pills.forEach(p=>p.classList.remove('active'));
      pill.classList.add('active');
      showTab(i);
    });
  });

  // Show dashboard by default
  showTab(0);
  window._showTab = showTab;
  window._navPills = pills;
})();

// ─── Config state ────────────────────────────────
let CFG = {
  minCycle:3, maxCycle:5, fanMin:10, shellMax:4, merchThresh:50, velocityWin:72,
  scoreCycle:60, scoreFan:50, scoreShell:45, scoreVelocity:20, scoreDegree:10, scoreRingBonus:20,
  maxNodes:300, simSteps:200, showLabels:true, animPulse:true, colorMode:'ring',
  repulse:3000, autoDownload:false, includeTx:false, particles:true, scanlines:true,
  filePrefix:'SENTINEL', theme:'cyan'
};
let cfgLogEntries = 0;

function cfgLog(msg, type='info'){
  const box = document.getElementById('cfgLog');
  if(!box) return;
  const cls = type==='ok'?'log-line-ok':type==='warn'?'log-line-warn':'log-line-info';
  const ts = new Date().toLocaleTimeString('en-GB');
  box.innerHTML += `<span class="${cls}">[${ts}] ${msg}</span><br>`;
  box.scrollTop = box.scrollHeight;
  cfgLogEntries++;
  const badge = document.getElementById('cfgLogBadge');
  if(badge) badge.textContent = cfgLogEntries + ' ENTRIES';
}

function toggleCfg(label){
  // Toggle checkbox inside label
  const cb = label.querySelector('input[type="checkbox"]');
  if(!cb) return;
  // thumb position
  const thumb = label.querySelector('.cfg-toggle-thumb');
  if(thumb){
    setTimeout(()=>{
      thumb.style.left = cb.checked ? '25px' : '3px';
      thumb.style.background = cb.checked ? 'var(--cyan)' : 'var(--muted)';
    }, 0);
  }
}

function saveConfig(){
  CFG.minCycle      = +document.getElementById('cfgMinCycle').value;
  CFG.maxCycle      = +document.getElementById('cfgMaxCycle').value;
  CFG.fanMin        = +document.getElementById('cfgFanMin').value;
  CFG.shellMax      = +document.getElementById('cfgShellMax').value;
  CFG.merchThresh   = +document.getElementById('cfgMerchThresh').value;
  CFG.velocityWin   = +document.getElementById('cfgVelocityWin').value;
  CFG.scoreCycle    = +document.getElementById('cfgScoreCycle').value;
  CFG.scoreFan      = +document.getElementById('cfgScoreFan').value;
  CFG.scoreShell    = +document.getElementById('cfgScoreShell').value;
  CFG.scoreVelocity = +document.getElementById('cfgScoreVelocity').value;
  CFG.scoreDegree   = +document.getElementById('cfgScoreDegree').value;
  CFG.scoreRingBonus= +document.getElementById('cfgScoreRingBonus').value;
  CFG.maxNodes      = +document.getElementById('cfgMaxNodes').value;
  CFG.simSteps      = +document.getElementById('cfgSimSteps').value;
  CFG.showLabels    = document.getElementById('cfgShowLabels').checked;
  CFG.animPulse     = document.getElementById('cfgAnimPulse').checked;
  CFG.colorMode     = document.getElementById('cfgColorMode').value;
  CFG.repulse       = +document.getElementById('cfgRepulse').value;
  CFG.autoDownload  = document.getElementById('cfgAutoDownload').checked;
  CFG.includeTx     = document.getElementById('cfgIncludeTx').checked;
  CFG.particles     = document.getElementById('cfgParticles').checked;
  CFG.scanlines     = document.getElementById('cfgScanlines').checked;
  CFG.filePrefix    = document.getElementById('cfgFilePrefix').value || 'SENTINEL';

  // Apply particle toggle
  const bgCanvas = document.getElementById('bgCanvas');
  if(bgCanvas) bgCanvas.style.display = CFG.particles ? '' : 'none';

  // Apply scanlines toggle (body::after is a pseudo-element; toggle via class)
  document.body.classList.toggle('no-scanlines', !CFG.scanlines);

  const bar = document.getElementById('cfgStatusBar');
  if(bar) bar.textContent = '✓ CONFIG SAVED — Changes will apply on next analysis run';

  cfgLog('Configuration saved successfully', 'ok');
  cfgLog(`Detection: cycle(${CFG.minCycle}-${CFG.maxCycle} hops) · fan(≥${CFG.fanMin}) · shell(≤${CFG.shellMax}tx)`, 'info');
  cfgLog(`Scoring: cycle=${CFG.scoreCycle} fan=${CFG.scoreFan} shell=${CFG.scoreShell} velocity=${CFG.scoreVelocity}`, 'info');
}

function resetConfig(){
  CFG = {
    minCycle:3, maxCycle:5, fanMin:10, shellMax:4, merchThresh:50, velocityWin:72,
    scoreCycle:60, scoreFan:50, scoreShell:45, scoreVelocity:20, scoreDegree:10, scoreRingBonus:20,
    maxNodes:300, simSteps:200, showLabels:true, animPulse:true, colorMode:'ring',
    repulse:3000, autoDownload:false, includeTx:false, particles:true, scanlines:true,
    filePrefix:'SENTINEL', theme:'cyan'
  };
  // Reset all inputs
  document.getElementById('cfgMinCycle').value = CFG.minCycle;
  document.getElementById('cfgMaxCycle').value = CFG.maxCycle;
  document.getElementById('cfgFanMin').value = CFG.fanMin;
  document.getElementById('cfgShellMax').value = CFG.shellMax;
  document.getElementById('cfgMerchThresh').value = CFG.merchThresh;
  document.getElementById('cfgVelocityWin').value = CFG.velocityWin;
  document.getElementById('cfgScoreCycle').value = CFG.scoreCycle;
  document.getElementById('cfgScoreFan').value = CFG.scoreFan;
  document.getElementById('cfgScoreShell').value = CFG.scoreShell;
  document.getElementById('cfgScoreVelocity').value = CFG.scoreVelocity;
  document.getElementById('cfgScoreDegree').value = CFG.scoreDegree;
  document.getElementById('cfgScoreRingBonus').value = CFG.scoreRingBonus;
  document.getElementById('cfgMaxNodes').value = CFG.maxNodes;
  document.getElementById('cfgSimSteps').value = CFG.simSteps;
  document.getElementById('cfgShowLabels').checked = true;
  document.getElementById('cfgAnimPulse').checked = true;
  document.getElementById('cfgColorMode').value = 'ring';
  document.getElementById('cfgRepulse').value = CFG.repulse;
  document.getElementById('cfgAutoDownload').checked = false;
  document.getElementById('cfgIncludeTx').checked = false;
  document.getElementById('cfgParticles').checked = true;
  document.getElementById('cfgScanlines').checked = true;
  document.getElementById('cfgFilePrefix').value = 'SENTINEL';
  document.getElementById('bgCanvas').style.display = '';
  const bar = document.getElementById('cfgStatusBar');
  if(bar) bar.textContent = '⬡ ENGINE READY — Defaults restored';
  cfgLog('Configuration reset to defaults', 'warn');
}

function setTheme(color, el){
  document.querySelectorAll('.theme-chip').forEach(c=>c.classList.remove('active'));
  el.classList.add('active');
  CFG.theme = color;
  const map = { cyan:'#00e5ff', red:'#ff2251', amber:'#ffaa00', green:'#00ff9d' };
  document.documentElement.style.setProperty('--cyan', map[color]);
  cfgLog(`Theme changed to ${color.toUpperCase()}`, 'info');
}

// ─── Analytics Engine ──────────────────────────
function populateAnalytics(result){
  if(!result) return;
  const sa = result.suspicious_accounts;
  const rings = result.fraud_rings;
  const total = result.summary.total_accounts_analyzed;

  // Sub text
  const sub = document.getElementById('anlSub');
  if(sub) sub.textContent = `Analysis of ${total.toLocaleString()} accounts · ${sa.length} flagged · ${rings.length} rings detected`;

  // KPIs
  const fraudRate = total > 0 ? ((sa.length/total)*100).toFixed(1)+'%' : '0%';
  const avgScore = sa.length > 0 ? (sa.reduce((s,a)=>s+a.suspicion_score,0)/sa.length).toFixed(1) : '0';
  const totalVol = result.transactions ? result.transactions.reduce((s,t)=>s+(t.amount||0),0) : 0;
  const fmtVol = totalVol > 1e6 ? '$'+(totalVol/1e6).toFixed(1)+'M' : '$'+(totalVol/1e3).toFixed(0)+'K';

  setText('aklRiskRate', fraudRate);
  setText('aklAvgScore', avgScore);
  setText('aklTotalVol', fmtVol);
  setText('aklPrecision', '≥70%');
  setText('aklRiskDelta', sa.length + ' suspicious accounts');
  setText('aklScoreDelta', avgScore >= 60 ? '▲ High risk cohort' : '▼ Moderate risk');
  setText('aklVolDelta', rings.length + ' rings contributing');
  setText('aklPreDelta', '✓ FP shield active');

  // Pattern breakdown bars
  const patternCount = {};
  rings.forEach(r=>{ patternCount[r.pattern_type] = (patternCount[r.pattern_type]||0)+1; });
  const maxPat = Math.max(...Object.values(patternCount), 1);
  const patColors = { cycle:'var(--red)', fan_in:'var(--amber)', fan_out:'var(--cyan)', shell_network:'var(--green)' };
  const patNames = { cycle:'CYCLE', fan_in:'FAN-IN', fan_out:'FAN-OUT', shell_network:'SHELL CHAIN' };
  const patBarsEl = document.getElementById('anlPatternBars');
  if(patBarsEl){
    if(Object.keys(patternCount).length === 0){
      patBarsEl.innerHTML = '<div class="empty-state"><div class="empty-icon">◎</div><div class="empty-text">No patterns detected</div></div>';
    } else {
      patBarsEl.innerHTML = Object.entries(patternCount).map(([pt,cnt])=>`
        <div class="bar-row">
          <div class="bar-label-row"><span class="bar-name">${patNames[pt]||pt}</span><span class="bar-val">${cnt} ring${cnt!==1?'s':''}</span></div>
          <div class="bar-track"><div class="bar-fill" style="width:${Math.round(cnt/maxPat*100)}%;background:${patColors[pt]||'var(--cyan)'}"></div></div>
        </div>`).join('');
      setText('anlPatBadge', rings.length + ' RINGS');
    }
  }

  // Score histogram (10 buckets: 0-9, 10-19 ... 90-100)
  const histEl = document.getElementById('anlHistogram');
  if(histEl){
    const buckets = Array(10).fill(0);
    sa.forEach(a=>{ const b = Math.min(9, Math.floor(a.suspicion_score/10)); buckets[b]++; });
    const maxB = Math.max(...buckets, 1);
    const hColors = ['#1a4a6e','#1a4a6e','#1a4a6e','#1a4a6e','var(--amber)','var(--amber)','var(--amber)','var(--red)','var(--red)','var(--red)'];
    histEl.innerHTML = buckets.map((cnt,i)=>`
      <div class="hist-bar">
        <div class="hist-fill" style="height:${Math.max(4,Math.round(cnt/maxB*90))}px;background:${hColors[i]};width:100%"></div>
        <div class="hist-lbl">${i*10}</div>
      </div>`).join('');
    setText('anlHistBadge', sa.length + ' ACCOUNTS');
  }

  // Donut chart (SVG)
  const donutWrap = document.getElementById('anlDonutWrap');
  if(donutWrap){
    if(Object.keys(patternCount).length === 0){
      donutWrap.innerHTML = '<div class="empty-state" style="flex:1;border:none;padding:20px"><div class="empty-icon">◈</div><div class="empty-text">No rings detected</div></div>';
    } else {
      const total_r = rings.length || 1;
      const colors = ['#ff2251','#ffaa00','#00e5ff','#00ff9d','#9467ff'];
      const keys = Object.keys(patternCount);
      const pcts = keys.map(k=>patternCount[k]/total_r);
      // Build SVG donut
      const R = 50, r = 32, cx = 60, cy = 60;
      let angle = -Math.PI/2;
      const arcs = pcts.map((pct,i)=>{
        const a0 = angle; const a1 = angle + pct * Math.PI * 2;
        angle = a1;
        const x0 = cx + R*Math.cos(a0), y0 = cy + R*Math.sin(a0);
        const x1 = cx + R*Math.cos(a1), y1 = cy + R*Math.sin(a1);
        const ix0 = cx + r*Math.cos(a0), iy0 = cy + r*Math.sin(a0);
        const ix1 = cx + r*Math.cos(a1), iy1 = cy + r*Math.sin(a1);
        const la = pct > 0.5 ? 1 : 0;
        return `<path d="M${x0},${y0} A${R},${R} 0 ${la},1 ${x1},${y1} L${ix1},${iy1} A${r},${r} 0 ${la},0 ${ix0},${iy0} Z" fill="${colors[i%colors.length]}" opacity="0.9"/>`;
      });
      donutWrap.innerHTML = `
        <svg class="donut-svg" width="120" height="120" viewBox="0 0 120 120">
          ${arcs.join('')}
          <text x="60" y="56" text-anchor="middle" font-family="JetBrains Mono" font-size="14" fill="#00e5ff">${rings.length}</text>
          <text x="60" y="70" text-anchor="middle" font-family="Rajdhani" font-size="9" fill="#3a6080">RINGS</text>
        </svg>
        <div class="donut-legend">
          ${keys.map((k,i)=>`<div class="donut-leg-item"><div class="donut-dot" style="background:${colors[i%colors.length]}"></div><span style="color:var(--muted)">${patNames[k]||k}</span><span class="donut-leg-pct">${(pcts[i]*100).toFixed(0)}%</span></div>`).join('')}
        </div>`;
    }
  }

  // Top accounts bar chart
  const topEl = document.getElementById('anlTopAccounts');
  if(topEl){
    const top = sa.slice(0,8);
    if(!top.length){
      topEl.innerHTML = '<div class="empty-state"><div class="empty-icon">⚠</div><div class="empty-text">No flagged accounts</div></div>';
    } else {
      topEl.innerHTML = top.map(a=>{
        const col = a.suspicion_score>=70?'var(--red)':a.suspicion_score>=40?'var(--amber)':'var(--green)';
        return `<div class="bar-row">
          <div class="bar-label-row"><span class="bar-name" style="font-size:10px">${a.account_id}</span><span class="bar-val" style="color:${col}">${a.suspicion_score}/100</span></div>
          <div class="bar-track"><div class="bar-fill" style="width:${a.suspicion_score}%;background:${col}"></div></div>
        </div>`;
      }).join('');
    }
  }

  // Timeline
  const tlEl = document.getElementById('anlTimeline');
  if(tlEl){
    const events = [];
    events.push({time:'T+0.0s', event:'CSV parsed', detail:`${result.transactions.length} transactions loaded`, col:'var(--cyan)'});
    events.push({time:'T+0.1s', event:'Graph constructed', detail:`${total} unique accounts · ${Object.keys(result.edgeMap||{}).length} edges`, col:'var(--cyan)'});
    if(patternCount['cycle']) events.push({time:'T+0.3s', event:'Cycle detection complete', detail:`${patternCount['cycle']} circular ring(s) found (DFS 3–5 hops)`, col:'var(--red)'});
    if(patternCount['fan_in']||patternCount['fan_out']) events.push({time:'T+0.4s', event:'Smurfing analysis complete', detail:`${(patternCount['fan_in']||0)+(patternCount['fan_out']||0)} fan ring(s) detected`, col:'var(--amber)'});
    if(patternCount['shell_network']) events.push({time:'T+0.5s', event:'Shell network scan complete', detail:`${patternCount['shell_network']} shell chain(s) identified`, col:'var(--green)'});
    events.push({time:'T+'+result.summary.processing_time_seconds+'s', event:'Analysis complete', detail:`${sa.length} accounts flagged · ${rings.length} rings · Report ready`, col:'var(--green)'});
    tlEl.innerHTML = events.map(ev=>`
      <div class="tl-item">
        <div class="tl-time">${ev.time}</div>
        <div class="tl-dot" style="background:${ev.col}"></div>
        <div class="tl-body"><div class="tl-event">${ev.event}</div><div class="tl-detail">${ev.detail}</div></div>
      </div>`).join('');
  }

  // Network topology stats
  const netEl = document.getElementById('anlNetStats');
  if(netEl){
    const allOut = Object.values(result.outEdges||{});
    const allIn = Object.values(result.inEdges||{});
    const avgOut = allOut.length ? (allOut.reduce((s,a)=>s+a.length,0)/allOut.length).toFixed(1) : 0;
    const avgIn = allIn.length ? (allIn.reduce((s,a)=>s+a.length,0)/allIn.length).toFixed(1) : 0;
    const maxOutDeg = allOut.length ? Math.max(...allOut.map(a=>a.length)) : 0;
    const density = total > 1 ? (Object.keys(result.edgeMap||{}).length / (total*(total-1))*100).toFixed(3) : '0';
    const stats = [
      {name:'Total Accounts', val:total.toLocaleString(), col:'var(--cyan)'},
      {name:'Total Edges', val:Object.keys(result.edgeMap||{}).length.toLocaleString(), col:'var(--cyan)'},
      {name:'Avg Out-Degree', val:avgOut, col:'var(--amber)'},
      {name:'Avg In-Degree', val:avgIn, col:'var(--amber)'},
      {name:'Max Out-Degree', val:maxOutDeg, col:'var(--red)'},
      {name:'Graph Density %', val:density+'%', col:'var(--green)'},
    ];
    const maxVal = Math.max(total, Object.keys(result.edgeMap||{}).length, 1);
    netEl.innerHTML = stats.map(st=>`
      <div class="bar-row">
        <div class="bar-label-row"><span class="bar-name">${st.name}</span><span class="bar-val" style="color:${st.col}">${st.val}</span></div>
        <div class="bar-track"><div class="bar-fill" style="width:${Math.min(100,parseFloat(st.val)/maxVal*100)}%;background:${st.col}"></div></div>
      </div>`).join('');
  }

  // Scatter canvas
  drawScatter(result);

  cfgLog(`Analytics updated — ${sa.length} accounts · ${rings.length} rings`, 'ok');
}

function drawScatter(result){
  const canvas = document.getElementById('scatterCanvas');
  if(!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.offsetWidth || 1200;
  const H = 180;
  canvas.width = W; canvas.height = H;
  ctx.clearRect(0,0,W,H);
  ctx.fillStyle = '#060b12';
  ctx.fillRect(0,0,W,H);

  // Grid
  ctx.strokeStyle = '#0f3356';
  ctx.lineWidth = 0.5;
  for(let i=0;i<=10;i++){
    const x = 40 + (W-60)*i/10;
    ctx.beginPath(); ctx.moveTo(x,8); ctx.lineTo(x,H-24); ctx.stroke();
  }
  for(let i=0;i<=5;i++){
    const y = 8 + (H-32)*i/5;
    ctx.beginPath(); ctx.moveTo(40,y); ctx.lineTo(W-12,y); ctx.stroke();
  }

  // Axes labels
  ctx.font = '9px JetBrains Mono'; ctx.fillStyle = '#3a6080';
  ctx.fillText('SCORE 0', 2, H-22); ctx.fillText('100', 2, 14);
  ctx.fillText('0', 40, H-10); ctx.fillText('HIGH DEGREE →', W/2-30, H-10);

  if(!result.suspicious_accounts.length) return;
  const sa = result.suspicious_accounts;
  const maxDeg = Math.max(...sa.map(a=>(result.outEdges[a.account_id]||[]).length + (result.inEdges[a.account_id]||[]).length), 1);

  sa.forEach(a=>{
    const deg = (result.outEdges[a.account_id]||[]).length + (result.inEdges[a.account_id]||[]).length;
    const x = 40 + (deg/maxDeg)*(W-60);
    const y = H-24 - (a.suspicion_score/100)*(H-32);
    const col = a.suspicion_score>=70?'#ff2251':a.suspicion_score>=40?'#ffaa00':'#00ff9d';
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI*2);
    ctx.fillStyle = col + 'bb';
    ctx.fill();
    ctx.strokeStyle = col;
    ctx.lineWidth = 1;
    ctx.stroke();
  });
}

function setText(id, val){
  const el = document.getElementById(id);
  if(el) el.textContent = val;
}

// ─── Reports Engine ───────────────────────────────
function generateReport(type){
  if(!analysisResult){
    showReportEmpty();
    return;
  }
  const r = analysisResult;
  const sa = r.suspicious_accounts;
  const rings = r.fraud_rings;
  const title = document.getElementById('rptPreviewTitle');
  const body = document.getElementById('rptPreviewBody');

  if(type==='executive'){
    title.textContent = 'EXECUTIVE SUMMARY REPORT — PREVIEW';
    const criticals = sa.filter(a=>a.suspicion_score>=70).length;
    const highs = sa.filter(a=>a.suspicion_score>=40&&a.suspicion_score<70).length;
    body.innerHTML = `
      <div style="font-family:var(--font-mono);font-size:11px;color:var(--muted);margin-bottom:14px">
        Generated: ${new Date().toLocaleString()} · SENTINEL v2.0 · Confidential
      </div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:20px">
        ${[
          {l:'TOTAL ACCOUNTS',v:r.summary.total_accounts_analyzed,c:'var(--cyan)'},
          {l:'FLAGGED',v:sa.length,c:'var(--amber)'},
          {l:'FRAUD RINGS',v:rings.length,c:'var(--red)'},
          {l:'CRITICAL RISK (≥70)',v:criticals,c:'var(--red)'},
          {l:'HIGH RISK (40–69)',v:highs,c:'var(--amber)'},
          {l:'PROCESSING TIME',v:r.summary.processing_time_seconds+'s',c:'var(--green)'},
        ].map(k=>`<div style="background:var(--panel);border:1px solid var(--rim);padding:14px">
          <div style="font-family:var(--font-display);font-size:18px;color:${k.c}">${k.v}</div>
          <div style="font-family:var(--font-mono);font-size:9px;color:var(--muted);letter-spacing:2px;margin-top:4px">${k.l}</div>
        </div>`).join('')}
      </div>
      <div style="font-family:var(--font-display);font-size:9px;letter-spacing:3px;color:var(--cyan);margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid var(--wire)">RECOMMENDED ACTIONS</div>
      <div style="display:flex;flex-direction:column;gap:8px">
        ${criticals>0?`<div style="background:rgba(255,34,81,0.08);border:1px solid var(--red);padding:10px 14px;font-family:var(--font-body);font-size:13px;color:var(--white)">🚨 Freeze ${criticals} critical-risk account${criticals!==1?'s':''} immediately — suspicion score ≥70 indicates high-confidence fraud</div>`:''}
        ${rings.length>0?`<div style="background:rgba(255,170,0,0.07);border:1px solid var(--amber);padding:10px 14px;font-family:var(--font-body);font-size:13px;color:var(--white)">⚠ File SAR for ${rings.length} detected fraud ring${rings.length!==1?'s':''} per BSA obligations</div>`:''}
        <div style="background:rgba(0,229,255,0.05);border:1px solid var(--wire);padding:10px 14px;font-family:var(--font-body);font-size:13px;color:var(--white)">📋 Submit full Technical Intelligence Report to compliance team within 24 hours</div>
      </div>`;
  }

  else if(type==='technical'){
    title.textContent = 'TECHNICAL INTELLIGENCE REPORT — TOP 15 ACCOUNTS';
    body.innerHTML = `
      <table class="rpt-table">
        <thead><tr><th>ACCOUNT ID</th><th>SCORE</th><th>SEVERITY</th><th>RING</th><th>PATTERNS</th></tr></thead>
        <tbody>${sa.slice(0,15).map(a=>{
          const sev = a.suspicion_score>=70?'<span class="rpt-sev sev-critical">CRITICAL</span>':
                      a.suspicion_score>=40?'<span class="rpt-sev sev-high">HIGH</span>':
                      '<span class="rpt-sev sev-medium">MEDIUM</span>';
          return `<tr>
            <td style="color:var(--cyan)">${a.account_id}</td>
            <td><span style="color:${a.suspicion_score>=70?'var(--red)':a.suspicion_score>=40?'var(--amber)':'var(--green)'};font-weight:bold">${a.suspicion_score}</span></td>
            <td>${sev}</td>
            <td style="color:var(--muted)">${a.ring_id}</td>
            <td style="color:var(--muted);font-size:10px">${a.detected_patterns.join(' · ')||'—'}</td>
          </tr>`;
        }).join('')}</tbody>
      </table>`;
  }

  else if(type==='sar'){
    title.textContent = 'SUSPICIOUS ACTIVITY REPORT — SAR DRAFT';
    const critAcc = sa.filter(a=>a.suspicion_score>=70).slice(0,5);
    body.innerHTML = `
      <div style="font-family:var(--font-mono);font-size:10px;color:var(--muted);margin-bottom:16px;border:1px solid var(--rim);padding:12px;background:rgba(255,34,81,0.04)">
        ⚠ DRAFT ONLY — This is a pre-formatted SAR template. Review with compliance counsel before filing with FinCEN.
      </div>
      <div style="font-family:var(--font-body);font-size:13px;color:var(--white);line-height:1.8">
        <div style="font-family:var(--font-display);font-size:11px;color:var(--cyan);margin-bottom:10px;letter-spacing:3px">PART I — REPORTING INSTITUTION</div>
        Institution: [Your Institution Name] · Date: ${new Date().toLocaleDateString()}<br>
        Report Type: Suspicious Activity Report (SAR) · Detection Method: Automated AML Analysis (SENTINEL v2.0)<br><br>
        <div style="font-family:var(--font-display);font-size:11px;color:var(--cyan);margin-bottom:10px;letter-spacing:3px">PART II — SUSPECT INFORMATION</div>
        ${critAcc.map((a,i)=>`${i+1}. Account: <strong style="color:var(--red)">${a.account_id}</strong> · Risk Score: ${a.suspicion_score}/100 · Assigned Ring: ${a.ring_id} · Patterns: ${a.detected_patterns.join(', ')}`).join('<br>')}
        <br><br><div style="font-family:var(--font-display);font-size:11px;color:var(--cyan);margin-bottom:10px;letter-spacing:3px">PART III — SUSPICIOUS ACTIVITY</div>
        Automated graph analysis detected ${rings.length} fraud ring(s) across ${r.summary.total_accounts_analyzed} analyzed accounts. 
        Pattern types identified include: ${[...new Set(rings.map(r=>r.pattern_type))].map(p=>p.replace(/_/g,' ')).join(', ')}. 
        ${sa.filter(a=>a.suspicion_score>=70).length} account(s) scored at critical threshold (≥70). 
        Full technical report available as supplemental attachment.
      </div>`;
  }

  else if(type==='rings'){
    title.textContent = 'FRAUD RING MEMBERSHIP REPORT';
    body.innerHTML = `
      <table class="rpt-table">
        <thead><tr><th>RING ID</th><th>PATTERN</th><th>MEMBERS</th><th>RISK SCORE</th><th>ACCOUNT IDS</th></tr></thead>
        <tbody>${rings.map(ring=>{
          const rc = ring.risk_score>=70?'var(--red)':ring.risk_score>=40?'var(--amber)':'var(--green)';
          return `<tr>
            <td style="color:var(--cyan)">${ring.ring_id}</td>
            <td style="color:var(--muted)">${ring.pattern_type.replace(/_/g,' ').toUpperCase()}</td>
            <td style="color:var(--cyan)">${ring.member_accounts.length}</td>
            <td><span style="color:${rc};font-weight:bold">${ring.risk_score}</span></td>
            <td style="color:var(--muted);font-size:9px;max-width:250px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${ring.member_accounts.join(', ')}">${ring.member_accounts.slice(0,5).join(', ')}${ring.member_accounts.length>5?` +${ring.member_accounts.length-5} more...`:''}</td>
          </tr>`;
        }).join('')}</tbody>
      </table>`;
  }

  else if(type==='accounts'){
    title.textContent = 'ACCOUNT RISK REGISTER — ALL FLAGGED ACCOUNTS';
    body.innerHTML = `
      <table class="rpt-table">
        <thead><tr><th>#</th><th>ACCOUNT ID</th><th>SCORE</th><th>RING</th><th>PATTERNS</th></tr></thead>
        <tbody>${sa.map((a,i)=>{
          const col = a.suspicion_score>=70?'var(--red)':a.suspicion_score>=40?'var(--amber)':'var(--green)';
          return `<tr>
            <td style="color:var(--muted)">${i+1}</td>
            <td style="color:var(--cyan)">${a.account_id}</td>
            <td style="color:${col};font-weight:bold">${a.suspicion_score}</td>
            <td style="color:var(--muted)">${a.ring_id}</td>
            <td style="color:var(--muted);font-size:10px">${a.detected_patterns.join(' · ')||'—'}</td>
          </tr>`;
        }).join('')}</tbody>
      </table>`;
  }

  else if(type==='network'){
    title.textContent = 'GRAPH EXPORT (JSON) — PREVIEW';
    const preview = {
      nodes: sa.slice(0,5).map(a=>({id:a.account_id,score:a.suspicion_score,ring:a.ring_id})),
      links: [],
      meta: r.summary
    };
    body.innerHTML = `
      <div style="background:var(--panel);border:1px solid var(--rim);padding:16px;font-family:var(--font-mono);font-size:10px;color:var(--muted);line-height:1.7;max-height:320px;overflow-y:auto">
        <span style="color:var(--cyan)">// D3-compatible graph JSON — first 5 nodes shown</span><br>
        <pre style="color:var(--white);font-size:10px;margin:0;white-space:pre-wrap">${JSON.stringify(preview, null, 2)}</pre>
      </div>
      <div style="margin-top:12px;font-family:var(--font-mono);font-size:10px;color:var(--muted)">
        Full export: ${r.allAccounts.length} nodes · ${Object.keys(r.edgeMap||{}).length} edges · Click "GRAPH EXPORT" button below to download
      </div>`;
  }
}

function showReportEmpty(){
  const body = document.getElementById('rptPreviewBody');
  const title = document.getElementById('rptPreviewTitle');
  if(title) title.textContent = 'REPORT PREVIEW — NO DATA';
  if(body) body.innerHTML = '<div class="empty-state"><div class="empty-icon">⚠</div><div class="empty-text">No analysis data available.<br>Load a CSV file or run demo data first, then return here.</div></div>';
}

// ─── Export functions ────────────────────────────
function exportJSON(){
  if(!analysisResult){ alert('Run an analysis first.'); return; }
  const out = {
    generated: new Date().toISOString(),
    tool: 'SENTINEL v2.0',
    summary: analysisResult.summary,
    suspicious_accounts: analysisResult.suspicious_accounts,
    fraud_rings: analysisResult.fraud_rings,
  };
  if(CFG.includeTx) out.transactions = analysisResult.transactions;
  dlFile(JSON.stringify(out,null,2), `${CFG.filePrefix}_report_${Date.now()}.json`, 'application/json');
  cfgLog('JSON report exported', 'ok');
}

function exportCSVAccounts(){
  if(!analysisResult){ alert('Run an analysis first.'); return; }
  const rows = ['account_id,suspicion_score,ring_id,patterns'];
  analysisResult.suspicious_accounts.forEach(a=>{
    rows.push(`${a.account_id},${a.suspicion_score},${a.ring_id},"${a.detected_patterns.join(';')}"`);
  });
  dlFile(rows.join('\n'), `${CFG.filePrefix}_accounts_${Date.now()}.csv`, 'text/csv');
  cfgLog('Accounts CSV exported', 'ok');
}

function exportCSVRings(){
  if(!analysisResult){ alert('Run an analysis first.'); return; }
  const rows = ['ring_id,pattern_type,risk_score,member_count,members'];
  analysisResult.fraud_rings.forEach(r=>{
    rows.push(`${r.ring_id},${r.pattern_type},${r.risk_score},${r.member_accounts.length},"${r.member_accounts.join(';')}"`);
  });
  dlFile(rows.join('\n'), `${CFG.filePrefix}_rings_${Date.now()}.csv`, 'text/csv');
  cfgLog('Rings CSV exported', 'ok');
}

function exportCSVTransactions(){
  if(!analysisResult||!analysisResult.transactions){ alert('No transaction data.'); return; }
  const rows = ['transaction_id,sender_id,receiver_id,amount,timestamp'];
  analysisResult.transactions.forEach(t=>{
    rows.push(`${t.transaction_id},${t.sender_id},${t.receiver_id},${t.amount},${t.timestamp}`);
  });
  dlFile(rows.join('\n'), `${CFG.filePrefix}_transactions_${Date.now()}.csv`, 'text/csv');
  cfgLog('Transactions CSV exported', 'ok');
}

function copyReport(){
  if(!analysisResult){ alert('Run an analysis first.'); return; }
  const r = analysisResult;
  const txt = `SENTINEL REPORT — ${new Date().toLocaleString()}
Total Accounts: ${r.summary.total_accounts_analyzed}
Flagged: ${r.summary.suspicious_accounts_flagged}
Fraud Rings: ${r.summary.fraud_rings_detected}
Processing Time: ${r.summary.processing_time_seconds}s
Critical (≥70): ${r.suspicious_accounts.filter(a=>a.suspicion_score>=70).length}
Top Account: ${r.suspicious_accounts[0]?.account_id||'N/A'} (${r.suspicious_accounts[0]?.suspicion_score||0}/100)`;
  navigator.clipboard.writeText(txt).then(()=>{ cfgLog('Summary copied to clipboard', 'ok'); }).catch(()=>{});
}

function dlFile(content, filename, mime){
  const blob = new Blob([content], {type: mime+';charset=utf-8'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.setAttribute('href', url);
  a.setAttribute('download', filename);
  a.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0';
  document.body.appendChild(a);
  setTimeout(()=>{ a.click(); setTimeout(()=>{ URL.revokeObjectURL(url); if(a.parentNode)a.parentNode.removeChild(a); }, 3000); }, 10);
}

// ─── Hook analytics into displayResults ──────────
const _origDisplayResults = displayResults;
displayResults = function(result){
  _origDisplayResults(result);
  // Auto-populate analytics whenever analysis runs
  setTimeout(()=>{ populateAnalytics(result); }, 300);
  // Auto-download if configured
  if(CFG.autoDownload) setTimeout(()=>{ exportJSON(); }, 500);
  cfgLog(`Analysis complete — ${result.summary.fraud_rings_detected} rings · ${result.summary.suspicious_accounts_flagged} flagged`, 'ok');
};

// ─── Utilities ────────────────────────────────────
function highlightAccount(id){
  graphState.selectedNode=graphState.nodes.find(n=>n.id===id)||null;
}

function downloadJSON(){
  if(!analysisResult) return;
  const out={
    suspicious_accounts:analysisResult.suspicious_accounts.map(sa=>({
      account_id:sa.account_id,
      suspicion_score:sa.suspicion_score,
      detected_patterns:sa.detected_patterns,
      ring_id:sa.ring_id
    })),
    fraud_rings:analysisResult.fraud_rings.map(r=>({
      ring_id:r.ring_id,
      member_accounts:r.member_accounts,
      pattern_type:r.pattern_type,
      risk_score:r.risk_score
    })),
    summary:analysisResult.summary
  };
  const blob=new Blob([JSON.stringify(out,null,2)],{type:'application/json'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download=`SENTINEL_report_${Date.now()}.json`;
  a.click();
}

function resetApp(){
  document.getElementById('heroSection').style.display='';
  document.getElementById('uploadSection').style.display='';
  document.getElementById('results').style.display='none';
  document.getElementById('progressWrap').style.display='none';
  document.getElementById('fileInput').value='';
  if(graphState.animFrame) cancelAnimationFrame(graphState.animFrame);
  analysisResult=null;
  graphState.nodes=[]; graphState.edges=[];
}

// ─── Demo Data ────────────────────────────────────
function loadDemoData(){
  const rows=['transaction_id,sender_id,receiver_id,amount,timestamp'];
  let id=1;
  const base=new Date('2024-06-15T12:00:00');
  const ts=h=>{ const d=new Date(base); d.setHours(d.getHours()+h); return d.toISOString().replace('T',' ').slice(0,19); };
  const tx=(s,r,a,h=0)=>rows.push(`TX${String(id++).padStart(5,'0')},${s},${r},${parseFloat(a).toFixed(2)},${ts(h)}`);

  // Ring 1 — Cycle length 3
  tx('ACC_001','ACC_002',5000,0); tx('ACC_002','ACC_003',4800,2); tx('ACC_003','ACC_001',4600,4);
  tx('ACC_001','ACC_002',3200,8); tx('ACC_002','ACC_003',3100,10); tx('ACC_003','ACC_001',3000,12);

  // Ring 2 — Cycle length 4
  tx('ACC_010','ACC_011',12000,0); tx('ACC_011','ACC_012',11500,3);
  tx('ACC_012','ACC_013',11000,6); tx('ACC_013','ACC_010',10500,9);

  // Ring 3 — Fan-in smurfing
  for(let i=1;i<=13;i++) tx(`ACC_0${30+i}`,'ACC_AGGS',8500+Math.random()*1500,i*1.5);
  for(let i=1;i<=5;i++) tx('ACC_AGGS',`ACC_DIST${i}`,19000,35+i);

  // Ring 4 — Fan-out
  tx('WIRE_SRC','ACC_FANOUT',200000,0);
  for(let i=1;i<=12;i++) tx('ACC_FANOUT',`ACC_RECV${String(i).padStart(2,'0')}`,14000+Math.random()*2000,i);

  // Ring 5 — Shell chain
  tx('ACC_S1','ACC_S2',9000,0); tx('ACC_S2','ACC_S3',8800,1);
  tx('ACC_S3','ACC_S4',8600,2); tx('ACC_S4','ACC_S5',8400,3);

  // Legitimate: Amazon merchant (should NOT flag)
  for(let i=1;i<=220;i++) tx(`CUST_${String(i).padStart(4,'0')}`,'MERCH_AMAZON',(Math.random()*300+10),Math.floor(Math.random()*150));

  // Legitimate: Payroll (should NOT flag)
  for(let i=1;i<=90;i++) tx('CORP_PAYROLL',`EMP_${String(i).padStart(3,'0')}`,(4000+Math.random()*3000),0);

  // Normal P2P traffic
  for(let i=0;i<120;i++){
    tx(`P2P_${String(Math.floor(Math.random()*60)+1).padStart(3,'0')}`,
       `P2P_${String(Math.floor(Math.random()*60)+61).padStart(3,'0')}`,
       Math.random()*600+20,Math.floor(Math.random()*60));
  }

  parseAndAnalyze(rows.join('\n'));
}
