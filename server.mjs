import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {Readable} from 'node:stream';
import {createService,securityHeaders} from './service.mjs';

const port=Number(process.env.PORT||4317);
const hostname=process.env.HOST||'127.0.0.1';
const external=!['127.0.0.1','localhost','::1'].includes(hostname);
const publicOrigin=process.env.PUBLIC_ORIGIN?new URL(process.env.PUBLIC_ORIGIN):null;
if(!Number.isInteger(port)||port<0||port>65535)throw new Error('PORT配置无效。');
if(external&&(!publicOrigin||!['http:','https:'].includes(publicOrigin.protocol)||!process.env.APP_ACCESS_TOKEN||process.env.APP_ACCESS_TOKEN.length<20))throw new Error('对外监听需要PUBLIC_ORIGIN和至少20位的APP_ACCESS_TOKEN。');
const assets=new Map([['/index.html','text/html; charset=utf-8'],['/app.js','text/javascript; charset=utf-8'],['/style.css','text/css; charset=utf-8'],['/manual.html','text/html; charset=utf-8'],['/manual.css','text/css; charset=utf-8']]);
const handler=createService({publicDeployment:external,getAsset:async path=>({body:await readFile(new URL('./dist'+path,import.meta.url)),type:assets.get(path)})});
const server=http.createServer(async(req,res)=>{
  const localPort=server.address()?.port||port;
  const allowedHosts=new Set([`127.0.0.1:${localPort}`,`localhost:${localPort}`,`[::1]:${localPort}`]);
  if(publicOrigin)allowedHosts.add(publicOrigin.host);
  if(!allowedHosts.has(req.headers.host)){res.writeHead(403,securityHeaders);return res.end('不支持的访问地址。');}
  const aborter=new AbortController();res.on('close',()=>{if(!res.writableEnded)aborter.abort();});
  try{
    const request=new Request(new URL(req.url,publicOrigin?.origin||`http://${req.headers.host}`),{method:req.method,headers:req.headers,signal:aborter.signal,...(!['GET','HEAD'].includes(req.method)?{body:Readable.toWeb(req),duplex:'half'}:{})});
    const result=await handler(request,process.env);
    if(!res.destroyed){res.writeHead(result.status,Object.fromEntries(result.headers));res.end(Buffer.from(await result.arrayBuffer()));}
  }catch{
    if(!res.destroyed&&!res.headersSent){res.writeHead(500,{...securityHeaders,'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify({error:{message:'服务暂时不可用。'}}));}
  }
});
server.requestTimeout=100000;server.headersTimeout=15000;
server.listen(port,hostname,()=>console.log(`读懂岗位：${publicOrigin?.origin||'http://127.0.0.1:'+server.address().port}/`));
server.on('error',()=>{console.error('服务启动失败，请确认地址和端口配置。');process.exitCode=1;});
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{server.close();setTimeout(()=>process.exit(0),2000).unref();});
