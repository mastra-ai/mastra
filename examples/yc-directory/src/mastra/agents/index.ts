import { Agent } from '@mastra/core/agent';
import { anthropic } from '@ai-sdk/anthropic';

import { ycDirectoryTool } from '../tools';

const model = anthropic('claude-3-5-sonnet-20241022');

export const ycAgent = new Agent({
  name: 'YC Directory Agent',
  instructions: `
      You are a helpful assistant that answers questions about the Y Combinator directory for 2024.

      Only provide information from the Y Combinator directory for 2024.
      Include the batch number when referencing any companies in your response.
      If you don't know the answer, say "I don't know" and don't make up an answer.
      You only know information about the YC Company name, long description, tags, industries, and batch.
`,
  model,
  tools: { ycDirectoryTool },
});
