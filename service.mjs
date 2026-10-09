import {analyze,AppError,prepareInput} from './analyze.mjs';
import {courses,verifiedOn} from './courses.mjs';

export const securityHeaders={'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Cache-Control':'no-store','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",'Permissions-Policy':'camera=(), microphone=(), geolocation=()'};
const json=(status,value)=>new Response(JSON.stringify(value),{status,headers:{...securityHeaders,'Content-Type':'application/json; charset=utf-8'}});
const error=(status,code,message)=>json(status,{error:{code,message}});
export function accessRequired(env,publicDeployment=false){return publicDeployment||env.REQUIRE_ACCESS_CODE==='true'||Boolean(env.APP_ACCESS_TOKEN);}
async function sameSecret(a,b){
  const encode=new TextEncoder();const [x,y]=await Promise.all([a,b].map(s=>crypto.subtle.digest('SHA-256',encode.encode(s))));
  const aa=new Uint8Array(x),bb=new Uint8Array(y);let diff=0;for(let i=0;i<aa.length;i++)diff|=aa[i]^bb[i];return diff===0;
}
async function readJSON(request){
  const reader=request.body?.getReader();if(!reader)throw new AppError('bad_json','请填写招聘要求。');
  const chunks=[];let size=0;
  try{while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>80000){await reader.cancel();throw new AppError('input_too_long','输入内容过长。',413);}chunks.push(value);}}
  finally{reader.releaseLock();}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
  try{return JSON.parse(new TextDecoder().decode(bytes));}catch{throw new AppError('bad_json','无法读取提交的内容。');}
}
// 限流状态只存在于当前进程/Worker实例内，不是跨实例预算控制。
export function createService({getAsset,analyzeImpl=analyze,publicDeployment=false,now=Date.now}={}){
  let running=0;let calls=[];
  return async function handle(request,env={}){
    const url=new URL(request.url);const path=url.pathname;
    const protectedAPI=accessRequired(env,publicDeployment);
    if(request.method==='GET'&&path==='/api/health')return json(200,{configured:Boolean(env.OPENAI_API_KEY),requiresAccessCode:protectedAPI,model:env.OPENAI_MODEL||'gpt-4.1-mini'});
    if(request.method==='GET'&&path==='/api/courses')return json(200,{courses,verified_on:verifiedOn});
    if(request.method==='GET'&&['/','/index.html','/app.js','/style.css','/manual.html','/manual.css'].includes(path)){
      const asset=await getAsset(path==='/'?'/index.html':path);
      return asset?new Response(asset.body,{headers:{...securityHeaders,'Content-Type':asset.type}}):error(500,'asset_error','网页文件暂不可用。');
    }
    if(path!=='/api/analyze')return error(404,'not_found','页面不存在。');
    if(request.method!=='POST')return error(405,'method_not_allowed','请使用页面按钮提交。');
    const origin=request.headers.get('origin');
    const allowedOrigin=env.PUBLIC_ORIGIN?new URL(env.PUBLIC_ORIGIN).origin:url.origin;
    if((origin&&origin!==allowedOrigin)||request.headers.get('sec-fetch-site')==='cross-site')return error(403,'invalid_origin','请从本工具页面发起请求。');
    if(protectedAPI){
      if(!env.APP_ACCESS_TOKEN||env.APP_ACCESS_TOKEN.length<20)return error(503,'access_not_configured','网站管理者尚未配置生成服务访问码，课程资料仍可查看。');
      const auth=request.headers.get('authorization')||'';
      if(auth.length>300||!auth.startsWith('Bearer ')||!(await sameSecret(auth.slice(7),env.APP_ACCESS_TOKEN)))return error(401,'access_denied','访问码不正确，请向网站管理者获取生成服务的访问码。');
    }
    if(!request.headers.get('content-type')?.startsWith('application/json'))return error(415,'bad_content_type','请求格式不正确。');
    let payload;
    try{payload=await readJSON(request);prepareInput(payload?.text);if(payload?.background!==undefined&&(typeof payload.background!=='string'||payload.background.length>500))throw new AppError('invalid_background','请将学习背景控制在500字以内。');}
    catch(e){return e instanceof AppError?error(e.status,e.code,e.message):error(400,'bad_request','无法读取请求。');}
    // 读取请求之后再检查并占用位置，避免并发请求绕过上限。
    const timestamp=now();calls=calls.filter(t=>t>timestamp-3600000);
    const requestedLimit=Number(env.MAX_REQUESTS_PER_HOUR||30);const limit=Number.isInteger(requestedLimit)&&requestedLimit>0?Math.min(requestedLimit,1000):30;
    if(running>=1)return error(429,'busy','已有一个生成正在进行，请稍后再试。');
    if(calls.length>=limit)return error(429,'local_limit','当前服务请求较多，请稍后再试。');
    if(!env.OPENAI_API_KEY)return error(503,'not_configured','网站管理者尚未配置模型服务，课程资料仍可查看。');
    running++;calls.push(timestamp);
    try{return json(200,await analyzeImpl(payload.text,env,{background:payload.background,signal:request.signal}));}
    catch(e){return e instanceof AppError?error(e.status,e.code,e.message):error(500,'internal_error','服务暂时无法完成生成，请稍后重试。');}
    finally{running--;}
  };
}
