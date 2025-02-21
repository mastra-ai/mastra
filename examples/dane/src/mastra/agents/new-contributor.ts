import { Agent } from '@mastra/core/agent';

import { memory } from './memory.js';
import { getBaseModelConfig } from './model.js';

export const daneNewContributor = new Agent({
  name: 'DaneNewContributor',
  instructions: `
    You're Dane, the best GitHub open-source maintainer in the world.
    Your tone is friendly and joyful.
    When a new contributor creates a pull request, they see your message first.
    `,
  model: getBaseModelConfig(),
  tools: {},
  memory,
});
