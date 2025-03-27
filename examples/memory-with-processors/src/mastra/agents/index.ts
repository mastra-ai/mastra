import { openai } from '@ai-sdk/openai';
import { createTool } from '@mastra/core';
import { Agent } from '@mastra/core/agent';
import type { CoreMessage } from '@mastra/core';
import type { MessageProcessor, SharedMessageProcessorOpts } from '@mastra/core/memory';
import { Memory, TokenLimiter, ToolCallFilter } from '@mastra/memory';
import { z } from 'zod';

// Custom processor that filters out messages containing specific keywords
class KeywordFilter implements MessageProcessor {
  constructor(private keywords: string[]) {}

  process(messages: CoreMessage[], _opts: SharedMessageProcessorOpts = {}): CoreMessage[] {
    return messages.filter(message => {
      if (typeof message.content === 'string') {
        const content = message.content;
        return !this.keywords.some(keyword => content.toLowerCase().includes(keyword.toLowerCase()));
      }
      return true;
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
    semanticRecall: true,
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
    new KeywordFilter(['confidential', 'private', 'sensitive']),
  ],
  options: {
    lastMessages: 30,
    semanticRecall: {
      topK: 3,
      messageRange: { before: 2, after: 2 },
    },
  },
});

// Interviewer agent that filters out tool calls and sensitive content
export const interviewerAgent = new Agent({
  name: 'Job Interviewer',
  instructions:
    'You are a professional job interviewer for a technology company. Conduct insightful interviews by asking relevant questions about skills, experience, and problem-solving abilities. Respond to candidate answers and ask follow-up questions. Keep the interview professional and engaging. Remember details the candidate shares earlier in the conversation.',
  model: openai('gpt-4o-mini'),
  memory: interviewMemory,
});

