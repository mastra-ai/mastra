import { Agent } from '@mastra/core';

import { graphRagTool } from '../tools';

export const whitePaperAgent = new Agent({
  name: 'Whitepaper Agent',
  instructions: `
      You are a helpful whitepaper assistant that receives a whitepaper and creates a podcast summary of the whitepaper.

      You will receive a whitepaper do the following:
      1. Extract the text from the whitepaper
      2. Analyze the text
      3. Create a podcast summary of the whitepaper
      4. Add audio to the podcast summary

      Please make sure to include as much detail as possible, while being concise.
`,
  model: {
    provider: 'OPEN_AI',
    name: 'gpt-4o',
    toolChoice: 'auto',
  },
  tools: { graphRagTool },
});
