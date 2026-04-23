import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Agent } from '@mastra/core/agent';
import { fastembed } from '@mastra/fastembed';
import { LibSQLStore, LibSQLVector } from '@mastra/libsql';
import { Memory } from '@mastra/memory';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  assertCreatedAtMonotonic,
  assertToolInvocationBeforeFinalText,
  assertUniqueMessageIds,
  createOmOrderingMockModel,
  createOmOrderingMockObserverModel,
  createOmOrderingMockReflectorModel,
  getMessageText,
  messageHasToolInvocation,
  OM_14745_POST_SEAL_ASSISTANT_ID,
  OM_14745_POST_SEAL_TEXT,
  OM_14745_PRE_SEAL_ASSISTANT_ID,
  OM_14745_TOOL_CALL_ID,
  omOrderingTestTool,
  runOm14745RotationScenario,
} from './shared/om-libsql-ordering';
import { getResuableTests, StorageType } from './shared/reusable-tests';

describe('Memory with LibSQL Integration', () => {
  let dbStoragePath: string;
  let memory: Memory;

  const memoryOptions = {
    lastMessages: 10,
    semanticRecall: {
      topK: 3,
      messageRange: 2,
    },
    generateTitle: false,
  };

  beforeAll(async () => {
    dbStoragePath = await mkdtemp(join(tmpdir(), `memory-test-`));

    memory = new Memory({
      storage: new LibSQLStore({
        url: `file:${join(dbStoragePath, 'test.db')}`,
        id: randomUUID(),
      }),
      vector: new LibSQLVector({
        url: 'file:libsql-test.db',
        id: randomUUID(),
      }),
      embedder: fastembed,
      options: memoryOptions,
    });
  });

  afterAll(async () => {
    await rm(dbStoragePath, { recursive: true });
  });

  getResuableTests(() => {
    return {
      memory,
      workerTestConfig: {
        storageTypeForWorker: StorageType.LibSQL,
        storageConfigForWorker: { url: `file:${join(dbStoragePath, 'libsql-test.db')}`, id: randomUUID() },
        memoryOptionsForWorker: memoryOptions,
        vectorConfigForWorker: {
          url: 'file:libsql-test.db',
          id: randomUUID(),
        },
      },
    };
  });

  describe('lastMessages should return newest messages, not oldest', () => {
    it('should return the LAST N messages when using lastMessages config without explicit orderBy', async () => {
      const memoryWithLimit = new Memory({
        storage: new LibSQLStore({
          url: 'file:libsql-test.db',
          id: randomUUID(),
        }),
        embedder: fastembed.small,
        options: {
          lastMessages: 3,
        },
      });

      const threadId = randomUUID();
      const resourceId = randomUUID();

      await memoryWithLimit.createThread({
        threadId,
        resourceId,
      });

      const messages = [];
      const baseTime = Date.now();
      for (let i = 1; i <= 10; i++) {
        messages.push({
          id: randomUUID(),
          threadId,
          resourceId,
          content: {
            format: 2,
            parts: [{ type: 'text', text: `Message ${i}` }],
          },
          role: 'user' as const,
          createdAt: new Date(baseTime + i * 1000),
        });
      }

      await memoryWithLimit.saveMessages({ messages });

      const result = await memoryWithLimit.recall({
        threadId,
        resourceId,
      });

      expect(result.messages).toHaveLength(3);

      const contents = result.messages.map(m => {
        if (typeof m.content === 'string') return m.content;
        if (m.content?.parts?.[0]?.text) return m.content.parts[0].text;
        if (m.content?.content) return m.content.content;
        return '';
      });

      expect(contents).toContain('Message 8');
      expect(contents).toContain('Message 9');
      expect(contents).toContain('Message 10');
      expect(contents).not.toContain('Message 1');
      expect(contents).not.toContain('Message 2');
      expect(contents).not.toContain('Message 3');
      expect(contents[0]).toBe('Message 8');
      expect(contents[1]).toBe('Message 9');
      expect(contents[2]).toBe('Message 10');
    });
  });

  /**
   * Observational Memory + LibSQL: persisted message order after multi-step agent.generate.
   * Without bufferTokens, tool calls may not appear as separate tool-invocation rows; with
   * bufferTokens, mid-loop observation persists tool parts — see #14745 / #14747.
   */
  describe('Observational Memory persisted ordering (LibSQL)', () => {
    let omDbPath: string;
    let omStorage: LibSQLStore;

    beforeAll(async () => {
      omDbPath = await mkdtemp(join(tmpdir(), 'memory-om-ordering-'));
      omStorage = new LibSQLStore({
        url: `file:${join(omDbPath, 'om-ordering.db')}`,
        id: randomUUID(),
      });
      await omStorage.init();
    });

    afterAll(async () => {
      await rm(omDbPath, { recursive: true });
    });

    async function listOmThreadMessages(threadId: string) {
      const memoryStore = await omStorage.getStore('memory');
      const result = await memoryStore!.listMessages({
        threadId,
        orderBy: { field: 'createdAt', direction: 'ASC' },
        perPage: false,
      });
      return result.messages;
    }

    function createOmAgent(bufferTokens: number | false) {
      const memory = new Memory({
        storage: omStorage,
        options: {
          observationalMemory: {
            enabled: true,
            observation: {
              model: createOmOrderingMockObserverModel() as any,
              messageTokens: 20,
              bufferTokens: bufferTokens === false ? false : bufferTokens,
            },
            reflection: {
              model: createOmOrderingMockReflectorModel() as any,
              observationTokens: 50000,
            },
          },
        },
      });

      return new Agent({
        id: 'libsql-om-ordering-agent',
        name: 'LibSQL OM Ordering Agent',
        instructions: 'You are a helpful assistant. Always use the test tool first.',
        model: createOmOrderingMockModel() as any,
        tools: { test: omOrderingTestTool },
        memory,
      });
    }

    it('persists user then assistant with final text; monotonic createdAt; unique ids (no bufferTokens)', async () => {
      const agent = createOmAgent(false);
      const threadId = randomUUID();

      await agent.generate('Please help me with something important.', {
        memory: { thread: threadId, resource: 'test-resource' },
      });

      const messages = await listOmThreadMessages(threadId);
      expect(messages.length).toBeGreaterThanOrEqual(2);

      const userIdx = messages.findIndex(m => m.role === 'user');
      const assistantWithAnswer = messages.findIndex(
        m => m.role === 'assistant' && getMessageText(m).includes('I understand your request'),
      );
      expect(userIdx).toBeGreaterThanOrEqual(0);
      expect(assistantWithAnswer).toBeGreaterThan(userIdx);

      assertCreatedAtMonotonic(messages);
      assertUniqueMessageIds(messages);
      assertToolInvocationBeforeFinalText(messages, 'I understand your request');
    });

    it('with bufferTokens, tool-invocation parts precede final text in storage order', async () => {
      const agent = createOmAgent(15);
      const threadId = randomUUID();

      await agent.generate('Please help me with something important.', {
        memory: { thread: threadId, resource: 'test-resource' },
      });

      const messages = await listOmThreadMessages(threadId);
      expect(messages.some(m => messageHasToolInvocation(m))).toBe(true);

      assertToolInvocationBeforeFinalText(messages, 'I understand your request');
      assertCreatedAtMonotonic(messages);
      assertUniqueMessageIds(messages);
    });

    it('second generate keeps both user messages ordered with unique ids (bufferTokens)', async () => {
      const agent = createOmAgent(15);
      const threadId = randomUUID();

      await agent.generate('First message about flights.', {
        memory: { thread: threadId, resource: 'test-resource' },
      });
      await agent.generate('Second message about hotels.', {
        memory: { thread: threadId, resource: 'test-resource' },
      });

      const messages = await listOmThreadMessages(threadId);
      const userMessages = messages.filter(m => m.role === 'user');
      const flightIdx = userMessages.findIndex(m => getMessageText(m).includes('flights'));
      const hotelIdx = userMessages.findIndex(m => getMessageText(m).includes('hotels'));
      expect(flightIdx).toBeGreaterThanOrEqual(0);
      expect(hotelIdx).toBeGreaterThanOrEqual(0);
      expect(flightIdx).toBeLessThan(hotelIdx);

      assertCreatedAtMonotonic(messages);
      assertUniqueMessageIds(messages);
    });

    it('no duplicate user rows by content after two turns (bufferTokens)', async () => {
      const agent = createOmAgent(15);
      const threadId = randomUUID();

      await agent.generate('Turn 1: search for restaurants.', {
        memory: { thread: threadId, resource: 'test-resource' },
      });
      await agent.generate('Turn 2: book a table.', {
        memory: { thread: threadId, resource: 'test-resource' },
      });

      const messages = await listOmThreadMessages(threadId);
      assertUniqueMessageIds(messages);
      const userTexts = messages.filter(m => m.role === 'user').map(m => getMessageText(m));
      expect(new Set(userTexts).size).toBe(userTexts.length);
    });

    /**
     * #14745: when async buffering seals a chunk, `onBufferChunkSealed` must rotate the active
     * response message id so the next assistant flush uses a new id. If rotation is skipped,
     * MessageList repair may assign a random split id instead — post-seal text would not persist
     * under the id returned from `rotateResponseMessageId`.
     */
    it('persists post-seal assistant text under the rotated response message id (buffer beforeBuffer + LibSQL)', async () => {
      const memoryStore = (await omStorage.getStore('memory'))!;
      const threadId = randomUUID();
      const resourceId = 'om-14745-libsql-resource';

      await runOm14745RotationScenario({
        memoryStore,
        threadId,
        resourceId,
        rotateResponseMessageId: () => OM_14745_POST_SEAL_ASSISTANT_ID,
      });

      const messages = await listOmThreadMessages(threadId);
      const postSealRow = messages.find(
        m => m.id === OM_14745_POST_SEAL_ASSISTANT_ID && getMessageText(m).includes(OM_14745_POST_SEAL_TEXT),
      );
      expect(postSealRow, 'post-seal continuation must be stored under the rotated assistant id').toBeDefined();

      const preSealRow = messages.find(m => m.id === OM_14745_PRE_SEAL_ASSISTANT_ID);
      expect(preSealRow, 'pre-seal assistant row must still exist').toBeDefined();

      const preSealToolPart = preSealRow?.content.parts.find(
        part => part.type === 'tool-invocation' && part.toolInvocation?.toolCallId === OM_14745_TOOL_CALL_ID,
      );

      expect(
        preSealToolPart?.toolInvocation?.state,
        'sealed pre-seal tool call must not be mutated after rotation',
      ).toBe('call');
      expect(getMessageText(preSealRow!)).not.toContain(OM_14745_POST_SEAL_TEXT);
    });
  });
});
