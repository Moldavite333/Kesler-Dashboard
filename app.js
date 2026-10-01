const STORAGE_KEY='nfc-v2';
const LEGACY_KEY='nfc-v1';
const CATEGORIES=['Housing','Bills & Utilities','Groceries','Dining & Drinks','Transportation','Shopping','Entertainment','Pets','Health & Wellness','Services','Gifts & Donations','Travel','Other'];
const defaultState={
  weeklyBudget:125,weeklySpent:0,checking:0,cushion:300,
  strategy:'avalanche',extraPayment:100,startingDebt:0,
  debts:[],bills:[],history:[],transactions:[],categoryBudgets:{},xp:0
};
let state=loadState();
const $=id=>document.getElementById(id);
const money=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(Number(n||0));
const money2=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(n||0));
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const uid=()=>crypto.randomUUID?crypto.randomUUID():`${Date.now()}-${Math.random().toString(16).slice(2)}`;
function loadState(){
  try{
    const raw=localStorage.getItem(STORAGE_KEY)||localStorage.getItem(LEGACY_KEY)||'{}';
    const parsed=JSON.parse(raw);
    return {...defaultState,...parsed,categoryBudgets:{...defaultState.categoryBudgets,...(parsed.categoryBudgets||{})},transactions:parsed.transactions||[]};
  }catch{return structuredClone(defaultState)}
}
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
function monthKey(date=new Date()){return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`}
function monthLabel(key){const [y,m]=key.split('-').map(Number);return new Date(y,m-1,1).toLocaleDateString(undefined,{month:'short',year:'2-digit'})}
function currentMonthTransactions(){return state.transactions.filter(t=>String(t.date||'').slice(0,7)===monthKey())}
function totalsForMonth(key){
  return state.transactions.filter(t=>String(t.date||'').slice(0,7)===key).reduce((a,t)=>{const v=Number(t.amount||0);if(t.type==='income')a.income+=v;else a.expense+=v;return a},{income:0,expense:0});
}
function lastMonths(n=6){const out=[];const now=new Date();for(let i=n-1;i>=0;i--){const d=new Date(now.getFullYear(),now.getMonth()-i,1);out.push(monthKey(d))}return out}
function monthSummary(){const x=totalsForMonth(monthKey());return {...x,net:x.income-x.expense,savingsRate:x.income>0?((x.income-x.expense)/x.income)*100:null}}
function categoryTotals(key=monthKey()){
  const map={};state.transactions.filter(t=>t.type!=='income'&&String(t.date||'').slice(0,7)===key).forEach(t=>{map[t.category||'Other']=(map[t.category||'Other']||0)+Number(t.amount||0)});return Object.entries(map).sort((a,b)=>b[1]-a[1]);
}
function merchantTotals(key=monthKey()){
  const map={};state.transactions.filter(t=>t.type!=='income'&&String(t.date||'').slice(0,7)===key).forEach(t=>{const m=t.merchant||'Unknown';map[m]=(map[m]||0)+Number(t.amount||0)});return Object.entries(map).sort((a,b)=>b[1]-a[1]);
}
function projectedSpend(){const s=monthSummary();const now=new Date();const daysInMonth=new Date(now.getFullYear(),now.getMonth()+1,0).getDate();return now.getDate()?s.expense/now.getDate()*daysInMonth:0}
function pct(v,total){return total>0?Math.max(0,Math.min(100,v/total*100)):0}
function renderDashboard(){
  $('safeToSpend').textContent=money(safeToSpend());
  const check=Number(state.checking||0);$('safeMeter').style.width=`${Math.min(100,check?100*safeToSpend()/check:0)}%`;
  const td=totalDebt();$('totalDebt').textContent=money(td);
  const start=Number(state.startingDebt||0);const progress=start>0?Math.max(0,Math.min(100,(start-td)/start*100)):0;$('debtMeter').style.width=progress+'%';
  $('debtProgressText').textContent=start>0?`${progress.toFixed(0)}% paid off since you started tracking.`:'Add your original debt total to track progress.';
  $('weeklySpent').textContent=money(state.weeklySpent);$('weeklyBudget').textContent=money(state.weeklyBudget);
  const bpct=state.weeklyBudget?Math.min(100,100*state.weeklySpent/state.weeklyBudget):0;$('budgetMeter').style.width=bpct+'%';
  $('weeklyRemaining').textContent=`${money(Math.max(0,state.weeklyBudget-state.weeklySpent))} remaining`;
  const upcoming=billsDueWithin(7);$('upcomingBills').innerHTML=upcoming.length?upcoming.map(b=>`<div class="list-row"><div><div class="row-title">${esc(b.name)}</div><div class="row-sub">${new Date(b.due+'T00:00:00').toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'})}</div></div><div class="money">${money(b.amount)}</div></div>`).join(''):'<div class="empty">Nothing unpaid due in the next 7 days.</div>';
  const p=prioritizedDebts()[0];$('payoffMission').innerHTML=p?`Attack <span class="target">${esc(p.name)}</span> first. Balance ${money2(p.balance)} at ${Number(p.apr).toFixed(2)}% APR. Keep minimums on everything else, then throw your extra <strong>${money(state.extraPayment)}/month</strong> here.`:'Add your debts and the app will tell you what to attack first.';
  const level=Math.floor(state.xp/100)+1;const into=state.xp%100;$('levelBadge').textContent=`Level ${level}`;$('xpTotal').textContent=`${state.xp} XP`;$('xpToNext').textContent=`${100-into} to next level`;$('xpMeter').style.width=into+'%';
  const ms=monthSummary();$('monthSpend').textContent=money(ms.expense);$('monthNet').textContent=money(ms.net);$('monthNet').className=ms.net>=0?'good-text':'bad-text';$('savingsRate').textContent=ms.savingsRate===null?'—':`${ms.savingsRate.toFixed(0)}%`;
  const top=categoryTotals()[0];
  $('dashboardSpendingPulse').innerHTML=`<div><span>Daily burn</span><strong>${money(ms.expense/Math.max(1,new Date().getDate()))}</strong></div><div><span>Projected month</span><strong>${money(projectedSpend())}</strong></div><div><span>Top category</span><strong>${top?esc(top[0]):'—'}</strong></div>`;
}
function renderBudget(){
  ['weeklyBudget','weeklySpent','checking','cushion'].forEach(k=>$(k+'Input').value=state[k]??0);
  $('categoryBudgetInputs').innerHTML=CATEGORIES.map(c=>`<label>${esc(c)}<input data-cat-budget="${esc(c)}" type="number" min="0" step="1" value="${state.categoryBudgets[c]||''}" placeholder="No limit" /></label>`).join('');
  const totals=Object.fromEntries(categoryTotals());
  const used=CATEGORIES.filter(c=>Number(state.categoryBudgets[c]||0)>0);
  $('categoryBudgetStatus').innerHTML=used.length?used.map(c=>{const limit=Number(state.categoryBudgets[c]);const spent=totals[c]||0;const p=pct(spent,limit);return `<div class="budget-status"><div class="card-head"><span>${esc(c)}</span><strong>${money(spent)} / ${money(limit)}</strong></div><div class="meter"><span style="width:${p}%"></span></div></div>`}).join(''):'<div class="empty">Set category limits above if you want monthly guardrails.</div>';
}
function renderDebt(){
  $('strategySelect').value=state.strategy;$('extraPayment').value=state.extraPayment;$('startingDebt').value=state.startingDebt;
  const ordered=prioritizedDebts();$('debtList').innerHTML=ordered.length?ordered.map((d,i)=>`<article class="card debt-row"><div><div class="row-title">${i===0?'<span class="target">TARGET → </span>':''}${esc(d.name)}</div><div class="row-sub">${Number(d.apr).toFixed(2)}% APR · min ${money2(d.min)}</div></div><div><div class="money danger">${money2(d.balance)}</div><div class="row-actions"><button class="tiny-btn" onclick="editDebt('${d.id}')">Edit</button><button class="tiny-btn" onclick="deleteDebt('${d.id}')">Delete</button></div></div></article>`).join(''):'<article class="card empty">No debts added yet.</article>';
  const sim=payoffSimulation();$('simulation').innerHTML=sim?`<div class="sim-grid"><div class="sim-box"><span class="muted">Debt-free in</span><strong>${sim.months} months</strong></div><div class="sim-box"><span class="muted">Projected interest</span><strong>${money(sim.interest)}</strong></div></div><p class="muted">Estimate assumes current balances/APRs, minimums, and ${money(state.extraPayment)} extra every month. It does not model new charges, changing rates, or due-date quirks.</p>`:'<div class="empty">Add debts to calculate payoff.</div>';
}
function renderBills(){
  const sorted=[...state.bills].sort((a,b)=>a.due.localeCompare(b.due));$('billsList').innerHTML=sorted.length?sorted.map(b=>`<article class="card bill-row"><div><div class="row-title">${esc(b.name)} ${b.paid?'<span class="tag">PAID</span>':''}</div><div class="row-sub">Due ${new Date(b.due+'T00:00:00').toLocaleDateString()}</div></div><div><div class="money ${b.paid?'good':''}">${money2(b.amount)}</div><div class="row-actions"><button class="tiny-btn" onclick="toggleBill('${b.id}')">${b.paid?'Unpay':'Paid'}</button><button class="tiny-btn" onclick="editBill('${b.id}')">Edit</button><button class="tiny-btn" onclick="deleteBill('${b.id}')">Delete</button></div></div></article>`).join(''):'<article class="card empty">No bills added yet.</article>';
}
function barChart(months){
  const rows=months.map(k=>({k,...totalsForMonth(k)}));const max=Math.max(1,...rows.flatMap(r=>[r.income,r.expense]));
  return `<div class="bar-chart">${rows.map(r=>`<div class="bar-group"><div class="bars"><i class="income-bar" style="height:${Math.max(2,r.income/max*100)}%" title="Income ${money2(r.income)}"></i><i class="expense-bar" style="height:${Math.max(2,r.expense/max*100)}%" title="Spending ${money2(r.expense)}"></i></div><span>${monthLabel(r.k)}</span></div>`).join('')}</div><div class="chart-legend"><span><i class="legend-dot income-dot"></i>Income</span><span><i class="legend-dot expense-dot"></i>Spending</span></div>`;
}
function categoryChartHtml(){
  const cats=categoryTotals();const total=cats.reduce((s,x)=>s+x[1],0);if(!cats.length)return '<div class="empty">Add expense transactions to build the chart.</div>';
  return cats.slice(0,8).map(([c,v])=>`<div class="category-row"><div class="card-head"><span>${esc(c)}</span><strong>${money(v)}</strong></div><div class="category-track"><span style="width:${pct(v,total)}%"></span></div><small>${pct(v,total).toFixed(0)}% of spending</small></div>`).join('');
}
function debtTrendSvg(){
  const rows=[...state.history].sort((a,b)=>new Date(a.date)-new Date(b.date));if(rows.length<2)return '<div class="empty">Add at least two debt snapshots to see the trend.</div>';
  const vals=rows.map(r=>Number(r.debt||0));const max=Math.max(...vals),min=Math.min(...vals);const range=Math.max(1,max-min);const w=600,h=160,pad=16;
  const pts=rows.map((r,i)=>{const x=pad+(w-pad*2)*(i/(rows.length-1));const y=pad+(h-pad*2)*(1-(Number(r.debt)-min)/range);return `${x},${y}`}).join(' ');
  return `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Debt trend chart"><polyline points="${pts}" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><line x1="${pad}" y1="${h-pad}" x2="${w-pad}" y2="${h-pad}" stroke="rgba(255,255,255,.14)"/></svg><div class="trend-labels"><span>${new Date(rows[0].date).toLocaleDateString(undefined,{month:'short',day:'numeric'})}: ${money(rows[0].debt)}</span><span>${new Date(rows.at(-1).date).toLocaleDateString(undefined,{month:'short',day:'numeric'})}: ${money(rows.at(-1).debt)}</span></div>`;
}
function renderSpending(){
  const ms=monthSummary();$('spendIncome').textContent=money(ms.income);$('spendExpenses').textContent=money(ms.expense);$('spendNet').textContent=money(ms.net);$('spendNet').className=ms.net>=0?'good-text':'bad-text';$('spendProjected').textContent=money(projectedSpend());
  $('cashflowChart').innerHTML=barChart(lastMonths(6));$('categoryChart').innerHTML=categoryChartHtml();
  const now=new Date(),day=now.getDate(),days=new Date(now.getFullYear(),now.getMonth()+1,0).getDate();const burn=ms.expense/Math.max(1,day);const top=categoryTotals()[0];
  $('paceStats').innerHTML=`<div><span>Daily burn rate</span><strong>${money(burn)}</strong></div><div><span>Days elapsed</span><strong>${day} / ${days}</strong></div><div><span>Projected month spend</span><strong>${money(projectedSpend())}</strong></div><div><span>Savings rate</span><strong>${ms.savingsRate===null?'—':ms.savingsRate.toFixed(1)+'%'}</strong></div><div><span>Largest category</span><strong>${top?esc(top[0]):'—'}</strong></div>`;
  const merchants=merchantTotals().slice(0,6);$('merchantList').innerHTML=merchants.length?merchants.map(([m,v],i)=>`<div class="list-row"><div><div class="row-title">${i+1}. ${esc(m)}</div></div><div class="money">${money2(v)}</div></div>`).join(''):'<div class="empty">No expense transactions this month.</div>';
  populateTransactionFilters();renderTransactionList();
  $('debtTrendChart').innerHTML=debtTrendSvg();
  $('historyList').innerHTML=state.history.length?[...state.history].reverse().slice(0,6).map(h=>`<div class="history-row"><div><div class="row-title">${new Date(h.date).toLocaleDateString()}</div><div class="row-sub">${esc(h.note||'Debt snapshot')}</div></div><div class="money">${money2(h.debt)}</div></div>`).join(''):'<div class="empty">No debt snapshots yet.</div>';
}
function populateTransactionFilters(){
  const keys=new Set(lastMonths(12));state.transactions.forEach(t=>{if(t.date)keys.add(t.date.slice(0,7))});const sorted=[...keys].sort().reverse();const selected=$('transactionMonth').value||monthKey();$('transactionMonth').innerHTML=sorted.map(k=>`<option value="${k}">${monthLabel(k)}</option>`).join('');$('transactionMonth').value=sorted.includes(selected)?selected:monthKey();
  const catSel=$('transactionCategory');const catVal=catSel.value||'all';catSel.innerHTML='<option value="all">All categories</option>'+CATEGORIES.map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join('');catSel.value=CATEGORIES.includes(catVal)?catVal:'all';
  $('transactionCategoryInput').innerHTML=CATEGORIES.map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join('')+'<option value="Income">Income</option>';
}
function renderTransactionList(){
  const mk=$('transactionMonth').value||monthKey(),cat=$('transactionCategory').value||'all';
  const tx=[...state.transactions].filter(t=>String(t.date||'').slice(0,7)===mk&&(cat==='all'||t.category===cat)).sort((a,b)=>b.date.localeCompare(a.date));
  $('transactionList').innerHTML=tx.length?tx.map(t=>`<div class="transaction-row"><div><div class="row-title">${esc(t.merchant||'Transaction')}</div><div class="row-sub">${new Date(t.date+'T00:00:00').toLocaleDateString(undefined,{month:'short',day:'numeric'})} · ${esc(t.category||'Other')}${t.note?' · '+esc(t.note):''}</div></div><div class="transaction-right"><div class="money ${t.type==='income'?'good':'danger'}">${t.type==='income'?'+':'−'}${money2(t.amount)}</div><div class="row-actions"><button class="tiny-btn" onclick="editTransaction('${t.id}')">Edit</button><button class="tiny-btn" onclick="deleteTransaction('${t.id}')">Delete</button></div></div></div>`).join(''):'<div class="empty">No transactions match this view.</div>';
}
function renderAll(){renderDashboard();renderBudget();renderDebt();renderBills();renderSpending()}
function showPage(id){document.querySelectorAll('.page').forEach(p=>p.classList.toggle('active',p.id===id));document.querySelectorAll('.bottom-nav button').forEach(b=>b.classList.toggle('active',b.dataset.nav===id));window.scrollTo({top:0,behavior:'smooth'})}
document.querySelectorAll('[data-nav]').forEach(b=>b.addEventListener('click',()=>showPage(b.dataset.nav)));
$('settingsBtn').addEventListener('click',()=>showPage('settings'));
$('saveBudget').addEventListener('click',()=>{state.weeklyBudget=+$('weeklyBudgetInput').value;state.weeklySpent=+$('weeklySpentInput').value;state.checking=+$('checkingInput').value;state.cushion=+$('cushionInput').value;saveState()});
$('saveCategoryBudgets').addEventListener('click',()=>{document.querySelectorAll('[data-cat-budget]').forEach(i=>{const v=+i.value;if(v>0)state.categoryBudgets[i.dataset.catBudget]=v;else delete state.categoryBudgets[i.dataset.catBudget]});saveState()});
$('saveDebtSettings').addEventListener('click',()=>{state.strategy=$('strategySelect').value;state.extraPayment=+$('extraPayment').value;state.startingDebt=+$('startingDebt').value;saveState()});
$('addDebtBtn').addEventListener('click',()=>openDebt());$('addBillBtn').addEventListener('click',()=>openBill());
function openDebt(d={}){$('debtId').value=d.id||'';$('debtName').value=d.name||'';$('debtBalance').value=d.balance??'';$('debtApr').value=d.apr??'';$('debtMin').value=d.min??'';$('debtDialog').showModal()}
window.editDebt=id=>openDebt(state.debts.find(d=>d.id===id));window.deleteDebt=id=>{state.debts=state.debts.filter(d=>d.id!==id);saveState()};
$('saveDebtBtn').addEventListener('click',e=>{e.preventDefault();if(!$('debtForm').reportValidity())return;const d={id:$('debtId').value||uid(),name:$('debtName').value.trim(),balance:+$('debtBalance').value,apr:+$('debtApr').value,min:+$('debtMin').value};const i=state.debts.findIndex(x=>x.id===d.id);if(i>=0)state.debts[i]=d;else state.debts.push(d);$('debtDialog').close();saveState()});
function openBill(b={}){$('billId').value=b.id||'';$('billName').value=b.name||'';$('billAmount').value=b.amount??'';$('billDue').value=b.due||new Date().toISOString().slice(0,10);$('billPaid').checked=!!b.paid;$('billDialog').showModal()}
window.editBill=id=>openBill(state.bills.find(b=>b.id===id));window.deleteBill=id=>{state.bills=state.bills.filter(d=>d.id!==id);saveState()};window.toggleBill=id=>{const b=state.bills.find(x=>x.id===id);if(b){b.paid=!b.paid;saveState()}};
$('saveBillBtn').addEventListener('click',e=>{e.preventDefault();if(!$('billForm').reportValidity())return;const b={id:$('billId').value||uid(),name:$('billName').value.trim(),amount:+$('billAmount').value,due:$('billDue').value,paid:$('billPaid').checked};const i=state.bills.findIndex(x=>x.id===b.id);if(i>=0)state.bills[i]=b;else state.bills.push(b);$('billDialog').close();saveState()});
function openTransaction(t={}){populateTransactionFilters();$('transactionId').value=t.id||'';$('transactionDate').value=t.date||new Date().toISOString().slice(0,10);$('transactionType').value=t.type||'expense';$('transactionMerchantInput').value=t.merchant||'';$('transactionCategoryInput').value=t.category||(t.type==='income'?'Income':'Groceries');$('transactionAmount').value=t.amount??'';$('transactionNote').value=t.note||'';$('transactionDialog').showModal()}
window.editTransaction=id=>openTransaction(state.transactions.find(t=>t.id===id));window.deleteTransaction=id=>{state.transactions=state.transactions.filter(t=>t.id!==id);saveState()};
$('addTransactionBtn').addEventListener('click',()=>openTransaction());$('addTransactionTop').addEventListener('click',()=>openTransaction());
$('transactionType').addEventListener('change',()=>{if($('transactionType').value==='income')$('transactionCategoryInput').value='Income'});
$('saveTransactionBtn').addEventListener('click',e=>{e.preventDefault();if(!$('transactionForm').reportValidity())return;const type=$('transactionType').value;const t={id:$('transactionId').value||uid(),date:$('transactionDate').value,type,merchant:$('transactionMerchantInput').value.trim(),category:type==='income'?'Income':$('transactionCategoryInput').value,amount:+$('transactionAmount').value,note:$('transactionNote').value.trim()};const i=state.transactions.findIndex(x=>x.id===t.id);if(i>=0)state.transactions[i]=t;else state.transactions.push(t);$('transactionDialog').close();saveState()});
$('transactionMonth').addEventListener('change',renderTransactionList);$('transactionCategory').addEventListener('change',renderTransactionList);
function openSnapshot(){$('snapshotDebt').value=totalDebt().toFixed(2);$('snapshotNote').value='';$('snapshotDialog').showModal()}
$('quickSnapshot').addEventListener('click',openSnapshot);
$('addSnapshot').addEventListener('click',e=>{e.preventDefault();state.history.push({date:new Date().toISOString(),debt:+$('snapshotDebt').value,note:$('snapshotNote').value.trim()});$('snapshotDialog').close();saveState()});
document.querySelectorAll('[data-xp]').forEach(b=>b.addEventListener('click',()=>{state.xp+=+b.dataset.xp;saveState()}));
function download(name,text,type){const blob=new Blob([text],{type});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),0)}
$('exportBtn').addEventListener('click',()=>download(`financial-command-center-backup-${new Date().toISOString().slice(0,10)}.json`,JSON.stringify(state,null,2),'application/json'));
$('importInput').addEventListener('change',async e=>{const f=e.target.files?.[0];if(!f)return;try{const data=JSON.parse(await f.text());state={...defaultState,...data,categoryBudgets:{...(data.categoryBudgets||{})},transactions:data.transactions||[]};saveState();alert('Backup imported.')}catch{alert('That backup file could not be read.')}});
function csvEscape(v){const s=String(v??'');return /[",\n]/.test(s)?`"${s.replace(/"/g,'""')}"`:s}
$('exportTransactionsBtn').addEventListener('click',()=>{const header='date,type,merchant,category,amount,note';const rows=state.transactions.map(t=>[t.date,t.type,t.merchant,t.category,t.amount,t.note].map(csvEscape).join(','));download(`transactions-${new Date().toISOString().slice(0,10)}.csv`,[header,...rows].join('\n'),'text/csv')});
$('csvTemplateBtn').addEventListener('click',()=>download('financial-command-center-transactions-template.csv','date,type,merchant,category,amount,note\n2026-10-01,expense,Example Store,Groceries,25.00,optional note\n2026-10-02,income,Example Paycheck,Income,1000.00,','text/csv'));
function parseCSV(text){const rows=[];let row=[],cell='',q=false;for(let i=0;i<text.length;i++){const ch=text[i];if(q){if(ch==='"'&&text[i+1]==='"'){cell+='"';i++}else if(ch==='"')q=false;else cell+=ch}else if(ch==='"')q=true;else if(ch===','){row.push(cell);cell=''}else if(ch==='\n'||ch==='\r'){if(ch==='\r'&&text[i+1]==='\n')i++;row.push(cell);cell='';if(row.some(x=>x.trim()!==''))rows.push(row);row=[]}else cell+=ch}row.push(cell);if(row.some(x=>x.trim()!==''))rows.push(row);return rows}
$('importTransactionsInput').addEventListener('change',async e=>{const f=e.target.files?.[0];if(!f)return;try{const rows=parseCSV(await f.text());const head=rows.shift().map(x=>x.trim().toLowerCase());const ix=n=>head.indexOf(n);if(['date','type','merchant','category','amount'].some(n=>ix(n)<0))throw new Error('columns');let added=0;for(const r of rows){const type=(r[ix('type')]||'expense').trim().toLowerCase()==='income'?'income':'expense';const amount=Math.abs(Number(r[ix('amount')])||0);if(!r[ix('date')]||!amount)continue;state.transactions.push({id:uid(),date:r[ix('date')].trim(),type,merchant:(r[ix('merchant')]||'Imported').trim(),category:type==='income'?'Income':((r[ix('category')]||'Other').trim()||'Other'),amount,note:ix('note')>=0?(r[ix('note')]||'').trim():''});added++}saveState();alert(`Imported ${added} transactions.`)}catch{alert('CSV import failed. Use the template columns: date,type,merchant,category,amount,note')}});
$('resetBtn').addEventListener('click',()=>{if(confirm('Delete all locally stored app data on this device?')){state=structuredClone(defaultState);saveState()}});
if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});
renderAll();
