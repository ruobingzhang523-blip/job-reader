import {spawn,execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';
const root=dirname(fileURLToPath(import.meta.url));
try{process.loadEnvFile(join(root,'.env.local'));}catch(e){if(e.code!=='ENOENT')throw new Error('无法读取本地配置。');}
const env={...process.env};
// 沿用本机已经启用的HTTP代理，仅影响这个子进程，不修改系统网络设置。
if(process.platform==='darwin'&&!env.HTTPS_PROXY&&!env.https_proxy){
  try{
    const proxy=execFileSync('/usr/sbin/scutil',['--proxy'],{encoding:'utf8'});
    const get=key=>proxy.match(new RegExp('^\\s*'+key+' : (.+)$','m'))?.[1]?.trim();
    if(get('HTTPSEnable')==='1'){
      const host=get('HTTPSProxy'),port=get('HTTPSPort');
      if(host&&/^[\w.-]+$/.test(host)&&/^\d+$/.test(port||'')){env.HTTPS_PROXY=`http://${host}:${port}`;env.NO_PROXY=[env.NO_PROXY,'localhost','127.0.0.1','::1'].filter(Boolean).join(',');}
    }
  }catch{}
}
const child=spawn(process.execPath,['--use-env-proxy','server.mjs'],{cwd:root,env,stdio:'inherit'});
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>child.kill(signal));
child.on('exit',code=>{process.exitCode=code||0;});
child.on('error',()=>{console.error('无法启动本地服务。');process.exitCode=1;});
