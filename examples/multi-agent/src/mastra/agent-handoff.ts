import { Agent } from '@mastra/core/agent';
import { createTool } from '@mastra/core/tools';
import { Memory } from '@mastra/memory';
import { z } from 'zod';

const memory = new Memory();

/**
 * Multi-Agent Handoff Example
 *
 * A triage agent detects the user's language and hands off to the appropriate
 * language specialist. The specialists respond in their language.
 */

// Language-specific agents (simple, no handoff capability)
const frenchAgent = new Agent({
  id: 'french-agent',
  name: 'French Language Specialist',
  instructions: 'You are a friendly assistant who speaks French. Always respond in French.',
  model: 'openai/gpt-4.1',
  memory,
});

const spanishAgent = new Agent({
  id: 'spanish-agent',
  name: 'Spanish Language Specialist',
  instructions: 'You are a friendly assistant who speaks Spanish. Always respond in Spanish.',
  model: 'openai/gpt-4.1',
  memory,
});

const englishAgent = new Agent({
  id: 'english-agent',
  name: 'English Language Specialist',
  instructions: 'You are a friendly assistant who speaks English. Always respond in English.',
  model: 'openai/gpt-4.1',
  memory,
});

// Agent registry for the handoff tool
const agents: Record<string, Agent> = {
  french: frenchAgent,
  spanish: spanishAgent,
  english: englishAgent,
};

// Handoff tool - transfers conversation to a language specialist
const handoffTool = createTool({
  id: 'handoff',
  description: `
Transfer the conversation to a language specialist.
Available agents:
- "french": For French language conversations
- "spanish": For Spanish language conversations  
- "english": For English language conversations
    `,
  inputSchema: z.object({
    targetAgent: z.enum(['french', 'spanish', 'english']).describe('The language agent to hand off to'),
    userMessage: z.string().describe('The user message to pass to the agent'),
  }),
  outputSchema: z.object({
    response: z.string(),
    handedOffTo: z.string(),
  }),
  execute: async ({ targetAgent, userMessage }, context) => {
    const agent = agents[targetAgent];
    if (!agent) {
      return { response: 'Agent not found', handedOffTo: 'none' };
    }

    const result = await agent.stream(userMessage, {
      memory: {
        resource: context?.agent?.resourceId,
        thread: context?.agent?.threadId,
      },
    });

    return {
      response: await result.text,
      handedOffTo: targetAgent,
    };
  },
});

// Triage agent - detects language and hands off to the right specialist
export const languageTriageAgent = new Agent({
  id: 'language-triage-agent',
  name: 'Language Triage Agent',
  instructions: `
You are a multilingual triage agent. Detect the user's language and hand off to the appropriate specialist.

## Language Detection
- French → hand off to "french"
- Spanish → hand off to "spanish"  
- English or unknown → hand off to "english"

## Important
- Do NOT respond to the user yourself
- ALWAYS use the handoff tool immediately
- Pass the user's message as-is to the handoff tool
- Always respond with the handoff tool result
    `,
  model: 'openai/gpt-4.1',
  memory,
  tools: {
    handoff: handoffTool,
  },
});
