const API=()=>window.SEEDSHOP_API_BASE||localStorage.getItem('seedshop_api_base')||'';
const CART=window.SeedshopCart;
const fmt=p=>p==null?'Not configured':'₹'+(p/100).toFixed(2);
const form=document.getElementById('checkout-form');
const submitButton=form.querySelector('button[type="submit"]');
const message=document.getElementById('checkout-message');
let submitting=false;

async function readJson(response){
  const text=await response.text();
  if(!text)return {};
  try{return JSON.parse(text)}catch{return {error:'The server returned an invalid response.'}}
}

async function init(){
  const box=document.getElementById('checkout-summary'),cart=CART.read();
  if(!Object.keys(cart).length){
    box.innerHTML='Cart is empty. <a href="shop.html">Shop now</a>';
    submitButton.disabled=true;
    return;
  }
  if(!API()){
    box.textContent='Backend is not configured. Please try later.';
    submitButton.disabled=true;
    return;
  }
  submitButton.disabled=true;
  try{
    const products=await Promise.all(Object.keys(cart).map(async id=>{
      const response=await fetch(API()+'/api/products/'+encodeURIComponent(id));
      if(!response.ok)throw new Error('One or more products are unavailable. Please return to your cart.');
      const product=await readJson(response);
      if(!product||product.id!==id||!Number.isFinite(product.pricePaise)||product.pricePaise<0||typeof product.name!=='string'){
        throw new Error('Product details could not be verified. Please return to your cart.');
      }
      return product;
    }));
    let subtotal=0;
    box.innerHTML='<h3>Order summary</h3>'+products.map(product=>{
      const quantity=cart[product.id],value=product.pricePaise*quantity;
      subtotal+=value;
      return '<p>'+product.name+' × '+quantity+' — '+fmt(value)+'</p>';
    }).join('')+'<hr><strong>Subtotal: '+fmt(subtotal)+'</strong>';
    submitButton.disabled=false;
    form.addEventListener('submit',async event=>{
      event.preventDefault();
      if(submitting)return;
      if(!API()){
        message.textContent='Backend is not configured. Please try later.';
        return;
      }
      submitting=true;
      submitButton.disabled=true;
      const originalLabel=submitButton.textContent;
      submitButton.textContent='Submitting order…';
      message.textContent='Submitting order…';
      const formData=new FormData(form);
      const items=Object.entries(cart).map(([productId,quantity])=>({productId,quantity}));
      const controller=new AbortController();
      const timeout=setTimeout(()=>controller.abort(),20000);
      try{
        const response=await fetch(API()+'/api/orders',{
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body:JSON.stringify({customerName:formData.get('customerName'),phone:formData.get('phone'),address:formData.get('address'),items}),
          signal:controller.signal
        });
        const data=await readJson(response);
        if(!response.ok)throw new Error(data.error||'Order failed. Your cart has been kept.');
        if(!data.orderId)throw new Error('The server response could not be verified. Your cart has been kept.');
        localStorage.removeItem(CART.key);
        box.innerHTML='<div class="commerce-card"><h2>Order received ✓</h2><p>Your order number: <strong>'+String(data.orderId)+'</strong></p><p>Subtotal: '+fmt(data.subtotalPaise)+'</p><p>Payment and shop confirmation are not automated yet. Keep your order ID.</p></div>';
        form.reset();
        message.textContent='Order saved successfully.';
        submitButton.textContent='Order received';
      }catch(error){
        message.textContent=error.name==='AbortError'?'Request timed out. Your cart has been kept. Please check with the shop before retrying.':(error.message||'Could not submit order. Your cart has been kept.');
        submitButton.textContent=originalLabel;
        submitButton.disabled=false;
      }finally{
        clearTimeout(timeout);
        submitting=false;
        if(box.querySelector('.commerce-card h2')?.textContent!=='Order received ✓')submitButton.disabled=false;
      }
    });
  }catch(error){
    box.textContent=error.message||'Unable to load checkout summary. Check the backend connection.';
    submitButton.disabled=true;
  }
}
init();
