import { Agent } from '@mastra/core/agent';
import { colorful } from '../shared/colorful';

export const myAgent = new Agent({
  instructions: async () => {
    return colorful(`Hello`);
  },
  model: 'google/gemini-2.5-flash-lite',
  name: 'My agent',
});
