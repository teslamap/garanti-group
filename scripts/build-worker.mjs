import {readFile,writeFile} from 'node:fs/promises';
const root=new URL('../',import.meta.url);
const source=await readFile(new URL('ai-worker/worker.js',root),'utf8');
const helpers=(await readFile(new URL('ai-worker/inquiries.js',root),'utf8')).replace(/^export /gm,'');
await writeFile(new URL('ai-worker/deploy.js',root),source.replace("import {REQUEST_STATUSES, commercialIntent, phoneFrom, requestId, boundedJson, saveInquiry} from './inquiries.js';",helpers));
