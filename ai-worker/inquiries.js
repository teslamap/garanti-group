// Included in the standalone worker by scripts/build-worker.mjs.
export const REQUEST_STATUSES=['ახალი','დაკავშირება','მუშავდება','დასრულებული','გაუქმებული'];
export function commercialIntent(text){
 return /შეთავაზ|შეკვეთ|შეძენ|შეძინ|შეკვეთ|მინდა.{0,60}(ფანჯ|კარ|შემინ|მოაჯირ|ტიხრ|ფასად)|მჭირდება|დამიკავშ|დამირეკ|გაზომ|აზომ|გამოთვლ|დამითვალ|რამდენი.*(ღირს|დამიჯდება)|ფასი|ფასის|quote|quotation|order|buy|purchase|call me|price|shetavaz|shekvet|mchirdeba|damirek|gazom|fasi/i.test(text);
}
export function phoneFrom(text){
 // Match complete digit runs: never turn the tail of a foreign/oversized number
 // into a Georgian phone. Newlines separate numbers and conversation turns.
 const normalized=String(text).normalize('NFKC').replace(/[\u200b-\u200f\u202a-\u202e\u2066-\u2069]/g,'');
 const candidates=normalized.match(/\+?\d(?:[ \t\u00a0().\-–—]*\d)*/g)||[];
 for(const candidate of candidates.reverse()){
  let digits=candidate.replace(/\D/g,'');
  if(digits.startsWith('00995'))digits=digits.slice(5);
  else if(digits.startsWith('995')&&digits.length>=12)digits=digits.slice(3);
  else if(candidate.startsWith('+'))continue;
  if(digits.length===10&&digits.startsWith('0'))digits=digits.slice(1);
  // Geographic (3/4), mobile (5), and non-geographic (7) national numbers.
  if(/^[3457]\d{8}$/.test(digits))return '+995'+digits;
 }
 return '';
}
export function contactReply(transcript){
 const last=transcript.at(-1);
 if(last?.role!=='user'||!phoneFrom(last.content))return false;
 const previous=transcript.slice(0,-1).findLast(m=>m.role==='assistant');
 return !!previous&&/(?:ნომერ|ტელეფონ|nomer|telefon|phone|number|номер|телефон)/i.test(previous.content);
}
export async function requestId(value){
 const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));
 return [...new Uint8Array(bytes)].map(b=>b.toString(16).padStart(2,'0')).join('');
}
export async function boundedJson(request,maximum=80000){
 const reader=request.body?.getReader();if(!reader)throw Error('INVALID_JSON');
 const chunks=[];let size=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>maximum){await reader.cancel();throw Error('BODY_TOO_LARGE')}chunks.push(value)}}finally{reader.releaseLock()}
 const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length}
 try{return JSON.parse(new TextDecoder().decode(bytes))}catch{throw Error('INVALID_JSON')}
}
export async function saveInquiry(db,id,transcript,detected){
 const existing=await db.prepare('SELECT id, deleted FROM ai_requests WHERE id = ?').bind(id).first();
 if(existing?.deleted)return {state:'removed'};
 if(!detected&&!existing)return {state:'none'};
 const users=transcript.filter(m=>m.role==='user').map(m=>m.content);
 const summary=users.filter(commercialIntent).join('\n').slice(0,3000)||users.join('\n').slice(0,3000);
 const now=new Date().toISOString();
 await db.prepare(`INSERT INTO ai_requests (id,phone,summary,transcript,created_at,updated_at,status,message_count)
 VALUES (?,?,?,?,?,?,'ახალი',?) ON CONFLICT(id) DO UPDATE SET
 phone=CASE WHEN excluded.phone='' THEN ai_requests.phone ELSE excluded.phone END,
 summary=excluded.summary, transcript=excluded.transcript, updated_at=excluded.updated_at, message_count=excluded.message_count
 WHERE ai_requests.deleted=0 AND excluded.message_count>=ai_requests.message_count`)
 .bind(id,phoneFrom(users.join('\n')),summary,JSON.stringify(transcript),now,now,transcript.length).run();
 return {state:'saved',number:id.slice(0,12).toUpperCase()};
}
