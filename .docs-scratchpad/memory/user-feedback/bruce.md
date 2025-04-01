https://discord.com/channels/1309558646228779139/1356090029063147630
bruce
OP
— 3/30/25, 7:17 PM
I'm trying to figure out best practie for updating memory. I finally got this to work which it does, but it just does not seem right. Is it normal to pull in memory to the tool. I wanted to the context to hold it and update when the agent called my loadIntialMemory tool. Normally this would be a database call but trying explore and learn without that added complexity.
import { z } from "zod";
import coopData from "../db/coopData.json";
import { createTool } from "@mastra/core/tools";
import { Memory } from "@mastra/memory";
import { memory } from "../agents/feedOptimizationAgent";
Expand

loadInitialMemory.ts
3 KB

Abhi Aiyer — Yesterday at 12:23 AM
Pulling in @Tyler !
Tyler — Yesterday at 12:25 PM
@bruce right now importing memory and using it in your execute function is the right way to go
bruce
OP
— Yesterday at 12:36 PM
Thanks for the follow-up. One last question. I feel like #1 and #2 are doing the something. Is if fair to say once I do the addMessage() I should expect agents and tools will have access to content added with out returning it back and forth? In other words i really did not have to do #2?

#1
const result = await memory.addMessage({
threadId: threadId!,
role: "assistant",
content: messageContent,
type: "text",
});
console.log("Memory updated:", result);

#2
return {
message: Memory has been updated with the chicken information. Here are the chicken details you can use to answer the user's question:

${messageContent}

Please use this information to respond directly to the user's query about the chickens.,
};
} catch (error) {
console.error("Error in loadInitialMemoryTool:", error);
throw error;
}
},
});
bruce
OP
— Yesterday at 12:57 PM
Just can't figure out how to make LLM respond with out doing #2. I know it loads in memory, but can't figure out how to get it to respond without asking the question again the second time. Just thinking best practice approach get inital memory loaded. This examples is with out forcing the message content into the return response.
Image
Tyler — Yesterday at 1:01 PM
Ah, I missed that you were calling memory.addMessage. You shouldn't need to do that as memory history is handled automatically for you.

What does your memory config look like and what are you trying to achieve?
bruce
OP
— Yesterday at 2:59 PM
Well, so many things. 🙂

Just trying to learn.
Trying to figure how the framework works by building a fun project to allow agents to manage my chicken coop.

What I'm trying to design is a way for the agents/tools to understand the data/state of the coop. I think I need to either take the following approach in my design.

load the conversation history with coop state on start up in a the initializeMemory tool and then load memory for other agents/tools to see data ( the path I'm going down )
load the conversation history with coop data when agent is initialize, I'm not sure if memory would be available. I guess in theory if I intialzie and can be used across agents and tools.
Tyler — Yesterday at 3:15 PM
dope! 😄 love it!
So here's what I recommend:
Add memory to your agent like you did
Add a system instruction telling the agent its purpose is to manage your chicken coop. tell it it needs to know the state of the chicken coop or it's not doing its job 😆 tell it if it doesn't know it needs to call the tool to find out.
Expose tools like you're doing so the agent is able to look up info about your chicken coop. You don't need to access memory inside the tool for this to work because memory is handled automatically for you - all you need to do is pass in a resourceId (think of it like a user id) and a threadId (conversation id) anytime you send a new message to the agent

By default Memory stores the conversation history for you and exposes it to your agent, and that will include any tool calls and results the agent makes. So as you interact with the agent it will remember the tool calls it already made
I'm working on new memory docs right now because we've heard from a lot of users the current docs are confusing
Let me know if that makes sense, happy to talk about it more!
bruce
OP
— Yesterday at 3:35 PM
Thanks for the feedback, will play around and let you know how it goes.
