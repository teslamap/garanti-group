import {isProjectImageUrl} from './project-upload.js?v=github-images-20261027';
export function photoData(value){return typeof value==='string'&&/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(value)&&value.length<=2000100}
const text=(x,max,min=0)=>typeof x==='string'&&x.trim().length>=min&&x.length<=max;
export function validateInquiry(body){
 if(!body||!text(body.name,100,2)||!text(body.phone,25,7)||!/^\+?[\d\s()-]{7,25}$/.test(body.phone)||!text(body.address,500)||!text(body.notes,2000)||body.consent!==true||!Array.isArray(body.items)||body.items.length<1||body.items.length>20)throw Error('შეამოწმეთ სახელი, ტელეფონი და თანხმობა.');
 let total=0;
 for(const i of body.items){if(!['ფანჯარა','კარი','ვიტრაჟი','მოაჯირი','სხვა'].includes(i.type)||!['PVC','ალუმინი','მინა'].includes(i.material)||!Number.isInteger(i.width)||i.width<1||i.width>20000||!Number.isInteger(i.height)||i.height<1||i.height>20000||!Number.isInteger(i.quantity)||i.quantity<1||i.quantity>100||!text(i.notes,1000)||!Array.isArray(i.photos)||i.photos.length>3||i.photos.some(p=>!photoData(p)))throw Error('შეამოწმეთ კონსტრუქციის ზომები და ფოტოები.');total+=i.photos.reduce((sum,p)=>sum+p.length,0)}
 if(total>15000000)throw Error('ფოტოების საერთო მოცულობა ძალიან დიდია.');
}
export function validateContent(data){
 if(!data||!data.texts||typeof data.texts!=='object'||Array.isArray(data.texts)||Object.keys(data.texts).length>500||Object.values(data.texts).some(x=>!text(x,10000))||!Array.isArray(data.projects)||data.projects.length>100)throw Error('გვერდის კონტენტი არასწორია.');
 if(data.links&&(typeof data.links!=='object'||Array.isArray(data.links)||Object.keys(data.links).length>200||Object.values(data.links).some(x=>!x||!text(x.label,100)||!text(x.href,2000)||!/^(https?:|tel:|mailto:|#|\.\/)/.test(x.href))))throw Error('ბმული არასწორია.');
 for(const p of data.projects)if(!text(p.title,200,1)||!text(p.category,100)||!text(p.description,4000)||!Array.isArray(p.photos)||p.photos.length>5||p.photos.some(x=>!photoData(x)&&!isProjectImageUrl(x)&&!(typeof x==='string'&&x.startsWith('https://firebasestorage.googleapis.com/v0/b/garanti-group.firebasestorage.app/o/projects%2F')&&x.length<3000)))throw Error('პროექტის ინფორმაცია ან ფოტო არასწორია.');
}

