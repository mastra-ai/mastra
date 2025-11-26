import {Agent} from '@mastra/core/agent';

const ROOT_AGENT_PROMPT = `
You are a helpful assistant who can answer questions about science.
`;

export const scienceChatAgent = new Agent({
  id: 'scienceAgent',
  name: 'Science Chat Agent',
  instructions: ROOT_AGENT_PROMPT,
  model: 'openai/gpt-4o-mini',
});
