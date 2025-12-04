import { Agent } from '@mastra/core/agent';
import type { MastraDBMessage } from '@mastra/core/agent';
import { parseMemoryRuntimeContext } from '@mastra/core/memory';
import type { ProcessInputStepArgs, Processor, ProcessorMessageResult, ProcessOutputResultArgs } from '@mastra/core/processors';
import type { MastraStorage } from '@mastra/core/storage';
import { encode } from '@toon-format/toon'

const OBSERVER_INSTRUCTIONS = `You are the memory consciousness of an AI assistant. Your observations will be the ONLY information the assistant has about past interactions with this user.

Extract observations that will help the assistant remember:

CRITICAL USER INFORMATION:
- Explicit preferences (e.g., "User wants short answers", "User prefers examples over theory")
- Current projects or context (e.g., "User is building a React app", "User is learning TypeScript")
- Communication style (e.g., "User dislikes verbose explanations", "User appreciates humor")
- Technical level (e.g., "User is familiar with JavaScript", "User is new to async programming")

CONVERSATION CONTEXT:
- What the user is working on or asking about
- Previous topics and their outcomes
- What user understands or needs clarification on
- Specific requirements or constraints mentioned
- Contents of assistant learnings and summaries
- Answers to users questions including full context to remember detailed summaries and explanations
- Relevant code snippets
- Any specifically formatted text or ascii that would need to be reproduced or referenced in later interactions (preserve these verbatim in memory)
- Any blocks of any text which the user and assistant are iteratively collaborating back and forth on should be preserved verbatim

ACTIONABLE INSIGHTS:
- What worked well in explanations
- What needs follow-up or clarification
- User's stated goals or next steps (note if the user tells you not to do a next step, or asks for something specific, other next steps besides the users request should be marked as "waiting for user", unless the user explicitly says to continue all next steps)

Output format (markdown list):
- 🔴 [High priority: explicit preferences, critical context, goals achieved, milestones] [labels]
- 🟡 [Medium priority: project details, learned information] [labels]
- 🟢 [Low priority: minor preferences, uncertain observations] [labels]

For observations that are all related to the same action, group the observations by indenting the sub observations under the parent observeration with a tab and an arrow (->). For example if the agent is working and calls multiple tools, the observations about those multiple tool calls should each be sub observations of a parent observation.
rough example:
- 🟡 Agent is working on x [task, tool_use]
  - -> 🟡 agent executed y to view z file [labels]
  - -> 🟡 (next tool observation)
  - -> 🟡 (next tool observation)
  - -> 🟡 (next tool observation)
  - -> 🟡 (etc)
- 🟡 Agent finished working on x an learned y and z [task, tool_use]

The reason for grouping observervations via indentation, is these observations will later be condensed into a single observation as the memory fades into the past. Make sure you group related observations so this system works well and the memories can gracefully decay. format the observations so that you're properly grouping multiple actions into an overarching observation. Do not group single observations under a parent observation, only group if there are 3 or more observations to group.

Guidelines:
- Be specific enough for the assistant to act on
- Good: "User prefers short, direct answers without lengthy explanations"
- Bad: "User stated a preference" (too vague)
- Add 1 to 5 observations per exchange
- Use terse language to save tokens. The sentences should be dense without unnecessary words, while maintaining necessary information. When the agent is taking actions, don't skip over making observations about what was accomplished, it's important for the agent to remember what they did.
- Do not add observations unless they meaningfully contribute to the memory system. In other words do not add repetitive observations that have already been observed. For example if the agent is re-iterating previous observations to the user, do not re-observe them, instead add an observation that the X memory was re-iterated to the user.
- If the agent calls tools, make sure you make observations about what was called and what the result was. List which tools were called, why, and what was learned from calling them. For example if the agent ran a file search, make note of any relevant files that were found and any other useful information that is relevant.
- When observing files, if there are specific parts where you see the line number, and it would be useful to know the line number, make an observation.
- If the agent does research or exploration and then responds with a larger explanation, make sure to observe what was communicated, so that the agent doesn't forget it.
- Do not repeat observations that are already in the observation list. All observations past and present will be available to the agent, so there's no need to re-iterate them.
- Make sure you start each observation with a priority emoji (🔴, 🟡, 🟢)
- If you make an observation about part of a file, make sure you observe the path to the file on disk if it hasn't already been observed in existing observations.
- Observe what the agent is doing, but remember that the point of observing is for the agent to remember later - making observations about how it's doing something is not as important as what it's doing, why it's doing it, and what the result is. The observations will be used by the agent to continue the conversation in the next interaction immediately following your observations. For example when observing a summary an agent has made, observing the quality of the summary is not as important as observing the contents of the summary. Observing that the agent is able to do x is not as important as observing what the agent learned or communicated by doing x. Do not make observations about the assistants ability to effectively do something, observe WHAT it was they did, and WHAT that means for needing to remember the interaction. Do not say things like "the assistant showcased an ability to extract information", that is not what this memory system is about.
- If the assistant provides a detailed response, make sure you observe the contents of what what communicated, so that the observations about the response would be enough to repeat the exact same response.
- If the final assistant message ends with a question or a follow up task or goal, make sure you add this to the end of your observations, so the agent knows exactly how to continue the conversation from the end of your observations.
- If the user provides a detailed message make sure you observe all the important details from that message so the agent doesn't forget later when all it has is the observations you've made. If the user has a problem, observe all the details from it.
- If the user provides specific artifacts like code snippets, ensure you retain observations that would allow the agent to remember everything about what was presented.

Common labels to use:
- user_preference, communication_style, learning_style
- current_project, user_context, technical_level
- topic_discussed, understanding_confirmed, needs_clarification
- explicit_requirement, constraint, goal, goal_achieved, milestone
- worked_well, avoid_this, follow_up_needed, didnt_work
- tool_use, task

Remember: These observations are the assistant's ONLY memory. Make them count.

In addition to observations, make sure you add a section at the bottom saying explicitly what the current task is - if the task is something the assistant started doing on its own without the user approving or suggesting it, make sure you observe that the agent is currently off task and should explain what it's doing to the user so they can get aligned again. The only tasks the agent should be doing are tasks directly related to something the user asked the assistant to do and minor sub-tasks that are needed to achieve the main task. Since the observations are the assistants only memory, it needs to know directly what it's currently doing, how to continue, and what to do next.
Note that the user messages are extremely important. The most recent user message (near the end of the conversation) should be given very high priority. If the user asks a question or gives a new task to do right now, it should be clear in the observations that the next steps are what the user wanted. Other next steps are lower priority, we are interacting with the user primarily! If the assistant needs to answer a question or follow up with the user based on the most recent user message, make it clear that the assistant should pause after responding to give the user a chance to reply, before continuing to the following next steps. If the assistant is still working on fulfilling this request, observe that that is the case and make sure the agent knows how and when to reply.

Finally it can be very helpful to give the agent a hint on what it's immediate first message should be when reviewing these reflections. eg should the agent call a specific tool? or should they respond with some text. If it's a text response, keep it terse and just hint to them how to respond, ex: "The assistant can maintain cohesion by starting the next reply with "[some sentence the agent would've said next]...". Keep this sentence short and let them continue from your suggested starting point.`

interface ConversationExchange {
    relevantMessages: MastraDBMessage[]
    timestamp: Date
}

function buildUserPrompt(exchange: ConversationExchange, compiledMemory: string): string {
    let prompt = ``

    if (compiledMemory) {
        prompt += 'Existing observations (avoid redundancy):\n'
        prompt += compiledMemory
        prompt += '\n'
        prompt +=
            'Do not repeat these existing observations, your new observations (your entire response) will be appended to the existing observations. Use the existing observations as a starting point so you can do the following:'
    }

    const hasUser = exchange.relevantMessages.some((m) => m.role === `user`)
    const hasAgent = exchange.relevantMessages.some(
        (m) => m.role === `assistant` || m.role === `tool`,
    )
    if (hasUser && hasAgent) {
        prompt +=
            'Make new observerations about the following conversational exchange between the user and assistant. Make sure you make observations about the user message AND the assistant response:\n\n'
    } else if (hasUser) {
        prompt +=
            'Make new observerations about the following user messages. Be aware that no assistant messages are present:\n\n'
    } else if (hasAgent) {
        prompt +=
            'Make new observerations about the following assistant messages. Be aware that no user messages are present:\n\n'
    }

    const toonHistory = encode(
        exchange.relevantMessages.map((m) => {
            if (`providerMetadata` in m) delete m.providerMetadata
            if (`parts` in m) {
                for (const part of m.parts) {
                    if (`providerMetadata` in part) delete part.providerMetadata
                }
            }
            return m
        }),
    )

    prompt += `MESSAGE_HISTORY: ${toonHistory.replaceAll(`role: user`, `role: user (IMPORTANT)`)}\n\n`

    if (hasUser) {
        prompt += `Note that the most recent user message is always important and should have special consideration in regards to the conversation and observations. The most recent user message is in the MESSAGE_HISTORY above. The user calls the shots so we need to make sure we keep on track with what they're saying specifically, above all else.\nHere is a copy of the most recent message to make it clear what to do: ${encode([...exchange.relevantMessages].reverse().find((m) => m.role === `user`))}`
    }

    prompt +=
        'Extract observations that will help the assistant in FUTURE interactions. Remember: these observations are the ONLY memory the assistant will have. When you make observations about messages, the agent will ONLY be able to see your observations, not the original messages. Make them specific and actionable.'

    return prompt
}


export class ObservationalMemory implements Processor {
    readonly id = 'observational-memory';
    private observerAgent: Agent;
    private storage?: MastraStorage;

    constructor({
        observer,
        storage,
    }: {
        storage?: MastraStorage;
        observer: {
            model: string;
        }
    }) {
        this.storage = storage;
        this.observerAgent = new Agent({
            id: 'observer-agent',
            name: 'Observer Agent',
            instructions: OBSERVER_INSTRUCTIONS,
            model: observer?.model || 'google/gemini-2.5-flash'
        });
    }

    async processInputStep(args: ProcessInputStepArgs) {
        console.log(args, 'SUHHHHHHHHHH');

        const memoryInfo = args.messageList.getMemoryInfo();

        console.log(args, memoryInfo);

        if (memoryInfo.threadId) {
            const observations = await this.storage?.stores?.memory.listObservations({ threadId: memoryInfo.threadId });
            console.log(observations);
        }

        return args.messageList;
    }

    async processOutputResult({ messages, messageList }: ProcessOutputResultArgs) {
        const userPrompt = buildUserPrompt({ relevantMessages: messages, timestamp: new Date() }, '');

        const result = await this.observerAgent.generate(`${userPrompt}`, {
            modelSettings: { temperature: 0.3, maxOutputTokens: 100_000 },
            providerOptions: {
                google: {
                    thinkingConfig: {
                        thinkingBudget: 215,
                        // thinkingBudget: 2048,
                        // thinkingBudget: 8192,
                        includeThoughts: true,
                    },
                },
            },
        });

        const memoryInfo = messageList.getMemoryInfo();

        if (this.storage) {
            await this.storage.stores?.memory.saveObservations({
                observations: [{
                    id: crypto.randomUUID(),
                    threadId: memoryInfo.threadId,
                    resourceId: memoryInfo.resourceId,
                    observation: result.text
                }]
            });
        }

        console.log(result.text);

        return messageList;
    }
}