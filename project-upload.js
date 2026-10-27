// Project gallery uploads only. Inquiry attachments keep their private Firebase path.
export function isProjectImageUrl(value){
 try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&!u.search&&!u.hash&&((/^[a-z0-9-]+\.supabase\.co$/.test(u.hostname)&&/^\/storage\/v1\/object\/public\/project-images\/[A-Za-z0-9/_-]+\.(?:jpg|png|webp)$/.test(u.pathname))||(u.hostname==='raw.githubusercontent.com'&&/^\/teslamap\/garanti-group\/[a-f0-9]{40}\/uploads\/projects\/[a-f0-9-]{36}\.(?:jpg|png|webp)$/.test(u.pathname)))}catch{return false}
}
export async function uploadProjectPhoto(photo,user,endpoint,fetcher=fetch){
 if(!endpoint)throw Error('პროექტის ფოტოების ატვირთვის Worker არ არის მითითებული.');
 const match=/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(photo);
 if(!match||photo.length>2000100)throw Error('ფოტო: JPG, PNG ან WebP, მაქსიმუმ 1.5 MB');
 const bytes=Uint8Array.from(atob(match[2]),c=>c.charCodeAt(0));
 if(!bytes.length||bytes.length>1500000)throw Error('ფოტო: მაქსიმუმ 1.5 MB');
 const form=new FormData();form.append('file',new Blob([bytes],{type:'image/'+match[1]}),'project.'+(match[1]==='jpeg'?'jpg':match[1]));
 const token=await user.getIdToken(true);
 const response=await fetcher(endpoint,{method:'POST',headers:{Authorization:'Bearer '+token},body:form,signal:AbortSignal.timeout(30000),redirect:'error'});
 const data=await response.json().catch(()=>({}));
 if(response.status===401){
  if(data.error==='AUTH_REQUIRED')throw Error('Worker-მა ავტორიზაციის ტოკენი ვერ მიიღო (AUTH_REQUIRED). ატვირთვის Authorization სათაური გადასამოწმებელია.');
  if(data.error==='INVALID_TOKEN')throw Error('Worker-მა განახლებული Firebase ტოკენი უარყო (INVALID_TOKEN). Worker-ში გადაამოწმეთ Firebase პროექტი garanti-group და ID token-ის შემოწმება.');
  throw Error('Worker-მა ატვირთვის ავტორიზაცია უარყო (HTTP 401). ეს პასუხი სესიის ამოწურვას არ ადასტურებს; საჭიროა Worker-ის ავტორიზაციის შემოწმება.');
 }
 if(response.status===403)throw Error('Worker-მა ატვირთვა უარყო: საჭიროა Firebase admins/{uid}.active=true როლის შემოწმება; მხოლოდ JWT admin claim საკმარისი არ არის.');
 if(data.error==='GITHUB_STORAGE_NOT_CONFIGURED')throw Error('GitHub-ზე ფოტოების ატვირთვა ჯერ არ არის ჩართული. საჭიროა Worker-ის დაცული GitHub წვდომის გამართვა.');
 if(data.error==='GITHUB_STORAGE_ACCESS_DENIED')throw Error('GitHub-ზე ჩაწერის წვდომა უარყოფილია. ადმინისტრატორმა უნდა შეამოწმოს Worker-ის GitHub გასაღები.');
 if(data.error==='GITHUB_STORAGE_CONFLICT')throw Error('GitHub-ზე პარალელური ცვლილებაა. ფოტო არ გამოქვეყნებულა; სცადეთ შენახვა ხელახლა.');
 if(!response.ok)throw Error('პროექტის ფოტო ვერ აიტვირთა. Worker /api/upload გადასამოწმებელია.');
 if(!isProjectImageUrl(data.url))throw Error('Worker-მა პროექტის ფოტოს სწორი საჯარო URL არ დააბრუნა.');
 return data.url;
}

