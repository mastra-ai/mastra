import { ChatPromptTemplate, MessagesPlaceholder } from '@langchain/core/prompts';
import { RunnableWithMessageHistory } from '@langchain/core/runnables';
import { ChatOpenAI } from '@langchain/openai';
import { PlatformChatMessageHistory } from '@mastra/platform-memory/langchain';

// Reads MASTRA_PLATFORM_ACCESS_TOKEN and MASTRA_MEMORY_INSTANCE_ID (and MASTRA_PLATFORM_API_URL for local).
const userId = process.argv[2] ?? 'user-ada';

const prompt = ChatPromptTemplate.fromMessages([
  ['system', 'You are a helpful assistant.'],
  new MessagesPlaceholder('history'),
  ['human', '{input}'],
]);

const chain = new RunnableWithMessageHistory({
  runnable: prompt.pipe(new ChatOpenAI({ model: 'gpt-4o-mini' })),
  getMessageHistory: sessionId => new PlatformChatMessageHistory({ threadId: sessionId, resourceId: userId }),
  inputMessagesKey: 'input',
  historyMessagesKey: 'history',
});

for (const input of process.argv.slice(3).length ? process.argv.slice(3) : ['What do you remember about me?']) {
  const reply = await chain.invoke({ input }, { configurable: { sessionId: `chat:${userId}` } });
  console.log(`> ${input}\n${reply.text}\n`);
}
