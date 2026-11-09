import {createRequire} from 'node:module';import {fork} from 'node:child_process';import {once} from 'node:events';import {appendFileSync} from 'node:fs';
const req=createRequire(new URL('../../packages/core/package.json',import.meta.url));const redis=createRequire(new URL('../../stores/redis/package.json',import.meta.url));const {createClient}=await import(redis.resolve('redis'));const client=createClient({url:'redis://127.0.0.1:16379'});await client.connect();const {LLMock}=await import(req.resolve('@copilotkit/aimock'));const llm=new LLMock({port:0});await llm.start();llm.on({endpoint:'chat'},{content:'cache loss proof'});const children=[];const log=x=>{const line=JSON.stringify({at:new Date().toISOString(),...x});console.log(line);appendFileSync(new URL('./eviction.jsonl',import.meta.url),line+'\n');};
async function child(kind){const p=fork(new URL('./child.mjs',import.meta.url),{env:{...process.env,KIND:kind,MODEL_URL:llm.url},stdio:['ignore','inherit','inherit','ipc']});children.push(p);const [m]=await once(p,'message');return {p,base:`http://127.0.0.1:${m.port}/api/agents/agent`};}
async function post(c,path,body){let status;try{const r=await fetch(c.base+'/'+path,{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer alice'},body:JSON.stringify(body),signal:AbortSignal.timeout(1500)});status=r.status;const text=await r.text();return {status,bytes:text.length,finish:text.includes('finish'),text:text.length<200?text:undefined};}catch(e){return {status,error:String(e)};}}
try{for(const kind of process.argv.slice(2).length?process.argv.slice(2):['plain','durable']){const a=await child(kind),b=await child(kind);const runId=`pr4-evict-${kind}-${Date.now()}`;log({kind,runId,step:'start',...await post(a,'stream',{messages:'Say done',runId})});
for(const step of ['baseline','native-evicted','replay-evicted','owner-evicted']){
 if(step==='native-evicted')await client.del('mastra:topic:agent.stream.'+runId);
 if(step==='replay-evicted')await client.del('mastra:cache:pubsub:agent.stream.'+runId);
 if(step==='owner-evicted')await client.del('mastra:cache:agent.run.agent.'+runId);
 log({kind,runId,step,keys:await client.keys('*'+runId+'*'),cacheLength:await client.lLen('mastra:cache:pubsub:agent.stream.'+runId)});
 for(const [where,c] of [['local',a],['remote',b]])log({kind,runId,step,where,...await post(c,'observe',{runId,offset:1})});
}
a.p.kill();b.p.kill();}}finally{for(const p of children)p.kill();await llm.stop();await client.quit();}
