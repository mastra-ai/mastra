import { Agent } from '@mastra/core';

import { integrations } from '../integrations';
import * as tools from '../tools';

export const agentOne = new Agent<typeof tools, typeof integrations>({
  name: 'Agent One',
  instructions: 'You know about basketball, specifically the NBA. You are a sports analyst.',
  model: {
    provider: 'ANTHROPIC_VERCEL',
    name: 'claude-3-haiku-20240307',
    toolChoice: 'auto',
  },
  enabledTools: {
    issuesList: true,
    reposListForUser: true,
    testTool: true,
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

agentOne.text({
  messages: [],
});
