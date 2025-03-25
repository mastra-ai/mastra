import { Agent } from '@mastra/core/agent';
// import { helloWorldTool } from '@inner/inner-tools';

export const innerAgent = new Agent({
  name: 'inner-agent',
  instructions: 'You are a helpful assistant',
  // tools: [helloWorldTool],
});
