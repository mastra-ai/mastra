import { createRequire } from 'node:module';
import { once } from 'node:events';
const core=createRequire(new URL('../../packages/core/package.json',import.meta.url));
const hono=createRequire(new URL('../../server-adapters/hono/package.json',import.meta.url));
const redis=createRequire(new URL('../../stores/redis/package.json',import.meta.url));
const {Agent}=await import(core.resolve('@mastra/core/agent'));
const {createDurableAgent,createEventedAgent}=await import(core.resolve('@mastra/core/agent/durable'));
const {Mastra}=await import(core.resolve('@mastra/core/mastra'));
const {RequestContext,MASTRA_RESOURCE_ID_KEY}=await import(core.resolve('@mastra/core/request-context'));
const {createTool}=await import(core.resolve('@mastra/core/tools'));
const {z}=await import(core.resolve('zod'));
const {Memory}=await import('../../packages/memory/dist/index.js');
const {createOpenAI}=await import(core.resolve('@ai-sdk/openai-v5'));
const {Hono}=await import(hono.resolve('hono'));
const {serve}=await import(hono.resolve('@hono/node-server'));
const {MastraServer}=await import('../../server-adapters/hono/dist/index.js');
const {RedisStreamsPubSub}=await import('../../pubsub/redis-streams/dist/index.js');
const {RedisServerCache,RedisStore,nodeRedisPreset}=await import('../../stores/redis/dist/index.js');
const {createClient}=await import(redis.resolve('redis'));
const client=createClient({url:'redis://127.0.0.1:16379'});await client.connect();
const cache=new RedisServerCache({client},nodeRedisPreset);
const pubsub=new RedisStreamsPubSub({url:'redis://127.0.0.1:16379',blockMs:100});
const storage=new RedisStore({id:'pr4-storage',client});await storage.init();
const send=data=>process.send({...data,pid:process.pid,at:Date.now()});
let release;const barrier=new Promise(r=>release=r);
const kind=process.env.KIND, mode=process.env.MODE;
const tool=createTool({id:'fetchRecord',description:'Fetch record',inputSchema:z.object({name:z.string()}),...(mode==='approval'?{requireApproval:true}:{background:{enabled:true}}),execute:async()=>{send({event:'tool-start'});if(mode==='continuation')await barrier;send({event:'tool-commit'});return {amount:42};}});
const inner=new Agent({id:'agent',name:'Agent',instructions:'Fetch record',model:createOpenAI({apiKey:'test',baseURL:process.env.MODEL_URL+'/v1'}).chat('gpt-4o-mini'),tools:{fetchRecord:tool},...(mode==='continuation'?{memory:new Memory({storage,options:{lastMessages:10,generateTitle:false}}),backgroundTasks:{tools:{fetchRecord:true}}}:{}),...(kind==='plain'?{durable:true}:{})});
const agent=kind==='plain'?inner:kind==='evented'?createEventedAgent({agent:inner,pubsub,cache}):createDurableAgent({agent:inner,pubsub,cache});
const mastra=new Mastra({logger:false,agents:{agent},storage,pubsub,cache,...(mode==='continuation'?{backgroundTasks:{enabled:true}}:{}),server:{auth:{authenticateToken:async token=>['alice','bob'].includes(token)?{id:token,resourceId:token}:null,authorizeUser:()=>true,mapUserToResourceId:u=>u.resourceId}}});
if(mode==='continuation'&&process.env.WORKER==='yes')await mastra.startWorkers();
const app=new Hono();await new MastraServer({app,mastra}).init();const server=serve({fetch:app.fetch,hostname:'127.0.0.1',port:0});if(!server.listening)await once(server,'listening');
send({event:'ready',port:server.address().port});
process.on('message',async msg=>{try{
if(msg.op==='release'){release();return;}
if(msg.op==='start'){
 const rc=new RequestContext();rc.set(MASTRA_RESOURCE_ID_KEY,'alice');
 const result=await agent.stream('Fetch record',{requestContext:rc,maxSteps:6,...(mode==='continuation'?{memory:{thread:msg.threadId,resource:'alice'},untilIdle:{maxIdleMs:1200}}:{})});
 send({event:'started',runId:result.runId});
 const chunks=[];for await(const c of result.fullStream){chunks.push(c);send({event:'chunk',chunk:c});}
 send({event:'drained',runId:result.runId,types:chunks.map(c=>c.type)});return;
}
if(msg.op==='direct-abort'){send({event:'direct-abort',result:await agent.abortRunStream(msg.runId)});return;}
if(msg.op==='evidence'){
 const p=agent.pubsub;const history=p?await p.getHistory('agent.stream.'+msg.runId,0):[];
 const workflows=await storage.getStore('workflows');const runs=await workflows.listWorkflowRuns({workflowName:'agentic-loop-agent',perPage:30,page:0});
 send({event:'evidence',owner:agent.__getRunOwner?.(msg.runId),history:history.map(e=>({index:e.index,type:e.type,dataType:e.data?.type,runId:e.runId})),keys:await client.keys('*'+msg.runId+'*'),runs});return;
}
if(msg.op==='evict-replay'){await client.del('mastra:cache:pubsub:agent.stream.'+msg.runId);send({event:'evicted-replay'});return;}
if(msg.op==='evict-native'){await client.del('mastra:topic:agent.stream.'+msg.runId);send({event:'evicted-native'});return;}
}catch(e){send({event:'error',op:msg.op,error:String(e),stack:e.stack});}});
