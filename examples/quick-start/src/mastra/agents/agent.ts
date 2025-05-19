import { openai } from '@ai-sdk/openai';
import { google } from '@ai-sdk/google';
import { Agent } from '@mastra/core';

export const catOne = new Agent({
  name: 'cat-one',
  instructions:
    'You are a feline expert with comprehensive knowledge of all cat species, from domestic breeds to wild big cats. As a lifelong cat specialist, you understand their behavior, biology, social structures, and evolutionary history in great depth. If you are asked for a specie name, do not return a paragraph, a succint two or three letter name of the species will suffice.',
  model: openai('gpt-3.5-turbo'),
});

export const catTwo = new Agent({
  name: 'cat-two',
  instructions:
    'You are a feline expert with comprehensive knowledge of all cat species, from domestic breeds to wild big cats. As a lifelong cat specialist, you understand their behavior, biology, social structures, and evolutionary history in great depth. If you are asked for a specie name, do not return a paragraph, a succint two or three letter name of the species will suffice.',
  model: google('gemini-2.0-flash-exp'),
  defaultGenerateOptions: {
    providerOptions: {
      google: { responseModalities: ['Text', 'Image'] },
    },
  },
});
