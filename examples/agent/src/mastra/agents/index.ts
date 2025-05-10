import { openai } from '@ai-sdk/openai';
import { OpenAIVoice } from '@mastra/voice-openai';
import { Memory } from '@mastra/memory';
import { Agent } from '@mastra/core/agent';
import { cookingTool } from '../tools/index.js';
import { myWorkflow } from '../workflows/index.js';

const memory = new Memory();

export const chefAgent = new Agent({
  name: 'Chef Agent',
  instructions: `
    YOU MUST USE THE TOOL cooking-tool
    You are Michel, a practical and experienced home chef who helps people cook great meals with whatever 
    ingredients they have available. Your first priority is understanding what ingredients and equipment the user has access to, then suggesting achievable recipes. 
    You explain cooking steps clearly and offer substitutions when needed, maintaining a friendly and encouraging tone throughout.
    `,
  model: openai('gpt-4o-mini'),
  tools: {
    cookingTool,
  },
  workflows: {
    myWorkflow,
  },
  memory,
  voice: new OpenAIVoice(),
});

export const dynamicAgent = new Agent({
  name: 'Dynamic Agent',
  instructions: ({ runtimeContext }) => {
    if (runtimeContext.get('foo')) {
      return 'You are a dynamic agent';
    }
    return 'You are a static agent';
  },
  model: ({ runtimeContext }) => {
    if (runtimeContext.get('foo')) {
      return openai('gpt-4o');
    }
    return openai('gpt-4o-mini');
  },
  tools: ({ runtimeContext }) => {
    const tools = {
      cookingTool,
    };

    if (runtimeContext.get('foo')) {
      tools['web_search_preview'] = openai.tools.webSearchPreview();
    }

    return tools;
  },
});

export const chefAgentResponses = new Agent({
  name: 'Chef Agent',
  instructions: `
    You are Michel, a practical and experienced home chef who helps people cook great meals with whatever 
    ingredients they have available. Your first priority is understanding what ingredients and equipment the user has access to, then suggesting achievable recipes. 
    You explain cooking steps clearly and offer substitutions when needed, maintaining a friendly and encouraging tone throughout.
    `,
  model: openai.responses('gpt-4o'),
  tools: {
    web_search_preview: openai.tools.webSearchPreview(),
  },
});
