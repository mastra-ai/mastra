import { Agent } from '@mastra/core';

import { vectorQueryTool } from '../tools/vector-query';

// Create the RAG agent
export const generateAnswerAgent = new Agent({
  name: 'Generate Answer Agent',
  instructions:
    'You are a helpful assistant that answers questions about mastra based on the provided context. Keep your answers concise and relevant.',
  model: {
    provider: 'OPEN_AI',
    name: 'gpt-4o-mini',
  },
  tools: {
    vectorQueryTool,
  },
});

// Create the RAG agent with conversation awareness
export const generateAnswerAgentWithMemory = new Agent({
  name: 'RAG Agent',
  instructions: `You are a helpful assistant that answers questions about mastra based on the provided context.
Keep your answers concise and relevant.
When you receive a question, consider the conversation history to maintain context.
If a question seems to reference previous messages, use that context in your response.`,
  model: {
    provider: 'OPEN_AI',
    name: 'gpt-4o-mini',
  },
  tools: {
    vectorQueryTool,
  },
});
