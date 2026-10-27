(()=>{
const endpoint='https://garanti-group-ai.suloanani1.workers.dev/api/chat';
const $=id=>document.getElementById(id);
const toggle=$('gg-chat-toggle'),panel=$('gg-chat-panel'),messages=$('gg-chat-messages'),form=$('gg-chat-form'),input=$('gg-chat-input'),send=$('gg-chat-send'),teaser=$('gg-chat-teaser');
let busy=false;const history=[];let conversationId=crypto.randomUUID();
function openChat(open){panel.classList.toggle('gg-open',open);panel.setAttribute('aria-hidden',String(!open));toggle.setAttribute('aria-expanded',String(open));if(open){teaser.hidden=true;input.focus()}else toggle.focus()}
toggle.addEventListener('click',()=>openChat(!panel.classList.contains('gg-open')));
panel.querySelector('.gg-chat-close').addEventListener('click',()=>openChat(false));
$('gg-teaser-close').addEventListener('click',()=>{teaser.hidden=true});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&panel.classList.contains('gg-open'))openChat(false)});
function bubble(text,who){const el=document.createElement('div');el.className='gg-bubble '+(who==='user'?'gg-user':'gg-bot');el.textContent=text;messages.append(el);messages.scrollTop=messages.scrollHeight;return el}
async function ask(value){
 const question=value.trim();if(!question||busy)return;
 if(history.length>=40){bubble('ახალი საუბრისთვის დააჭირეთ „თავიდან დაწყებას“.','bot');return}
 input.value='';bubble(question,'user');busy=true;send.disabled=true;
 const pending=bubble('პასუხს ვამზადებ…','bot');
 try{
  const res=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:question,history,conversationId}),signal:AbortSignal.timeout(90000)});
  const data=await res.json();if(!res.ok)throw Error(data.reply||'კავშირი ვერ დამყარდა. სცადეთ ხელახლა.');
  if(typeof data.reply!=='string'||!data.reply.trim())throw Error('პასუხი ვერ მივიღეთ. სცადეთ ხელახლა.');
  pending.textContent=data.reply;history.push({role:'user',content:question},{role:'assistant',content:data.reply});
  if(data.inquiry?.state==='saved')$('gg-inquiry-status').textContent='მოთხოვნა №'+data.inquiry.number+' გადაეცა ადმინისტრატორს.';
 }catch(e){pending.textContent=e.name==='TimeoutError'?'პასუხი დაგვიანდა. იგივე შეტყობინება ხელახლა გაგზავნეთ.':e.message;input.value=question}
 finally{busy=false;send.disabled=false;if(panel.classList.contains('gg-open'))input.focus()}
}
form.addEventListener('submit',e=>{e.preventDefault();ask(input.value)});
panel.querySelectorAll('[data-question]').forEach(btn=>btn.addEventListener('click',()=>ask(btn.dataset.question)));
$('gg-chat-reset').addEventListener('click',()=>{if(busy)return;history.length=0;conversationId=crypto.randomUUID();messages.replaceChildren();bubble('გამარჯობა! რით შეგვიძლია დაგეხმაროთ?','bot');$('gg-inquiry-status').textContent='';input.value='';input.focus()});
})();
