https://discord.com/channels/1309558646228779139/1355263718362972210
Omicrxn
OP
— 3/28/25, 12:34 PM
Hey guys! glad to tell you that memory is working MUCH better since the fix from ⁠Unsupported role: tool when usi… . However after a bit of testing, when i call a tool, if I call it again after some time it does not call the tool and use the result from the previous call or just hallucinates it a bit. I can't bring a reproduction as it doesn't happen 100% of the time, but I tested without memory and didn't get this issue. Can this be fixed in anyway?
Tyler — 3/28/25, 1:14 PM
I've seen this too and it can be quite annoying.
You can try a system prompt telling it to always call that tool again
This upcoming feat will allow you to strip tool calls out of memory history selectively which would make it call the tool again https://github.com/mastra-ai/mastra/pull/3304

GitHub
feat(@mastra/core, @mastra/memory): Memory processors by TylerBarne...
TLDR Adds memory processors to filter or transform messages before they&#39;re sent to the LLM. Includes two built-in processors: TokenLimiter (prevents context window overflow) and ToolCallFil...
feat(@mastra/core, @mastra/memory): Memory processors by TylerBarne...
There will be a builtin ToolCallFilter memory processor that strips out all tool calls or tool calls by tool id.
And if it's not enough you can write a custom memory processor
https://github.com/mastra-ai/mastra/pull/3304/files#diff-03eb56f49cb8b8b7e5ba38e598e354dccde2de07da34803c2435256fff73a769R42
https://github.com/mastra-ai/mastra/pull/3304/files#diff-03eb56f49cb8b8b7e5ba38e598e354dccde2de07da34803c2435256fff73a769R89
Omicrxn
OP
— 3/28/25, 4:50 PM
This is actually really good @Tyler, now after reading the PR i remembered that when calling a tool with a large output weird things happened too, and also it takes a bit of time between the output and the next answer which I guess it's due to this too, didn't think of it. I really like this idea!
Tyler — Yesterday at 12:27 PM
Awesome, glad to hear that! My hope is this can conceptually simplify memory features - working memory and semantic recall could potentially become memory processors later too
Tyler — Yesterday at 1:12 PM
It's out in @mastra/core@0.8.0-alpha.1 and @mastra/memory@0.2.7-alpha.1 !

Since the docs wont be published til the next latest release here are some links (if you want to try it out):
https://github.com/mastra-ai/mastra/blob/main/docs/src/pages/examples/memory/memory-processors.mdx
https://github.com/mastra-ai/mastra/blob/main/docs/src/pages/docs/reference/memory/memory-processors.mdx
https://github.com/mastra-ai/mastra/tree/main/examples/memory-with-processors
