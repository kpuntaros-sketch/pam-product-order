const cart={};
const ORDER_KEY='pam_orders_v2';

function money(n){return new Intl.NumberFormat('th-TH',{style:'currency',currency:'THB'}).format(Number(n)||0)}
function clean(s){return String(s||'').replace(/\s+/g,' ').trim()}
function parseBonus(text){
  const tiers=[]; const re=/(\d+)\s*แถม\s*(\d+)/g; let m;
  while((m=re.exec(text||''))) tiers.push({buy:+m[1],free:+m[2]});
  return tiers.sort((a,b)=>a.buy-b.buy);
}
function activeTier(p,qty){
  const tiers=parseBonus(p.bonus);
  if(!tiers.length)return null;
  let tier=null;
  for(const t of tiers) if(qty>=t.buy) tier=t;
  return tier;
}
function calcFree(p,qty){
  const tier=activeTier(p,qty);
  if(!tier)return 0;
  return Math.floor(qty/tier.buy)*tier.free;
}
function chargeUnitVat(p){
  return Number(p.price||0)*1.07;
}
function avgUnitAfterFree(p,qty){
  const free=calcFree(p,qty);
  const received=qty+free;
  return received ? chargeUnitVat(p)*qty/received : chargeUnitVat(p);
}
function perPieceAfterFree(p,qty){
  const pack=Number(p.pack||1);
  return avgUnitAfterFree(p,qty)/pack;
}
function renderProducts(){
 const q=clean(document.getElementById('search').value).toLowerCase();
 const f=document.getElementById('filter').value;
 const el=document.getElementById('productGrid');
 el.innerHTML=products.filter(p=>(!q||p.name.toLowerCase().includes(q))&&(f==='all'||p.bestSeller)).map(p=>{
   const base=chargeUnitVat(p);
   return `<article class="card ${p.bestSeller?'best':''}">
    ${p.bestSeller?'<span class="badge">⭐ ขายดี</span>':''}
    <div class="pic">${p.image?`<img src="${p.image}" alt="${p.name}" onerror="this.style.display='none'">`:'<span>ไม่มีรูป</span>'}</div>
    <div class="body">
      <div class="name">${p.name}</div>
      <div class="meta">บรรจุ ${p.pack} ชิ้น/แพ็ก · LTP ฿${Number(p.ltp||0).toLocaleString()}</div>
      <div class="price">${money(base)} <small class="muted">/ แพ็ก รวม VAT</small></div>
      <div class="bonus">${p.bonus?`🎁 ${clean(p.bonus)}`:'ไม่มีโปรโมชั่นของแถม'}</div>
      <div class="buy">
        <input class="qty" id="q-${p.id}" type="number" min="0" step="1" value="${cart[p.id]?.qty||0}">
        <button class="add" onclick="addToCart(${p.id})">เพิ่มตะกร้า</button>
      </div>
    </div>
   </article>`;
 }).join('');
}
function addToCart(id){
 const q=Math.max(0,parseInt(document.getElementById('q-'+id).value)||0);
 if(!q)return;
 cart[id]={qty:q}; renderCart(); toggleCart(true);
}
function change(id,d){
 const item=cart[id]; if(!item)return;
 item.qty=Math.max(0,item.qty+d);
 if(!item.qty)delete cart[id];
 renderCart(); renderProducts();
}
function renderCart(){
 let subtotal=0,free=0;
 const html=Object.entries(cart).map(([id,it])=>{
  const p=products.find(x=>x.id==id);
  const f=calcFree(p,it.qty);
  const total=chargeUnitVat(p)*it.qty;
  subtotal+=total; free+=f;
  const avg=avgUnitAfterFree(p,it.qty);
  return `<div class="item">
    <div class="item-title">${p.name}</div>
    <div class="item-line">
      <div class="stepper"><button onclick="change(${id},-1)">−</button><b>${it.qty}</b><button onclick="change(${id},1)">+</button></div>
      <b>${money(total)}</b>
    </div>
    ${f?`<div class="muted">🎁 ของแถม ${f} แพ็ก · รับรวม ${it.qty+f} แพ็ก<br>เฉลี่ย ${money(avg)}/แพ็ก</div>`:''}
  </div>`;
 }).join('');
 document.getElementById('cartItems').innerHTML=html||'<div style="padding:30px;text-align:center;color:#888">ยังไม่มีสินค้าในตะกร้า</div>';
 document.getElementById('subtotal').textContent=money(subtotal);
 document.getElementById('freeTotal').textContent=free+' แพ็ก';
 document.getElementById('grandTotal').textContent=money(subtotal);
 document.getElementById('cartCount').textContent=Object.values(cart).reduce((s,x)=>s+x.qty,0);
}
function toggleCart(force){
 const p=document.getElementById('cartPanel'),o=document.getElementById('overlay');
 const open=force===true||!p.classList.contains('open');
 p.classList.toggle('open',open); o.classList.toggle('show',open);
}
function getOrderData(){
 let total=0,free=0;
 const items=Object.entries(cart).map(([id,it])=>{
  const p=products.find(x=>x.id==id);
  const unit=chargeUnitVat(p), f=calcFree(p,it.qty), amount=unit*it.qty;
  total+=amount; free+=f;
  return {
    product:p.name, sku:p.id, pack:p.pack, qty:it.qty,
    unitPriceExVat:Number(p.price||0), unitPriceVat:unit,
    amount, free:f, received:it.qty+f,
    avgPackPrice:avgUnitAfterFree(p,it.qty),
    avgPiecePrice:perPieceAfterFree(p,it.qty),
    bonus:p.bonus||''
  };
 });
 const now=new Date();
 const orderNo='PAM-'+now.getFullYear()+String(now.getMonth()+1).padStart(2,'0')+
 String(now.getDate()).padStart(2,'0')+'-'+String(now.getHours()).padStart(2,'0')+
 String(now.getMinutes()).padStart(2,'0')+String(now.getSeconds()).padStart(2,'0');
 return {
  orderNo,date:now,
  customerName:document.getElementById('customerName')?.value||'',
  customerPhone:document.getElementById('customerPhone')?.value||'',
  contact:document.getElementById('customerContact')?.value||'',
  note:document.getElementById('customerNote')?.value||'',
  items,total,free
 };
}
function showOrder(){
 if(!Object.keys(cart).length)return alert('กรุณาเพิ่มสินค้าลงตะกร้าก่อน');
 let lines='<p class="muted">ยอดชำระคำนวณจากราคาขาย (Offer Price) + VAT 7% ส่วนราคาเฉลี่ยหลังของแถมจะแสดงแยกต่างหาก</p>';
 let total=0;
 Object.entries(cart).forEach(([id,it])=>{
  const p=products.find(x=>x.id==id),unit=chargeUnitVat(p),t=unit*it.qty,f=calcFree(p,it.qty);
  total+=t;
  lines+=`<div class="order-row"><b>${p.name}</b><br>${it.qty} × ${money(unit)} = <b>${money(t)}</b>
  ${f?`<br>🎁 แถม ${f} แพ็ก · รับรวม ${it.qty+f} แพ็ก · เฉลี่ย ${money(avgUnitAfterFree(p,it.qty))}/แพ็ก`:''}</div>`;
 });
 lines+=`<h3 style="display:flex;justify-content:space-between"><span>ยอดชำระรวม</span><span>${money(total)}</span></h3>`;
 document.getElementById('orderText').innerHTML=lines;
 document.getElementById('orderModal').classList.add('show');
}
function closeOrder(){document.getElementById('orderModal').classList.remove('show')}
async function copyOrder(){
 const d=getOrderData();
 const rows=d.items.map(x=>`${x.product} | ซื้อ ${x.qty} | แถม ${x.free} | รับรวม ${x.received} | ยอด ${money(x.amount)}`).join('\n');
 const text=`รายการสั่งซื้อ ${d.orderNo}\nลูกค้า: ${d.customerName}\nโทร: ${d.customerPhone}\n${rows}\nยอดชำระรวม ${money(d.total)}`;
 try{await navigator.clipboard.writeText(text);alert('คัดลอกรายการสั่งซื้อแล้ว')}catch(e){alert(text)}
}
function exportCurrentOrder(){
 if(!Object.keys(cart).length)return alert('ยังไม่มีสินค้า');
 if(typeof XLSX==='undefined')return alert('ไม่สามารถโหลดระบบ Excel ได้ กรุณาเชื่อมต่ออินเทอร์เน็ต');
 const d=getOrderData();
 const rows=d.items.map(x=>({
  'เลขที่คำสั่งซื้อ':d.orderNo,'วันที่':d.date.toLocaleString('th-TH'),
  'ลูกค้า':d.customerName,'เบอร์โทร':d.customerPhone,'ผู้ติดต่อ':d.contact,'หมายเหตุ':d.note,
  'สินค้า':x.product,'จำนวนชิ้น/แพ็ก':x.pack,'จำนวนซื้อ (แพ็ก)':x.qty,'ของแถม (แพ็ก)':x.free,
  'รับรวม (แพ็ก)':x.received,'Offer Price Ex.VAT':x.unitPriceExVat,
  'ราคาต่อแพ็ก รวม VAT':x.unitPriceVat,'ยอดชำระ':x.amount,
  'ราคาเฉลี่ย/แพ็ก หลังของแถม':x.avgPackPrice,'ราคาเฉลี่ย/ชิ้น หลังของแถม':x.avgPiecePrice,
  'โปรโมชั่น':x.bonus
 }));
 rows.push({'เลขที่คำสั่งซื้อ':d.orderNo,'สินค้า':'รวมทั้งออเดอร์','จำนวนซื้อ (แพ็ก)':d.items.reduce((s,x)=>s+x.qty,0),
 'ของแถม (แพ็ก)':d.free,'รับรวม (แพ็ก)':d.items.reduce((s,x)=>s+x.received,0),'ยอดชำระ':d.total});
 const ws=XLSX.utils.json_to_sheet(rows);
 ws['!cols']=[20,22,28,16,20,30,44,16,18,18,18,20,22,20,28,28,30].map(w=>({wch:w}));
 const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,'Order');
 const customer=clean(d.customerName).replace(/[\\/:*?"<>|]/g,'_')||'Customer';
 XLSX.writeFile(wb,`${d.orderNo}_${customer}.xlsx`);
 saveOrder(d);
}
function saveOrder(d){
 const history=JSON.parse(localStorage.getItem(ORDER_KEY)||'[]');
 history.push({...d,date:d.date.toISOString()});
 localStorage.setItem(ORDER_KEY,JSON.stringify(history.slice(-500)));
}
function exportOrderHistory(){
 if(typeof XLSX==='undefined')return alert('ไม่สามารถโหลดระบบ Excel ได้ กรุณาเชื่อมต่ออินเทอร์เน็ต');
 const history=JSON.parse(localStorage.getItem(ORDER_KEY)||'[]');
 if(!history.length)return alert('ยังไม่มีประวัติคำสั่งซื้อในเครื่องนี้');
 const rows=[];
 history.forEach(d=>d.items.forEach(x=>rows.push({
  'เลขที่คำสั่งซื้อ':d.orderNo,'วันที่':new Date(d.date).toLocaleString('th-TH'),'ลูกค้า':d.customerName,
  'เบอร์โทร':d.customerPhone,'ผู้ติดต่อ':d.contact,'สินค้า':x.product,'จำนวนซื้อ (แพ็ก)':x.qty,
  'ของแถม (แพ็ก)':x.free,'รับรวม (แพ็ก)':x.received,'ราคาต่อแพ็ก รวม VAT':x.unitPriceVat,
  'ยอดชำระ':x.amount,'ราคาเฉลี่ย/แพ็ก หลังของแถม':x.avgPackPrice,'โปรโมชั่น':x.bonus
 })));
 const ws=XLSX.utils.json_to_sheet(rows); ws['!cols']=Array(13).fill({wch:22});
 const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,'Orders');
 XLSX.writeFile(wb,`PAm_Order_History_${new Date().toISOString().slice(0,10)}.xlsx`);
}
renderProducts();renderCart();
