import { randomUUID } from 'node:crypto';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { Agent } from '@mastra/core/agent';
import type { MastraDBMessage } from '@mastra/core/agent';
import { LibSQLStore, LibSQLVector } from '@mastra/libsql';
import { Memory } from '@mastra/memory';
import { describe, expect, it, beforeEach } from 'vitest';
import { mockEmbedder } from './worker/mock-embedder';

const resourceId = 'test-resource-metadata-filter';

function createThread(id: string, metadata: Record<string, unknown>) {
  const now = new Date();
  return {
    id,
    resourceId,
    title: id,
    metadata,
    createdAt: now,
    updatedAt: now,
  };
}

function createMessage(threadId: string, text: string, role: 'user' | 'assistant' = 'user'): MastraDBMessage {
  return {
    id: randomUUID(),
    threadId,
    resourceId,
    role,
    content: {
      format: 2,
      parts: [{ type: 'text', text }],
    },
    createdAt: new Date(),
  };
}

function getText(message: MastraDBMessage) {
  return message.content.parts
    .filter(part => part.type === 'text')
    .map(part => part.text)
    .join(' ');
}

describe('Semantic recall with metadata filtering', () => {
  let memory: Memory;

  beforeEach(async () => {
    const dbPath = join(await mkdtemp(join(tmpdir(), 'memory-metadata-filter-test-')), 'test.db');

    const storage = new LibSQLStore({
      id: randomUUID(),
      url: `file:${dbPath}`,
    });
    const vector = new LibSQLVector({
      id: randomUUID(),
      url: `file:${dbPath}`,
    });

    memory = new Memory({
      options: {
        lastMessages: 0,
        semanticRecall: {
          topK: 10,
          messageRange: 0,
          scope: 'resource',
        },
      },
      storage,
      vector,
      embedder: mockEmbedder,
    });
  });

  it('filters semantic recall by thread metadata', async () => {
    await memory.saveThread({ thread: createThread('thread-project-a', { projectId: 'project-a' }) });
    await memory.saveThread({ thread: createThread('thread-project-b', { projectId: 'project-b' }) });

    await memory.saveMessages({
      messages: [
        createMessage('thread-project-a', 'Cats sleep for many hours each day'),
        createMessage('thread-project-a', 'Cats use body language to communicate', 'assistant'),
        createMessage('thread-project-b', 'Dogs need daily walks and training'),
        createMessage('thread-project-b', 'Dogs are social pack animals', 'assistant'),
      ],
    });

    const result = await memory.recall({
      threadId: 'new-thread',
      resourceId,
      vectorSearchString: 'animal behavior',
      threadConfig: {
        semanticRecall: {
          topK: 10,
          messageRange: 0,
          scope: 'resource',
          filter: { projectId: { $eq: 'project-a' } },
        },
      },
    });

    const recalledText = result.messages.map(getText).join('\n');
    expect(recalledText).toContain('Cats');
    expect(recalledText).not.toContain('Dogs');
  });

  it('combines metadata filters with resource scope', async () => {
    await memory.saveThread({ thread: createThread('work-thread', { projectId: 'project-a', category: 'work' }) });
    await memory.saveThread({
      thread: createThread('personal-thread', { projectId: 'project-a', category: 'personal' }),
    });
    await memory.saveThread({
      thread: createThread('other-resource-thread', { projectId: 'project-a', category: 'work' }),
    });

    await memory.saveMessages({
      messages: [
        createMessage('work-thread', 'The quarterly report is ready'),
        createMessage('personal-thread', 'The grocery list includes apples'),
        {
          ...createMessage('other-resource-thread', 'The other resource report should not be recalled'),
          resourceId: 'other-resource',
        },
      ],
    });

    const result = await memory.recall({
      threadId: 'new-thread',
      resourceId,
      vectorSearchString: 'report',
      threadConfig: {
        semanticRecall: {
          topK: 10,
          messageRange: 0,
          scope: 'resource',
          filter: {
            $and: [{ projectId: { $eq: 'project-a' } }, { category: { $eq: 'work' } }],
          },
        },
      },
    });

    const recalledText = result.messages.map(getText).join('\n');
    expect(recalledText).toContain('quarterly report');
    expect(recalledText).not.toContain('grocery list');
    expect(recalledText).not.toContain('other resource');
  });
});

// Before #29352, agent runs ignored `semanticRecall.filter`: the SemanticRecall input processor
// queried with the scope filter only, and the embeddings it wrote for agent-run messages had no
// thread metadata for a filter to match. Memory.recall() already applied the filter.
describe('Semantic recall metadata filtering during agent runs (#29352)', () => {
  const usage = { inputTokens: 1, outputTokens: 1, totalTokens: 2 };

  async function setup() {
    const dbPath = join(await mkdtemp(join(tmpdir(), 'memory-metadata-filter-agent-test-')), 'test.db');
    const memory = new Memory({
      options: {
        lastMessages: 1,
        semanticRecall: { topK: 10, messageRange: 0, scope: 'resource', filter: { mode: { $eq: 'work' } } },
      },
      storage: new LibSQLStore({ id: randomUUID(), url: `file:${dbPath}` }),
      vector: new LibSQLVector({ id: randomUUID(), url: `file:${dbPath}` }),
      embedder: mockEmbedder,
    });

    const prompts: string[] = [];
    const model = new MockLanguageModelV2({
      doGenerate: async ({ prompt }) => {
        prompts.push(JSON.stringify(prompt));
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          finishReason: 'stop',
          usage,
          content: [{ type: 'text', text: 'ok' }],
          warnings: [],
        };
      },
      doStream: async ({ prompt }) => {
        prompts.push(JSON.stringify(prompt));
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'id', modelId: 'mock', timestamp: new Date(0) },
            { type: 'text-start', id: 't' },
            { type: 'text-delta', id: 't', delta: 'ok' },
            { type: 'text-end', id: 't' },
            { type: 'finish', finishReason: 'stop', usage },
          ]),
        };
      },
    });
    const agent = new Agent({ id: 'agent', name: 'agent', instructions: 'Answer briefly.', model, memory });

    await memory.saveThread({ thread: createThread('work-1', { mode: 'work' }) });
    await memory.saveThread({ thread: createThread('personal-1', { mode: 'personal' }) });
    await memory.saveThread({ thread: createThread('work-2', { mode: 'work' }) });

    return { memory, agent, prompts };
  }

  async function run(
    agent: Agent,
    mode: 'generate' | 'stream',
    message: string,
    thread: string | { id: string; metadata: Record<string, unknown> },
  ) {
    const options = { memory: { thread, resource: resourceId } };
    if (mode === 'generate') {
      await agent.generate(message, options);
    } else {
      await (await agent.stream(message, options)).consumeStream();
    }
  }

  describe.each(['generate', 'stream'] as const)('agent.%s', mode => {
    it('leaves messages saved with Memory.saveMessages() in non-matching threads out of the prompt', async () => {
      const { memory, agent, prompts } = await setup();
      await memory.saveMessages({
        messages: [
          createMessage('work-1', 'The deploy runs on the pizza server.'),
          createMessage('personal-1', 'My favourite pizza has olives.'),
        ],
      });

      await run(agent, mode, 'Tell me about pizza.', 'work-2');

      const sent = prompts.at(-1)!;
      expect(sent).toContain('pizza server');
      expect(sent).not.toContain('olives');
    });

    it('leaves messages saved by earlier agent runs in non-matching threads out of the prompt', async () => {
      const { memory, agent, prompts } = await setup();
      await run(agent, mode, 'The deploy runs on the pizza server.', 'work-1');
      await run(agent, mode, 'My favourite pizza has olives.', 'personal-1');

      await run(agent, mode, 'Tell me about pizza.', 'work-2');

      const sent = prompts.at(-1)!;
      expect(sent).toContain('pizza server');
      expect(sent).not.toContain('olives');

      // Memory.recall() reads the same embeddings and agrees with the agent run.
      const recalled = await memory.recall({ threadId: 'work-2', resourceId, vectorSearchString: 'pizza' });
      const recalledText = recalled.messages.map(getText).join('\n');
      expect(recalledText).toContain('pizza server');
      expect(recalledText).not.toContain('olives');
    });

    it('applies the filter to a thread that an agent run creates with metadata', async () => {
      const { agent, prompts } = await setup();
      await run(agent, mode, 'The deploy runs on the pizza server.', { id: 'work-3', metadata: { mode: 'work' } });
      await run(agent, mode, 'My favourite pizza has olives.', { id: 'personal-3', metadata: { mode: 'personal' } });

      await run(agent, mode, 'Tell me about pizza.', 'work-2');

      const sent = prompts.at(-1)!;
      expect(sent).toContain('pizza server');
      expect(sent).not.toContain('olives');
    });
  });
});
