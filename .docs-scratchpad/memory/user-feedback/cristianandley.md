https://discord.com/channels/1309558646228779139/1351181218607140916
Ok i see the docs reference storage as a sub definition on Memory instance, i have changed that and i still get the errors (and memory is implemented in agents)
dero — 2025-03-17, 7:06 AM
Hi there
Looks like you have the correct setup now right? i.e you have the upstashStore initialized and you're passing that as storage to your initialized memory
cristiandley — 2025-03-17, 7:13 AM
Hey @dero not quite yet. This is my setup

import { Memory } from "@mastra/memory";
import { UpstashStore, UpstashVector } from "@mastra/upstash";

const memory = new Memory({
storage: new UpstashStore({
url: "https://xyz",
token: "xyz",
}),
vector: new UpstashVector({
url: "https://xyz",
token: "xyz",
}),
options: {
lastMessages: 10,
semanticRecall: {
topK: 3,
messageRange: 2,
},
},
});

export default memory

Now if i try to add that to an Agent (not to the main Mastra instance since i believe its not there)

I get

Database initialized.
✘ [ERROR] service core:user:cantara-backend: Uncaught ReferenceError: \_\_dirname is not defined

    at null.<anonymous> (server.entry.js:19781:15) in node_modules/node_modules-path/index.js
    at null.<anonymous> (server.entry.js:18:50) in __require2
    at null.<anonymous> (server.entry.js:51597:40)

✘ [ERROR] The Workers runtime failed to start. There is likely additional logging output above.
Image
Im not quite sure what im doing wrong
dero — 2025-03-17, 7:14 AM
yeah the setup looks correct
this works fine locally, but errors on deployment correct?
cristiandley — 2025-03-17, 7:15 AM
yep
dero — 2025-03-17, 7:17 AM
ok got it, i'll bring in @Ward, he just made some deployment fixes today. maybe he can help here
Ward — 2025-03-17, 7:18 AM
is this cloudflare?
cristiandley — 2025-03-17, 7:18 AM
It is, yes
cristiandley — 2025-03-17, 10:14 AM
just in case im in "@mastra/core": "^0.6.1-alpha.1", and tried going back but error persist.
Ward — 2025-03-17, 5:31 PM
I still need to make cloudflare work
cristiandley — 2025-03-18, 4:06 AM
Ward, what is the main issue, that the deployment does not work (btw I’m not using RAG either Memory in it)
Ward — 2025-03-18, 5:53 AM
i know
cristiandley — 2025-03-19, 11:55 AM
Is there a way I could make this work temporarily?
Amine — 2025-03-23, 10:17 AM
I really appreciate all the hard work being put in this project 🙏 but this is a blocker now, none of the officially proposed storages work on CF. No memory means cannot be used in production. Is there any temporary workaround?
dero — 2025-03-24, 1:00 AM
@Core Team
Ward — 2025-03-24, 8:07 AM
I have published an alpha version for cloudflare
can you retry if something else comes up let me know
Amine — 2025-03-24, 12:17 PM
Update 2: it seems that its still not working, i get the same error:
Uncaught Error: LibsqlError: URL_SCHEME_NOT_SUPPORTED: The client that uses Web standard APIs supports only "libsql:", "wss:", "ws:", "https:" and "http:" URLs, got "file:". For more information, please read https://github.com/libsql/libsql-client-ts#supported-urls

Update 1: its not related to wrangler v4, it deploys fine without memory so its not related

I'm testing and getting an error on deployment:

✘ [ERROR] A request to the Cloudflare API (/accounts/xxxxxxxxxx/workers/scripts/xxxxxxxx/versions) failed.
Uncaught TypeError: Environment validation failed

could be related to the migration to wrangler v4, im still checking if we need to do any migration related work
Tyler — 2025-03-25, 4:26 PM
@cristiandley the \_\_dirname issue should've been fixed in this PR https://github.com/mastra-ai/mastra/pull/2938 so that's odd, which version were you seeing that on?

@Amine what does your memory config look like? By default memory uses file:memory.db as the libsql url. If you use a url with a hosted libsql (like turso) does it work?
Amine — 2025-03-26, 12:09 PM
@Tyler i'm testing with an empty project with the default weather example, tried Upstash and Turso, on both v0.4.3 and latest alpha, and it still fails with the same error:

[ERROR] A request to the Cloudflare API (/accounts/xxxxxxxx/workers/scripts/mastra-test/versions) failed.
Uncaught Error: LibsqlError: URL_SCHEME_NOT_SUPPORTED: The client that uses Web standard APIs supports only "libsql:", "wss:", "ws:", "https:" and "http:" URLs, got "file:". For more information, please read https://github.com/libsql/libsql-client-ts#supported-urls
Image
Image
Image
Tyler — 2025-03-26, 12:53 PM
try exporting your storage instance and adding it to Mastra new Mastra({ storage, ...etc }) because Mastra also uses Libsql by default
I think @Ward might have other plans to fix it more seamlessly, but my guess is that should work in the meantime
Amine — 2025-03-26, 6:58 PM
Its the exact same error. Just setting storage on Mastra is fine, but once memory is specified it throws.
Ward — 2025-03-27, 1:02 AM
can you create a github issue? I need to test if turso is actually working on cloudflare
cristiandley — 2025-03-27, 10:10 AM
Guys sorry my radio silence, just following

https://github.com/mastra-ai/mastra/issues/2877

I left a comment few weeks ago with details of the error
^
i have deployed the service now with a workaround (not my best idea) but since the proxy layer in Mastra was comparing if 'libsql' was present in the connection string i implemented Turso to bypass all this issue temporally. It required for me to set that up in the Mastra instance and not the Agents (since if not present in the agents seems to not compare the base instance of storage).

const mastra = new Mastra({
storage: new LibSQLStore({
config: {
url: tursoStorageUrl,
authToken: tursoAuthToken,
}
}),
agents: {
xyz,
xyz,
xyz,
xyz
},
workflows: {
xyz: xyz,
},
});

⏰ BUT: if i use memory (implement it) in agents it fails again at runtime... same error as my comment.
cristiandley — 2025-03-27, 10:19 AM
So to clear this up a bit, with history of the issue:

seem the 2877 issue was about not being able to deploy the service to cloudflare without setting a specific storage.
comment and possible solution was to set memory/storage to Upstash.
i tried that path and didn't work at that time (same error URL_SCHEME...)

bypass:

i have checked the lib implementation and was always checking against 'libsql' existance (not sure if it has changed by now).
using Turso (libsql url string) fix the issue to initialize Mastra, but still not capable of using agents memory.

Thanks hopes this helps guys.
Abhi Aiyer — 2025-03-27, 11:16 AM
@cristiandley wow sorry for that journey you had to go on! We were ensuring we can be deployed on Cloudflare which feel confident about now but the storage things may still have some issues as we can see here.

@Ward tagging you in here. What do you think the right thing to do is?
Tyler — 2025-03-27, 11:37 AM
Just took another look at this - I think this is happening because Memory has default libsql for storage and also for vector. Right now memory doesn't have very good default settings. What we tried to do was make it so you can add memory with no config and it'll work with all memory features out of the box - but that out of the box doesn't work at all in cloudflare. Unfortunately right now you have to set a vector store and storage in memory for it to work.
cristiandley — 2025-03-27, 11:38 AM
@Tyler if i set the vector store it used to fail. Thats why im only setting the storage.
Tyler — 2025-03-27, 11:47 AM
weird, it adds libsql by default here https://github.com/mastra-ai/mastra/blob/main/packages/core/src/memory/memory.ts#L71
GitHub
mastra/packages/core/src/memory/memory.ts at main · mastra-ai/mastra
The TypeScript AI agent framework. ⚡ Assistants, RAG, observability. Supports any LLM: GPT-4, Claude, Gemini, Llama. - mastra-ai/mastra
mastra/packages/core/src/memory/memory.ts at main · mastra-ai/mastra
maybe the error only happens when a query is made to libsql
Ward — 2025-03-28, 9:26 AM
I guess we have to re-check some of our defaults... i'll at least look into your latest comment
Tyler — 2025-03-28, 9:30 AM
@Ward for memory I have a ticket to change all defaults based on what we learned - it's a breaking change
