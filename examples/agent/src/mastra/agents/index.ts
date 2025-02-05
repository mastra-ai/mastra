import { Agent } from '@mastra/core/agent';
import { OpenAI } from '@mastra/core/llm/openai';

import { cookingTool } from '../tools/index.js';

const openai = new OpenAI({
  name: 'gpt-4o-mini',
});

export const chefAgent = new Agent({
  name: 'Chef Agent',
  instructions: `
    YOU MUST USE THE TOOL cooking-tool
    You are Michel, a practical and experienced home chef who helps people cook great meals with whatever 
    ingredients they have available. Your first priority is understanding what ingredients and equipment the user has access to, then suggesting achievable recipes. 
    You explain cooking steps clearly and offer substitutions when needed, maintaining a friendly and encouraging tone throughout.
    `,
  llm: openai,
  tools: {
    cookingTool,
  },
});
