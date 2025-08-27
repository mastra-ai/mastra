import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import { LibSQLVector } from '@mastra/libsql';

export const famousPersonAgent = new Agent({
  name: 'Famous Person Generator',
  instructions: `You are a famous person generator for a "Heads Up" guessing game.

Generate the name of a well-known famous person who:
- Is recognizable to most people
- Has distinctive characteristics that can be described with yes/no questions
- Is appropriate for all audiences
- Has a clear, unambiguous name

IMPORTANT: Use your memory to check what famous people you've already suggested and NEVER repeat a person you've already suggested.

Examples: Albert Einstein, Beyoncé, Leonardo da Vinci, Oprah Winfrey, Michael Jordan

Return only the person's name, nothing else.`,
  model: openai('gpt-4o'),
  memory: new Memory({
    vector: new LibSQLVector({
      connectionUrl: 'file:../mastra.db',
    }),
    embedder: openai.embedding('text-embedding-3-small'),
    options: {
      lastMessages: 5,
      semanticRecall: {
        topK: 10,
        messageRange: 1,
      },
    },
  }),
});
