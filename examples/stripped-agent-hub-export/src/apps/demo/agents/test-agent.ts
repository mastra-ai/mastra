import {Agent} from '@mastra/core/agent';
import {getGpt4oModel} from '../../../core/models';
import {createStorage} from '../../../core/storage';
import {Memory} from '@mastra/memory';

const ROOT_AGENT_PROMPT = `
You are a helpful assistant who can answer questions about science.
`;

export const scienceChatAgent = new Agent({
  name: 'Science Chat Agent',
  instructions: ROOT_AGENT_PROMPT,
  model: getGpt4oModel(),
  memory: new Memory({
    storage: createStorage('science_chat'),
  }),
  tools: {},
});
