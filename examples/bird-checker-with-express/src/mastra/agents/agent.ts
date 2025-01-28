import { Agent } from '@mastra/core/agent';

export const birdCheckerAgent = new Agent({
  name: 'Bird checker',
  instructions:
    'You can view an image and figure out if it is a bird or not. You can also figure out the species of the bird and where the picture was taken.',
  model: {
    provider: 'ANTHROPIC',
    name: 'claude-3-haiku-20240307',
    toolChoice: 'auto',
  },
});
