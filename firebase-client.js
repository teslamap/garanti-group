import {initializeApp} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js';
import {getAuth, setPersistence, inMemoryPersistence, signInWithEmailAndPassword, signInAnonymously, signOut} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';
import {getFirestore, doc, collection, getDoc, getDocs, query, orderBy, limit, setDoc, updateDoc, deleteDoc, writeBatch, serverTimestamp} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';
import {getStorage, ref, uploadString, getBlob, deleteObject} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-storage.js';
import {validateInquiry, validateContent} from './firebase-validation.js';
import {uploadProjectPhoto} from './project-upload.js';

const config=window.GG_CONFIG;
const app=initializeApp(config.firebase);
const auth=getAuth(app),db=getFirestore(app),storage=getStorage(app);
const ready=setPersistence(auth,inMemoryPersistence);
const empty=()=>({texts:{},links:{},projects:[]});
const orderRef=id=>doc(db,'orders',id);
const blobUrls=new Set();
let activeDraft=null;
let anonymousLogin=null;
window.addEventListener('pagehide',()=>blobUrls.forEach(URL.revokeObjectURL));

export function firebaseError(error){
  const code=error?.code||'';
  if(code.includes('operation-not-allowed'))return 'Firebase-ში Email/Password და Anonymous შესვლა გასააქტიურებელია.';
  if(code.includes('invalid-credential')||code.includes('wrong-password')||code.includes('user-not-found')||code.includes('invalid-email'))return 'ელფოსტა ან პაროლი არასწორია.';
  if(code.includes('configuration-not-found'))return 'Firebase Authentication ჯერ არ არის გააქტიურებული.';
  if(code.includes('permission-denied')||code.includes('unauthorized'))return 'წვდომა უარყოფილია. შეამოწმეთ Firebase-ის წესები და ადმინისტრატორის უფლება.';
  if(code.includes('not-found')||code.includes('failed-precondition'))return 'Firebase-ის მონაცემთა ბაზა ან მისი კონფიგურაცია გადასამოწმებელია.';
  if(code.includes('too-many-requests')||code.includes('resource-exhausted'))return 'მოთხოვნების ლიმიტი ამოიწურა. სცადეთ მოგვიანებით.';
  if(code.includes('network')||code.includes('unavailable'))return 'კავშირი ვერ დამყარდა. გადაამოწმეთ ინტერნეტი და სცადეთ ხელახლა.';
  return error.message||'Firebase-თან კავშირის შეცდომა.';
}
async function visitor(){await ready;if(!auth.currentUser){anonymousLogin??=signInAnonymously(auth).finally(()=>anonymousLogin=null);await anonymousLogin}return auth.currentUser}
async function admin(){await ready;const user=auth.currentUser;if(!user||user.isAnonymous)throw Error('გაიარეთ ადმინისტრატორის ავტორიზაცია.');const grant=await getDoc(doc(db,'admins',user.uid));if(!grant.exists()||grant.data().active!==true)throw Error('ანგარიშს ადმინისტრატორის უფლება არ აქვს. Firebase Console-ში admins/'+user.uid+' დოკუმენტში დაამატეთ active: true.');return user}
async function publicContent(){const snap=await getDoc(doc(db,'site','content'));const data=snap.exists()?snap.data():empty();validateContent(data);return data}
async function publish(data){
 const user=await admin();validateContent(data);const result=structuredClone(data);
 for(const p of result.projects){for(let i=0;i<p.photos.length;i++){const photo=p.photos[i];if(photo.startsWith('data:')){const url=await uploadProjectPhoto(photo,user,config.projectUploadUrl);p.photos[i]=url;data.projects[result.projects.indexOf(p)].photos[i]=url}}}
 if(new TextEncoder().encode(JSON.stringify(result)).length>700000)throw Error('გვერდის კონტენტი ძალიან დიდია.');
 await setDoc(doc(db,'site','content'),{texts:result.texts,links:result.links||{},projects:result.projects});Object.assign(data,result);return {ok:true};
}
async function submit(body){
 validateInquiry(body);if(body.items.some(i=>i.photos.length)&&!config.storageEnabled)throw Error('ფოტოების ონლაინ ატვირთვა ჯერ არ არის ჩართული. შეგიძლიათ განაცხადი ფოტოებიანად ჩამოტვირთოთ ან ფოტოები წაშალოთ და ტექსტური მოთხოვნა გაგზავნოთ.');
 const user=await visitor();
 // Retain the same reservation across retries, preventing duplicate completed orders
 // when a final response is interrupted after the database committed it.
 const fingerprint=JSON.stringify(body);
 if(activeDraft&&activeDraft.fingerprint!==fingerprint){throw Error('წინა გაგზავნა დაუმთავრებელია. სცადეთ იგივე განაცხადის ხელახლა გაგზავნა ან განაახლეთ გვერდი ახალი განაცხადისთვის.');}
 if(!activeDraft){
  const header=doc(collection(db,'orders'));const id=header.id;
  const items=body.items.map((item,index)=>({...item,photos:item.photos.map((_,photo)=>'orders/'+user.uid+'/'+id+'/'+index+'/'+photo)}));
  const batch=writeBatch(db);
  batch.set(header,{ownerUid:user.uid,name:body.name.trim(),phone:body.phone.trim(),address:body.address.trim(),notes:body.notes.trim(),consent:true,itemCount:items.length,createdAt:serverTimestamp(),submittedAt:null,status:'მზადდება'});
  items.forEach((item,index)=>batch.set(doc(db,'orders',id,'items',String(index)),item));
  batch.set(doc(db,'submissionLimits',user.uid),{lastAt:serverTimestamp(),orderId:id});
  await batch.commit();activeDraft={id,items,fingerprint};
 }
 const {id,items}=activeDraft;
 const existing=await getDoc(orderRef(id));
 if(existing.data()?.status!=='მზადდება'){activeDraft=null;return {id}}
 for(let i=0;i<items.length;i++)for(let j=0;j<items[i].photos.length;j++){
  const file=ref(storage,items[i].photos[j]);await uploadString(file,body.items[i].photos[j],'data_url');
 }
 await updateDoc(orderRef(id),{status:'ახალი',submittedAt:serverTimestamp()});activeDraft=null;return {id};
}
async function privatePhoto(path){const image=await getBlob(ref(storage,path),1500000);const url=URL.createObjectURL(image);blobUrls.add(url);return url}
async function orders(){
 await admin();blobUrls.forEach(URL.revokeObjectURL);blobUrls.clear();
 const snap=await getDocs(query(collection(db,'orders'),orderBy('createdAt','desc'),limit(100)));
 const result=[];
 for(const record of snap.docs){const data=record.data();const rows=await getDocs(collection(db,'orders',record.id,'items'));const items=[];
  for(const row of rows.docs){const item=row.data();const images=[];for(const path of item.photos)try{images.push(await privatePhoto(path))}catch{ /* Keep the order readable when an image upload is incomplete. */ }items.push({...item,photos:images,index:Number(row.id)})}
  items.sort((a,b)=>a.index-b.index);result.push({id:record.id,created:data.createdAt?.toDate().toISOString()||'',status:data.status,value:{...data,items}});
 }return result;
}
async function removeOrder(id){await admin();const items=await getDocs(collection(db,'orders',id,'items'));
 for(const item of items.docs)for(const path of item.data().photos){try{await deleteObject(ref(storage,path))}catch(e){if(e.code!=='storage/object-not-found')throw e}}
 const batch=writeBatch(db);items.docs.forEach(i=>batch.delete(i.ref));batch.delete(orderRef(id));await batch.commit();return {ok:true};
}
export async function firebaseApi(path,method='GET',body){
 try{
 if(path==='login'&&method==='POST'){await ready;await signInWithEmailAndPassword(auth,body.email,body.password);try{await admin()}catch(e){await signOut(auth);throw e}return {token:'firebase-session'}}
 if(path==='logout'){await signOut(auth);return {ok:true}}
 if(path==='content'&&method==='GET')return await publicContent();
 if(path==='content'&&method==='PUT')return await publish(body);
 if(path==='orders'&&method==='POST')return await submit(body);
 if(path==='orders'&&method==='GET')return await orders();
 if(path==='orders'&&method==='PUT'){await admin();await updateDoc(orderRef(body.id),{status:body.status});return {ok:true}}
 if(path.startsWith('orders?id=')&&method==='DELETE')return await removeOrder(decodeURIComponent(path.split('=')[1]));
 throw Error('უცნობი მოქმედება.');
 }catch(e){throw Error(firebaseError(e))}
}
