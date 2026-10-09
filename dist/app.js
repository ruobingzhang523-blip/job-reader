'use strict';
const EXAMPLE=`1. 负责访谈商家，归纳广告投放中的主要困难，并将需求整理为产品方案。
2. 熟练掌握SQL、Python，能够独立分析审核效率、误判和漏判情况。
3. 熟悉RAG和Agent的应用；有SFT实践经验者优先，但不要求独立训练基础大模型。
4. 协调产品、运营和算法团队，明确验收指标并推动项目交付。`;
const source=document.getElementById('source');
const background=document.getElementById('background');
const results=document.getElementById('results');
const status=document.getElementById('status');
const summary=document.getElementById('summary');
const button=document.getElementById('analyze');
const exampleButton=document.getElementById('example');
const cancelButton=document.getElementById('cancel');
const accessInput=document.getElementById('access-code');
let requiresAccessCode=false;
let lastAnalyzed='',active=null;
function el(tag,cls,text){const node=document.createElement(tag);if(cls)node.className=cls;if(text!==undefined)node.textContent=text;return node;}
function inputKey(){return JSON.stringify([source.value,background.value]);}
function clear(){
  const box=el('div','empty');box.append(el('strong','','把“看不懂”，变成第一步'),el('p','','放入岗位要求后，会结合你的基础生成学习路线。先看需要学到什么程度，再选课程、做练习。'));
  const steps=el('div','empty-steps');for(const text of ['① 先学什么','② 去哪里学','③ 怎样算学会'])steps.append(el('span','',text));box.append(steps);results.replaceChildren(box);summary.textContent='';
}
function count(){document.getElementById('count').textContent=source.value.length+' / 12000';}
function edit(){count();const stale=Boolean(lastAnalyzed)&&inputKey()!==lastAnalyzed;document.body.classList.toggle('changed',stale);status.textContent=stale?'岗位或学习背景已修改。右侧是上次结果，请重新生成。':'';status.classList.remove('error');document.getElementById('billing').hidden=true;}
function busy(on){button.disabled=on;source.disabled=on;background.disabled=on;exampleButton.disabled=on;cancelButton.hidden=!on;button.textContent=on?'正在整理你的学习路线…':'生成解读与学习路线';results.setAttribute('aria-busy',String(on));}
function courseCard(course){
  const card=el('div','course');const a=el('a','course-link',course.title+' ↗');
  // URL只来自服务端核实目录；额外限制浏览器可打开的协议。
  try{const url=new URL(course.url);if(url.protocol==='https:')a.href=url.href;}catch{}
  a.target='_blank';a.rel='noopener noreferrer';card.append(a,el('p','course-meta',course.provider+' · '+course.language+' · '+course.format));
  card.append(el('p','course-prereq','开始前：'+course.prerequisite),el('p','course-focus','选学建议：'+course.focus));return card;
}
function field(label,text,cls=''){const box=el('div','learning-field '+cls);box.append(el('h4','',label),el('p','',text));return box;}
function render(data){
  const fragment=document.createDocumentFragment();
  if(data.next_action){const action=el('div','next-action');action.append(el('span','eyebrow','今天，只做这一小步'),el('p','',data.next_action));fragment.append(action);}
  for(const [index,module] of data.learning_path.entries()){
    const card=el('article','learning-card');const head=el('div','learning-heading');head.append(el('span','module-number',String(index+1).padStart(2,'0')),el('h3','',module.title),el('span','tag',module.stage));card.append(head,el('p','module-why',module.why));
    const depth=el('div','depth');depth.append(field('岗位最终要求',module.job_expectation,'job-depth'),field('你先做到这里',module.first_milestone,'first-depth'));card.append(depth);
    card.append(el('h4','section-label','去哪里学'));if(module.courses.length){for(const course of module.courses)card.append(courseCard(course));}else card.append(el('p','library-note','当前已核实资料中没有合适的课程，先按下面的练习检验目标学习。'));
    card.append(el('h4','section-label','怎样检查自己学会了'));const checks=el('ul','check-list');for(const check of module.ready_when)checks.append(el('li','',check));card.append(checks);
    card.append(field('完成这一步后，还差什么',module.remaining_gap,'gap'));
    const evidence=el('details','evidence');evidence.append(el('summary','','为什么要学：对应的招聘原文'));for(const item of module.evidence)evidence.append(el('p','','第'+item.source_id+'条 · '+item.source));card.append(evidence);fragment.append(card);
  }
  if(data.limits)fragment.append(el('p','route-limits',data.limits));
  const explanations=el('details','explanations');explanations.append(el('summary','','回看逐条白话解释 · '+data.items.length+' 条'));
  for(const item of data.items){
    const card=el('article','result-card');const quote=el('div','quote');quote.append(el('div','quote-label','招聘原文 '+String(item.source_id).padStart(2,'0')),el('p','',item.source));card.append(quote);
    const body=el('div','term');body.append(el('h3','explanation-title','白话解释'),el('p','',item.plain_language));
    if(item.terms.length){const terms=el('dl','terms-list');for(const t of item.terms){terms.append(el('dt','',t.name),el('dd','',t.explanation));}body.append(terms);}
    if(item.example){const p=el('p','example-line');p.append(el('strong','','教学例子 · '),document.createTextNode(item.example));body.append(p);}
    if(item.learning_suggestion)body.append(el('p','ability','入门练习（模型建议） · '+item.learning_suggestion));
    if(item.uncertainty)body.append(el('p','uncertainty','待确认 · '+item.uncertainty));card.append(body);explanations.append(card);
  }
  fragment.append(explanations);results.replaceChildren(fragment);summary.textContent=data.learning_path.length+' 个学习模块';
  results.append(el('p','field-help','由 '+data.model+' 根据输入生成 · 课程来源核实于 '+data.courses_verified_on+' · 学习顺序与掌握标准为模型建议'));
}
async function run(){
  if(active)throw new Error('已有解读正在进行。');
  const text=source.value;const profile=background.value;const key=inputKey();
  if(!text.trim()){status.textContent='请先粘贴招聘要求，或载入教学示例。';status.classList.add('error');source.focus();return null;}
  if(requiresAccessCode&&!accessInput.value.trim()){status.textContent='请先填写网站管理者提供的访问码；下方课程可直接查看。';status.classList.add('error');accessInput.focus();return null;}
  const controller=new AbortController();active=controller;busy(true);document.getElementById('billing').hidden=true;status.classList.remove('error');status.textContent='正在调用模型，整理岗位要求、学习顺序与课程。通常需要数十秒。';
  try{
    const response=await fetch('/api/analyze',{method:'POST',headers:{'Content-Type':'application/json',...(accessInput.value?{Authorization:'Bearer '+accessInput.value.trim()}:{})},body:JSON.stringify({text,background:profile}),signal:controller.signal});
    let data;try{data=await response.json();}catch{throw new Error('服务返回了无法读取的内容，请确认打开的是正在运行的网页。');}
    if(!response.ok){document.getElementById('billing').hidden=requiresAccessCode||data.error?.code!=='insufficient_quota';throw new Error(data.error?.message||'生成失败，请稍后重试。');}
    if(data.mode!=='live_model'||!Array.isArray(data.items)||!Array.isArray(data.learning_path))throw new Error('服务返回的结果格式不正确。');
    render(data);lastAnalyzed=key;document.body.classList.remove('changed');status.textContent='已收到模型生成的解读与学习路线。请对照招聘原文检查，课程建议不代表招聘方承诺。';return data;
  }catch(e){status.textContent=e.name==='AbortError'?'已停止等待本次结果。已经发出的模型调用仍可能计费。':e.message;status.classList.add('error');if(lastAnalyzed&&lastAnalyzed!==key)document.body.classList.add('changed');return null;
  }finally{active=null;busy(false);}
}
source.addEventListener('input',edit);background.addEventListener('input',edit);
button.addEventListener('click',()=>run());cancelButton.addEventListener('click',()=>active?.abort());
exampleButton.addEventListener('click',()=>{source.value=EXAMPLE;edit();if(!lastAnalyzed)status.textContent='教学示例已载入。点击“生成解读与学习路线”后才会发送给模型。';});
clear();count();
fetch('/api/health').then(r=>r.json()).then(data=>{requiresAccessCode=Boolean(data.requiresAccessCode);document.getElementById('access-panel').hidden=!requiresAccessCode;document.getElementById('connection').textContent=data.configured?'模型服务已配置 · 待调用':'课程可浏览 · 生成服务待配置';if(!data.configured){status.textContent='网站管理者尚未配置模型服务，课程资料仍可查看。';status.classList.add('error');}}).catch(()=>{document.getElementById('connection').textContent='无法连接服务';status.textContent='请打开运行中的网站，直接打开HTML文件无法调用模型。';status.classList.add('error');});
fetch('/api/courses').then(r=>{if(!r.ok)throw new Error();return r.json();}).then(data=>{
  const list=document.getElementById('course-list');list.replaceChildren();
  for(const course of data.courses){const detail=el('details','catalog-entry');const heading=el('summary');heading.append(el('span','',course.title),el('span','catalog-level',course.level));detail.append(heading,courseCard(course));list.append(detail);}
  document.getElementById('verified-date').textContent='官方来源核实于 '+data.verified_on+'。此处不是实时搜索；页面内容可能更新。课程学习重点由本工具整理。';
}).catch(()=>{document.getElementById('course-list').textContent='暂时无法读取课程资料，请确认本地服务正在运行。';});

if(document.modelContext?.registerTool){
  const lifetime=new AbortController();
  try{Promise.resolve(document.modelContext.registerTool({name:'analyze_job_requirements',title:'解读岗位并生成学习路线',description:'将招聘文字和学习背景发送到OpenAI API，产生调用费用；生成原文解释、掌握目标、已核实课程与练习检查标准。不保存历史。',inputSchema:{type:'object',properties:{text:{type:'string',minLength:1,maxLength:12000},background:{type:'string',maxLength:500}},required:['text'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:true},async execute(input){if(!input||typeof input.text!=='string'||!input.text.trim()||input.text.length>12000)throw new Error('请提供1至12000字的招聘要求');if(input.background!==undefined&&(typeof input.background!=='string'||input.background.length>500))throw new Error('学习背景应为500字以内');if(active)throw new Error('已有解读正在进行');source.value=input.text;if(input.background!==undefined)background.value=input.background;edit();const r=await run();if(!r)throw new Error(status.textContent);return {mode:r.mode,model:r.model,items:r.items,learning_path:r.learning_path,next_action:r.next_action,limits:r.limits};}},{signal:lifetime.signal})).catch(()=>{});}catch{}
  window.addEventListener('pagehide',()=>lifetime.abort(),{once:true});
}
