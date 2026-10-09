import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createService} from '../service.mjs';
const env={OPENAI_API_KEY:'test-only-not-real',PUBLIC_ORIGIN:'https://learn.example'};
function request({path='/api/analyze',method='POST',token='',origin=env.PUBLIC_ORIGIN,body={text:'熟悉SQL。',background:'零基础'},headers={}}={}){
  return new Request('https://learn.example'+path,{method,headers:{'Content-Type':'application/json',Origin:origin,...(token?{Authorization:'Bearer '+token}:{}),...headers},...(['GET','HEAD'].includes(method)?{}:{body:typeof body==='string'?body:JSON.stringify(body)})});
}
test('公网请求无需访问码；旧访问码配置和请求头不再影响生成',async()=>{
  let calls=0;const handler=createService({analyzeImpl:async()=>{calls++;return {};}});
  for(const config of [env,{...env,APP_ACCESS_TOKEN:'obsolete',REQUIRE_ACCESS_CODE:'true'}]){
    for(const token of ['', 'obsolete-code'])assert.equal((await handler(request({token}),config)).status,200);
  }
  assert.equal(calls,4);
});
test('无需访问码传递学习背景；健康接口不泄露密钥',async()=>{
  const handler=createService({analyzeImpl:async(text,config,options)=>({text,background:options.background})});
  assert.deepEqual(await (await handler(request(),env)).json(),{text:'熟悉SQL。',background:'零基础'});
  const health=await (await handler(request({path:'/api/health',method:'GET',token:''}),env)).json();assert.equal(health.requiresAccessCode,false);assert.ok(!JSON.stringify(health).includes(env.OPENAI_API_KEY));
});
test('课程可无访问码查看；私有文件与源码均不提供',async()=>{
  const handler=createService({});
  assert.equal((await (await handler(request({path:'/api/courses',method:'GET',token:''}),env)).json()).courses.length,8);
  for(const path of ['/.env.local','/server.mjs','/.git/config','/dist/server/index.js'])assert.equal((await handler(request({path,method:'GET',token:''}),env)).status,404);
});
test('跨站请求、错误JSON和过大正文均拒绝且不调用模型',async()=>{
  let count=0;const handler=createService({analyzeImpl:async()=>{count++;return {};}});
  assert.equal((await handler(request({origin:'https://attacker.example'}),env)).status,403);
  assert.equal((await handler(request({body:'{'}),env)).status,400);
  assert.equal((await handler(request({body:'x'.repeat(80001)}),env)).status,413);
  assert.equal((await handler(request({body:{text:'JD',background:42}}),env)).status,400);
  assert.equal(count,0);
});
test('正在生成时拒绝并发；完成后小时限额仍生效',async()=>{
  let finish;let entered;const ready=new Promise(r=>{entered=r;});
  const handler=createService({analyzeImpl:async()=>{entered();await new Promise(r=>{finish=r;});return {};}});
  const config={...env,MAX_REQUESTS_PER_HOUR:'1'};const first=handler(request(),config);await ready;
  assert.equal((await handler(request(),config)).status,429);finish();assert.equal((await first).status,200);
  const limited=await handler(request(),config);assert.equal((await limited.json()).error.code,'local_limit');
});
test('额度失败保留可理解的错误；不返回异常原文',async()=>{
  const handler=createService({analyzeImpl:async()=>{throw new Error('private internal credential');}});
  const response=await handler(request(),env);assert.equal(response.status,500);assert.ok(!(await response.text()).includes('credential'));
});
