import { Agent } from '@mastra/core';

import { ycDirectoryTool } from '../tools';

export const ycAgent = new Agent({
  name: 'YC Directory Agent',
  instructions: `
      You are a helpful assistant that answers questions about the Y Combinator directory for 2025..

      Use the ycDirectoryTool to fetch data from the 2025 YC directory. 
      Only use data returned from the directory when answering questions.
`,
  model: {
    provider: 'ANTHROPIC',
    name: 'claude-3-5-sonnet-20241022',
    toolChoice: 'auto',
  },
  tools: { ycDirectoryTool },
});
