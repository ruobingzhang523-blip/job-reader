import {test} from 'node:test';
import assert from 'node:assert/strict';
import {analyze,prepareInput,validateOutput,validatePath} from '../analyze.mjs';
import {courseById} from '../courses.mjs';
const row=id=>({source_id:id,plain_language:'解释',terms:[],example:'例子',learning_suggestion:'建议',uncertainty:''});
const module=()=>({title:'用SQL查数据',stage:'先补基础',source_ids:[1],why:'为独立查数补基础',job_expectation:'熟练掌握SQL',first_milestone:'先能筛选表格中的记录',ready_when:['能写出SELECT和WHERE','能解释查询结果'],course_ids:['sql'],remaining_gap:'还需要多表分析与实际业务经验'});
const resultData=()=>({items:[row(1)],learning_path:[module()],next_action:'先认识数据表的行和列。',limits:'入门练习不能替代业务经验。'});
test('空白和超长输入在请求模型之前被拒绝',async()=>{
  let requested=false;const fetchImpl=()=>{requested=true;};
  for(const text of [' ', 'x'.repeat(12001)])await assert.rejects(analyze(text,{OPENAI_API_KEY:'test'},{fetchImpl}));
  assert.equal(requested,false);
});
test('原文来自用户输入，不能被模型改写；模型乱序会被纠正',()=>{
  const sources=prepareInput('不要求Python经验。\nSFT经验优先。');
  const output=validateOutput({items:[{...row(2),source:'必须有SFT经验'},row(1)]},sources);
  assert.deepEqual(output.map(i=>i.source),['不要求Python经验。','SFT经验优先。']);
});
test('漏条、重复ID、伪造ID被拒绝',()=>{
  const sources=prepareInput('甲\n乙');
  for(const items of [[row(1)],[row(1),row(1)],[row(1),row(3)]])assert.throws(()=>validateOutput({items},sources));
});
test('区分余额不足与普通限流，且不泄露上游原始错误',async()=>{
  for(const [code,expected] of [['insufficient_quota','insufficient_quota'],['rate_limit_exceeded','rate_limit']]){
    const fetchImpl=async()=>new Response(JSON.stringify({error:{code,message:'secret details'}}),{status:429});
    await assert.rejects(analyze('岗位要求',{OPENAI_API_KEY:'test'},{fetchImpl}),e=>e.code===expected&&!e.message.includes('secret'));
  }
});
test('超时以外的网络失败不会伪装成成功',async()=>{
  await assert.rejects(analyze('岗位要求',{OPENAI_API_KEY:'test'},{fetchImpl:async()=>{throw new TypeError('network');}}),e=>e.code==='network_error');
});
test('实际API返回的credit_balance_exhausted应归为额度不足',async()=>{
  const fetchImpl=async()=>new Response(JSON.stringify({error:{code:'credit_balance_exhausted',type:'insufficient_quota'}}),{status:429});
  await assert.rejects(analyze('岗位要求',{OPENAI_API_KEY:'test'},{fetchImpl}),e=>e.code==='insufficient_quota'&&e.status===402&&e.message.includes('没有剩余额度'));
});
test('真实请求格式使用服务端授权、关闭响应存储、校验结构化结果',async()=>{
  const fetchImpl=async(url,options)=>{
    assert.equal(url,'https://api.openai.com/v1/responses');assert.equal(options.headers.Authorization,'Bearer test');
    const body=JSON.parse(options.body);assert.equal(body.store,false);assert.equal(body.text.format.strict,true);
    const input=JSON.parse(body.input);assert.equal(input.learner_background,'没有编程经验');assert.ok(input.verified_courses.some(c=>c.id==='sql'));
    return new Response(JSON.stringify({id:'response-test',model:'test-model',status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(resultData())}]}]}));
  };
  const result=await analyze('原文',{OPENAI_API_KEY:'test'},{fetchImpl,background:'没有编程经验'});assert.equal(result.items[0].source,'原文');assert.equal(result.mode,'live_model');assert.equal(result.learning_path[0].courses[0].url,courseById.get('sql').url);
});
test('学习路线只能选已核实课程；不接受编造课程、重复课程或越界原文',()=>{
  const sources=prepareInput('熟练掌握SQL。');
  for(const patch of [{course_ids:['made-up-course']},{course_ids:['sql','sql']},{source_ids:[2]},{source_ids:[]},{ready_when:[]},{stage:'立即精通'}]){
    assert.throws(()=>validatePath({...resultData(),learning_path:[{...module(),...patch}]},sources),e=>e.code==='invalid_output');
  }
});
test('模型不能改写课程URL、前置条件或原文证据',()=>{
  const sources=prepareInput('SQL经验优先。');
  const path=validatePath({...resultData(),learning_path:[{...module(),courses:[{url:'https://example.invalid',prerequisite:'无门槛'}],evidence:[{source:'必须精通SQL'}]}]},sources);
  assert.deepEqual(path[0].courses,[courseById.get('sql')]);assert.deepEqual(path[0].evidence,sources);
});
test('背景过长或类型错误在调用模型前拒绝；无匹配课程与非JD均可诚实返回',async()=>{
  let called=false;
  for(const background of ['x'.repeat(501),{}])await assert.rejects(analyze('JD',{OPENAI_API_KEY:'test'},{background,fetchImpl:()=>{called=true;}}),e=>e.code==='invalid_background');
  assert.equal(called,false);
  assert.deepEqual(validatePath({...resultData(),learning_path:[]},prepareInput('你好')),[]);
  assert.deepEqual(validatePath({...resultData(),learning_path:[{...module(),course_ids:[]}]},prepareInput('JD'))[0].courses,[]);
});
test('模型截断、拒绝、非JSON输出均返回错误',async()=>{
  for(const payload of [{status:'incomplete'},{status:'completed',output:[{content:[{type:'refusal'}]}]},{status:'completed',output:[{content:[{type:'output_text',text:'invalid'}]}]}]){
    await assert.rejects(analyze('岗位要求',{OPENAI_API_KEY:'test'},{fetchImpl:async()=>new Response(JSON.stringify(payload))}));
  }
});
