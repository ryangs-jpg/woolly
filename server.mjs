import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {handleApi} from './server/api.js';
import {localDatabase} from './server/local-db.js';
const project=path.dirname(fileURLToPath(import.meta.url)),root=path.join(project,'public');
const db=localDatabase(path.join(project,'.local-data/reference.sqlite'));
const port=Number(process.env.PORT)||4173;
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8'};
const server=http.createServer(async(req,res)=>{try{
 const host=req.headers.host;if(!['127.0.0.1:'+port,'localhost:'+port].includes(host)){res.writeHead(403);res.end();return;}
 const url=new URL(req.url,'http://'+host);
 if(url.pathname.startsWith('/api/')){
  const headers=new Headers();for(const [name,value]of Object.entries(req.headers))if(value&&!name.startsWith('oai-authenticated-'))headers.set(name,Array.isArray(value)?value.join(', '):value);
  headers.set('oai-authenticated-user-id','local-preview');
  const request=new Request(url,{method:req.method,headers,...(!['GET','HEAD'].includes(req.method)?{body:req,duplex:'half'}:{})});
  const response=await handleApi(request,{DB:db});res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));return;
 }
 const file=path.resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));
 if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
 const data=await readFile(file);res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','X-Content-Type-Options':'nosniff','Cache-Control':'no-cache'});res.end(data);
}catch{res.writeHead(500,{'Content-Type':'text/plain; charset=utf-8'});res.end('요청을 처리하지 못했습니다.');}});
server.listen(port,'127.0.0.1',()=>console.log('JEJU REF: http://127.0.0.1:'+port+' (local SQLite, local-preview account)'));
process.on('SIGINT',()=>server.close(()=>{db.close();process.exit(0);}));
