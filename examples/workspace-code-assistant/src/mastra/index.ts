import { Mastra } from '@mastra/core/mastra';
import { codeAssistantAgent } from './agents';

export const mastra = new Mastra({
  agents: { codeAssistantAgent },
});
