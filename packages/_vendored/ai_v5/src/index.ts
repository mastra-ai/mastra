import { generateText as generateTextV5, streamText as streamTextV5 } from 'ai';

export * from 'ai';

export const generateText: typeof generateTextV5 = options =>
  generateTextV5({
    ...options,
    allowSystemInMessages: false,
  });

export const streamText: typeof streamTextV5 = options =>
  streamTextV5({
    ...options,
    allowSystemInMessages: false,
  });
