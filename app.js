const API_URL='https://script.google.com/macros/s/AKfycbxp9q_2Qra3XNkxh1HCp7u-DaKfWTXtpGLyc44ex-QUfvsUb5sdlTlr-tqy0qxs0pAZ/exec';
const state={transactions:[],accounts:[],categories:[],incomeSources:[],goals:[],budgets:[],dashboard:null,txType:'Pengeluaran',currentMonth:new Date()};
const $=id=>document.getElementById(id); const fmt=n=>new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(Number(n||0));
const icons={Makanan:'🍜',Belanja:'🛒',Transport:'🚗',Rumah:'🏠',Kesehatan:'❤️',Pendidikan:'🎓',Hiburan:'🎮',Lainnya:'•••',Gaji:'💼','Uang dari Suami':'💚','Pendapatan Lain':'💰',Bonus:'🎁',Tabungan:'🏦'};
const esc=v=>String(v??'').replace(/[&<>"']/g,s=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[s]));
async function get(action,params={}){const r=await fetch(API_URL+'?'+new URLSearchParams({action,...params}),{cache:'no-store'});const j=await r.json();if(!j.success)throw Error(j.data?.message||'Request gagal');return j.data}
async function post(payload){const r=await fetch(API_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(payload)});const j=await r.json();if(!j.success)throw Error(j.data?.message||'Request gagal');return j.data}
function toast(msg,err=false){let e=$('toast');if(!e){e=document.createElement('div');e.id='toast';e.style.cssText='position:fixed;left:50%;bottom:92px;transform:translateX(-50%);z-index:9999;background:#20302b;color:#fff;padding:12px 18px;border-radius:14px;font-size:13px;box-shadow:0 8px 30px rgba(0,0,0,.18);max-width:88vw;text-align:center';document.body.appendChild(e)}e.textContent=msg;e.style.background=err?'#a93f4a':'#20302b';clearTimeout(window.tt);window.tt=setTimeout(()=>e.remove(),2600)}
function monthLabel(d){return new Intl.DateTimeFormat('id-ID',{month:'long',year:'numeric'}).format(d)}
function iso(d){return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')}
function render(){const d=state.dashboard||{};$('balance').textContent=fmt(d.totalBalance);$('incomeTotal').textContent=fmt(d.income);$('expenseTotal').textContent=fmt(d.expense);$('savingTotal').textContent=fmt(d.savings);$('statIncome').textContent=fmt(d.income);$('statExpense').textContent=fmt(d.expense);$('statSavings').textContent=fmt(d.savings);$('statNet').textContent=fmt(d.net);$('monthLabel').textContent=monthLabel(state.currentMonth);
 const list=state.transactions.filter(t=>t.type==='Pengeluaran').slice(0,8);$('todayList').innerHTML=list.map(t=>`<div class="tx"><div class="tx-icon">${icons[t.category]||'💳'}</div><div class="tx-main"><b>${esc(t.category||t.type)}</b><small>${esc(t.note||'Transaksi')} · ${esc(t.date)}</small></div><div class="tx-amount">− ${fmt(t.amount)}</div></div>`).join('')||'<div class="muted" style="padding:18px 4px">Belum ada transaksi.</div>';
 $('goals').innerHTML=state.goals.map(g=>{const p=Math.round(g.percentage||0);return `<div class="goal"><div class="goal-top"><div class="goal-icon">${g.name.toLowerCase().includes('libur')?'🌴':'🎯'}</div><div class="goal-title"><b>${esc(g.name)}</b><small>${fmt(g.current)} / ${fmt(g.target)}</small></div><div class="goal-value">${p}%</div></div><div class="progress"><i style="width:${Math.min(100,p)}%"></i></div><div class="goal-foot"><span>Terkumpul ${fmt(g.current)}</span><span>Target ${fmt(g.target)}</span></div></div>`}).join('')||'<div class="muted">Belum ada target tabungan.</div>';
 $('accountsList').innerHTML=state.accounts.map(a=>`<div class="account"><div class="account-icon">${a.type==='Bank'?'🏦':a.type==='E-Wallet'?'🟣':a.type==='Tabungan'?'💚':'💵'}</div><div class="account-main"><b>${esc(a.name)}</b><small>Saldo saat ini</small></div><strong>${fmt(a.balance)}</strong></div>`).join('');
 const cats=state.categories.filter(c=>!c.type||c.type===state.txType);$('category').innerHTML=(cats.length?cats.map(c=>`<option>${esc(c.name)}</option>`).join():(state.txType==='Pemasukan'?['Gaji','Uang dari Suami','Pendapatan Lain','Bonus','Lainnya']:['Makanan','Belanja','Transport','Rumah','Kesehatan','Pendidikan','Hiburan','Lainnya']).map(x=>`<option>${x}</option>`).join(''));const ao=state.accounts.map(a=>`<option>${esc(a.name)}</option>`).join('');$('account').innerHTML=ao;$('toAccount').innerHTML=ao;$('toAccountWrap').classList.toggle('hidden',state.txType!=='Transfer')}
async function load(){try{const d=await get('bootstrap');state.dashboard=d.dashboard||{};state.accounts=d.accounts||[];state.categories=d.categories||[];state.incomeSources=d.incomeSources||[];state.goals=d.goals||[];state.budgets=d.budgets||[];state.transactions=d.transactions||[];render();toast('MyFin tersambung ke Google Sheets ✓')}catch(e){console.error(e);render();toast('Gagal terhubung. Cek deployment Apps Script.',true)}}
async function refresh(){const [d,t,a,g]=await Promise.all([get('dashboard'),get('transactions',{limit:100}),get('accounts'),get('goals')]);state.dashboard=d;state.transactions=t;state.accounts=a;state.goals=g;render()}
function showPage(id){document.querySelectorAll('.page').forEach(p=>p.classList.toggle('active',p.id===id));document.querySelectorAll('.nav').forEach(n=>n.classList.toggle('active',n.dataset.page===id));window.scrollTo({top:0,behavior:'smooth'})}
document.querySelectorAll('.nav').forEach(n=>n.onclick=()=>showPage(n.dataset.page));const modal=$('modal');$('addBtn').onclick=()=>{modal.classList.remove('hidden');$('date').value=iso(new Date());$('amount').value='';$('note').value='';state.txType='Pengeluaran';document.querySelectorAll('.type-tabs button').forEach(x=>x.classList.toggle('active',x.dataset.type==='expense'));render()};$('closeModal').onclick=()=>modal.classList.add('hidden');modal.onclick=e=>{if(e.target===modal)modal.classList.add('hidden')};document.querySelectorAll('.type-tabs button').forEach(b=>b.onclick=()=>{document.querySelectorAll('.type-tabs button').forEach(x=>x.classList.remove('active'));b.classList.add('active');state.txType={expense:'Pengeluaran',income:'Pemasukan',transfer:'Transfer'}[b.dataset.type];render()});
$('saveTx').onclick=async()=>{const n=Number(($('amount').value||'').replace(/\D/g,''));if(!n)return toast('Masukkan nominal terlebih dahulu.',true);if(!$('account').value)return toast('Pilih akun terlebih dahulu.',true);const p={action:'saveTransaction',date:$('date').value||iso(new Date()),type:state.txType,category:$('category').value,amount:n,account:$('account').value,source:state.txType==='Pemasukan'?$('category').value:'',toAccount:state.txType==='Transfer'?$('toAccount').value:'',note:$('note').value||''};if(state.txType==='Transfer'&&p.account===p.toAccount)return toast('Akun asal dan tujuan harus berbeda.',true);$('saveTx').disabled=true;$('saveTx').textContent='Menyimpan...';try{await post(p);modal.classList.add('hidden');await refresh();showPage('home');toast('Transaksi berhasil disimpan ✓')}catch(e){console.error(e);toast(e.message||'Gagal menyimpan transaksi.',true)}finally{$('saveTx').disabled=false;$('saveTx').textContent='Simpan'}};
$('toggleBalance').onclick=()=>{const b=$('balance');b.textContent=b.textContent==='••••••'?fmt(state.dashboard?.totalBalance):'••••••'};$('prevMonth').onclick=()=>{state.currentMonth.setMonth(state.currentMonth.getMonth()-1);$('monthLabel').textContent=monthLabel(state.currentMonth)};$('nextMonth').onclick=()=>{state.currentMonth.setMonth(state.currentMonth.getMonth()+1);$('monthLabel').textContent=monthLabel(state.currentMonth)};load();if('serviceWorker'in navigator)navigator.serviceWorker.register('sw.js').catch(()=>{});

let deferredInstallPrompt = null;

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

function updateInstallUI() {
  const btn = $('installBtn');
  const status = $('installStatus');
  if (!btn || !status) return;
  if (isStandalone()) {
    status.textContent = 'Sudah terpasang ✓';
    btn.disabled = true;
    btn.style.opacity = '.62';
    return;
  }
  btn.disabled = false;
  btn.style.opacity = '1';
  status.textContent = deferredInstallPrompt ? 'Pasang ke HP ›' : 'Cara install ›';
}

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredInstallPrompt = e;
  updateInstallUI();
});

window.addEventListener('appinstalled', () => {
  deferredInstallPrompt = null;
  updateInstallUI();
  toast('MyFin berhasil dipasang di HP ✓');
});

function showIOSInstallGuide() {
  const message = 'Untuk iPhone/iPad: tekan tombol Share (□↑) di Safari, lalu pilih “Add to Home Screen”.';
  toast(message);
}

$('installBtn')?.addEventListener('click', async () => {
  if (isStandalone()) return;
  if (deferredInstallPrompt) {
    deferredInstallPrompt.prompt();
    const choice = await deferredInstallPrompt.userChoice;
    if (choice.outcome === 'accepted') toast('Memasang MyFin…');
    deferredInstallPrompt = null;
    updateInstallUI();
    return;
  }
  if (/iphone|ipad|ipod/i.test(navigator.userAgent)) {
    showIOSInstallGuide();
    return;
  }
  toast('Jika tombol install belum muncul, buka MyFin dari Chrome lalu pilih “Install app” atau “Add to Home screen”.');
});

window.matchMedia('(display-mode: standalone)').addEventListener?.('change', updateInstallUI);
updateInstallUI();

