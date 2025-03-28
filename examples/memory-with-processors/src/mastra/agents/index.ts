import { openai } from '@ai-sdk/openai';
import { createTool } from '@mastra/core';
import { Agent } from '@mastra/core/agent';
import type { CoreMessage } from '@mastra/core';
import type { MemoryProcessor, SharedMemoryProcessorOpts } from '@mastra/core/memory';
import { Memory, TokenLimiter, ToolCallFilter } from '@mastra/memory';
import { z } from 'zod';

// Custom processor that makes the llm forget any messages that contain keywords
class ForgetfulProcessor implements MemoryProcessor {
  constructor(private keywords: string[]) {}

  process(messages: CoreMessage[], _opts: SharedMemoryProcessorOpts = {}): CoreMessage[] {
    return messages.map(message => {
      if (message.role === `assistant` || message.role === `user`) {
        const content =
          typeof message.content === `string`
            ? message.content
            : message.content.reduce((msg = ``, current) => {
                if (current.type === `text`) {
                  return msg + `\n${current.text}`;
                }
              }, '') || '';

        const shouldForgetThis = this.keywords.some(keyword => content.toLowerCase().includes(keyword.toLowerCase()));
        console.log(`\n`, { shouldForgetThis, content });
        if (shouldForgetThis && (message.role === `user` || message.role === `assistant`)) {
          return {
            role: 'assistant',
            content: `<forgotten>I'm getting forgetful in my old age. this used to be a ${message.role} message but I forgot it</forgotten>`,
          };
        }
      }
      return message;
    });
  }
}

// Create a technical support agent with token limiting
const supportMemory = new Memory({
  processors: [
    // Limit history to approximately 2000 tokens to demonstrate truncation
    new TokenLimiter(2000),
  ],
  options: {
    lastMessages: 50,
    semanticRecall: false,
  },
});

// Create the web search tool
const searchTool = createTool({
  id: 'web-search',
  description: 'Search the web for information',
  inputSchema: z.object({
    query: z.string().describe('The search query'),
  }),
  execute: async ({ context: { query } }) => {
    // Simulate web search results
    return `Search results for "${query}": 
    1. Top result with important information
    2. Secondary information related to the query
    3. Additional context that might be helpful`;
  },
});

// Technical support agent with token limiting
export const supportAgent = new Agent({
  name: 'Technical Support',
  instructions:
    'You are a technical support agent who helps users solve software problems. You provide clear, step-by-step instructions and ask clarifying questions when needed. You remember details from earlier in the conversation. Your goal is to efficiently resolve user issues.',
  model: openai('gpt-4o-mini'),
  memory: supportMemory,
  tools: { searchTool },
});

// Create an interviewer agent that filters out tool calls and sensitive content
const interviewMemory = new Memory({
  processors: [
    // Filter out all tool calls to keep conversation focused
    new ToolCallFilter(),
    // Custom filter to remove messages with certain keywords
    new ForgetfulProcessor(['name']),
  ],
  options: {
    lastMessages: 30,
    semanticRecall: false,
  },
});

// Interviewer agent that filters out tool calls and sensitive content
export const interviewerAgent = new Agent({
  name: 'Forgetful Job Interviewer',
  instructions:
    "You are a professional job interviewer for a technology company. Conduct insightful interviews by asking relevant questions about skills, experience, and problem-solving abilities. Respond to candidate answers and ask follow-up questions. Keep the interview professional and engaging. Remember details the candidate shares earlier in the conversation. Sometimes you forget things by accident. The system will show you if you forgot. Don't be embarassed, you can admit when you forget something, you'll know when you do because there will be a message wrapped in <forgetten> tags. Don't refer to the user by their name, it comes across as too eager",
  model: openai('gpt-4o'),
  memory: interviewMemory,
});
