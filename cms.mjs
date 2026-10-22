import {DatabaseSync} from 'node:sqlite';
import {randomBytes, timingSafeEqual} from 'node:crypto';
import {mkdirSync} from 'node:fs';
export function createCMS({directory=process.env.DATA_DIR||'./data',password=process.env.ADMIN_PASSWORD,origin=process.env.ALLOWED_ORIGIN}={}) {
 mkdirSync(directory,{recursive:true});const db=new DatabaseSync(directory+'/cms.sqlite');db.exec('PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS content (id INTEGER PRIMARY KEY CHECK(id=1), value TEXT); CREATE TABLE IF NOT EXISTS orders (id TEXT PRIMARY KEY, created TEXT, status TEXT, value TEXT);');
 const sessions=new Map(),limits=new Map();
 const timer=setInterval(()=>{limits.clear();for(const [k,v]of sessions)if(v<Date.now())sessions.delete(k)},60000);timer.unref();
 return async function(req,res){const url=new URL(req.url,'http://localhost');if(!url.pathname.startsWith('/cms/'))return false;
 const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
 if(origin&&req.headers.origin===origin)Object.assign(headers,{'Access-Control-Allow-Origin':origin,'Vary':'Origin','Access-Control-Allow-Headers':'Content-Type, Authorization','Access-Control-Allow-Methods':'GET, POST, PUT, DELETE, OPTIONS'});
 const send=(s,v)=>{res.writeHead(s,headers);res.end(JSON.stringify(v));return true};
 if(req.headers.origin&&req.headers.origin!==origin)return send(403,{error:'Origin denied'});
 if(req.method==='OPTIONS')return send(204,{});
 try{
 const path=url.pathname,method=req.method,admin=(sessions.get((req.headers.authorization||'').replace(/^Bearer /,''))||0)>Date.now();
 if(path==='/cms/content'&&method==='GET'){const row=db.prepare('SELECT value FROM content WHERE id=1').get();return send(200,row?JSON.parse(row.value):{texts:{},projects:[]})}
 if(!['/cms/login','/cms/orders'].includes(path)&&!admin)return send(401,{error:'გაიარეთ ავტორიზაცია'});
 if(path==='/cms/orders'&&method!=='POST'&&!admin)return send(401,{error:'გაიარეთ ავტორიზაცია'});
 if(!['POST','PUT','GET','DELETE'].includes(method))return send(405,{error:'Method denied'});
 let body={};if(['POST','PUT'].includes(method)){let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>16000000)return send(413,{error:'ფაილები ძალიან დიდია'})}body=JSON.parse(raw)}
 const ip=req.socket.remoteAddress;const limited=(max)=>{const key=ip+path;const n=(limits.get(key)||0)+1;limits.set(key,n);return n>max};
 if(path==='/cms/login'&&method==='POST'){
 if(limited(5))return send(429,{error:'სცადეთ ერთ წუთში'});if(!password||password.length<16)return send(503,{error:'ადმინისტრატორის პაროლი სერვერზე არ არის გამართული'});
 const a=Buffer.from(String(body.password||'')),b=Buffer.from(password);if(a.length!==b.length||!timingSafeEqual(a,b))return send(401,{error:'პაროლი არასწორია'});
 const token=randomBytes(32).toString('hex');sessions.set(token,Date.now()+3600000);return send(200,{token})}
 if(path==='/cms/logout'){sessions.delete((req.headers.authorization||'').replace(/^Bearer /,''));return send(200,{ok:true})}
 if(path==='/cms/content'&&method==='PUT'){
 if(!body.texts||typeof body.texts!=='object'||Array.isArray(body.texts)||Object.keys(body.texts).length>500||Object.values(body.texts).some(t=>typeof t!=='string'||t.length>10000)||!Array.isArray(body.projects)||body.projects.length>100)return send(400,{error:'არასწორი კონტენტი'});
 if(body.links&&(typeof body.links!=='object'||Array.isArray(body.links)||Object.keys(body.links).length>200||Object.values(body.links).some(x=>!x||typeof x.label!=='string'||x.label.length>100||typeof x.href!=='string'||x.href.length>2000||!/^(https?:|tel:|mailto:|#|\.\/)/.test(x.href))))return send(400,{error:'არასწორი ბმული'});
 for(const p of body.projects)if(typeof p.title!=='string'||p.title.length>200||typeof p.description!=='string'||p.description.length>4000||typeof p.category!=='string'||p.category.length>100||!Array.isArray(p.photos)||p.photos.length>5||p.photos.some(x=>typeof x!=='string'||!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(x)||x.length>2200000))return send(400,{error:'არასწორი პროექტი / ფოტო'});
 db.prepare('INSERT INTO content VALUES(1,?) ON CONFLICT(id) DO UPDATE SET value=excluded.value').run(JSON.stringify(body));return send(200,{ok:true})}
 if(path==='/cms/orders'&&method==='POST'){
 if(limited(3))return send(429,{error:'სცადეთ ერთ წუთში'});
 if(typeof body.name!=='string'||body.name.length<2||body.name.length>100||typeof body.phone!=='string'||!/^\+?[\d\s()-]{7,25}$/.test(body.phone)||typeof body.address!=='string'||body.address.length>500||typeof body.notes!=='string'||body.notes.length>2000||body.consent!==true||!Array.isArray(body.items)||!body.items.length||body.items.length>20)return send(400,{error:'შეამოწმეთ საკონტაქტო ინფორმაცია'});
 for(const i of body.items)if(!['ფანჯარა','კარი','ვიტრაჟი','მოაჯირი','სხვა'].includes(i.type)||!['PVC','ალუმინი','მინა'].includes(i.material)||!Number.isFinite(i.width)||i.width<=0||i.width>20000||!Number.isFinite(i.height)||i.height<=0||i.height>20000||!Number.isInteger(i.quantity)||i.quantity<1||i.quantity>100||typeof i.notes!=='string'||i.notes.length>1000||!Array.isArray(i.photos)||i.photos.length>3||i.photos.some(x=>typeof x!=='string'||!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(x)||x.length>2200000))return send(400,{error:'შეამოწმეთ კონსტრუქციები და ფოტოები'});
 const id=randomBytes(10).toString('hex');db.prepare('INSERT INTO orders VALUES(?,?,?,?)').run(id,new Date().toISOString(),'ახალი',JSON.stringify(body));return send(201,{id})}
 if(path==='/cms/orders'&&method==='GET')return send(200,db.prepare('SELECT id,created,status,value FROM orders ORDER BY created DESC LIMIT 200').all().map(x=>({...x,value:JSON.parse(x.value)})));
 if(path==='/cms/orders'&&method==='PUT'){if(!['ახალი','დაკავშირება','მუშავდება','დასრულებული','გაუქმებული'].includes(body.status))return send(400,{error:'Invalid status'});db.prepare('UPDATE orders SET status=? WHERE id=?').run(body.status,body.id);return send(200,{ok:true})}
 if(path==='/cms/orders'&&method==='DELETE'){db.prepare('DELETE FROM orders WHERE id=?').run(url.searchParams.get('id'));return send(200,{ok:true})}
 return send(404,{error:'Not found'});
 }catch{return send(400,{error:'მოთხოვნა ვერ დამუშავდა'})}
 }
}
