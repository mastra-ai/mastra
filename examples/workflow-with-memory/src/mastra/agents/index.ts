import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import { PostgresStore } from '@mastra/pg';

const connectionString = process.env.POSTGRES_URL!;
const memory = new Memory({
  storage: new PostgresStore({ connectionString }),
});

export const catOne = new Agent({
  name: 'cat-one',
  memory,
  instructions:
    'You are a feline expert with comprehensive knowledge of all cat species, from domestic breeds to wild big cats. As a lifelong cat specialist, you understand their behavior, biology, social structures, and evolutionary history in great depth.',
  model: openai('gpt-4o'),
});
