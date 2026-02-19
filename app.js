'use strict';

// ─── Particle Background ──────────────────────────
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