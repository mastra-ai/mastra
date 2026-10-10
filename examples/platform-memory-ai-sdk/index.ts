import { openai } from '@ai-sdk/openai';
import { platformMemoryMiddleware } from '@mastra/platform-memory/ai-sdk';
import { generateText, wrapLanguageModel } from 'ai';

// Reads MASTRA_PLATFORM_ACCESS_TOKEN and MASTRA_MEMORY_INSTANCE_ID (and MASTRA_PLATFORM_API_URL for local).
const userId = process.argv[2] ?? 'user-ada';
const model = wrapLanguageModel({
  model: openai('gpt-4o-mini'),
  middleware: platformMemoryMiddleware({ threadId: `chat:${userId}`, resourceId: userId }),
});

for (const prompt of process.argv.slice(3).length ? process.argv.slice(3) : ['What do you remember about me?']) {
  const { text } = await generateText({ model, prompt });
  console.log(`> ${prompt}\n${text}\n`);
}
