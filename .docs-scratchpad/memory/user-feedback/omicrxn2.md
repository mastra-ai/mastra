https://discord.com/channels/1309558646228779139/1350882749094952980
When calling tools on the client and using useChat onToolCall() callback, i return the result, however on my mastra server i get a:
MessageConversionError [AI_MessageConversionError]: Unsupported role: tool

this happens on "@mastra/core": "0.6.1-alpha.0" and "@mastra/core": "0.6.1-alpha.1".

and it only happens while using memory, here is my exact implementation of the memory:
memory: new Memory({
storage: new LibSQLStore({
config: {
url: process.env.DATABASE_URL ?? 'file:memory.db',
},
}),
options: {
workingMemory: {
enabled: true,
use: "tool-call", // Required for toDataStream() compatibility
},
},
}),

the memory works though
Omicrxn changed the post title: Unsupported role: tool when using memory — 2025-03-16, 10:28 AM
Omicrxn
OP
— 2025-03-16, 10:28 AM
i have to say that if i remove memory the tool calling works, this only happens if i use memory
Tony — 2025-03-16, 10:50 PM
@Tyler would probably be able to help with this !
Ward — 2025-03-17, 1:49 AM
I'll have a quick look as well
Omicrxn
OP
— 2025-03-17, 6:06 AM
this was fixed a couple of days ago, which is where we found the [messages.at(-1)] thing but seems to be broken again, also sometimes it calls the tool a lot of times
Tyler — 2025-03-17, 9:17 AM
@Omicrxn when it calls the tool multiple times that's from before the bug fix so I wonder if there was a bad publish or it's pulling in an old version somehow 🤔
Even with the fix the multiple tool calling thing can happen if more than one message is being sent in - though from what you said that's not happening
Unsupported role: tool is odd
Omicrxn
OP
— 2025-03-17, 9:29 AM
Yeah i have all the measures you told me from the last bug fixing applied, this started happening when updating to the newest 0.6.1-alpha.0 and .1
The unsupported role is new though
Tyler — 2025-03-17, 10:08 AM
Thanks, I'll take a look - really strange since I don't think anything changed since then
Omicrxn
OP
— 2025-03-17, 11:18 AM
I'll try deleting node modules but I think i already tried. It's weird.
Tyler — 2025-03-17, 11:30 AM
Yeah I'm sure it's not on your side - we're currently planning out OSS stability+tests improvements but it'll be a week or two before we see those improvements. There's a good chance this is a regression or new bug
Omicrxn
OP
— 2025-03-17, 12:01 PM
No problem, I totally get the stage you are at, you have to iterate quick which you are doing an amazing job at. And writing tests would be beneficial but not the topmost priority it's okay
Tyler — 2025-03-17, 1:00 PM
being able to ship fast and not break anything is one of our main focuses right now so we'll be putting a huge focus on it this week and the next few
Omicrxn
OP
— 2025-03-17, 2:14 PM
hey @Tyler how can i get the [messages.at(-1)] on the stream on a mastra server {MASTRA_BASE_URL}/agents/:agentId/stream
i'm just testing some things using a newly created mastra server just in case my implementation is at fault but I don't really know how to do that
i've tried using the mastra client-js on my svelte project on a /api/chat route so that useChat goes there but instead of vercel it finds the mastra agent, but the client-js stream does not have a toDataStreamResponse()
Tyler — 2025-03-17, 2:16 PM
Good question! I'm not 100% sure off the top of my head. What does your client code look like?
Omicrxn
OP
— 2025-03-17, 2:23 PM
export const POST: RequestHandler = async ({ request }) => {
const { messages, threadId, resourceId } = await request.json();

const agent = mastraClient.getAgent(AGENT_NAME);
const result = await agent.stream({
messages: [messages.at(-1)],
threadId,
resourceId,
});

return result;
};

as a suggestion maybe the client-js API could be similar to the mastra/core one, like stream(messages,{params}) instead of stream({params})
and the same with the response not having toDataStreamResponse etc but this i'm not 100% sure if maybe it's okay because it has a different purpose, just random thoughts
Tyler — 2025-03-17, 2:30 PM
ah so the client-js is meant to be called client side. If you're in a server endpoint like that you should be able to import your agent and use it directly
Omicrxn
OP
— 2025-03-17, 2:31 PM
the thing is that my agent lives on a separate mastra server made with mastra create
but since i don't have access to the stream endpoint and i can't use the experimental_previewRequestBody in svelte i don't know how to pass only the last message
or maybe the created mastra streaming endpoint already does the [messages.at(-1)] thing?
Tyler — 2025-03-17, 3:48 PM
I don't think it does since passing just the last message is needed because of how useChat sends all messages each time. I haven't tried using it in your exact setup though so I'll give it a shot and see what's up 👀
Omicrxn
OP
— 2025-03-17, 4:09 PM
perfect the setup is a mastra server mastra create and mastra dev and a useChat instance in svelte with api:'localhost:4111/api/agent/:agentID/stream
then the memory using working memory:
new Memory({
options: {
workingMemory: {
enabled: true,
use: "tool-call", // Required for toDataStream() compatibility
},
},
})

and the issue is that although it recalls correctly the memory, when calling tools, they enter in a loop, and also the error at the beginning of the thread.
I also tried witha custom endpoint where i could do the [messages.at(-1)] and the same happens (which is when i opened this thread)
I can work without memory for now but I plan on launching soon and I think memory would be really great on launch so let me know how it goes.
this is an example of it calling multiple tools
Image
Image
hope it helps!
Tyler — 2025-03-17, 4:23 PM
Thanks, that's helpful context - I'll keep you updated
Omicrxn
OP
— 2025-03-18, 3:23 PM
Forwarded
A perf improvement for those using memory is out in alpha courtesy of @Tony 🚀 https://github.com/mastra-ai/mastra/pull/3015 @mastra/core@0.6.2-alpha.0
GitHub
Fix overly synchronous and blocking memory behaviour by rase- · Pul...
Creating a thread in preExecute before hook and de-coupling that from saveMemory() logic in packages/core/src/agent/index.ts
saveMemory() is now called fetchMemory because it no longer saves any me...
#release-channel • 2025-03-18
hey @Tyler is this fixing the issue on this thread?
Tyler — 2025-03-18, 3:23 PM
@Omicrxn unfortunately no, it's a perf improvement @Tony made
Omicrxn
OP
— 2025-03-21, 5:41 AM
hey @Tyler how are we on this?
Tyler — 2025-03-21, 11:50 AM
Hey @Omicrxn , lots going on this week so havn't had time to look into it! Have it on my list to check out today though
Tyler — 2025-03-21, 2:15 PM
@Omicrxn I took a look but it's working for me 🙈 wish I could reproduce it! Just pushed up another commit to my svelte repo, lmk if I'm missing anything that you have in your setup https://github.com/TylerBarnes/svelte-usechat/commit/83fd957f2060c48f8d7d727630b1e2c1ca6b4afc
GitHub
latest repro · TylerBarnes/svelte-usechat@83fd957
Image
Omicrxn
OP
— 2025-03-22, 6:14 AM
Hey @Tyler I have copied exactly your code into mine, but i'm still getting the:
Error streaming from agent MessageConversionError [AI_MessageConversionError]: Unsupported role: tool
i have the same @mastra/\* versions, the same setup, same usechat and client and server
and in this example i just said my name which successfully called the updateMemory tool , then i closed the server and the app, init again and after that it gives this error
just by saying hello
didn't even called a tool yet
I even tried using your repo but with my server and it gives the same error of unsupported tool so it is 100% on my mastra server
and in the server the only different thing between yours and mine is that i don't use the embedder from openai:
my agent:
import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { clientTools } from '../../tools';
import { Memory } from '@mastra/memory';

const instructions = `... too long for discord`;

const memory = new Memory({
options: {
workingMemory: {
enabled: true,
use: "tool-call", // Required for toDataStream() compatibility
},
},
});

export const uAgent = new Agent({
name: "U",
instructions: instructions,
model: openai("gpt-4o-mini"),
tools: clientTools,
memory
});
Omicrxn
OP
— 2025-03-22, 6:35 AM
@Tyler Here is a video of me using your repo, but with my mastra server
Omicrxn
OP
— 2025-03-22, 7:23 AM
Tried with the openai embedder but same result
Omicrxn
OP
— 2025-03-22, 9:55 AM
removing the workingMemory, seems to work fine, any insights on why? @Tyler
const memory = new Memory({
options: {
// workingMemory: {
// enabled: true,
// use: "tool-call", // Required for toDataStream() compatibility
// },
},
});
C11 — 2025-03-22, 11:26 AM
Hi all. I believe I'm experiencing the same problem here. I have a separate Mastra server/project and a Next frontend. I've set up a basic repo that should reproduce the problem, if that's of any help. https://github.com/JesseDunlap/mastra-memory-tool-test

Steps I've been following to reproduce:
Ask the agent for the weather in LA
The agent correctly responds with the fake forecast for LA
Ask the agent for the weather in Seattle
The /stream endpoint returns a 500 response with the Unsupported role: tool when using memory message.

Any further messages sent in the thread will fail after a tool call as far as I can tell.
GitHub
GitHub - JesseDunlap/mastra-memory-tool-test
Contribute to JesseDunlap/mastra-memory-tool-test development by creating an account on GitHub.
Abhi Aiyer — 2025-03-24, 7:26 AM
Thanks for the repros! We are focusing on fixing memory issues this week
Omicrxn
OP
— 2025-03-24, 9:24 AM
cool keep us posted
Tyler — 2025-03-24, 10:10 AM
Thanks @C11 and @Omicrxn ! Makes it so much easier being able to see and easily reproduce the problem. Working on a fix + tests now!
Omicrxn
OP
— 2025-03-24, 1:33 PM
I've reached another scenario where the Unsupported role: tool message happens. If I call a function where the output is big enough, despite the tool executing well, when talking to it again it happens. Just in case this is helpful.
Tyler — 2025-03-24, 2:13 PM
Found a clue while writing tests! The error only happens when using experimental_prepareRequestBody . In your repro if I comment that out and restart everything it works
ok even closer - commenting out resourceId/threadId also makes it work
experimental_prepareRequestBody({ messages, id }) {
return {
messages,
// threadId,
// resourceId,
};
},

There must be something happening inside the stream endpoint when these are added
still investigating
Tyler — 2025-03-24, 2:23 PM
ah you know what - my bad that just makes it not use Memory 😄 but I've atleast written a test that catches this case - so should be able to fix soon
Omicrxn
OP
— 2025-03-24, 2:24 PM
yeah also I'm on svelte so can't use the prepareRequestBody, I'm doing the [messages.at(-1)] thing
Tyler — 2025-03-24, 2:24 PM
makes sense
should have a fix soon in any case 😄
Omicrxn
OP
— 2025-03-24, 2:25 PM
glad to hear that!
Tyler — 2025-03-24, 3:27 PM
tracked it down - somehow we started using the internal CoreMessage type instead of ui messages. I have a test that will make sure it doesn't happen again and should have a PR open soon
Tyler — 2025-03-24, 4:25 PM
PR here https://github.com/mastra-ai/mastra/pull/3230 almost done! I'll have to continue tomorrow since there's a failing test all fixed, once it's reviewed I'll do an alpha release
GitHub
fix(@mastra/core): always convert to ui messages before sending to ...
Fixes https://discord.com/channels/1309558646228779139/1350882749094952980/1353072381786329181
We store LLM messages as core messages everywhere, but sending core messages to the ai sdk can result ...
fix(@mastra/core): always convert to ui messages before sending to ...
Tyler — 2025-03-24, 5:10 PM
Once this is done the fix will be out in @alpha https://github.com/mastra-ai/mastra/actions/runs/14048554750
GitHub
Prerelease · mastra-ai/mastra@a751326
The TypeScript AI agent framework. ⚡ Assistants, RAG, observability. Supports any LLM: GPT-4, Claude, Gemini, Llama. - Prerelease · mastra-ai/mastra@a751326
Prerelease · mastra-ai/mastra@a751326
Omicrxn
OP
— 2025-03-24, 5:47 PM
Hey @Tyler, nice job. I've been testing and i don't see anymore the Unsupported role: tool
But now it behaves really weird
Same workflow as always:
Hello, who am i?
I don't know
My name is alex
Updates memory
Who am i?
You are Alex
Okey read what's on my clipboard

And here comes the interesting part, now it calls the read clipboard, which returns teh tool result, but the agent responds as if there has been an issue or as if I have not said anything
Image
Image
also I still have the same issue that if once the memory is updated, I close the app and server and run it again, the memory persists, it remembers who i am, but from here on, every tool I call is called on a loop forever
and this happens equally with working memory set up or not, it doesn't matter if I uncomment the commented lines on the image, the behaviour is the same as mentioned above
Image
Again just in case, I have the same setup as in your svelte repo, everything is the same, I have the [messages.at(-1)] and stuff
Omicrxn
OP
— 2025-03-24, 5:59 PM
Memory is quite unusable right now, and just asking, do you see it fixed before thursday? I have a test session and would love to have everything working, including memory so just asking to know what to prepare, not rushing or anything, just to know what to do for the testers😊 @Tyler @Abhi Aiyer
Btw if @C11 can confirm on the nextjs repo the same behavior I mentioned earlier would be cool to check.
Abhi Aiyer — 2025-03-24, 7:38 PM
We'll keep hustling on it ofcourse
Omicrxn
OP
— 2025-03-25, 3:40 AM
Hey more testing here! So I think something has completedly broke. Now it doesn't matter if I have memory set up or not, if I call any tool, it detects it as a hello or a really standard message. This is an example without memory set up.
Image
My guess is that the issue is on the CoreMessage-UIMessage stuff, like maybe there is a conversion somewhere where it loses context, or maybe the ai-sdk expects something different? We can also scope it down to tool calling/ tool results as normal conversation is okay. So maybe there's a hidden conversion anywhere on tool results or similar that makes it lose context?
Omicrxn
OP
— 2025-03-25, 3:47 AM
By reading the debugging logs on the mastra server, the tool result is received but then it kind of resets the conversation
there is not much more i can't see i hope this helps pinpoint the issue
Abhi Aiyer — 2025-03-25, 7:02 AM
@Tyler looks like we made things borked
Tyler — 2025-03-25, 8:06 AM
Thanks @Omicrxn yeah you're most likely right about that. I'll focus on this today and should have a fix soon - I'll start by writing more tests since that seems to be our biggest memory problem, not having enough tests
Omicrxn
OP
— 2025-03-25, 8:47 AM
Sounds good @Tyler we'll get there soon 💪🏻💪🏻
Tyler — 2025-03-25, 2:31 PM
Ok tests are much better! Now I'm catching the old bug and this new issue! I also fixed it https://github.com/mastra-ai/mastra/pull/3267
GitHub
fix(@mastra/core): ensure messages are all core messages when using...
Builds on #3230
In that PR I converted all messages to UI messages and that seems to somehow be a lossy operation. Here I&#39;m taking the opposite approach. Any messages stored in memory are c...
fix(@mastra/core): ensure messages are all core messages when using...
Tyler — 2025-03-25, 3:57 PM
New fix is out in @mastra/core@0.7.0-alpha.2
C11 — 2025-03-25, 4:29 PM
@Tyler Awesome work, and thank you so much for the rapid turnaround! I've confirmed in my test repo that this resolves the issue. Thanks again 🙂
Tyler — 2025-03-25, 4:31 PM
Glad to hear it! Thanks for helping me fix it with that repro, really appreciate it!
Omicrxn
OP
— 2025-03-25, 6:20 PM
Hey @Tyler ! I just tested it a bit and seems to work, tomorrow I'll test it more in depth and I'll let you know if something comes up. Huge congrats man really good work and as always really fast! It's amazing to see the work you guys are putting in and how well you are executing everything and improving mastra by the hour. 🫶
just a quick question before closing this issue (if nothing else comes up) is there a difference between having the commented code uncommented? because I have tested it with both and it seems to work the same, I would even say it the responses feel better without the commented code (but this is just a hunch not logical hahaahah):
const memory = new Memory({
options: {
// workingMemory: {
// enabled: true,
// use: "tool-call", // Required for toDataStream() compatibility
// },
},
});
Tyler — 2025-03-25, 6:25 PM
Awesome, glad it's working so far! Let me know if you run into anything else and I can look asap. The default for working memory is having it disabled. I think you wont see benefits from working memory unless you have a working memory template + system instruction for it. I have it on my list to make some examples (and update docs!) so working memory makes more sense to folks. Right now it's a bit confusing
Omicrxn
OP
— 2025-03-25, 6:27 PM
oh interesting, yeah, from the docs the first time i read it i felt like it was necessary for memory to actually work, but I totally get your explanation, I might need to use templates in the future so i'll keep the code commented. Thanks a lot @Tyler!
Tyler — 2025-03-25, 6:27 PM
Yeah, those docs were written very quickly 😅 haha. anytime! thanks for your help reproducing and testing this fix
