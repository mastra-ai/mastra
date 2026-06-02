import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { LibSQLStore } from '@mastra/libsql';
import { Memory, WORKING_MEMORY_STATE_PROCESSOR_ID } from '@mastra/memory';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * Storage-backed integration tests for the opt-in working memory state-signal path.
 *
 * These tests run against a real LibSQL store (the same backend used by other
 * memory integration tests) and exercise:
 *   1. Default path unchanged: `useStateSignals: false` keeps the system-message
 *      delivery and does NOT auto-attach the state-signal processor.
 *   2. Opt-in path: `useStateSignals: true` suppresses the system message and
 *      auto-attaches the `WorkingMemoryStateProcessor`.
 *   3. Tool round-trip: writing through `updateWorkingMemory` produces a new
 *      `cacheKey` on the next `computeStateSignal` call.
 *   4. Dedup: consecutive `computeStateSignal` calls with no store write return
 *      `undefined` when the snapshot is still in the context window.
 */

const TEMPLATE = `# User
- name:
- location:`;

async function createMemory({
  useStateSignals,
  dbPath,
}: {
  useStateSignals: boolean;
  dbPath: string;
}): Promise<Memory> {
  return new Memory({
    storage: new LibSQLStore({
      id: `wm-state-signal-${useStateSignals ? 'on' : 'off'}`,
      url: `file:${dbPath}/store-${useStateSignals ? 'on' : 'off'}.db`,
    }),
    options: {
      workingMemory: {
        enabled: true,
        template: TEMPLATE,
        scope: 'resource',
        useStateSignals,
      },
    },
  });
}

describe('Working memory via state signals (opt-in)', () => {
  let dbPath: string;

  beforeAll(async () => {
    dbPath = await mkdtemp(join(tmpdir(), `wm-state-signal-`));
  });

  afterAll(async () => {
    await rm(dbPath, { recursive: true, force: true });
  });

  describe('default path (useStateSignals: false)', () => {
    it('still renders working memory as a system message', async () => {
      const memory = await createMemory({ useStateSignals: false, dbPath });
      const thread = await memory.createThread({
        threadId: 'thread-default',
        resourceId: 'resource-default',
      });

      const systemMessage = await memory.getSystemMessage({
        threadId: thread.id,
        resourceId: 'resource-default',
      });

      expect(systemMessage).not.toBeNull();
      expect(systemMessage).toContain('<working_memory_template>');
      expect(systemMessage).toContain('# User');
    });

    it('does not auto-attach the working-memory-state processor', async () => {
      const memory = await createMemory({ useStateSignals: false, dbPath });
      const processors = await memory.getInputProcessors();
      expect(processors.some(p => p.id === WORKING_MEMORY_STATE_PROCESSOR_ID)).toBe(false);
    });
  });

  describe('opt-in path (useStateSignals: true)', () => {
    it('suppresses the working-memory system message', async () => {
      const memory = await createMemory({ useStateSignals: true, dbPath });
      const thread = await memory.createThread({
        threadId: 'thread-opt-in',
        resourceId: 'resource-opt-in',
      });

      const systemMessage = await memory.getSystemMessage({
        threadId: thread.id,
        resourceId: 'resource-opt-in',
      });

      expect(systemMessage).toBeNull();
    });

    it('auto-attaches the working-memory-state processor', async () => {
      const memory = await createMemory({ useStateSignals: true, dbPath });
      const processors = await memory.getInputProcessors();
      const wm = processors.find(p => p.id === WORKING_MEMORY_STATE_PROCESSOR_ID);
      expect(wm).toBeDefined();
      expect((wm as { stateId?: string }).stateId).toBe('working-memory');
      expect(typeof (wm as { computeStateSignal?: unknown }).computeStateSignal).toBe('function');
    });

    it('does not auto-attach when a user-supplied processor with the same id is already configured', async () => {
      const memory = await createMemory({ useStateSignals: true, dbPath });
      // Build a stub processor with the same id to simulate user-supplied config.
      const userSupplied = { id: WORKING_MEMORY_STATE_PROCESSOR_ID, name: 'user-supplied' } as any;
      const processors = await memory.getInputProcessors([userSupplied]);
      // `getInputProcessors` returns the processors Memory itself attaches — it should
      // skip auto-attach when the caller already supplies one with the matching id.
      expect(processors.some(p => p.id === WORKING_MEMORY_STATE_PROCESSOR_ID)).toBe(false);
    });
  });

  describe('storage round-trip via the processor', () => {
    it('emits a snapshot signal, dedups when unchanged, then re-emits after a tool write', async () => {
      const memory = await createMemory({ useStateSignals: true, dbPath });
      const thread = await memory.createThread({
        threadId: 'thread-round-trip',
        resourceId: 'resource-round-trip',
      });

      const processors = await memory.getInputProcessors();
      const wm = processors.find(p => p.id === WORKING_MEMORY_STATE_PROCESSOR_ID) as {
        computeStateSignal: (args: any) => Promise<any>;
      };
      expect(wm).toBeDefined();

      const baseArgs = {
        stepNumber: 0,
        steps: [],
        state: {},
        resourceId: 'resource-round-trip',
        threadId: thread.id,
        activeStateSignals: [],
        contextWindow: { hasSnapshot: false },
        lastSnapshot: undefined,
        deltasSinceSnapshot: [],
        tracking: undefined,
      };

      // First call: emit a snapshot.
      const first = await wm.computeStateSignal(baseArgs);
      expect(first).toBeDefined();
      expect(first.id).toBe('working-memory');
      expect(first.mode).toBe('snapshot');
      expect(first.tagName).toBe('working-memory');
      expect(first.attributes?.scope).toBe('resource');
      const firstCacheKey = first.cacheKey;

      // Second call with identical state and snapshot still in context: dedup.
      const second = await wm.computeStateSignal({
        ...baseArgs,
        tracking: {
          currentCacheKey: firstCacheKey,
          currentMode: 'snapshot',
          version: 1,
          lastSignalId: 'state:working-memory:1',
          lastSnapshotSignalId: 'state:working-memory:1',
          updatedAt: new Date().toISOString(),
          activeCopies: [],
        },
        contextWindow: { hasSnapshot: true },
        lastSnapshot: {},
      });
      expect(second).toBeUndefined();

      // Simulate a tool write by calling updateWorkingMemory directly.
      await memory.updateWorkingMemory({
        threadId: thread.id,
        resourceId: 'resource-round-trip',
        workingMemory: '# User\n- name: Ada\n- location: London',
        memoryConfig: undefined,
      });

      // Third call: cacheKey should change, fresh snapshot emitted.
      const third = await wm.computeStateSignal({
        ...baseArgs,
        tracking: {
          currentCacheKey: firstCacheKey,
          currentMode: 'snapshot',
          version: 1,
          lastSignalId: 'state:working-memory:1',
          lastSnapshotSignalId: 'state:working-memory:1',
          updatedAt: new Date().toISOString(),
          activeCopies: [],
        },
        contextWindow: { hasSnapshot: true },
        lastSnapshot: {},
      });
      expect(third).toBeDefined();
      expect(third.mode).toBe('snapshot');
      expect(third.cacheKey).not.toBe(firstCacheKey);
      expect(third.contents).toContain('Ada');
      expect(third.contents).toContain('London');
    });

    it('re-injects the snapshot when it has dropped out of the context window', async () => {
      const memory = await createMemory({ useStateSignals: true, dbPath });
      const thread = await memory.createThread({
        threadId: 'thread-reinject',
        resourceId: 'resource-reinject',
      });

      const processors = await memory.getInputProcessors();
      const wm = processors.find(p => p.id === WORKING_MEMORY_STATE_PROCESSOR_ID) as {
        computeStateSignal: (args: any) => Promise<any>;
      };

      const baseArgs = {
        stepNumber: 0,
        steps: [],
        state: {},
        resourceId: 'resource-reinject',
        threadId: thread.id,
        activeStateSignals: [],
        contextWindow: { hasSnapshot: false },
        lastSnapshot: undefined,
        deltasSinceSnapshot: [],
        tracking: undefined,
      };

      const first = await wm.computeStateSignal(baseArgs);
      expect(first).toBeDefined();
      const cacheKey = first.cacheKey;

      // Snapshot evicted from window — should re-inject even though cacheKey matches.
      const reinjected = await wm.computeStateSignal({
        ...baseArgs,
        tracking: {
          currentCacheKey: cacheKey,
          currentMode: 'snapshot',
          version: 1,
          lastSignalId: 'state:working-memory:1',
          lastSnapshotSignalId: 'state:working-memory:1',
          updatedAt: new Date().toISOString(),
          activeCopies: [],
        },
        contextWindow: { hasSnapshot: false },
        lastSnapshot: {},
      });
      expect(reinjected).toBeDefined();
      expect(reinjected.cacheKey).toBe(cacheKey);
      expect(reinjected.mode).toBe('snapshot');
    });
  });

  describe('agent stream end-to-end (the path Studio hits)', () => {
    it('keeps updateWorkingMemory tool-invocation parts after agent.stream completes', async () => {
      const { MockLanguageModelV2, convertArrayToReadableStream } = await import('@internal/ai-sdk-v5/test');
      const { Agent } = await import('@mastra/core/agent');

      const memory = await createMemory({ useStateSignals: true, dbPath });
      const threadId = 'thread-agent-stream';
      const resourceId = 'resource-agent-stream';

      // Two-step model: step 1 emits an updateWorkingMemory tool call; step 2 emits text.
      let streamCallCount = 0;
      const model = new MockLanguageModelV2({
        doStream: async () => {
          streamCallCount++;
          if (streamCallCount === 1) {
            return {
              stream: convertArrayToReadableStream([
                { type: 'stream-start', warnings: [] },
                { type: 'response-metadata', id: 'r-1', modelId: 'mock', timestamp: new Date() },
                {
                  type: 'tool-call',
                  toolCallId: 'wm-call-1',
                  toolName: 'updateWorkingMemory',
                  input: JSON.stringify({ memory: '# User\n- name: Caleb\n- color: orange' }),
                },
                {
                  type: 'finish',
                  finishReason: 'tool-calls',
                  usage: { inputTokens: 10, outputTokens: 10, totalTokens: 20 },
                },
              ]),
              rawCall: { rawPrompt: null, rawSettings: {} },
              warnings: [],
            };
          }
          return {
            stream: convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              { type: 'response-metadata', id: 'r-2', modelId: 'mock', timestamp: new Date() },
              { type: 'text-start', id: 't-1' },
              { type: 'text-delta', id: 't-1', delta: 'Got it.' },
              { type: 'text-end', id: 't-1' },
              {
                type: 'finish',
                finishReason: 'stop',
                usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
              },
            ]),
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
          };
        },
      });

      const agent = new Agent({
        id: 'wm-state-signal-stream-agent',
        name: 'WM State Signal Stream Agent',
        instructions: 'Use updateWorkingMemory when learning new facts.',
        model: model as any,
        memory,
      });

      const stream = await (agent as any).stream('Hi, I am Caleb, my favorite color is orange.', {
        memory: { thread: threadId, resource: resourceId },
        maxSteps: 3,
      });
      // Drain the stream.
      for await (const _chunk of stream.fullStream) {
        // drain
      }

      const { messages: persisted } = await memory.recall({
        threadId,
        resourceId,
        perPage: 50,
      });

      const wmCallParts = persisted.flatMap((m: any) =>
        Array.isArray(m.content?.parts)
          ? m.content.parts.filter(
              (p: any) => p?.type === 'tool-invocation' && p.toolInvocation?.toolName === 'updateWorkingMemory',
            )
          : [],
      );

      // This is the regression we're locking in: in default behavior, this would
      // be 0 (stripped). With useStateSignals: true, the tool-invocation part is
      // preserved so the Studio UI tool-call card survives a page refresh.
      expect(wmCallParts.length).toBeGreaterThanOrEqual(1);
    });

    it('strips updateWorkingMemory tool-invocation parts on agent.stream with useStateSignals: false (default behavior preserved)', async () => {
      const { MockLanguageModelV2, convertArrayToReadableStream } = await import('@internal/ai-sdk-v5/test');
      const { Agent } = await import('@mastra/core/agent');

      const memory = await createMemory({ useStateSignals: false, dbPath });
      const threadId = 'thread-agent-stream-default';
      const resourceId = 'resource-agent-stream-default';

      let streamCallCount = 0;
      const model = new MockLanguageModelV2({
        doStream: async () => {
          streamCallCount++;
          if (streamCallCount === 1) {
            return {
              stream: convertArrayToReadableStream([
                { type: 'stream-start', warnings: [] },
                { type: 'response-metadata', id: 'r-1', modelId: 'mock', timestamp: new Date() },
                {
                  type: 'tool-call',
                  toolCallId: 'wm-call-1',
                  toolName: 'updateWorkingMemory',
                  input: JSON.stringify({ memory: '# User\n- name: Caleb' }),
                },
                {
                  type: 'finish',
                  finishReason: 'tool-calls',
                  usage: { inputTokens: 10, outputTokens: 10, totalTokens: 20 },
                },
              ]),
              rawCall: { rawPrompt: null, rawSettings: {} },
              warnings: [],
            };
          }
          return {
            stream: convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              { type: 'response-metadata', id: 'r-2', modelId: 'mock', timestamp: new Date() },
              { type: 'text-start', id: 't-1' },
              { type: 'text-delta', id: 't-1', delta: 'Got it.' },
              { type: 'text-end', id: 't-1' },
              {
                type: 'finish',
                finishReason: 'stop',
                usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
              },
            ]),
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
          };
        },
      });

      const agent = new Agent({
        id: 'wm-default-stream-agent',
        name: 'WM Default Stream Agent',
        instructions: 'Use updateWorkingMemory when learning new facts.',
        model: model as any,
        memory,
      });

      const stream = await (agent as any).stream('Hi, I am Caleb.', {
        memory: { thread: threadId, resource: resourceId },
        maxSteps: 3,
      });
      for await (const _ of stream.fullStream) {
        void _;
      }

      const { messages: persisted } = await memory.recall({
        threadId,
        resourceId,
        perPage: 50,
      });

      const wmCallParts = persisted.flatMap((m: any) =>
        Array.isArray(m.content?.parts)
          ? m.content.parts.filter(
              (p: any) => p?.type === 'tool-invocation' && p.toolInvocation?.toolName === 'updateWorkingMemory',
            )
          : [],
      );

      // Default behavior: stripped.
      expect(wmCallParts.length).toBe(0);
    });
  });
});
