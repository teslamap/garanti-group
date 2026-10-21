const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
export async function generateGemini(payload, {key, model, fetchImpl=fetch, wait=pause}) {
  // Only models with documented free text tiers; never fall back to a paid Pro model.
  const models=[...new Set([model || 'gemini-3.1-flash-lite','gemini-3.5-flash-lite'])];
  for(const candidate of models) {
    for(let attempt=0;attempt<2;attempt++) {
      let response;
      try {
        response=await fetchImpl('https://generativelanguage.googleapis.com/v1beta/models/'+encodeURIComponent(candidate)+':generateContent',{
          method:'POST',signal:AbortSignal.timeout(18000),
          headers:{'x-goog-api-key':key,'Content-Type':'application/json'},body:JSON.stringify(payload)
        });
      } catch {
        if(attempt===0){await wait(1000);continue;}
        break;
      }
      if(response.ok)return {ok:true,data:await response.json()};
      const failure=await response.json().catch(()=>({}));
      const code=String(failure.error?.status||'unknown').replace(/[^a-zA-Z0-9_]/g,'').slice(0,80);
      console.error('Gemini request failed',candidate,response.status,code);
      // Invalid keys and exhausted quota require user action, not extra calls.
      if(![404,408,500,502,503,504].includes(response.status))return {ok:false,status:response.status};
      if(response.status===404)break;
      if(attempt===0)await wait(1000+Math.floor(Math.random()*400));
    }
  }
  return {ok:false,status:503};
}
