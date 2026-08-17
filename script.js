
const LOGIN_KEY='pam_logged_in_v1';
const APP_USER='login001';
const APP_PASS='1234';

function checkLogin(){
  const logged=sessionStorage.getItem(LOGIN_KEY)==='1';
  const screen=document.getElementById('loginScreen');
  if(screen) screen.classList.toggle('hidden', logged);
  document.body.classList.toggle('locked', !logged);
}
function login(e){
  e.preventDefault();
  const u=document.getElementById('loginUsername').value.trim();
  const p=document.getElementById('loginPassword').value;
  const err=document.getElementById('loginError');
  if(u===APP_USER && p===APP_PASS){
    sessionStorage.setItem(LOGIN_KEY,'1');
    if(err) err.textContent='';
    checkLogin();
  }else{
    if(err) err.textContent='User name หรือ Password ไม่ถูกต้อง';
  }
}
function logout(){
  sessionStorage.removeItem(LOGIN_KEY);
  Object.keys(cart).forEach(k=>delete cart[k]);
  renderCart();
  checkLogin();
}

const cart={};
const ORDER_KEY='pam_orders_group_v1';

function money(n){return new Intl.NumberFormat('th-TH',{style:'currency',currency:'THB'}).format(Number(n)||0)}
function clean(s){return String(s||'').replace(/\s+/g,' ').trim()}
function parseBonus(text){
 const tiers=[]; const re=/(\d+)\s*แถม\s*(\d+)/g; let m;
 while((m=re.exec(text||''))) tiers.push({buy:+m[1],free:+m[2]});
 return tiers.sort((a,b)=>a.buy-b.buy);
}
function chargeUnitVat(p){return Number(p.price||0)*1.07}

function avgPricePerPiece(p,qty,freeQty){
  const paid=chargeUnitVat(p)*qty;
  const totalPacks=qty+(freeQty||0);
  const totalPieces=totalPacks*Number(p.pack||1);
  return totalPieces ? paid/totalPieces : 0;
}

function groupQty(groupId){
 return products.filter(p=>p.promoGroup===groupId).reduce((s,p)=>s+(cart[p.id]?.qty||0),0);
}
function groupFree(groupId){
 const g=promoGroups[groupId]; if(!g)return 0;
 return Math.floor(groupQty(groupId)/g.buy)*g.free;
}
function individualFree(p,qty){
 if(p.promoGroup)return 0;
 const tiers=parseBonus(p.bonus); if(!tiers.length)return 0;
 let tier=null; for(const t of tiers)if(qty>=t.buy)tier=t;
 return tier?Math.floor(qty/tier.buy)*tier.free:0;
}
function calcFree(p,qty){return p.promoGroup?groupFree(p.promoGroup):individualFree(p,qty)}
function groupLabel(groupId){
 const g=promoGroups[groupId];
 return g?`โปรรวมรายการ ${g.members.join(', ')} — ยอดรวมทุกสินค้าในกลุ่มครบ ${g.buy} แพ็ก แถม ${g.free}`:'';
}
function renderProducts(){
 const q=clean(document.getElementById('search').value).toLowerCase();
 const f=document.getElementById('filter').value;
 document.getElementById('productGrid').innerHTML=products
 .filter(p=>(!q||p.name.toLowerCase().includes(q))&&(f==='all'||p.bestSeller))
 .map(p=>`<article class="card ${p.bestSeller?'best':''}">
 ${p.bestSeller?'<span class="badge">⭐ ขายดี</span>':''}
 <div class="pic">${p.image?`<img src="${p.image}" alt="${p.name}" onerror="this.style.display='none'">`:'<span>ไม่มีรูป</span>'}</div>
 <div class="body">
  <div class="name"><span class="item-no">#${p.itemNo}</span> ${p.name}</div>
  <div class="meta">บรรจุ ${p.pack} ชิ้น/แพ็ก</div>
  <div class="price">${money(chargeUnitVat(p))} <small class="muted">/ แพ็ก รวม VAT</small></div>
  <div class="bonus ${p.promoGroup?'group-bonus':''}">${p.promoGroup?'🔗 '+groupLabel(p.promoGroup):(p.bonus?'🎁 '+clean(p.bonus):'ไม่มีโปรโมชั่นของแถม')}</div>
  <div class="buy"><input class="qty" id="q-${p.id}" type="number" min="0" step="1" value="${cart[p.id]?.qty||0}">
  <button class="add" onclick="addToCart(${p.id})">เพิ่มตะกร้า</button></div>
 </div></article>`).join('');
}
function addToCart(id){
 const q=Math.max(0,parseInt(document.getElementById('q-'+id).value)||0);
 if(!q)return; cart[id]={qty:q}; renderCart(); toggleCart(true);
}
function change(id,d){
 if(!cart[id])return; cart[id].qty=Math.max(0,cart[id].qty+d);
 if(!cart[id].qty)delete cart[id]; renderCart(); renderProducts();
}
function groupSummaryHtml(){
 const active=[...new Set(products.filter(p=>p.promoGroup&&cart[p.id]?.qty).map(p=>p.promoGroup))];
 return active.map(gid=>{
   const g=promoGroups[gid], qty=groupQty(gid), free=groupFree(gid);
   const names=products.filter(p=>p.promoGroup===gid&&cart[p.id]?.qty).map(p=>`#${p.itemNo} × ${cart[p.id].qty}`).join(' + ');
   return `<div class="promo-summary"><b>🔗 โปรรวม ${g.members.join(', ')}</b><br>${names} = <b>${qty} แพ็ก</b>
   ${free?`<br>🎁 ได้ของแถมรวม <b>${free} แพ็ก</b> <span class="success">✓ ถึงโปรแล้ว</span>`:
   `<br><span class="muted">อีก ${g.buy-(qty%g.buy)} แพ็ก ถึงโปร ${g.buy}+${g.free}</span>`}</div>`;
 }).join('');
}
function renderCart(){
 let subtotal=0, freeIndividual=0;
 const html=Object.entries(cart).map(([id,it])=>{
  const p=products.find(x=>x.id==id), total=chargeUnitVat(p)*it.qty;
  subtotal+=total;
  const f=individualFree(p,it.qty); freeIndividual+=f;
  return `<div class="item"><div class="item-title">#${p.itemNo} ${p.name}</div>
  <div class="item-line"><div class="stepper"><button onclick="change(${id},-1)">−</button><b>${it.qty}</b><button onclick="change(${id},1)">+</button></div><b>${money(total)}</b></div>
  ${f?`<div class="muted">🎁 ของแถม ${f} แพ็ก</div>`:''}</div>`;
 }).join('');
 const groupFreeTotal=Object.keys(promoGroups).reduce((s,g)=>s+groupFree(g),0);
 document.getElementById('cartItems').innerHTML=(html||'<div style="padding:30px;text-align:center;color:#888">ยังไม่มีสินค้าในตะกร้า</div>')+groupSummaryHtml();
 document.getElementById('subtotal').textContent=money(subtotal);
 document.getElementById('freeTotal').textContent=(freeIndividual+groupFreeTotal)+' แพ็ก';
 document.getElementById('grandTotal').textContent=money(subtotal);
 document.getElementById('cartCount').textContent=Object.values(cart).reduce((s,x)=>s+x.qty,0);
}
function toggleCart(force){
 const p=document.getElementById('cartPanel'),o=document.getElementById('overlay');
 const open=force===true||!p.classList.contains('open'); p.classList.toggle('open',open);o.classList.toggle('show',open);
}
function activeGroupIds(){return [...new Set(products.filter(p=>p.promoGroup&&cart[p.id]?.qty&&groupFree(p.promoGroup)>0).map(p=>p.promoGroup))]}
function freeSelectors(){
 return activeGroupIds().map(gid=>{
  const g=promoGroups[gid], free=groupFree(gid);
  const opts=products.filter(p=>p.promoGroup===gid).map(p=>`<option value="${p.id}">#${p.itemNo} ${p.name}</option>`).join('');
  return `<div class="free-choice">
    <div class="free-choice-title">🎁 เลือกสินค้าของแถม</div>
    <div class="free-choice-note">โปรรวมรายการ ${g.members.join(', ')} ครบ ${g.buy} แพ็ก → ได้ของแถม ${free} แพ็ก</div>
    <label for="free-${gid}">ต้องการรับสินค้าตัวไหนเป็นของแถม?</label>
    <select id="free-${gid}">${opts}</select>
    <div class="free-qty">จำนวนของแถม: <b>${free} แพ็ก</b></div>
  </div>`;
 }).join('');
}
function showOrder(){
 if(!Object.keys(cart).length)return alert('กรุณาเพิ่มสินค้าลงตะกร้าก่อน');
 let total=0,lines='';
 Object.entries(cart).forEach(([id,it])=>{
  const p=products.find(x=>x.id==id),t=chargeUnitVat(p)*it.qty; total+=t;
  lines+=`<div class="order-row"><b>#${p.itemNo} ${p.name}</b><br>${it.qty} × ${money(chargeUnitVat(p))} = <b>${money(t)}</b></div>`;
 });
 lines+=groupSummaryHtml()+freeSelectors()+`<h3 style="display:flex;justify-content:space-between"><span>ยอดชำระรวม</span><span>${money(total)}</span></h3>`;
 document.getElementById('orderText').innerHTML=lines; document.getElementById('orderModal').classList.add('show');
}
function closeOrder(){document.getElementById('orderModal').classList.remove('show')}
function selectedGroupFree(){
 const out={};
 activeGroupIds().forEach(gid=>{
  const p=products.find(x=>x.id==Number(document.getElementById('free-'+gid)?.value));
  out[gid]={product:p?.name||'',itemNo:p?.itemNo||'',qty:groupFree(gid)};
 });
 return out;
}
function getOrderData(){
 let total=0;
 const items=Object.entries(cart).map(([id,it])=>{
  const p=products.find(x=>x.id==id),unit=chargeUnitVat(p),amount=unit*it.qty;
  total+=amount; const freeQty=individualFree(p,it.qty);
  return {product:p.name,itemNo:p.itemNo,pack:p.pack,qty:it.qty,unitPriceExVat:p.price,unitPriceVat:unit,amount,
  free:freeQty,avgPiecePrice:avgPricePerPiece(p,it.qty,freeQty),promoGroup:p.promoGroup||'',bonus:p.bonus||''};
 });
 const now=new Date(), orderNo='PAM-'+now.getFullYear()+String(now.getMonth()+1).padStart(2,'0')+String(now.getDate()).padStart(2,'0')+'-'+String(now.getHours()).padStart(2,'0')+String(now.getMinutes()).padStart(2,'0')+String(now.getSeconds()).padStart(2,'0');
 return {orderNo,date:now,customerName:document.getElementById('customerName')?.value||'',customerPhone:document.getElementById('customerPhone')?.value||'',contact:document.getElementById('customerContact')?.value||'',note:document.getElementById('customerNote')?.value||'',items,total,groupFree:selectedGroupFree()};
}
async function copyOrder(){
 const d=getOrderData();
 let text=`รายการสั่งซื้อ ${d.orderNo}\nลูกค้า: ${d.customerName}\n`;
 d.items.forEach(x=>text+=`#${x.itemNo} ${x.product} | ซื้อ ${x.qty} | ยอด ${money(x.amount)}${x.free?' | แถม '+x.free:''}\n`);
 Object.values(d.groupFree).forEach(x=>text+=`ของแถมโปรรวม: #${x.itemNo} ${x.product} × ${x.qty}\n`);
 text+=`ยอดชำระรวม ${money(d.total)}`;
 try{await navigator.clipboard.writeText(text);alert('คัดลอกรายการสั่งซื้อแล้ว')}catch(e){alert(text)}
}
function exportCurrentOrder(){
 if(typeof XLSX==='undefined')return alert('ไม่สามารถโหลดระบบ Excel ได้ กรุณาเชื่อมต่ออินเทอร์เน็ต');
 const d=getOrderData(), rows=d.items.map(x=>({
 'เลขที่คำสั่งซื้อ':d.orderNo,'วันที่':d.date.toLocaleString('th-TH'),'ลูกค้า':d.customerName,'เบอร์โทร':d.customerPhone,'ผู้ติดต่อ':d.contact,'หมายเหตุ':d.note,
 'รายการที่':x.itemNo,'สินค้า':x.product,'จำนวนชิ้น/แพ็ก':x.pack,'จำนวนซื้อ (แพ็ก)':x.qty,'ของแถมรายสินค้า':x.free,'Offer Price Ex.VAT':x.unitPriceExVat,'ราคาต่อแพ็ก รวม VAT':x.unitPriceVat,'ยอดชำระ':x.amount,
 'ราคาเฉลี่ยต่อชิ้น':x.avgPiecePrice,'กลุ่มโปรรวม':x.promoGroup,'โปรโมชั่น':x.bonus
 }));
 Object.entries(d.groupFree).forEach(([gid,x])=>rows.push({'เลขที่คำสั่งซื้อ':d.orderNo,'วันที่':d.date.toLocaleString('th-TH'),'ลูกค้า':d.customerName,'รายการที่':x.itemNo,'สินค้า':x.product,'จำนวนชิ้น/แพ็ก':(products.find(p=>p.itemNo==x.itemNo)?.pack||1),'จำนวนซื้อ (แพ็ก)':0,'ของแถมรายสินค้า':x.qty,'ยอดชำระ':0,'ราคาเฉลี่ยต่อชิ้น':0,'กลุ่มโปรรวม':gid,'โปรโมชั่น':'ของแถมจากโปรรวม'}));
 rows.push({'เลขที่คำสั่งซื้อ':d.orderNo,'สินค้า':'รวมทั้งออเดอร์','จำนวนซื้อ (แพ็ก)':d.items.reduce((s,x)=>s+x.qty,0),'ยอดชำระ':d.total});
 const ws=XLSX.utils.json_to_sheet(rows); ws['!cols']=Array(15).fill({wch:20});
 const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'Order');
 const customer=clean(d.customerName).replace(/[\\/:*?"<>|]/g,'_')||'Customer';
 XLSX.writeFile(wb,`${d.orderNo}_${customer}.xlsx`); saveOrder(d);
}
function saveOrder(d){const h=JSON.parse(localStorage.getItem(ORDER_KEY)||'[]');h.push({...d,date:d.date.toISOString()});localStorage.setItem(ORDER_KEY,JSON.stringify(h.slice(-500)))}
function exportOrderHistory(){
 if(typeof XLSX==='undefined')return alert('ไม่สามารถโหลดระบบ Excel ได้');
 const h=JSON.parse(localStorage.getItem(ORDER_KEY)||'[]');if(!h.length)return alert('ยังไม่มีประวัติ');
 const rows=[];h.forEach(d=>d.items.forEach(x=>rows.push({'เลขที่คำสั่งซื้อ':d.orderNo,'วันที่':new Date(d.date).toLocaleString('th-TH'),'ลูกค้า':d.customerName,'รายการที่':x.itemNo,'สินค้า':x.product,'จำนวนชิ้น/แพ็ก':x.pack,'จำนวนซื้อ':x.qty,'ของแถม':x.free,'ยอดชำระ':x.amount,'ราคาเฉลี่ยต่อชิ้น':x.avgPiecePrice||0,'กลุ่มโปร':x.promoGroup})));
 const ws=XLSX.utils.json_to_sheet(rows),wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'Orders');XLSX.writeFile(wb,`PAm_Order_History_${new Date().toISOString().slice(0,10)}.xlsx`);
}
renderProducts();renderCart();checkLogin();