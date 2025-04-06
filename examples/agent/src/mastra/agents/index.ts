import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { AnswerRelevancy } from '@mastra/evals/evaluators/llm';
import { cookingTool } from '../tools/index.js';

const answerRelevancy = new AnswerRelevancy({
  model: openai('gpt-4o-mini'),
});

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
  evals: {
    answerRelevancy,
  },
});

export const chefAgentResponses = new Agent({
  name: 'Chef Agent Responses',
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
