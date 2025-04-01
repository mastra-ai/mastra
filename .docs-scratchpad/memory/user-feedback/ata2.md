https://discord.com/channels/1309558646228779139/1354642038942863492/1354848773313921186
Ata Sanchez
OP
— 3/26/25, 7:23 PM
I'm creating a simple memory-based mastra implementation using package versions:

@mastra/core": "0.7.0-alpha.3
@mastra/memory": "0.2.6-alpha.3

This is my memory implementation on agent 1:

export const memory = new Memory({
options: {
lastMessages: 20,
semanticRecall: {
topK: 10,
messageRange: 2,
},
},
});

This is how I wanted to use it on agent 2:

const agentTwo = mastra.getAgent('agentTwo');

            const response = await agentTwo.generate(
                [
                    {
                        role: 'user',
                        content: `Instructions`,
                    },
                ],
                {
                    threadId,
                    resourceId,
                }
            );

If I try to get the messages using the query method, I can get them without any problem:

const { messages } = await agentTwo.query({
threadId,
});

Finally, I opted to "inject" the messages directly into the prompt of agent 2's generate method, and it works, but the memory system doesn't work.

NOTE: It works the first time; when I delete memory.db, it never works again after the first time until delete again memory.db
Image
dero — 3/27/25, 2:13 AM
oh Interesting, do you have the memory registered on both agent 1 & agent 2
Ata Sanchez
OP
— 3/27/25, 6:33 AM
Yes, I have different memory objets in each
Ata Sanchez
OP
— 3/27/25, 6:45 AM
I also have doubts how the memory.dB works. When we deploy mastra into Nextjs project, we should exclude the memory.dB from the repository and also the .mastra directory?
dero — 3/27/25, 7:17 AM
For deployment you'll need a remote db. Gonna bring in @Tyler here. He'll have more context on memory stuff
Ata Sanchez
OP
— 3/27/25, 8:20 AM
oh.... This is not clear in the documentation @Tyler, also, using the alpha version of @mastra/pg, I am getting this error
Image
Ata Sanchez
OP
— 3/27/25, 9:05 AM
I've updated to @mastra/pg@alpha and now is working. Guys, a small feedback: The memory documentation is very confused to follow, for example, these questions are not responded in the documentation:

Do we have to create only 1 memory object and share across all agents?
How we have to configure a Supabase/Postgres Vector instance to use it? (An example is missing here)
Abhi Aiyer — 3/27/25, 11:19 AM
Thanks for all the feedback @Ata Sanchez we are actively iterating on the docs and bug fixes right now!
Please keep the feedback coming, trying to address them as soon as we can!
Ata Sanchez
OP
— 3/27/25, 11:20 AM
Hi @Abhi Aiyer great!
You know, I'm currently facing an issue with Vercel's serverless functions. After adding memory to my Mastra agents, the router handler used by that agent now exceeds the allowed memory and cannot be deployed.
Do you guys have an example using Memory and integrating mastra with nextjs?
Abhi Aiyer — 3/27/25, 11:33 AM
We dont do anything special in a nextjs env same code should apply but the diff providers behave differently. Are you talking about the bundle size exceeding 250MB? or actual mem of your function
https://mastra.ai/docs/frameworks/01-next-js we do have this doc we wrote on using mastra with next

Getting started with Mastra and NextJS | Mastra Guides
Guide on integrating Mastra with NextJS.
Getting started with Mastra and NextJS | Mastra Guides
Ata Sanchez
OP
— 3/27/25, 11:38 AM
yeap, exactly
Local works perfectly, but when I try to deploy it, it fails. If I remove the memory configuration, the error appears again.
Tyler — 3/27/25, 11:48 AM
@Ata Sanchez this may be from the default embedder. what does your memory config look like?
Ata Sanchez
OP
— 3/27/25, 11:49 AM
import { myProvider } from '@/lib/ai/models';
import { quoteAgentInstructions } from '@/mastra/instructions/quote-agent.instructions';
import { deleteItineraryTool } from '@/mastra/tools/itinerary/delete-itinerary.tool';
import { updateItineraryTool } from '@/mastra/tools/itinerary/update-itinerary.tool';
import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import { PgVector, PostgresStore } from '@mastra/pg';

if (!process.env.DATABASE_URL) {
throw new Error('DATABASE_URL are not set');
}

const prodConfig = {
vector: new PgVector(process.env.DATABASE_URL),
storage: new PostgresStore({
connectionString: process.env.DATABASE_URL,
}),
};

export const quoteMemory = new Memory({
...(process.env.NODE_ENV === 'development' ? {} : prodConfig),
options: {
lastMessages: 5,
workingMemory: {
enabled: true,
template: `                 template here
                `,
},
semanticRecall: {
topK: 3,
messageRange: 2,
},
},
});

export const quoteAgent = new Agent({
name: 'Quote Agent',
instructions: quoteAgentInstructions,
model: myProvider.languageModel('agent-model'),
memory: quoteMemory,
tools: {
updateItinerary: updateItineraryTool,
deleteItinerary: deleteItineraryTool,
},
});
This is my main agent
import { myProvider } from '@/lib/ai/models';
import { itineraryAgentInstructions } from '@/mastra/instructions/itinerary-agent.instructions';
import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import { PgVector, PostgresStore } from '@mastra/pg';

if (!process.env.DATABASE_URL) {
throw new Error('DATABASE_URL are not set');
}

const prodConfig = {
vector: new PgVector(process.env.DATABASE_URL),
storage: new PostgresStore({
connectionString: process.env.DATABASE_URL,
}),
};

export const itineraryMemory = new Memory({
...(process.env.NODE_ENV === 'development' ? {} : prodConfig),
options: {
lastMessages: 1,
workingMemory: {
enabled: true,
template: `                Template here    
                `,
},
semanticRecall: {
topK: 5,
messageRange: 2,
},
},
});

export const itineraryAgent = new Agent({
name: 'Itinerary Agent',
instructions: itineraryAgentInstructions,
model: myProvider.languageModel('agent-model'),
memory: itineraryMemory,
});

and this one is another agent that I'm unsing into my workflows
My main question is:

Is it okay to have two separate memory configurations?
I don't fully understand the storage and vector configuration for production. I followed the documentation, but they aren't clear.
Tyler — 3/27/25, 11:52 AM
what you have is good, that's a good way to make local dev easier. Adding this to my notes about improving docs! Try this:
const prodConfig = {
vector: new PgVector(process.env.DATABASE_URL),
storage: new PostgresStore({
connectionString: process.env.DATABASE_URL,
}),
embedder: openai.embedding("text-embedding-3-small")
};
