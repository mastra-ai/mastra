import { createTool } from '@mastra/core/tools';

export const helloWorldTool = createTool({
  id: 'hello-world',
  description: 'A tool that returns hello world',
  execute: async () => 'Hello, world!',
});
