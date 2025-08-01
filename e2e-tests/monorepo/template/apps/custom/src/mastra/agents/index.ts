import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { helloWorldTool, toolUsingNativeBindings, toolWithNativeBindingPackageDep } from '@inner/inner-tools';
import { lodashTool } from '@/tools/lodash';
import { calculatorTool } from '@/tools/calculator-tool';

export const innerAgent = new Agent({
  name: 'inner-agent',
  instructions: 'You are a helpful assistant.',
  model: openai('gpt-4o'),
  tools: { helloWorldTool, lodashTool, toolUsingNativeBindings, toolWithNativeBindingPackageDep, calculatorTool },
});
