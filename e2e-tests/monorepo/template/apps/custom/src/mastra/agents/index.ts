import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { helloWorldTool, toolUsingNativeBindings, toolWithNativeBindingPackageDep } from '@inner/inner-tools';

export const innerAgent = new Agent({
  name: 'inner-agent',
  instructions: 'You are a helpful assistant',
  model: openai('gpt-4o'),
  tools: [helloWorldTool, toolUsingNativeBindings, toolWithNativeBindingPackageDep],
});
