import { createRequire } from 'node:module';
import { fork } from 'node:child_process';
import { once } from 'node:events';
import { appendFileSync } from 'node:fs';
const require = createRequire(new URL('../../packages/core/package.json',import.meta.url));
const { LLMock } = await import(require.resolve('@copilotkit/aimock'));
const llm = new LLMock({port:0}); await llm.start();
const children=[];
const log = data => {const row={at:new Date().toISOString(),...data}; console.log(JSON.stringify(row));};
async function child(kind){const p=fork(new URL('./child.mjs',import.meta.url),{env:{...process.env,KIND:kind,MODEL_URL:llm.url},stdio:['ignore','inherit','inherit','ipc']});children.push(p);const msg=await Promise.race([once(p,'message').then(x=>x[0]),once(p,'exit').then(([code])=>{throw Error('child exit '+code)})]);log({step:'ready',...msg});return {p,base:`http://127.0.0.1:${msg.port}/api/agents/agent`};}
async function post(c,path,token,body){const r=await fetch(c.base+'/'+path,{method:'POST',headers:{'content-type':'application/json',...(token?{authorization:'Bearer '+token}:{})},body:JSON.stringify(body),signal:AbortSignal.timeout(6000)});const text=await r.text();return {status:r.status,bytes:text.length,finish:text.includes('finish'),text:text.length<350?text:undefined};}
try {for(const kind of process.argv.slice(2).length?process.argv.slice(2):['durable','plain','evented']){llm.clearFixtures();llm.clearRequests();llm.resetMatchCounts();llm.on({endpoint:'chat'},{content:'retained replay proof'});const a=await child(kind),b=await child(kind);const runId=`pr4-${kind}-${Date.now()}`;
log({kind,runId,step:'stream',...await post(a,'stream','alice',{messages:'Say done',runId})});
for(const [where,c,token] of [['local',a,'alice'],['remote',b,'alice'],['local-tenant',a,'bob'],['remote-tenant',b,'bob'],['local-anonymous',a,undefined],['remote-anonymous',b,undefined]])log({kind,runId,step:where,...await post(c,'observe',token,{runId})});
for(const [where,c] of [['local',a],['remote',b]]){c.p.send({op:'evidence',runId});log({kind,runId,step:'evidence-'+where,...(await once(c.p,'message'))[0]});}
log({kind,runId,step:'abort-finished-local',...await post(a,`runs/${runId}/abort`,'alice',{})});
await new Promise(r=>setTimeout(r,31500));
for(const [where,c] of [['local',a],['remote',b]])log({kind,runId,step:'expired-'+where,...await post(c,'observe','alice',{runId})});
a.p.kill();b.p.kill();}}
finally{for(const p of children)p.kill();await llm.stop();}
