// Set the HTTPS backend URL here when the AI server is deployed.
const API_BASE = 'https://garanti-group-ai.suloanani1.workers.dev';
const $ = id => document.getElementById(id);
const messages=[];
let busy=false;
const greeting='გამარჯობა! რით შემიძლია დაგეხმაროთ? მომიყევით, რისი გაკეთება გსურთ — ფანჯრების, კარის თუ სხვა კონსტრუქციის?';
function bubble(text,role='assistant'){const el=document.createElement('div');el.className='chat-bubble '+role;el.textContent=text;$('chatLog').append(el);$('chatLog').scrollTop=$('chatLog').scrollHeight;}
async function api(path,body){
 if(!API_BASE && location.hostname.endsWith('github.io')){if(path==='/api/catalog')return {ready:false,aiReady:false};throw Error('AI კონსულტანტი ჯერ არ არის ჩართული. მანამდე დაგეხმარებით ტელეფონით: +995 598 12 30 30.');}
 const res=await fetch(API_BASE+path,{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(90000)});
 const data=await res.json();if(!res.ok)throw Error(data.error||'მოთხოვნა ვერ შესრულდა.');return data;
}
function fail(error){return error.name==='TimeoutError'?'პასუხი დაგვიანდა. გთხოვთ, სცადოთ ხელახლა.':error instanceof TypeError?'კავშირი ვერ დამყარდა. შეგიძლიათ დაგვირეკოთ: +995 598 12 30 30.':error.message;}
bubble(greeting);
api('/api/catalog').then(data=>{$('quoteStatus').textContent=data.aiReady?'მოგვწერეთ ჩვეულებრივი შეტყობინება — საჭირო დეტალებს საუბარში დავაზუსტებთ.':'AI კონსულტანტი მალე ჩაირთვება. ამ ეტაპზე კონსულტაციისთვის დაგვირეკეთ: +995 598 12 30 30.';if(!data.aiReady){$('chatLog').replaceChildren();bubble('მოგესალმებით! AI კონსულტანტი ჯერ მზადების პროცესშია. კონსულტაციისთვის დაგვირეკეთ: +995 598 12 30 30.');}}).catch(e=>{$('quoteStatus').textContent=fail(e);});
$('chatForm').addEventListener('submit',async e=>{
 e.preventDefault();if(busy)return;const content=$('chatInput').value.trim();if(!content)return;
 if(messages.length>=18){bubble('ახალი საუბრისთვის დააჭირეთ „თავიდან დაწყებას“.');return;}
 busy=true;$('chatSend').disabled=true;bubble(content,'user');messages.push({role:'user',content});$('chatInput').value='';$('chatState').textContent='კონსულტანტი წერს…';
 try{const data=await api('/api/chat',{messages});let reply=data.question;
 if(data.quote){const q=data.quote;const money=n=>new Intl.NumberFormat('ka-GE',{style:'currency',currency:q.currency}).format(n);reply+='\n\n'+q.profile+'\nკონსტრუქცია: '+money(q.material)+'\nმონტაჟი: '+money(q.installation)+'\nსავარაუდო ჯამი: '+money(q.total)+'\n'+q.notes;}
 bubble(reply);messages.push({role:'assistant',content:data.question});
 }catch(err){messages.pop();$('chatInput').value=content;bubble(fail(err));}
 finally{busy=false;$('chatSend').disabled=false;$('chatState').textContent='';$('chatInput').focus();}
});
$('resetChat').addEventListener('click',()=>{if(busy)return;messages.length=0;$('chatLog').replaceChildren();$('chatInput').value='';bubble('დავიწყოთ თავიდან. რით შემიძლია დაგეხმაროთ?');$('chatInput').focus();});
