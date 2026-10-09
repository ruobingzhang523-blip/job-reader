import {readFile,writeFile,mkdir} from 'node:fs/promises';
const root=new URL('../',import.meta.url);
let code='// Generated from the shared Node/Worker application. Contains no environment secrets.\n';
for(const name of ['courses.mjs','analyze.mjs','service.mjs']){
  code+=(await readFile(new URL(name,root),'utf8')).replace(/^import .*?;\n/gm,'').replace(/^export /gm,'')+'\n';
}
const assets={};for(const [file,type] of [['index.html','text/html; charset=utf-8'],['app.js','text/javascript; charset=utf-8'],['style.css','text/css; charset=utf-8'],['manual.html','text/html; charset=utf-8'],['manual.css','text/css; charset=utf-8']])assets['/'+file]={body:await readFile(new URL('dist/'+file,root),'utf8'),type};
code+='\nconst bundledAssets='+JSON.stringify(assets)+';\n';
code+="const workerHandler=createService({publicDeployment:true,getAsset:async path=>bundledAssets[path]});\nexport default {fetch(request,env){return workerHandler(request,env);}};\n";
await mkdir(new URL('dist/server/',root),{recursive:true});await writeFile(new URL('dist/server/index.js',root),code);
console.log('Worker构建完成；不包含本地环境文件。');
