(()=>{
  const KEY='nfc-v2';
  const $=id=>document.getElementById(id);
  if(!$('payday')) return;
  const money=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(Number(n||0));
  const money2=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(n||0));
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
  const read=()=>{try{return JSON.parse(localStorage.getItem(KEY)||'{}')}catch{return {}}};
  const write=s=>localStorage.setItem(KEY,JSON.stringify(s));
  const localDate=d=>{const x=new Date(d);x.setMinutes(x.getMinutes()-x.getTimezoneOffset());return x.toISOString().slice(0,10)};
  const today=()=>localDate(new Date());
  const addDays=(date,n)=>{const d=new Date(date+'T12:00:00');d.setDate(d.getDate()+n);return localDate(d)};
  const dayDiff=(a,b)=>Math.max(0,Math.ceil((new Date(b+'T12:00:00')-new Date(a+'T12:00:00'))/86400000));
  const fmtDate=s=>new Date(s+'T12:00:00').toLocaleDateString(undefined,{month:'short',day:'numeric'});
  const prioritized=s=>[...(s.debts||[])].filter(d=>Number(d.balance)>0).sort((a,b)=>s.strategy==='snowball'?Number(a.balance)-Number(b.balance):Number(b.apr)-Number(a.apr));
  const totalDebt=s=>(s.debts||[]).reduce((sum,d)=>sum+Number(d.balance||0),0);
  const inferNextPayday=s=>{
    if(s.paydaySettings?.nextPayday && s.paydaySettings.nextPayday>=today()) return s.paydaySettings.nextPayday;
    const dates=(s.transactions||[]).filter(t=>t.type==='income'&&t.date).map(t=>t.date).sort();
    if(dates.length>=2){const gaps=[];for(let i=Math.max(1,dates.length-4);i<dates.length;i++)gaps.push(dayDiff(dates[i-1],dates[i]));gaps.sort((a,b)=>a-b);const gap=gaps[Math.floor(gaps.length/2)]||14;let next=addDays(dates.at(-1),gap);while(next<=today())next=addDays(next,gap);return next;}
    return addDays(today(),14);
  };
  const autoFlexible=(s,next)=>{
    const days=Math.max(1,dayDiff(today(),next));
    const weeks=Math.max(1,Math.ceil(days/7));
    const remainingThisWeek=Math.max(0,Number(s.weeklyBudget||0)-Number(s.weeklySpent||0));
    return remainingThisWeek+Math.max(0,weeks-1)*Number(s.weeklyBudget||0);
  };
  const billsUntil=(s,next)=>(s.bills||[]).filter(b=>!b.paid&&b.due&&b.due>=today()&&b.due<=next).sort((a,b)=>a.due.localeCompare(b.due));
  const allocations=(s,amount)=>{let left=Math.max(0,amount),out=[];for(const d of prioritized(s)){if(left<=.005)break;const p=Math.min(Number(d.balance||0),left);if(p>0){out.push({id:d.id,name:d.name,apr:Number(d.apr||0),before:Number(d.balance||0),payment:p,after:Math.max(0,Number(d.balance||0)-p)});left-=p}}return {rows:out,left};};
  let state=read();
  function seed(){
    state=read();
    const next=inferNextPayday(state);
    if(!$('paydayNextDate').value)$('paydayNextDate').value=next;
    if(!$('paydayChecking').value)$('paydayChecking').value=Number(state.checking||0).toFixed(2);
    if(!$('paydaySource').value)$('paydaySource').value=state.paydaySettings?.source||'Paycheck';
    if(!$('paydayFlexible').dataset.touched){$('paydayFlexible').value=Math.round(autoFlexible(state,$('paydayNextDate').value));}
    $('paydayOther').value=state.paydaySettings?.other??$('paydayOther').value;
    $('paydayBuffer').value=state.paydaySettings?.buffer??$('paydayBuffer').value;
    $('paydayRecordIncome').checked=!!state.paydaySettings?.recordIncome;
  }
  function plan(){
    state=read();
    const next=$('paydayNextDate').value||inferNextPayday(state);
    const checking=Math.max(0,Number($('paydayChecking').value||0));
    const paycheck=Math.max(0,Number($('paydayAmount').value||0));
    const bills=billsUntil(state,next),billTotal=bills.reduce((s,b)=>s+Number(b.amount||0),0);
    const auto=autoFlexible(state,next);
    const flexible=Math.max(0,Number($('paydayFlexible').value||0));
    const cushion=Math.max(0,Number(state.cushion||0));
    const other=Math.max(0,Number($('paydayOther').value||0));
    const buffer=Math.max(0,Number($('paydayBuffer').value||0));
    const reserved=billTotal+flexible+cushion+other+buffer;
    const raw=checking-reserved;
    const safe=Math.max(0,raw);
    const debt=Math.max(0,totalDebt(state));
    const debtPayment=Math.min(safe,debt);
    const alloc=allocations(state,debtPayment);
    const afterChecking=Math.max(0,checking-debtPayment);
    const surplus=Math.max(0,safe-debtPayment);
    return {next,checking,paycheck,bills,billTotal,auto,flexible,cushion,other,buffer,reserved,raw,safe,debt,debtPayment,alloc,afterChecking,surplus,shortfall:Math.max(0,-raw)};
  }
  function render(){
    const p=plan();
    $('paydayBillsTotal').textContent=money(p.billTotal);$('paydayFlexibleAuto').textContent=money(p.auto);$('paydayCushion').textContent=money(p.cushion);
    $('paydayBillsList').innerHTML=p.bills.length?p.bills.map(b=>`<div class="payday-bill"><div><strong>${esc(b.name)}</strong><br><small>Due ${fmtDate(b.due)}</small></div><strong>${money2(b.amount)}</strong></div>`).join(''):'<div class="empty">No unpaid bills are currently listed before the next payday.</div>';
    const hero=$('paydaySafeExtra');hero.textContent=p.shortfall?`−${money(p.shortfall)}`:money(p.debtPayment);hero.classList.toggle('is-short',p.shortfall>0);
    $('paydayStatusBadge').textContent=p.shortfall?'SHORTFALL':p.debtPayment>0?'ATTACK READY':'PROTECTED';
    $('paydayWaterfall').innerHTML=`<div class="waterfall-row"><span>Checking available now</span><strong>${money(p.checking)}</strong></div><div class="waterfall-row"><span>Upcoming bills</span><strong class="minus">− ${money(p.billTotal)}</strong></div><div class="waterfall-row"><span>Flexible spending reserve</span><strong class="minus">− ${money(p.flexible)}</strong></div><div class="waterfall-row"><span>Protected cash cushion</span><strong class="minus">− ${money(p.cushion)}</strong></div><div class="waterfall-row"><span>Other planned + extra buffer</span><strong class="minus">− ${money(p.other+p.buffer)}</strong></div><div class="waterfall-row total"><span>${p.shortfall?'Amount not yet covered':'Cash available beyond reserves'}</span><strong>${p.shortfall?`−${money(p.shortfall)}`:money(p.safe)}</strong></div>`;
    $('paydayDebtAllocation').innerHTML=p.shortfall?'<div class="empty">No extra debt payment yet. The plan is short before the next payday, so protect cash first.</div>':p.alloc.rows.length?p.alloc.rows.map((a,i)=>`<div class="allocation-row"><div><strong>${i===0?'TARGET → ':''}${esc(a.name)}</strong><small>${a.apr.toFixed(2)}% APR · ${money(a.before)} → ${money(a.after)}</small></div><strong>${money(a.payment)}</strong></div>`).join(''):p.debt===0?'<div class="empty">No debt balances are entered. Nice problem to have.</div>':'<div class="empty">No extra payment is available after reserves.</div>';
    $('paydayAfterChecking').textContent=money(p.afterChecking);$('paydayReserved').textContent=money(p.reserved);$('paydaySurplus').textContent=money(p.surplus);
    $('applyPaydayPlan').disabled=p.debtPayment<=0;
    renderHistory();
  }
  function saveSettings(s,p){s.paydaySettings={nextPayday:p.next,source:$('paydaySource').value.trim()||'Paycheck',other:p.other,buffer:p.buffer,recordIncome:$('paydayRecordIncome').checked};return s}
  function historyRecord(p,applied){return {id:(crypto.randomUUID?crypto.randomUUID():`${Date.now()}-${Math.random()}`),date:new Date().toISOString(),nextPayday:p.next,paycheck:p.paycheck,checking:p.checking,bills:p.billTotal,flexible:p.flexible,cushion:p.cushion,other:p.other,buffer:p.buffer,debtPayment:p.debtPayment,shortfall:p.shortfall,applied,allocations:p.alloc.rows.map(a=>({name:a.name,payment:a.payment}))}}
  function renderHistory(){state=read();const h=[...(state.paydayHistory||[])].sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,8);$('paydayHistory').innerHTML=h.length?h.map(r=>`<div class="payday-history-row"><div><strong>${new Date(r.date).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'})}</strong><small>${r.shortfall?`Shortfall ${money(r.shortfall)}`:`Debt payment ${money(r.debtPayment)}`} · next payday ${fmtDate(r.nextPayday)}</small></div><strong class="${r.applied?'applied':'planned'}">${r.applied?'APPLIED':'PLAN'}</strong></div>`).join(''):'<div class="empty">Run your first payday plan and it will show up here.</div>'}
  function savePlan(){const p=plan();let s=read();s=saveSettings(s,p);s.paydayHistory=[...(s.paydayHistory||[]),historyRecord(p,false)].slice(-24);write(s);state=s;render();alert('Payday plan saved. No balances were changed.')}
  function applyPlan(){const p=plan();if(p.debtPayment<=0)return;const allocationText=p.alloc.rows.map(a=>`${a.name}: ${money(a.payment)}`).join('\n');if(!confirm(`Apply ${money(p.debtPayment)} of debt payments in this app?\n\n${allocationText}\n\nThis will reduce checking and the listed debt balances.`))return;let s=read();for(const a of p.alloc.rows){const d=(s.debts||[]).find(x=>x.id===a.id);if(d)d.balance=Math.max(0,Number(d.balance||0)-a.payment)}s.checking=Math.max(0,p.checking-p.debtPayment);s.history=[...(s.history||[]),{date:new Date().toISOString(),debt:totalDebt(s),note:`Payday Mode: ${money(p.debtPayment)} extra debt payment`}];s.xp=Number(s.xp||0)+10;if($('paydayRecordIncome').checked&&p.paycheck>0){s.transactions=[...(s.transactions||[]),{id:(crypto.randomUUID?crypto.randomUUID():`${Date.now()}-${Math.random()}`),date:today(),type:'income',merchant:$('paydaySource').value.trim()||'Paycheck',category:'Income',amount:p.paycheck,note:'Recorded from Payday Mode'}]}s=saveSettings(s,p);s.paydayHistory=[...(s.paydayHistory||[]),historyRecord(p,true)].slice(-24);write(s);location.reload()}
  ['paydayAmount','paydayChecking','paydayNextDate','paydayOther','paydayBuffer','paydayRecordIncome'].forEach(id=>$(id).addEventListener('input',render));
  $('paydayFlexible').addEventListener('input',()=>{$('paydayFlexible').dataset.touched='1';render()});
  $('paydayNextDate').addEventListener('change',()=>{if(!$('paydayFlexible').dataset.touched)$('paydayFlexible').value=Math.round(autoFlexible(read(),$('paydayNextDate').value));render()});
  $('savePaydayPlan').addEventListener('click',savePlan);$('applyPaydayPlan').addEventListener('click',applyPlan);
  window.addEventListener('storage',()=>{seed();render()});
  seed();render();
})();
