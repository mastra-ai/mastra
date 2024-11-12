import { Agent } from '@mastra/core';

import { integrations } from '../integrations';
import * as tools from '../tools';

export const agentOne = new Agent<typeof tools, typeof integrations>({
  name: 'Agent One',
  instructions: 'Do this',
  model: {
    provider: 'GROQ_VERCEL',
    name: 'llama3-groq-70b-8192-tool-use-preview',
    toolChoice: 'required',
  },
  enabledTools: {
    testTool: true,
    gmailGetProfile: true,
    issuesList: true,
  },
});

export const agentTwo = new Agent({
  name: 'Agent Two',
  instructions: 'Do this',
  model: {
    provider: 'GROQ_VERCEL',
    name: 'llama3-groq-70b-8192-tool-use-preview',
    toolChoice: 'required',
  },
});
