const productsFallback=[{id:'paddy',name:'Paddy / Rice',category:'GRAIN · PADDY',description:'Seed options for rice cultivation.',image:'image/paddy-rice-328.jpg'},{id:'mustard',name:'Mustard',category:'OILSEED · MUSTARD',description:'Explore mustard seed options.',image:'image/Mustard.png'},{id:'sesame',name:'Black sesame',category:'OILSEED · SESAME',description:'Explore sesame seed options.',image:'image/Black%20sesame.jfif'}];
const grid=document.getElementById('shop-products'),search=document.getElementById('crop-search'),empty=document.getElementById('shop-empty');
let shopProducts=productsFallback;
const validId=id=>typeof id==='string'&&/^[a-zA-Z0-9_-]{1,80}$/.test(id);
const validImage=image=>typeof image==='string'&&image.length<=500&&/^image\/[a-zA-Z0-9_% .-]+$/.test(image)&&image.trim().length>0;
function normalizeProduct(p){
 if(!p||!validId(p.id)||typeof p.name!=='string'||!p.name.trim()||p.name.length>150||typeof p.category!=='string'||p.category.length>80||typeof p.description!=='string'||p.description.length>2000||!validImage(p.image))return null;
 return {id:p.id,name:p.name.trim(),category:p.category,description:p.description,image:p.image};
}
function renderShop(q=''){
 const filtered=shopProducts.filter(p=>(p.name+' '+p.category+' '+p.description).toLowerCase().includes(q.toLowerCase()));
 grid.innerHTML=filtered.map(p=>'<a class="shop-card" href="product.html?product='+encodeURIComponent(p.id)+'"><img src="'+safe(p.image)+'" alt="'+safe(p.name)+'"><div><small>'+safe(p.category||'CROP SEED')+'</small><h3>'+safe(p.name)+'</h3><p>'+safe(p.description||'Explore product details.')+'</p><span>View details ↗</span></div></a>').join('');
 empty.hidden=filtered.length!==0;
 document.getElementById('product-count').textContent=filtered.length+' CROPS FOUND';
}
function safe(v){return String(v||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
search.addEventListener('input',()=>renderShop(search.value));
fetch((window.SEEDSHOP_API_BASE||localStorage.getItem('seedshop_api_base')||'')+'/api/products').then(r=>r.ok?r.json():Promise.reject()).then(data=>{
 if(!Array.isArray(data))throw new Error('Invalid product catalog response');
 const validated=data.map(normalizeProduct).filter(Boolean);
 if(validated.length)shopProducts=validated;
 renderShop(search.value);
}).catch(()=>renderShop(search.value));
