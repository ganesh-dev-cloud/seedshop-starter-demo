import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';

const app = express();
const port = Number(process.env.PORT || 4000);
const dbFile = path.resolve(process.env.DATABASE_PATH || './data/seedshop.sqlite');
fs.mkdirSync(path.dirname(dbFile), { recursive: true });
const db = new Database(dbFile);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

app.use(helmet());
app.use(express.json({ limit: '32kb', strict: true }));
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173,http://localhost:8000').split(',').map(v => v.trim()).filter(Boolean);
app.use(cors({ origin(origin, callback) { if (!origin || allowedOrigins.includes(origin)) return callback(null, true); callback(new Error('Origin blocked by CORS')); } }));

// Small in-memory per-IP throttling. This protects basic abuse but resets on restart
// and is not a substitute for a production gateway/WAF or distributed rate limiter.
const rateBuckets = new Map();
function rateLimit({scope,windowMs,limit,message}) {
 return (req,res,next)=>{
  const now=Date.now(),ip=req.ip||req.socket.remoteAddress||'unknown',keyId=scope+':'+ip;
  for(const [key,bucket] of rateBuckets){if(bucket.resetAt<=now)rateBuckets.delete(key);}
  let bucket=rateBuckets.get(keyId);
  if(!bucket||bucket.resetAt<=now){bucket={count:0,resetAt:now+windowMs};rateBuckets.set(keyId,bucket);}
  if(rateBuckets.size>5000){for(const [key,b] of rateBuckets){if(b.resetAt<=now)rateBuckets.delete(key);}if(rateBuckets.size>5000)return res.status(503).json({error:'Rate limiter temporarily busy'});}
  bucket.count++;
  res.set('RateLimit-Limit',String(limit));
  res.set('RateLimit-Remaining',String(Math.max(0,limit-bucket.count)));
  res.set('RateLimit-Reset',String(Math.ceil(bucket.resetAt/1000)));
  if(bucket.count>limit){res.set('Retry-After',String(Math.ceil((bucket.resetAt-now)/1000)));return res.status(429).json({error:message});}
  next();
 };
}
const apiLimiter=rateLimit({scope:'api',windowMs:60_000,limit:120,message:'Too many API requests. Please wait and retry.'});
const orderLimiter=rateLimit({scope:'orders',windowMs:60_000,limit:8,message:'Too many order attempts. Please wait before trying again.'});
const adminLimiter=rateLimit({scope:'admin',windowMs:60_000,limit:30,message:'Too many admin attempts. Please wait and retry.'});
app.use('/api',apiLimiter);
app.use('/api/orders',orderLimiter);
app.use('/api/admin',adminLimiter);
app.use(cors({ origin(origin, callback) { if (!origin || allowedOrigins.includes(origin)) return callback(null, true); callback(new Error('Origin blocked by CORS')); } }));

db.exec(`
CREATE TABLE IF NOT EXISTS products (
 id TEXT PRIMARY PRIMARY KEY, name TEXT NOT NULL, category TEXT NOT NULL,
 description TEXT NOT NULL DEFAULT '', image TEXT NOT NULL DEFAULT '',
 price_paise INTEGER CHECK(price_paise IS NULL OR price_paise >= 0),
 stock INTEGER CHECK(stock IS NULL OR stock >= 0), active INTEGER NOT NULL DEFAULT 1,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS orders (
 id TEXT PRIMARY PRIMARY KEY, customer_name TEXT NOT NULL, phone TEXT NOT NULL,
 address TEXT NOT NULL, items_json TEXT NOT NULL, subtotal_paise INTEGER NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
`.replaceAll('PRIMARY PRIMARY KEY','PRIMARY KEY'));

const initialProducts=[
 {id:'paddy',name:'Paddy / Rice',category:'grain',description:'Rice seed. Ask the shop to confirm variety, suitability and availability.',image:'image/paddy-rice-328.jpg'},
 {id:'mustard',name:'Mustard',category:'oilseed',description:'Mustard seed. Ask the shop to confirm variety, sowing window and availability.',image:'image/Mustard.png'},
 {id:'sesame',name:'Black sesame',category:'oilseed',description:'Black sesame seed. Ask the shop to confirm variety, sowing window and availability.',image:'image/Black sesame.jfif'}
];
const addSeed=db.prepare('INSERT OR IGNORE INTO products (id,name,category,description,image,price_paise,stock) VALUES (@id,@name,@category,@description,@image,NULL,NULL)');
initialProducts.forEach(p=>addSeed.run(p));
const viewProduct=p=>({id:p.id,name:p.name,category:p.category,description:p.description,image:p.image,pricePaise:p.price_paise,stock:p.stock,active:Boolean(p.active),updatedAt:p.updated_at});
const isText=(v,max)=>typeof v==='string'&&v.trim().length>0&&v.trim().length<=max;
function admin(req,res,next){const secret=process.env.ADMIN_API_KEY;if(!secret)return res.status(503).json({error:'Admin API key not configured'});const received=Buffer.from(req.get('x-admin-key')||''),expected=Buffer.from(secret);if(received.length!==expected.length||!crypto.timingSafeEqual(received,expected))return res.status(401).json({error:'Unauthorized'});next();}

app.get('/api/health',(_req,res)=>res.json({status:'ok',service:'seedshop-api',deployed:false}));
app.get('/api/products',(req,res)=>{const category=req.query.category;res.json(db.prepare('SELECT * FROM products WHERE active=1 ORDER BY name').all().filter(p=>!category||p.category===category).map(viewProduct));});
app.get('/api/products/:id',(req,res)=>{const p=db.prepare('SELECT * FROM products WHERE id=? AND active=1').get(req.params.id);if(!p)return res.status(404).json({error:'Product not found'});res.json(viewProduct(p));});

app.post('/api/orders',(req,res)=>{
 const {customerName,phone,address,items}=req.body||{};
 if(!isText(customerName,120)||!isText(phone,40)||!isText(address,1000)||!Array.isArray(items)||items.length===0||items.length>30)return res.status(400).json({error:'Provide customerName, phone, address and cart items (1-30)'});
 const qtyMap=new Map();
 for(const i of items){if(!isText(i?.productId,80)||!Number.isInteger(i?.quantity)||i.quantity<1||i.quantity>100)return res.status(400).json({error:'Invalid item quantity/product id'});qtyMap.set(i.productId,(qtyMap.get(i.productId)||0)+i.quantity);}
 const orderLines=[];let subtotal=0;
 for(const [pid,qty] of qtyMap){const p=db.prepare('SELECT * FROM products WHERE id=? AND active=1').get(pid);if(!p)return res.status(400).json({error:'Product not available',productId:pid});if(p.price_paise===null)return res.status(409).json({error:'Product price not configured',productId:pid});if(p.stock!==null&&p.stock<qty)return res.status(409).json({error:'Insufficient stock',productId:pid});const total=p.price_paise*qty;subtotal+=total;if(!Number.isSafeInteger(subtotal))return res.status(400).json({error:'Order total overflow'});orderLines.push({productId:pid,name:p.name,quantity:qty,unitPricePaise:p.price_paise,lineTotalPaise:total});}
 const create=db.transaction(()=>{for(const line of orderLines){const s=db.prepare('SELECT stock FROM products WHERE id=?').get(line.productId);if(s.stock!==null){const changed=db.prepare('UPDATE products SET stock=stock-?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND stock>=?').run(line.quantity,line.productId,line.quantity);if(changed.changes===0)throw new Error('STOCK_CONFLICT');}}const id='SS-'+crypto.randomBytes(4).toString('hex').toUpperCase();db.prepare('INSERT INTO orders(id,customer_name,phone,address,items_json,subtotal_paise) VALUES(?,?,?,?,?,?)').run(id,customerName.trim(),phone.trim(),address.trim(),JSON.stringify(orderLines),subtotal);return id;});
 try{const id=create();res.status(201).json({orderId:id,status:'pending',subtotalPaise:subtotal,note:'Order saved. Payment and shop confirmation are not automated.'});}catch(err){if(err.message==='STOCK_CONFLICT')return res.status(409).json({error:'Stock changed; please retry'});throw err;}
});

app.get('/api/admin/products',admin,(_req,res)=>res.json(db.prepare('SELECT * FROM products ORDER BY name').all()));
app.put('/api/admin/products/:id',admin,(req,res)=>{const {name,category,description='',image='',pricePaise,stock,active}=req.body||{};const validImage=image===''||(/^image\/[a-zA-Z0-9_% .-]+$/.test(image));if(!/^[a-zA-Z0-9_-]{1,80}$/.test(req.params.id)||!isText(name,150)||!isText(category,80)||typeof description!=='string'||description.length>2000||typeof image!=='string'||image.length>500||!validImage||!(pricePaise===null||(Number.isSafeInteger(pricePaise)&&pricePaise>=0))||!(stock===null||(Number.isInteger(stock)&&stock>=0))||typeof active!=='boolean')return res.status(400).json({error:'Invalid product data'});const r=db.prepare('UPDATE products SET name=?,category=?,description=?,image=?,price_paise=?,stock=?,active=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(name.trim(),category.trim(),description,image,pricePaise,stock,active?1:0,req.params.id);if(r.changes===0)return res.status(404).json({error:'Product not found'});res.json(viewProduct(db.prepare('SELECT * FROM products WHERE id=?').get(req.params.id)));});
app.get('/api/admin/orders',admin,(_req,res)=>res.json(db.prepare('SELECT * FROM orders ORDER BY created_at DESC').all().map(o=>({...o,items:JSON.parse(o.items_json)}))));
app.patch('/api/admin/orders/:id/status',admin,(req,res)=>{const allowed=['pending','confirmed','packed','shipped','completed','cancelled'];if(!allowed.includes(req.body?.status))return res.status(400).json({error:'Invalid status'});try{const update=db.transaction(()=>{const order=db.prepare('SELECT * FROM orders WHERE id=?').get(req.params.id);if(!order)return null;const wasCancelled=order.status==='cancelled',willCancel=req.body.status==='cancelled',lines=JSON.parse(order.items_json);if(!wasCancelled&&!willCancel){/* no inventory adjustment */}else if(!wasCancelled&&willCancel){for(const line of lines){db.prepare('UPDATE products SET stock=stock+?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND stock IS NOT NULL').run(line.quantity,line.productId);}}else if(wasCancelled&&!willCancel){for(const line of lines){const p=db.prepare('SELECT stock FROM products WHERE id=?').get(line.productId);if(!p||p.stock===null)continue;const r=db.prepare('UPDATE products SET stock=stock-?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND stock>=?').run(line.quantity,line.productId,line.quantity);if(!r.changes)throw new Error('STOCK_CONFLICT');}}db.prepare('UPDATE orders SET status=? WHERE id=?').run(req.body.status,req.params.id);return {id:req.params.id,status:req.body.status};});const result=update();if(!result)return res.status(404).json({error:'Order not found'});res.json(result);}catch(e){if(e.message==='STOCK_CONFLICT')return res.status(409).json({error:'Cannot reopen order: insufficient stock'});throw e;}});

app.use((err,_req,res,_next)=>{if(err?.type==='entity.too.large')return res.status(413).json({error:'Request body too large'});if(err instanceof SyntaxError&&err.status===400)return res.status(400).json({error:'Invalid JSON body'});if(err.message==='Origin blocked by CORS')return res.status(403).json({error:'Origin blocked by CORS'});console.error(err);res.status(500).json({error:'Server error'});});
app.listen(port,()=>console.log('Seedshop backend listening on localhost:'+port+' (not deployed)'));
