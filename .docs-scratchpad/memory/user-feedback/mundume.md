https://discord.com/channels/1309558646228779139/1343277326296809503
mundume — 2025-02-23, 9:44 AM
I'm sorry for not explaining well I meant that creating threads in memory is working but saving messages in the threads is not working.
mundume — 2025-02-24, 12:08 AM
here is the error thats being thrown in the console
at async POST (src/app/api/chat/route.ts:29:16)
27 |
28 | try {

> 29 | const res = await myAgent.stream(messages, {

     |                ^

30 | threadId,
31 | resourceId,
32 | });
Error: Cannot find module as expression is too dynamic
this happens when im triying to persist conversations. Thread creation works fine but saving messages is where im getting the issue
here is the repo url https://github.com/mundume/mastra-play
GitHub
GitHub - mundume/mastra-play
Contribute to mundume/mastra-play development by creating an account on GitHub.
GitHub - mundume/mastra-play
Sam Bhagwat — 2025-02-24, 12:28 AM
Okay got it thanks for the repo
Repro
Okay both I guess lol
mundume — 2025-02-24, 12:38 AM
Im sorry? Should i provide more context?
mundume — 2025-02-24, 12:53 AM
When the page loads for the first time, there are a couple of buttons and and an input, clicking the buttons or submititing the forminput will send a post request to create a thread(which works im creating a cookie which acts as a resource-id for thread creating ) and youre navigated to a dynamic chat screen with thread id as a param.. sending messages here now doesnt work
i tried postgres and upstash none of them works
i can send you my env if you dont mind
Ward — 2025-02-24, 1:06 AM
Sam thanks you for the repro and the repo 😄 (he made a typo).

@mundume any change you can create a github issue for us https://github.com/mastra-ai/mastra/issues.
I'll delegate it to @Tyler
mundume — 2025-02-24, 1:30 AM
Sure
Thanks for your response
Ward — 2025-02-24, 1:30 AM
Thank you for letting us know about the bug 👍
mundume — 2025-02-24, 1:31 AM
Cool, hoping for a quick fix soon. Any workaround for the memory for the time being?
Ward — 2025-02-24, 1:38 AM
Does it work with postgres? so if you remove storage all together?
We should have a fix for you today
mundume — 2025-02-24, 2:10 AM
nope, postgres doesnt work too...if i remove storage alltogether it works just fine
Ward — 2025-02-24, 2:22 AM
sqlite?
ah ok
than it's a pg issue
mundume — 2025-02-24, 2:40 AM
Havent tried this yey
mundume — 2025-02-24, 2:40 AM
looks like it
Im having a problem creating an issue on github
I think there is some spam control on the repository
mundume — 2025-02-24, 5:30 AM
Just created the github issue, thanks
Ward — 2025-02-24, 5:35 AM
Definitly; if you're new to github we don't allow you to create issues etc
mundume — 2025-02-24, 5:42 AM
Cool thanks
Ward — 2025-02-24, 5:53 AM
i'll see if we can fix that soonish but in the meantime i'll create the issue and escalate it internally
mundume — 2025-02-24, 7:15 AM
Cool..have a nice day
Ward — 2025-02-24, 8:31 AM
https://github.com/mastra-ai/mastra/issues/2498
GitHub
Posting memory threads to non default storage fails · Issue #2498 ·...
this happens when im triying to persist conversations. Thread creation works fine but saving messages is where im getting the issue at async POST (src/app/api/chat/route.ts:29:16) 27 | 28 | try { &...
mundume — 2025-02-24, 9:22 AM
Cool
Tyler — 2025-02-24, 10:28 AM
@mundume the issue is the default embedder doesn't work in Nextjs right now, and there's a bug where you can't disable the "semantic recall" feature of memory (which calls the default embedder). I fixed it here https://github.com/mastra-ai/mastra/pull/2501
Cutting a prerelease with the fix now!
There is a workaround though, you can add an embedder to Memory so that it doesn't use the default one:

import { openai } from "@ai-sdk/openai";

const memory = new Memory({
embedder: openai.embedding("text-embedding-3-small"), // <- doesn't have to be openai
})

GitHub
fix(core, memory): disable embedder by disabling semantic recall by...
Fixes #2498
The actual error in that issue is related to the default embedder. The solution is to use a different embedder (eg openai) or disable semantic recall. While investigating I discovered t...
fix(core, memory): disable embedder by disabling semantic recall by...
After the fix is released you can do this:

const memory = new Memory({
options: {
semanticRecall: false // <- an embedder will not be required with this set to false
}
})
Tyler — 2025-02-24, 11:50 AM
@mundume update to the new alpha versions:
"@mastra/core": "0.4.1",
"@mastra/memory": "0.1.4",

And you can disable semanticRecall properly now which will solve the issue
Tyler — 2025-02-24, 12:03 PM
Oh also if you remove "pg" from your package.json deps it'll remove the nextjs warning - you shouldn't need it installed to use memory, unless you're using it for something else too
mundume — 2025-02-24, 8:13 PM
Aaaah...actually this(the embedder error) was being logged to the console but i thought it was a warning since i was not trying to do any chunking, just storage
mundume — 2025-02-24, 8:17 PM
Cool...thank you so much man...this error had me going nuts all weekend😁
mundume — 2025-02-24, 8:42 PM
Everything is working now thanks!
Tyler — 2025-02-24, 9:33 PM
Glad to hear it!! Lmk if anything else comes up
mundume — 2025-02-24, 9:44 PM
Cool!
