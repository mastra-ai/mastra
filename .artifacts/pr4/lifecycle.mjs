import {createRequire} from 'node:module';import {fork} from 'node:child_process';import {appendFileSync} from 'node:fs';
const req=createRequire(new URL('../../packages/core/package.json',import.meta.url));const {LLMock}=await import(req.resolve('@copilotkit/aimock'));
const llm=new LLMock({port:0});await llm.start();const children=[];const log=x=>{const row={at:new Date().toISOString(),...x};console.log(JSON.stringify(row));appendFileSync(new URL('./lifecycle.jsonl',import.meta.url),JSON.stringify(row)+'\n');};
async function child(kind,mode,worker){const p=fork(new URL('./lifecycle-child.mjs',import.meta.url),{env:{...process.env,KIND:kind,MODE:mode,WORKER:worker?'yes':'no',MODEL_URL:llm.url},stdio:['ignore','inherit','inherit','ipc']});children.push(p);const events=[];p.on('message',m=>{events.push(m);log({kind,mode,...m});});const c={p,events};const ready=await wait(c,m=>m.event==='ready');c.base=`http://127.0.0.1:${ready.port}/api/agents/agent`;return c;}
async function wait(c,pred,timeout=18000){const end=Date.now()+timeout;while(Date.now()<end){const found=c.events.find(pred);if(found)return found;if(c.p.exitCode!==null)throw Error('child exited '+c.p.exitCode);await new Promise(r=>setTimeout(r,25));}throw Error('event timeout');}
async function post(c,path,body,token='alice',timeout=1500){let status,text='',open=false;try{const r=await fetch(c.base+'/'+path,{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+token},body:JSON.stringify(body),signal:AbortSignal.timeout(timeout)});status=r.status;const reader=r.body.getReader();try{while(true){const {done,value}=await reader.read();if(done)break;text+=new TextDecoder().decode(value);}}catch(e){open=true;}return {status,bytes:text.length,open,text:text.length<500?text:undefined,types:[...text.matchAll(/"type":"([^"]+)"/g)].map(x=>x[1]),continuation:text.includes('amount 42')};}catch(e){return {status,error:String(e)};}}
const [kind='durable',mode='approval',variant='remote-abort']=process.argv.slice(2);
try{llm.on({endpoint:'chat',sequenceIndex:0},{toolCalls:[{id:'call-fetch-1',name:'fetchRecord',arguments:{name:'proof',...(mode==='continuation'?{_background:{disposition:'deferred'}}:{})}}]});llm.on({endpoint:'chat',sequenceIndex:1},{content:mode==='continuation'?'waiting':'approved result'});llm.on({endpoint:'chat',sequenceIndex:2},{content:'amount 42 continuation'});
const a=await child(kind,mode,true),b=await child(kind,mode,false);a.p.send({op:'start',threadId:`pr4-${kind}-${Date.now()}`});const {runId}=await wait(a,m=>m.event==='started');
if(mode==='approval'){
 await wait(a,m=>m.event==='chunk'&&m.chunk.type==='tool-call-approval');await new Promise(r=>setTimeout(r,500));
 for(const [where,c] of [['local',a],['remote',b]]){c.p.send({op:'evidence',runId});log({step:'observe-parked-'+where,...await post(c,'observe',{runId})});}
 if(variant==='local-fence'){a.p.send({op:'direct-abort',runId});await wait(a,m=>m.event==='direct-abort');}
 else if(variant!=='baseline')log({step:'abort-'+variant,...await post(variant==='remote-abort'?b:a,`runs/${runId}/abort`,{})});
 log({step:'approve-remote',...await post(b,'approve-tool-call',{runId,toolCallId:'call-fetch-1'})});
 await new Promise(r=>setTimeout(r,800));log({step:'side-effect-summary',commits:a.events.concat(b.events).filter(x=>x.event==='tool-commit').length,modelRequests:llm.getRequests().length});
}else{
 await wait(a,m=>m.event==='tool-start');await wait(a,m=>m.event==='chunk'&&m.chunk.type==='finish');
 const before=a.events.filter(m=>m.event==='chunk').map(m=>({type:m.chunk.type,runId:m.chunk.runId,payload:m.chunk.payload}));log({step:'before-release',publicRunId:runId,chunks:before});
 for(const [where,c] of [['local',a],['remote',b]])log({step:'observe-before-release-'+where,...await post(c,'observe',{runId})});
 a.p.send({op:'release'});await wait(a,m=>m.event==='drained',25000);
 for(const [where,c] of [['local',a],['remote',b]]){c.p.send({op:'evidence',runId});log({step:'observe-after-release-'+where,...await post(c,'observe',{runId})});}
 log({step:'model-requests',count:llm.getRequests().length});
}
}catch(e){log({step:'failed',error:String(e),stack:e.stack});process.exitCode=1;}finally{for(const p of children)p.kill();await llm.stop();}
