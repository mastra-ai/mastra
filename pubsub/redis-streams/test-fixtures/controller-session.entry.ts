/**
 * One process of a two-process AgentController deploy: an AgentController on a
 * shared LibSQL file and RedisStreamsPubSub, driven over stdin.
 *
 * Commands (one JSON object per line):
 *   { "cmd": "send", "threadId": "...", "content": "...", "blockAfterMs"?: 2500 }
 * `blockAfterMs` busies the event loop right after the send settles, like a
 * CPU-bound request handled by the same process.
 * Each send opens (or reuses) a session on that thread and reports how
 * `sendMessage` settled: { "type": "sent", "threadId", "ms", "outcome", "error"? }.
 */
import { createInterface } from 'node:readline';

import { createOpenAI } from '@ai-sdk/openai-v5';
import { Agent } from '@mastra/core/agent';
import { AgentController } from '@mastra/core/agent-controller';
import { LibSQLStore } from '@mastra/libsql';

import { RedisStreamsPubSub } from '../src/index';

const emit = (event: Record<string, unknown>) => process.stdout.write(`${JSON.stringify(event)}\n`);

const openai = createOpenAI({ apiKey: 'test', baseURL: `${process.env.LLM_URL!.replace(/\/+$/, '')}/v1` });
const pubsub = new RedisStreamsPubSub({
  url: process.env.REDIS_URL!,
  keyPrefix: process.env.KEY_PREFIX!,
  blockMs: 200,
});
const agent = new Agent({ id: 'agent', name: 'agent', instructions: 'Reply briefly.', model: openai('gpt-4o-mini') });
const controller = new AgentController({
  id: 'controller',
  storage: new LibSQLStore({ id: `storage-${process.env.NODE_NAME}`, url: process.env.STORAGE_URL! }),
  pubsub,
  resourceId: 'resource',
  modes: [{ id: 'default', name: 'Default', default: true, agent }],
});
await controller.init();

const sessions = new Map<string, Awaited<ReturnType<AgentController['createSession']>>>();

createInterface({ input: process.stdin }).on('line', async line => {
  const command = JSON.parse(line) as { cmd: string; threadId: string; content: string; blockAfterMs?: number };
  if (command.cmd !== 'send') return;
  let session = sessions.get(command.threadId);
  if (!session) {
    session = await controller.createSession({
      id: `${process.env.NODE_NAME}-${command.threadId}`,
      ownerId: 'owner',
      threadId: command.threadId,
    });
    sessions.set(command.threadId, session);
  }
  const start = Date.now();
  try {
    await session.sendMessage({ content: command.content });
    emit({ type: 'sent', threadId: command.threadId, ms: Date.now() - start, outcome: 'resolved' });
    const until = Date.now() + (command.blockAfterMs ?? 0);
    while (Date.now() < until) {}
  } catch (error) {
    emit({
      type: 'sent',
      threadId: command.threadId,
      ms: Date.now() - start,
      outcome: 'rejected',
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

emit({ type: 'ready' });
