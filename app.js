const STORAGE_KEY='nfc-v1';
const defaultState={
  weeklyBudget:125,weeklySpent:0,checking:0,cushion:300,
  strategy:'avalanche',extraPayment:100,startingDebt:0,
  debts:[],bills:[],history:[],xp:0
};
let state=loadState();
const $=id=>document.getElementById(id);
const money=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(Number(n||0));
const money2=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(n||0));
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
function loadState(){try{return {...defaultState,...JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}')}}catch{return {...defaultState}}}
function saveState(){localStorage.setItem(STORAGE_KEY,JSON.stringify(state));renderAll()}
function daysFromNow(dateStr){const a=new Date();a.setHours(0,0,0,0);const b=new Date(dateStr+'T00:00:00');return Math.ceil((b-a)/86400000)}
function billsDueWithin(days=7){return state.bills.filter(b=>!b.paid&&daysFromNow(b.due)>=0&&daysFromNow(b.due)<=days).sort((a,b)=>a.due.localeCompare(b.due))}
function protectedBills(){return billsDueWithin(14).reduce((s,b)=>s+Number(b.amount||0),0)}
function safeToSpend(){return Math.max(0,Number(state.checking||0)-protectedBills()-Number(state.cushion||0))}
function totalDebt(){return state.debts.reduce((s,d)=>s+Number(d.balance||0),0)}
function prioritizedDebts(){return [...state.debts].sort((a,b)=>state.strategy==='snowball'?Number(a.balance)-Number(b.balance):Number(b.apr)-Number(a.apr))}
function payoffSimulation(){
  const debts=prioritizedDebts().map(d=>({...d,balance:Number(d.balance),apr:Number(d.apr),min:Number(d.min)}));
  if(!debts.length)return null;
  let month=0,interest=0;const max=1200;
  while(debts.some(d=>d.balance>0.005)&&month<max){month++;
    debts.forEach(d=>{if(d.balance>0){const i=d.balance*(d.apr/100/12);d.balance+=i;interest+=i}});
    let extra=Number(state.extraPayment||0);
    debts.forEach(d=>{if(d.balance>0){const p=Math.min(d.balance,d.min);d.balance-=p}});
    for(const d of debts){if(extra<=0)break;if(d.balance>0){const p=Math.min(d.balance,extra);d.balance-=p;extra-=p}}
  }
  return {months:month,interest};
}
function renderDashboard(){
  $('safeToSpend').textContent=money(safeToSpend());
  const check=Number(state.checking||0);$('safeMeter').style.width=`${Math.min(100,check?100*safeToSpend()/check:0)}%`;
  const td=totalDebt();$('totalDebt').textContent=money(td);
  const start=Number(state.startingDebt||0);const progress=start>0?Math.max(0,Math.min(100,(start-td)/start*100)):0;$('debtMeter').style.width=progress+'%';
  $('debtProgressText').textContent=start>0?`${progress.toFixed(0)}% paid off since you started tracking.`:'Add your original debt total to track progress.';
  $('weeklySpent').textContent=money(state.weeklySpent);$('weeklyBudget').textContent=money(state.weeklyBudget);
  const pct=state.weeklyBudget?Math.min(100,100*state.weeklySpent/state.weeklyBudget):0;$('budgetMeter').style.width=pct+'%';
  $('weeklyRemaining').textContent=`${money(Math.max(0,state.weeklyBudget-state.weeklySpent))} remaining`;
  const upcoming=billsDueWithin(7);$('upcomingBills').innerHTML=upcoming.length?upcoming.map(b=>`<div class="list-row"><div><div class="row-title">${esc(b.name)}</div><div class="row-sub">${new Date(b.due+'T00:00:00').toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'})}</div></div><div class="money">${money(b.amount)}</div></div>`).join(''):'<div class="empty">Nothing unpaid due in the next 7 days.</div>';
  const p=prioritizedDebts()[0];$('payoffMission').innerHTML=p?`Attack <span class="target">${esc(p.name)}</span> first. Balance ${money2(p.balance)} at ${Number(p.apr).toFixed(2)}% APR. Keep minimums on everything else, then throw your extra <strong>${money(state.extraPayment)}/month</strong> here.`:'Add your debts and the app will tell you what to attack first.';
  const level=Math.floor(state.xp/100)+1;const into=state.xp%100;$('levelBadge').textContent=`Level ${level}`;$('xpTotal').textContent=`${state.xp} XP`;$('xpToNext').textContent=`${100-into} to next level`;$('xpMeter').style.width=into+'%';
}
function renderBudget(){['weeklyBudget','weeklySpent','checking','cushion'].forEach(k=>$(k+'Input').value=state[k]??0)}
function renderDebt(){
  $('strategySelect').value=state.strategy;$('extraPayment').value=state.extraPayment;$('startingDebt').value=state.startingDebt;
  const ordered=prioritizedDebts();$('debtList').innerHTML=ordered.length?ordered.map((d,i)=>`<article class="card debt-row"><div><div class="row-title">${i===0?'<span class="target">TARGET → </span>':''}${esc(d.name)}</div><div class="row-sub">${Number(d.apr).toFixed(2)}% APR · min ${money2(d.min)}</div></div><div><div class="money danger">${money2(d.balance)}</div><div class="row-actions"><button class="tiny-btn" onclick="editDebt('${d.id}')">Edit</button><button class="tiny-btn" onclick="deleteDebt('${d.id}')">Delete</button></div></div></article>`).join(''):'<article class="card empty">No debts added yet.</article>';
  const sim=payoffSimulation();$('simulation').innerHTML=sim?`<div class="sim-grid"><div class="sim-box"><span class="muted">Debt-free in</span><strong>${sim.months} months</strong></div><div class="sim-box"><span class="muted">Projected interest</span><strong>${money(sim.interest)}</strong></div></div><p class="muted">Estimate assumes current balances/APRs, minimums, and ${money(state.extraPayment)} extra every month. It does not model new charges, changing rates, or due-date quirks.</p>`:'<div class="empty">Add debts to calculate payoff.</div>';
}
function renderBills(){
  const sorted=[...state.bills].sort((a,b)=>a.due.localeCompare(b.due));$('billsList').innerHTML=sorted.length?sorted.map(b=>`<article class="card bill-row"><div><div class="row-title">${esc(b.name)} ${b.paid?'<span class="tag">PAID</span>':''}</div><div class="row-sub">Due ${new Date(b.due+'T00:00:00').toLocaleDateString()}</div></div><div><div class="money ${b.paid?'good':''}">${money2(b.amount)}</div><div class="row-actions"><button class="tiny-btn" onclick="toggleBill('${b.id}')">${b.paid?'Unpay':'Paid'}</button><button class="tiny-btn" onclick="editBill('${b.id}')">Edit</button><button class="tiny-btn" onclick="deleteBill('${b.id}')">Delete</button></div></div></article>`).join(''):'<article class="card empty">No bills added yet.</article>';
}
function renderHistory(){
  $('snapshotDebt').value=totalDebt().toFixed(2);$('historyList').innerHTML=state.history.length?[...state.history].reverse().map(h=>`<article class="card history-row"><div><div class="row-title">${new Date(h.date).toLocaleDateString()}</div><div class="row-sub">${esc(h.note||'Debt snapshot')}</div></div><div class="money">${money2(h.debt)}</div></article>`).join(''):'<article class="card empty">No progress snapshots yet.</article>';
}
function renderAll(){renderDashboard();renderBudget();renderDebt();renderBills();renderHistory()}
function showPage(id){document.querySelectorAll('.page').forEach(p=>p.classList.toggle('active',p.id===id));document.querySelectorAll('.bottom-nav button').forEach(b=>b.classList.toggle('active',b.dataset.nav===id));window.scrollTo({top:0,behavior:'smooth'})}
document.querySelectorAll('[data-nav]').forEach(b=>b.addEventListener('click',()=>showPage(b.dataset.nav)));
$('settingsBtn').addEventListener('click',()=>showPage('settings'));
$('saveBudget').addEventListener('click',()=>{state.weeklyBudget=+$('weeklyBudgetInput').value;state.weeklySpent=+$('weeklySpentInput').value;state.checking=+$('checkingInput').value;state.cushion=+$('cushionInput').value;saveState()});
$('saveDebtSettings').addEventListener('click',()=>{state.strategy=$('strategySelect').value;state.extraPayment=+$('extraPayment').value;state.startingDebt=+$('startingDebt').value;saveState()});
$('addDebtBtn').addEventListener('click',()=>openDebt());
$('addBillBtn').addEventListener('click',()=>openBill());
function openDebt(d={}){$('debtId').value=d.id||'';$('debtName').value=d.name||'';$('debtBalance').value=d.balance??'';$('debtApr').value=d.apr??'';$('debtMin').value=d.min??'';$('debtDialog').showModal()}
window.editDebt=id=>openDebt(state.debts.find(d=>d.id===id));window.deleteDebt=id=>{state.debts=state.debts.filter(d=>d.id!==id);saveState()};
$('saveDebtBtn').addEventListener('click',e=>{e.preventDefault();if(!$('debtForm').reportValidity())return;const d={id:$('debtId').value||crypto.randomUUID(),name:$('debtName').value.trim(),balance:+$('debtBalance').value,apr:+$('debtApr').value,min:+$('debtMin').value};const i=state.debts.findIndex(x=>x.id===d.id);if(i>=0)state.debts[i]=d;else state.debts.push(d);$('debtDialog').close();saveState()});
function openBill(b={}){$('billId').value=b.id||'';$('billName').value=b.name||'';$('billAmount').value=b.amount??'';$('billDue').value=b.due||new Date().toISOString().slice(0,10);$('billPaid').checked=!!b.paid;$('billDialog').showModal()}
window.editBill=id=>openBill(state.bills.find(b=>b.id===id));window.deleteBill=id=>{state.bills=state.bills.filter(b=>b.id!==id);saveState()};window.toggleBill=id=>{const b=state.bills.find(x=>x.id===id);if(b){b.paid=!b.paid;saveState()}};
$('saveBillBtn').addEventListener('click',e=>{e.preventDefault();if(!$('billForm').reportValidity())return;const b={id:$('billId').value||crypto.randomUUID(),name:$('billName').value.trim(),amount:+$('billAmount').value,due:$('billDue').value,paid:$('billPaid').checked};const i=state.bills.findIndex(x=>x.id===b.id);if(i>=0)state.bills[i]=b;else state.bills.push(b);$('billDialog').close();saveState()});
$('addSnapshot').addEventListener('click',()=>{state.history.push({date:new Date().toISOString(),debt:+$('snapshotDebt').value,note:$('snapshotNote').value.trim()});$('snapshotNote').value='';saveState()});
document.querySelectorAll('[data-xp]').forEach(b=>b.addEventListener('click',()=>{state.xp+=+b.dataset.xp;saveState()}));
$('exportBtn').addEventListener('click',()=>{const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`financial-command-center-backup-${new Date().toISOString().slice(0,10)}.json`;a.click();URL.revokeObjectURL(a.href)});
$('importInput').addEventListener('change',async e=>{const f=e.target.files?.[0];if(!f)return;try{const data=JSON.parse(await f.text());state={...defaultState,...data};saveState();alert('Backup imported.')}catch{alert('That backup file could not be read.')}});
$('resetBtn').addEventListener('click',()=>{if(confirm('Delete all locally stored app data on this device?')){state={...defaultState};saveState()}});
if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});
renderAll();
