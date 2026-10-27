let next=null,loading=false;
const statuses=['ახალი','დაკავშირება','მუშავდება','დასრულებული','გაუქმებული'];
const el=(tag,text,parent)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;parent?.append(node);return node};
export async function load(api,fail,more=false){
 if(loading)return;loading=true;
 const list=document.getElementById('ai-requests'),note=document.getElementById('ai-request-status'),button=document.getElementById('load-more-ai');
 note.textContent='იტვირთება…';
 try{
  const data=await api('ai-requests'+(more&&next?'?before='+encodeURIComponent(next):''));
  if(!more)list.replaceChildren();
  for(const row of data.requests){
   const box=el('details',undefined,list);box.className='ai-request-card';
   el('summary','№'+row.number+' · '+(row.phone||'ტელეფონი ჯერ არ არის')+' · '+row.status+' · '+new Date(row.created_at).toLocaleString('ka-GE'),box);
   el('p',row.summary,box).style.whiteSpace='pre-wrap';
   if(row.phone){const phone=el('a',row.phone,box);phone.href='tel:'+row.phone}
   const log=el('details',undefined,box);el('summary','სრული მიმოწერა',log);
   for(const message of row.transcript){const p=el('p',(message.role==='user'?'მომხმარებელი: ':'AI: ')+message.content,log);p.style.whiteSpace='pre-wrap'}
   const label=el('label','სტატუსი ',box),select=el('select',undefined,label);select.setAttribute('aria-label','მოთხოვნის სტატუსი');
   for(const status of statuses){const option=el('option',status,select);option.selected=status===row.status}
   select.onchange=async()=>{select.disabled=true;try{await api('ai-requests','PATCH',{id:row.id,status:select.value});row.status=select.value;box.querySelector('summary').textContent='№'+row.number+' · '+(row.phone||'ტელეფონი ჯერ არ არის')+' · '+row.status+' · '+new Date(row.created_at).toLocaleString('ka-GE');note.textContent='სტატუსი შენახულია.'}catch(e){select.value=row.status;note.textContent=e.message;fail(e)}finally{select.disabled=false}};
   const del=el('button','პირადი მონაცემების წაშლა',box);del.type='button';del.onclick=async()=>{if(!confirm('წაიშალოს მოთხოვნის ტელეფონი და მიმოწერა?'))return;del.disabled=true;try{await api('ai-requests','DELETE',{id:row.id});box.remove();note.textContent='მონაცემები წაშლილია.'}catch(e){note.textContent=e.message;del.disabled=false}};
  }
  next=data.next;button.hidden=!next;button.onclick=()=>load(api,fail,true);
  note.textContent=list.children.length?'ჩატვირთულია '+list.children.length+' მოთხოვნა.':'AI მოთხოვნები ჯერ არ არის.';
  filter();
 }catch(e){note.textContent=e.message;fail(e)}finally{loading=false}
}
export function filter(){
 const text=document.getElementById('ai-search').value.trim().toLocaleLowerCase('ka');
 document.querySelectorAll('.ai-request-card').forEach(row=>row.hidden=!row.textContent.toLocaleLowerCase('ka').includes(text));
}
