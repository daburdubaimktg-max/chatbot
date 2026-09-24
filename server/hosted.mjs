import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {Readable} from 'node:stream';
import {fileURLToPath} from 'node:url';
import {createPersonalisedHandler,diskMeter} from './personalised.mjs';

export const assets=['index.html','alter.css','alter.js','generation-client.js','favicon.svg','vatika-logo.png','worlds.png','men-worlds.png','trial-0.png','trial-1-v2.png','trial-2-v2.png','trial-3-v2.png','trial-4-v2.png'];
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.svg':'image/svg+xml'};

export async function initialiseLedger(file,pilot,initialUsed){
 // Bootstrap explicitly at cutover. Never overwrite an existing usage counter.
 if(!Number.isInteger(initialUsed)||initialUsed<0)throw Error('A verified migration count is required');
 await fs.mkdir(path.dirname(file),{recursive:true});
 try{await fs.writeFile(file,JSON.stringify({[pilot]:initialUsed}),{flag:'wx',mode:0o600})}catch(e){if(e.code!=='EEXIST')throw e}
 const ledger=JSON.parse(await fs.readFile(file,'utf8'));
 if(!Number.isInteger(ledger[pilot])||ledger[pilot]<initialUsed)throw Error('Usage ledger requires review');
}

export function createHostedServer({origin,publicRoot,handler}){
 const base=new URL(origin);if(base.protocol!=='https:')throw Error('An HTTPS public origin is required');
 const server=http.createServer(async(req,res)=>{
  const safe={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY','Strict-Transport-Security':'max-age=31536000'};
  try{
   if(req.url==='/healthz'&&req.method==='GET'){res.writeHead(200,safe).end('ok');return}
   if(req.headers.host!==base.host){res.writeHead(403,safe).end('Unsupported host');return}
   const url=new URL(req.url,base);if(url.origin!==base.origin){res.writeHead(403,safe).end();return}
   if(url.pathname.startsWith('/api/')){
    const abort=new AbortController();res.on('close',()=>{if(!res.writableEnded)abort.abort()});
    const request=new Request(url,{method:req.method,headers:req.headers,signal:abort.signal,...(!['GET','HEAD'].includes(req.method)?{body:Readable.toWeb(req),duplex:'half'}:{})});
    const result=await handler(request);
    res.writeHead(result?.status||404,{...safe,...Object.fromEntries(result?.headers||[])});
    res.end(result?Buffer.from(await result.arrayBuffer()):undefined);return;
   }
   if(!['GET','HEAD'].includes(req.method)){res.writeHead(405,safe).end();return}
   const name=url.pathname==='/'?'index.html':url.pathname.slice(1);
   if(!assets.includes(name)){res.writeHead(404,safe).end();return}
   const bytes=await fs.readFile(path.join(publicRoot,name));
   res.writeHead(200,{...safe,'Content-Type':types[path.extname(name)]});res.end(req.method==='HEAD'?undefined:bytes);
  }catch{if(!res.headersSent)res.writeHead(503,safe);res.end('Service temporarily unavailable')}
 });
 server.requestTimeout=60000;server.headersTimeout=15000;
 server.on('close',()=>handler.close());return server;
}

async function main(){
 const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
 const config=JSON.parse(await fs.readFile(path.join(root,'server/generation-approval.json'),'utf8'));
 // Publishing a package cannot by itself enable paid generation.
 config.enabled=config.enabled&&process.env.GENERATION_ENABLED==='true';
 const dataDir=process.env.DATA_DIR;if(!dataDir||!path.isAbsolute(dataDir))throw Error('Persistent DATA_DIR is required');
 const initial=process.env.INITIAL_USED_SESSIONS;
 if(!/^\d+$/.test(initial||''))throw Error('INITIAL_USED_SESSIONS must be verified at cutover');
 const ledger=path.join(dataDir,'generation-usage.json');await initialiseLedger(ledger,config.pilotId,Number(initial));
 const handler=createPersonalisedHandler({config,getKey:()=>process.env.OPENAI_API_KEY,meter:diskMeter(ledger),concurrency:3,maxQueued:3});
 const server=createHostedServer({origin:process.env.PUBLIC_ORIGIN||process.env.RENDER_EXTERNAL_URL,publicRoot:path.join(root,'public'),handler});
 server.listen(Number(process.env.PORT||10000),'0.0.0.0',()=>console.log('Hosted Vatika service ready'));
 for(const signal of ['SIGTERM','SIGINT'])process.once(signal,()=>{handler.close();server.close();setTimeout(()=>process.exit(0),10000).unref()});
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await main();
