https://discord.com/channels/1309558646228779139/1354342508754243616/1354342508754243616
Ata
OP
— 3/25/25, 11:33 PM
I’m trying to understand how memory works in Mastra, and I’d like to open this thread to explain what I’ve understood so far and see if I’ve managed to grasp it correctly.

If we don’t use Memory(), so the agent by default won’t use memory?

When we initialize Memory and configure it, I have doubts about the use of threadId and resourceId:

---> Let’s say I use an endpoint to chat with agent.stream().
---> If I add a threadId (let’s assume it’s the ID of my conversation) and a resourceId (the ID of the logged-in user) to this stream, these two things, by themselves, don’t modify the agent’s functionality in any way (I suppose 🤔).
---> Instead, they serve me in the future, in another chat (say, an "administrative" chat), to give an admin user the ability to "query" the context of a specific user’s conversations.
Ata
OP
— 3/25/25, 11:33 PM
So... In other words, let’s suppose that in my application administrators can view the chats of the users they’re responsible for. With the userId (resourceId) and the chat’s ID (threadId), could I request that information?

If the answer is yes, here comes my first real doubt: In this case, I’m using a threadId and resourceId to access the memory of a specific "chat" from a specific "user" but how would I save THIS administrative chat to memory? That is, reviewing the API/documentation, I’d have to inject the same resourceId and threadId of the conversation whose memory I want to retrieve as parameters. This is confusing to me, and I’m not fully understanding it.

Working Memory: I perfectly understand the idea of "saving memory in XML templates," but I don’t understand how this information is "shared" or, better said, how it’s used in the agent. If I start multiple conversations, each being a different conversation, would both have the same "working memory"? For this to work, do I need to send them the same threadId and resourceId, or does the simple fact that it’s the same agent mean this working memory is shared? 😅

I hope my questions make sense. I find the mechanism really fascinating, but I’m struggling to fully understand it in depth.

Thanks in advance! 👌🏻
Ata
OP
— 3/25/25, 11:49 PM
@Ata Sanchez
dayo — 3/26/25, 1:36 AM
Hey @Ata

Bringing in our memory expert @Tyler to help here when he's available later today

Tyler — 3/26/25, 9:35 AM
Hey @Ata when you use Mastra memory all of the memories are segmented by user + thread as you've discovered.
Adding the IDs to interactions makes it so memory is handled on your behalf during each interaction.

The most basic feature in our memory is maintaining a conversation history - so you provide a user id + thread id + only new messages and we will inject any older messages from that thread into context for the agent to see.

Then we also have the ability to do RAG memory using the "semantic recall" feature. Same as conversation history, adding a user id + thread id will make it automatically use RAG to search for previous similar messages and inject those in context.
Working memory is also per-thread.

On top of this you can manually manage and query memory if you need to
Fetch all threads for a user: https://mastra.ai/docs/reference/memory/getThreadsByResourceId
Fetch an individual thread by id: https://mastra.ai/docs/reference/memory/getThreadById
Query for memory messages manually: https://mastra.ai/docs/reference/memory/query

Does that help? Happy to keep chatting and answer any questions you have
Ata Sanchez — 3/26/25, 11:19 AM
Hey @Tyler so, if i'm using and agent to strem responses with the AI SDK, should I inject the resourceId and threadID into the stream method?
Image
and automatically mastra use memory to "inject" the conversation?
So, if I have a tool and within that tool I cal my agent (or another agent) and say something like, "Analyze the conversation and determine what the user wants to do", would that just work?
well... if I use a different agent, this agent will have different memory, so, I should "inject" the threadId and resourceId to that agent?
am I right?
Tyler — 3/26/25, 11:29 AM
yes that's right
Ata Sanchez — 3/26/25, 11:34 AM
I understand, great. Now, is there any way to "inject" the agent with certain "information they need to know" beforehand for proper execution? That is, some "context" beforehand?
@Tyler there's a problem with the documentation (https://mastra.ai/docs/agents/01-agent-memory#usechat): the experimental_prepareRequestBody method states that it should return "a message," but the following code block expects an array of messages. A person following the documentation would find an error. This would need to be changed:

experimental_prepareRequestBody({ messages, id }) {
return { messages: [messages.at(-1)], id };
},

const { id, messages }: { id: string; messages: Array<Message> } =
await request.json();
Image

Using Agent Memory | Agents | Mastra Docs
Documentation on how agents in Mastra use memory to store conversation history and contextual information.
Using Agent Memory | Agents | Mastra Docs
stream is waiting and array of Message[]/CoreMessage[]/string but not a simple Message
Image
"@mastra/core": "^0.6.4",
Ata Sanchez — 3/26/25, 11:55 AM
How should I "inject" that resourceId and threadId? Should I get it using the memory query method, for example, and pass it in the instructions to the agent I'm using? (https://mastra.ai/docs/reference/memory/query)

query
query
Ata Sanchez — 3/26/25, 12:26 PM
@Tyler I've noticed that we have a context property to use into generate method. So, I could get the messages with query and then send them into the context property? Would this be the correct way to do it?
Image
Tyler — 3/26/25, 12:57 PM
Thanks for finding that docs issue @Ata Sanchez ! Appreciate you letting me know 😄 so when you're using useChat you can do this:
experimental_prepareRequestBody({ messages, id }) {
return { messages: [messages.at(-1)], id, threadId, resourceId };
},

Then you'll be able to access the threadId+resourceId in your function handler

I'll update the docs and add that too
btw we shipped a bug fix for memory w/ useChat to alpha yesterday pnpm i @mastra/memory@alpha - should have a new full release soon, but without that you'll likely run into issues
You probably need pnpm i @mastra/core@alpha too
Ata Sanchez — 3/26/25, 12:59 PM
gotcha
I'm going to upgrade
Tyler — 3/26/25, 12:59 PM
For this you shouldn't need to query and pass them in. If you add resourceId + threadId as args to generate it will do it for you
so you can just pass in new messages each time
Ata Sanchez — 3/26/25, 1:00 PM
uhmmmm this is what I don't quite understand. If I pass it the same threadId and resourceId that I already passed to another agent, wouldn't I be "mixing" memory?
That is, by adding those two parameters, if they don't exist, the memory is created, and if they do, the messages are used? Would that be the case?
Tyler — 3/26/25, 1:02 PM
yes, so you can do that intentionally if you want to, if you want each agent to have separate memory you'll need a different thread id for each. You could do something like threadId: threadId + agentName to scope each thread id to each specific agent
Ata Sanchez — 3/26/25, 1:03 PM
it makes perfect sense now
So, what do we use the context property for?
Tyler — 3/26/25, 1:04 PM
awesome, glad to hear it! context is useful for passing data between workflow steps - so you could pass a thread id between steps if you want, or any other data
context allows you to pass any data you need in your workflow
Ata Sanchez — 3/26/25, 1:04 PM
Would it be the same as the variables between steps?
Tyler — 3/26/25, 1:06 PM
I'm not an expert on workflows so I'm not 100% sure on that, @Tony what's the difference between variables and context for workflows? Did I mis-speak on what context is used for?
Ata Sanchez — 3/26/25, 1:06 PM
I think there is a misunderstanding, I am referring to the context property that can be sent when calling the generate or stream method of an agent, not to the context prop that arrives in the execute function.
Tyler — 3/26/25, 1:06 PM
Ah I see, one sec, I'm not sure then I'll double check
Ata Sanchez — 3/26/25, 1:07 PM
Context I understand that this is where the inputSchema information is located and also the variables that were mapped with the variable functionality to pass information between steps of a workflow.
am I right @Tony ?
Tyler — 3/26/25, 1:07 PM
ahhh that context - ok sorry naming is confusing here. So that context is referring to the context window of the agent
you can use that to inject messages
Ata Sanchez — 3/26/25, 1:07 PM
OH
great!
Tyler — 3/26/25, 1:08 PM
When you're using memory it's best to just add new messages with the first arg. You can use context if you were adding a one-off system instruction or something like that

Ata Sanchez — 3/26/25, 1:09 PM
Impressive! I'm understanding a lot of things as I use Mastra. More information is really needed in the documentation. If I can lend a hand or share examples with the AI ​​SDK in a future app (my use case), I'd be happy to do so. It saves new developers a headache.
Tyler — 3/26/25, 1:09 PM
Yeah, we 100% agree that the docs are lacking here. I've been collecting feedback on memory docs and I'm planning an overhaul on it. What would you say was the most confusing part for you?
Ata Sanchez — 3/26/25, 1:11 PM
There's a lack of practical examples, with real-world, less "abstract" use cases.

For example, I had a hard time understanding that Mastra is a framework for building a conversational API, basically, so my first questions were about how to wire up the UI with Mastra (due to my influence with the AI ​​SDK).

Small examples at first, then tying everything together would be ideal.

For example, a great practical example/use case would be an application that keeps track of a to-do list or a travel itinerary. Different agents then access and modify the memory while keeping everything synchronized with a database (this is exactly what I'm doing).
And explain when to use one method or another. For example, when would you use query in that case? When would you obtain a Thread, and for what purpose? Why would you need all the threads? What information can be obtained from the threads? (For example, I still don't fully understand what the thread list is for.)
Something I do miss is perhaps a better memory viewer in MasterCloud, that would be great.
Tyler — 3/26/25, 1:20 PM
That's really helpful, thanks for writing that up!
Definitely going to use this feedback while working on docs, thank you!

Ata Sanchez — 3/26/25, 1:21 PM
@Tyler One last question... Do I need to pass the threadId and resourceId for the memory to work correctly? Or is passing the threadId enough for it to get the messages?
(when call an agent)
Tyler — 3/26/25, 1:22 PM
double checking right now, I'm pretty sure you need both (definitely recommend using both) but I'll check
ah yes it's required. If you only pass threadId it'll throw an error
Ata Sanchez — 3/26/25, 1:24 PM
Ok, so the linter should indicate this, since typescript didn't give me any warnings.
Thanks for the answer! 😄
Tyler — 3/26/25, 1:25 PM
Good call out, I'll make a note of that too
thanks!
Ata Sanchez — 3/26/25, 1:56 PM
@Tyler how can I "pass" the resourceId and threadId to a workflow?
I was doing some tests, and it turns out that the threadId and resourceId are undefined, when the workflow runs.
I am executing the workflow from a tool, which is assigned to my agent (the agent I use with threadId and resourceId)... What's more, within the tool, I can easily obtain the threadId and resourceId from the execute function.
Here, threadId and resourceId are defined
Image
Here (into the workflow) none :/
Image
Tyler — 3/26/25, 2:05 PM
Likely this is just a missing feature - curious what you think @Tony should we add this or document that it should be done via variables? I can see that tools and steps both having an execute fn, but each having different args could be confusing
Ata Sanchez — 3/26/25, 2:07 PM
Oh! My whole workflow is based on being able to have the threadId and resourceId, haha
🤣
What would be the workaround here? Pass it as triggerData?
Abhi Aiyer — 3/26/25, 2:29 PM
Workflow step execution isn't related to the memory system, you would be using triggerData for the resourceId/threadId you want!

Ata Sanchez — 3/26/25, 2:36 PM
Uhmmm so then why these props are mapped into the execution function? 🤔 always will be infringed both?
Undefined\*
Ata Sanchez — 3/26/25, 3:45 PM
For Memory to work between agents, each agent should have subtropics memory configuration? I understand that later, when passing the threadId and the resourceId each "memory" goes and looks for the messages to the memory DB and adds it to the context, right? Am I right?
Tyler — 3/27/25, 11:31 AM
yes, that's right 😄
