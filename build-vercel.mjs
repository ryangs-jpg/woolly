import {mkdir,readdir,copyFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
await mkdir(path.join(root,'vercel-public'),{recursive:true});
for(const file of await readdir(path.join(root,'public')))await copyFile(path.join(root,'public',file),path.join(root,'vercel-public',file));
console.log('Vercel frontend ready. API functions deploy separately; no secrets included.');
