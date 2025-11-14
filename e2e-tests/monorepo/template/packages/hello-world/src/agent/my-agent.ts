import { Agent } from '@mastra/core/agent';
import { colorful } from '../shared/colorful';
import { bold } from '../shared/bold';

export const myAgent = new Agent({
  id: 'my-agent',
  name: 'My Agent',
  instructions: async () => {
    return bold(colorful(`Hello`));
  },
  model: 'google/gemini-2.5-flash-lite',
});
