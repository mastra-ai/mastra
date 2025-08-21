import { createTool } from '@mastra/core/tools';
import { HELLO_WORLD } from './constants';

export const helloWorldTool = createTool({
  id: 'hello-world',
  description: 'A tool that returns hello world',
  execute: async () => HELLO_WORLD,
});
