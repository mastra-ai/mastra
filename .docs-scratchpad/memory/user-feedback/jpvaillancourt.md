https://discord.com/channels/1309558646228779139/1349491463762743346
I have an issue using my Mastra app as a package in an other app (using pnpm). It seems "@mastra/core" uses the package "node_modules-path", and it uses the nodejs "\_dirname" method. Considering the fact I'm using Wrangler and Cloudflare Worker, "\_dirname" is not defined.

Is node_modules-path really necessary ? I thought Mastra was designed to be deployed on Cloudflare Workers also. TBH, I'm a bit over my head on this matter and I might not made any sense.
jpvaillancourt.
OP
— 2025-03-12, 3:21 PM
It's used here (packages/core/src/vector/fastembed.ts) :

import node_modulesPath from 'node_modules-path';

let cachedPath: false | string = false;
function getModelCachePath() {
if (cachedPath) return cachedPath;

// TODO: we can set this somewhere for cloud to drop models there in advance
// for now it's in node_modules/.fastembed-model-cache
const firstNodeModules = node_modulesPath().split('node_modules')[0];
cachedPath = path.join(firstNodeModules, 'node_modules', '.fastembed-model-cache');

return cachedPath;
}
Yujohn — 2025-03-12, 3:25 PM
Hey @jpvaillancourt. 👋

We are currently working on our deployers with Cloudflare in mind.

Just to confirm you are seeing this issue when you are deploying to cloudflare or locally as well?

We've had some people get unblocked deploying to cloudflare bringing their own memory storage instead of using the default one which I believe is using that package you mentioned.
jpvaillancourt.
OP
— 2025-03-12, 3:32 PM
Thanks for the quick reply @Yujohn !

100% locally.

I have a mono repo with pnpm. I use my Mastra app as a package in my main Api.

I build the Mastra app using "mastra build", which the output is used in a API Endpoint in my Hono server.

The moment I call mastra.getAgent, the function "getModelCachePath()" in @mastra/core/src/vector/fastembed.ts gets called, using the "node_modulesPath" module to retrieve the "node_modules" path to generate a cachedPath.

If we could simply provide manually a "cachePath" for the embedding models, it would not only provide a solution, but it could avoid losing the cache if the node_modules are reinstalled.
GitHub
mastra/packages/core/src/vector/fastembed.ts at main · mastra-ai/ma...
The TypeScript AI agent framework. ⚡ Assistants, RAG, observability. Supports any LLM: GPT-4, Claude, Gemini, Llama. - mastra-ai/mastra
mastra/packages/core/src/vector/fastembed.ts at main · mastra-ai/ma...
Yujohn — 2025-03-12, 3:38 PM
thank you this was really helpful!
I'll forward this to the team
Tyler — 2025-03-12, 3:54 PM
Hey @jpvaillancourt. we can definitely make it configurable! The chance the default embedder will work in cloudflare is really low though since the embedding models are larger. It probably makes more sense to use openai.embedder() instead since the embedding model runs on openai servers
jpvaillancourt.
OP
— 2025-03-12, 3:54 PM
I thought the same thing, but I never used the defaultTextEmbedder at all but it seems to be called anyway.
Tyler — 2025-03-12, 3:55 PM
If you use memory it adds it by default
jpvaillancourt.
OP
— 2025-03-12, 3:55 PM
Even if I use memory with pgvector and postgre ?
and the openai.embedder()
Tyler — 2025-03-12, 3:56 PM
Oh, if you're using the openai embedder it shouldn't happen - maybe the problem then is just that we're using **dirname when we shouldn't
jpvaillancourt.
OP
— 2025-03-12, 3:56 PM
Image
Tyler — 2025-03-12, 3:56 PM
Thanks, ok I'll take a look, it definitely should work with that config
So it's a bug, I'll be able to fix pretty quick here
jpvaillancourt.
OP
— 2025-03-12, 3:57 PM
I'm currently tring to create a polyfill for **dirname that returns a "valid" path containing /node_modules/ in order work in the .split
Tyler — 2025-03-12, 3:59 PM
I think the problem is we're using this util import node_modulesPath from 'node_modules-path'; pretty sure I added that cause I was moving quick 😅 really don't need such a simple dep
jpvaillancourt.
OP
— 2025-03-12, 4:00 PM
Not really hahaha. But **dirname is not supposed to be used if the method .doEmbed isn't called
The package is used only when the generateEmbeddings is called
Image
Tyler — 2025-03-12, 4:04 PM
I think the default embedding file is still imported which imports this https://github.com/lexoyo/node_modules-path/blob/master/index.js
GitHub
node_modules-path/index.js at master · lexoyo/node_modules-path
Get the path of the `node_modules` folder in your scripts or CLI or package.json - lexoyo/node_modules-path
node_modules-path/index.js at master · lexoyo/node_modules-path
but yeah you're right 🤔
I'll remove it anyway so there's no **dirname used
jpvaillancourt.
OP
— 2025-03-12, 4:05 PM
Great 🙂
Tyler — 2025-03-12, 4:05 PM
ahh, yeah they use **dirname at the top level
jpvaillancourt.
OP
— 2025-03-12, 4:05 PM
AAAHHH... so true...
so even if it's not called, **dirname is used.
jpvaillancourt.
OP
— 2025-03-12, 4:13 PM
Do you prefer I create an issue on github ?
Tyler — 2025-03-12, 4:18 PM
It's ok, almost have a fix ready 😄
jpvaillancourt.
OP
— 2025-03-12, 4:20 PM
Great 🙂 Other issue with Wrangler / Cloudflare Workers will be the use of pg-promise because it's trying to use Node.js specific functionality that isn't available in Workers. Not an issue if using Cloudflare D1, but if using a connection string to an external DB, it is.
I will stop using wrangler during in dev for a moment and get back to it when my db will be setupped on Cloudflare. Save some headaches hahaha
Tyler — 2025-03-12, 4:33 PM
Got a fix here! https://github.com/mastra-ai/mastra/pull/2938
GitHub
fix(@mastra/core): put fastembed cache in ~/.cache/mastra/fastembed...
Fixes https://discord.com/channels/1309558646228779139/1349491463762743346/1349491463762743346
The convenience package we were using calls \_\_dirname at the top level and breaks cloudflare deploys, ...
fix(@mastra/core): put fastembed cache in ~/.cache/mastra/fastembed...
jpvaillancourt.
OP
— 2025-03-12, 4:35 PM
Changes seems good 🙂 I'll try very soon
Tyler — 2025-03-12, 4:37 PM
I'll let you know when a new alpha is ready - shouldn't take long
jpvaillancourt.
OP
— 2025-03-12, 4:38 PM
I have hit another issue using Wrangler. I'll create an issue for this one since it might be a bit more complex to fix, and not quite urgent
Other issue with Wrangler / Cloudflare Workers will be the use of pg-promise because it's trying to use Node.js specific functionality that isn't available in Workers. Not an issue if using Cloudflare D1, but if using a connection string to an external DB, it is.
Tyler — 2025-03-12, 4:41 PM
I've heard talk of a D1 storage adapter - so that would also solve it. Definitely a good idea to open an issue tho!
Tyler — 2025-03-13, 8:19 AM
Hey sorry for not follow up yesterday! This fix is out on alpha
jpvaillancourt.
OP
— 2025-03-13, 8:56 AM
No worry, you have much to do ! Thanks for everything 🙂
Tyler — 2025-03-13, 8:59 AM
anytime! lmk if you run into any other issues
jpvaillancourt.
OP
— 2025-03-13, 9:00 AM
We're actively developping with Mastra on our team, trying to push the limit, so we'll be a good testing group. I'll let you know 🙂
Tyler — 2025-03-13, 9:14 AM
Btw @Nik is working on D1 here 🎉 https://github.com/mastra-ai/mastra/pull/2932
GitHub
[MASTRA-2396] Cloudflare D1 Implementation by NikAiyer · Pull Reque...
This PR adds the cloudflare D1 store.
[MASTRA-2396] Cloudflare D1 Implementation by NikAiyer · Pull Reque...
Tyler — 2025-03-13, 9:14 AM
love to hear it!
