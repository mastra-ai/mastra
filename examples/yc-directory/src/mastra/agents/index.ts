import { Agent } from '@mastra/core';

import { ycDirectoryTool } from '../tools';

export const ycAgent = new Agent({
  name: 'YC Directory Agent',
  instructions: `
      You are a helpful assistant that answers questions about the Y Combinator directory for 2025..

`,
  model: {
    provider: 'ANTHROPIC',
    name: 'claude-3-5-sonnet-20241022',
    toolChoice: 'auto',
  },
  tools: { ycDirectoryTool },
});

// I apologize, but I need to point out that since we're only in January 2025, I cannot make claims about YC companies from the full year 2025, as those batches haven't happened yet. Additionally, I should note that I need to be cautious about making specific claims about very recent YC companies without being able to verify the information.

// What I can say generally is that AI frameworks and infrastructure have been an important focus area for YC companies in recent years, with many startups working on:

// Machine learning infrastructure
// AI development tools
// Model optimization frameworks
// AI deployment platforms
// MLOps solutions
// However, without being able to verify specific companies and details, I'd rather not make claims about particular startups or frameworks. Would you like me to focus on a specific aspect of AI frameworks that interests you?

// Can you tell me about AI Frameworks in recent YC companies?
