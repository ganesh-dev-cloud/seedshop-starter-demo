const urlInput=document.getElementById('api-url'),keyInput=document.getElementById('admin-key'),msg=document.getElementById('admin-message'),content=document.getElementById('admin-content');
urlInput.value=localStorage.getItem('seedshop_api_base')||'';
keyInput.value=sessionStorage.getItem('seedshop_admin_key')||'';
const base=()=>urlInput.value.trim().replace(/\/$/,'');
function validBase(value){try{const u=new URL(value);return (u.protocol==='https:'||(u.protocol==='http:'&&['localhost','127.0.0.1'].includes(u.hostname)))&&!u.username&&!u.password;}catch{return false}}
const headers=()=>({'x-admin-key':keyInput.value.trim(),'Content-Type':'application/json'});
async function req(path,options={}){
 const response=await fetch(base()+path,{...options,headers:{...headers(),...(options.headers||{})}});
 const text=await response.text();
 let data={};try{data=text?JSON.parse(text):{};}catch{throw Error('Server returned an invalid response.')}
 if(!response.ok)throw Error(data.error||'Request failed ('+response.status+')');
 return data;
}
document.getElementById('connect').onclick=async()=>{
 if(!validBase(base())||!keyInput.value.trim()){msg.textContent='Enter a valid HTTPS backend URL (HTTP is allowed only for localhost) and admin key.';return}
 try{
  await refresh();
  localStorage.setItem('seedshop_api_base',base());
  sessionStorage.setItem('seedshop_admin_key',keyInput.value.trim());
  msg.textContent='Connected to admin API.';
 }catch(e){content.hidden=true;msg.textContent=e.message;}
};
document.getElementById('logout').onclick=()=>{localStorage.removeItem('seedshop_api_base');sessionStorage.removeItem('seedshop_admin_key');keyInput.value='';urlInput.value='';content.hidden=true;msg.textContent='Credentials cleared from this browser.'};
async function refresh(){const ps=await req('/api/admin/products'),os=await req('/api/admin/orders');if(!Array.isArray(ps)||!Array.isArray(os))throw Error('Unexpected admin API response.');renderProducts(ps);renderOrders(os);content.hidden=false;}
function renderProducts(ps){
 const root=document.getElementById('admin-products');
 root.innerHTML=ps.map(p=>'<form class="commerce-card admin-product" data-id="'+esc(p.id)+'"><label>Product name<input name="name" value="'+esc(p.name)+'" required maxlength="150"></label><label>Category<input name="category" value="'+esc(p.category)+'" required maxlength="80"></label><label class="full">Description<textarea name="description" maxlength="2000">'+esc(p.description||'')+'</textarea></label><label class="full">Image path<input name="image" value="'+esc(p.image||'')+'" maxlength="500"></label><label>Price (₹)<input name="price" type="number" step="0.01" min="0" value="'+(p.pricePaise==null?'':(p.pricePaise/100).toFixed(2))+'"></label><label>Stock<input name="stock" type="number" min="0" step="1" value="'+(p.stock==null?'':p.stock)+'"></label><label>Status<select name="active"><option value="true" '+(p.active?'selected':'')+'>Active</option><option value="false" '+(!p.active?'selected':'')+'>Hidden</option></select></label><button class="primary-btn full" type="submit">Save product ↗</button></form>').join('');
 root.querySelectorAll('form').forEach(f=>f.onsubmit=async e=>{
  e.preventDefault();const button=f.querySelector('button[type=submit]');if(button.disabled)return;button.disabled=true;
  const fd=new FormData(f),price=fd.get('price'),stock=fd.get('stock'),pricePaise=price===''?null:Math.round(Number(price)*100),stockValue=stock===''?null:Number(stock);
  if(price!==''&&(!Number.isFinite(Number(price))||Number(price)<0||!Number.isSafeInteger(pricePaise))){msg.textContent='Enter a valid price (up to 2 decimal places).';button.disabled=false;return}
  if(stock!==''&&(!Number.isInteger(stockValue)||stockValue<0)){msg.textContent='Stock must be a non-negative whole number.';button.disabled=false;return}
  if(!/^image\/[a-zA-Z0-9_% .-]+$/.test(String(fd.get('image')||''))&&fd.get('image')!==''){msg.textContent='Image must be a local image/ asset path.';button.disabled=false;return}
  const body={name:String(fd.get('name')).trim(),category:String(fd.get('category')).trim(),description:fd.get('description'),image:fd.get('image'),pricePaise,stock:stockValue,active:fd.get('active')==='true'};
  try{await req('/api/admin/products/'+encodeURIComponent(f.dataset.id),{method:'PUT',body:JSON.stringify(body)});msg.textContent='Saved '+body.name;await refresh()}catch(err){msg.textContent=err.message}finally{button.disabled=false}
 };
}
function renderOrders(os){
 const root=document.getElementById('admin-orders');
 root.innerHTML=os.length?os.map(o=>'<article class="admin-order"><header><strong>'+esc(o.id)+'</strong><span>'+esc(o.created_at||'')+'</span></header><p><b>'+esc(o.customer_name)+'</b> · '+esc(o.phone)+'</p><p>'+esc(o.address)+'</p><pre>'+o.items.map(i=>esc(i.name)+' × '+i.quantity+' @ ₹'+(i.unitPricePaise/100).toFixed(2)).join('\n')+'</pre><p><strong>Total: ₹'+(o.subtotal_paise/100).toFixed(2)+'</strong></p><label>Status <select class="status-select" data-order="'+esc(o.id)+'">'+['pending','confirmed','packed','shipped','completed','cancelled'].map(s=>'<option '+(s===o.status?'selected':'')+'>'+s+'</option>').join('')+'</select></label></article>').join(''):'<p>No orders yet.</p>';
 root.querySelectorAll('[data-order]').forEach(s=>s.onchange=async()=>{s.disabled=true;try{await req('/api/admin/orders/'+encodeURIComponent(s.dataset.order)+'/status',{method:'PATCH',body:JSON.stringify({status:s.value})});msg.textContent='Order status updated.';await refresh()}catch(e){msg.textContent=e.message;try{await refresh()}catch{}}finally{s.disabled=false}});
}
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
