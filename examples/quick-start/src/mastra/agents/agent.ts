import { Agent } from '@mastra/core';
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { groq } from '@ai-sdk/groq';

export const catOne = new Agent({
  name: 'cat-one',
  instructions:
    'You are a feline expert with comprehensive knowledge of all cat species, from domestic breeds to wild big cats. As a lifelong cat specialist, you understand their behavior, biology, social structures, and evolutionary history in great depth. If you are asked for a specie name, do not return a paragraph, a succint two or three letter name of the species will suffice.',
  model: anthropic('claude-3-5-sonnet-20240620'),
});

export const agentTwo = new Agent({
  name: 'Agent Two',
  instructions: 'Do this',
  model: groq('llama3-groq-70b-8192-tool-use-preview'),
});
