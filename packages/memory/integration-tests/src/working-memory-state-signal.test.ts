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
  variant = 'default',
  template,
  schema,
}: {
  useStateSignals: boolean;
  dbPath: string;
  variant?: string;
  template?: string;
  schema?: any;
}): Promise<Memory> {
  const workingMemory: any = {
    enabled: true,
    scope: 'resource',
    useStateSignals,
  };
  if (schema) {
    workingMemory.schema = schema;
  } else {
    workingMemory.template = template ?? TEMPLATE;
  }
  return new Memory({
    storage: new LibSQLStore({
      id: `wm-state-signal-${useStateSignals ? 'on' : 'off'}-${variant}`,
      url: `file:${dbPath}/store-${useStateSignals ? 'on' : 'off'}-${variant}.db`,
    }),
    options: { workingMemory },
  });
}

describe('Working memory via state signals (opt-in)', () => {
  let dbPath: string;

  beforeAll(async () => {
    dbPath = await mkdtemp(join(tmpdir(), `wm-state-signal-`));
  });

  afterAll(async () => {
    await rm(dbPath, { recursive: true, force: true }).catch(() => {});
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

      // Seed working memory so the processor has something to broadcast.
      await memory.updateWorkingMemory({
        threadId: thread.id,
        resourceId: 'resource-round-trip',
        workingMemory: '# User Profile\n- Name: Caleb',
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

      // Seed working memory so the processor has something to broadcast.
      await memory.updateWorkingMemory({
        threadId: thread.id,
        resourceId: 'resource-reinject',
        workingMemory: '# User Profile\n- Name: Caleb',
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
    it('keeps setWorkingMemory tool-invocation parts after agent.stream completes (useStateSignals: true)', async () => {
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
                  toolName: 'setWorkingMemory',
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
        instructions: 'Use setWorkingMemory when learning new facts.',
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

      // With useStateSignals: true the tool is registered under the `setWorkingMemory`
      // wire name, so legacy `updateWorkingMemory` strip filters skip it and the
      // tool-call part persists as a normal audit trail (Studio UI tool-call cards
      // survive a page refresh).
      const wmCallParts = persisted.flatMap((m: any) =>
        Array.isArray(m.content?.parts)
          ? m.content.parts.filter(
              (p: any) => p?.type === 'tool-invocation' && p.toolInvocation?.toolName === 'setWorkingMemory',
            )
          : [],
      );

      expect(wmCallParts.length).toBeGreaterThanOrEqual(1);

      // Thread metadata should track the working-memory state signal lifecycle.
      const refreshedThread = await memory.getThreadById({ threadId });
      const tracking = (refreshedThread?.metadata as any)?.mastra?.stateSignals?.['working-memory'];
      expect(tracking).toBeDefined();
      expect(tracking?.currentMode).toBe('snapshot');

      // The WorkingMemoryStateProcessor should have emitted a snapshot signal during
      // the agent run, and it should be persisted as a state signal row.
      const wmStateSignals = persisted.filter((m: any) => {
        if (m.role !== 'signal') return false;
        const signal = m.content?.metadata?.signal;
        return signal?.type === 'state' && signal?.metadata?.state?.id === 'working-memory';
      });
      expect(wmStateSignals.length).toBeGreaterThanOrEqual(1);
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

  describe('Memory.saveMessages direct (covers network agents and other write paths)', () => {
    const buildAssistantMessage = (threadId: string, resourceId: string, toolName: string) => ({
      id: 'asst-1',
      role: 'assistant' as const,
      threadId,
      resourceId,
      createdAt: new Date(),
      content: {
        format: 2 as const,
        content: '',
        parts: [
          {
            type: 'tool-invocation' as const,
            toolInvocation: {
              state: 'result' as const,
              toolCallId: 'wm-1',
              toolName,
              args: { memory: '# User\n- name: Caleb' },
              result: { success: true },
            },
          },
          { type: 'text' as const, text: 'Saved.' },
        ],
      },
    });

    it('preserves setWorkingMemory tool-invocation parts when useStateSignals: true', async () => {
      const memory = await createMemory({ useStateSignals: true, dbPath });
      const threadId = 'thread-direct-save-signals';
      const resourceId = 'resource-direct-save-signals';
      await memory.createThread({ threadId, resourceId });

      await memory.saveMessages({
        messages: [buildAssistantMessage(threadId, resourceId, 'setWorkingMemory')],
      });

      const { messages: persisted } = await memory.recall({ threadId, resourceId, perPage: 50 });
      const wmCallParts = persisted.flatMap((m: any) =>
        Array.isArray(m.content?.parts)
          ? m.content.parts.filter(
              (p: any) => p?.type === 'tool-invocation' && p.toolInvocation?.toolName === 'setWorkingMemory',
            )
          : [],
      );

      expect(wmCallParts.length).toBeGreaterThanOrEqual(1);
    });

    it('strips updateWorkingMemory tool-invocation parts when useStateSignals is omitted (default behavior preserved)', async () => {
      const memory = await createMemory({ useStateSignals: false, dbPath });
      const threadId = 'thread-direct-save-default';
      const resourceId = 'resource-direct-save-default';
      await memory.createThread({ threadId, resourceId });

      await memory.saveMessages({
        messages: [buildAssistantMessage(threadId, resourceId, 'updateWorkingMemory')],
      });

      const { messages: persisted } = await memory.recall({ threadId, resourceId, perPage: 50 });
      const wmCallParts = persisted.flatMap((m: any) =>
        Array.isArray(m.content?.parts)
          ? m.content.parts.filter(
              (p: any) => p?.type === 'tool-invocation' && p.toolInvocation?.toolName === 'updateWorkingMemory',
            )
          : [],
      );

      expect(wmCallParts.length).toBe(0);
    });
  });

  describe('incremental delta value anchor', () => {
    it('diffs against the most recently emitted value (B->C), not the last full snapshot (A->C)', async () => {
      const memory = await createMemory({ useStateSignals: true, dbPath, variant: 'value-anchor' });
      const thread = await memory.createThread({
        threadId: 'thread-value-anchor',
        resourceId: 'resource-value-anchor',
      });

      const processors = await memory.getInputProcessors();
      const wm = processors.find(p => p.id === WORKING_MEMORY_STATE_PROCESSOR_ID) as {
        computeStateSignal: (args: any) => Promise<any>;
      };

      // Seed with a fat-enough template so the size guard allows the delta path.
      const longHeader = '# User Profile\n' + Array.from({ length: 20 }, (_, i) => `- field${i}: value${i}`).join('\n');
      const stateA = `${longHeader}\n- current: alpha`;
      await memory.updateWorkingMemory({
        threadId: thread.id,
        resourceId: 'resource-value-anchor',
        workingMemory: stateA,
      });

      const baseArgs = {
        stepNumber: 0,
        steps: [],
        state: {},
        resourceId: 'resource-value-anchor',
        threadId: thread.id,
        activeStateSignals: [],
        contextWindow: { hasSnapshot: true },
        deltasSinceSnapshot: [],
      };

      // Turn 1: emit snapshot A.
      const snapA = await wm.computeStateSignal({ ...baseArgs, lastSnapshot: undefined, tracking: undefined });
      expect(snapA.mode).toBe('snapshot');
      expect(snapA.value).toBe(stateA.trim());

      // Turn 2: write B, expect delta computed against snapshot A.
      const stateB = `${longHeader}\n- current: beta`;
      await memory.updateWorkingMemory({
        threadId: thread.id,
        resourceId: 'resource-value-anchor',
        workingMemory: stateB,
      });
      const lastSnapshotAB = {
        contents: snapA.contents,
        metadata: { value: snapA.value },
      };
      const deltaB = await wm.computeStateSignal({
        ...baseArgs,
        lastSnapshot: lastSnapshotAB,
        tracking: {
          currentCacheKey: snapA.cacheKey,
          currentMode: 'snapshot',
          version: 1,
          lastSignalId: 's-1',
          lastSnapshotSignalId: 's-1',
          updatedAt: new Date().toISOString(),
          activeCopies: [],
        },
      });
      expect(deltaB.mode).toBe('delta');
      expect(deltaB.value).toBe(stateB.trim());
      // The diff body should reference the alpha->beta swap.
      expect(deltaB.contents).toContain('-- current: alpha');
      expect(deltaB.contents).toContain('+- current: beta');

      // Turn 3: write C. If the anchor were the stale snapshot A, the diff would
      // reference alpha. The new behavior should anchor on B's value, so only
      // the beta->gamma hunk should appear.
      const stateC = `${longHeader}\n- current: gamma`;
      await memory.updateWorkingMemory({
        threadId: thread.id,
        resourceId: 'resource-value-anchor',
        workingMemory: stateC,
      });
      const deltaC = await wm.computeStateSignal({
        ...baseArgs,
        lastSnapshot: lastSnapshotAB,
        deltasSinceSnapshot: [
          {
            contents: deltaB.contents,
            metadata: { value: deltaB.value },
          },
        ],
        tracking: {
          currentCacheKey: deltaB.cacheKey,
          currentMode: 'delta',
          version: 2,
          lastSignalId: 's-2',
          lastSnapshotSignalId: 's-1',
          updatedAt: new Date().toISOString(),
          activeCopies: [],
        },
      });
      expect(deltaC.mode).toBe('delta');
      expect(deltaC.value).toBe(stateC.trim());
      // Incremental: should reference beta -> gamma, NOT alpha -> gamma.
      expect(deltaC.contents).toContain('-- current: beta');
      expect(deltaC.contents).toContain('+- current: gamma');
      expect(deltaC.contents).not.toContain('alpha');
    });
  });

  describe('schema mode (JSON-backed working memory)', () => {
    const schema = {
      _def: { typeName: 'ZodObject' },
      shape: () => ({}),
      // Minimal duck-typed schema; Memory only checks for presence to switch modes.
    } as any;

    it('always emits snapshot mode (never delta) for schema-backed working memory', async () => {
      // Schema mode: gate delta off, payloads are JSON strings.
      const memory = new Memory({
        storage: new LibSQLStore({
          id: 'wm-state-signal-schema',
          url: `file:${dbPath}/store-schema.db`,
        }),
        options: {
          workingMemory: {
            enabled: true,
            scope: 'resource',
            useStateSignals: true,
            schema,
          },
        },
      });

      const thread = await memory.createThread({
        threadId: 'thread-schema',
        resourceId: 'resource-schema',
      });

      // Seed JSON-backed working memory.
      await memory.updateWorkingMemory({
        threadId: thread.id,
        resourceId: 'resource-schema',
        workingMemory: JSON.stringify({ name: 'Caleb', favoriteColor: 'orange' }),
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
        resourceId: 'resource-schema',
        threadId: thread.id,
        activeStateSignals: [],
        contextWindow: { hasSnapshot: true },
        deltasSinceSnapshot: [],
      };

      const first = await wm.computeStateSignal({ ...baseArgs, lastSnapshot: undefined, tracking: undefined });
      expect(first).toBeDefined();
      expect(first.mode).toBe('snapshot');
      // Contents and value should be the JSON-serialized payload.
      expect(typeof first.contents).toBe('string');
      const parsed = JSON.parse(first.contents as string);
      expect(parsed.name).toBe('Caleb');
      expect(parsed.favoriteColor).toBe('orange');
      expect(first.value).toBe(first.contents);

      // Update the JSON payload and re-run with a prior snapshot. Even though
      // the value changed, schema mode must always return a snapshot - never a
      // delta - because unified-diff doesn't make sense for opaque JSON blobs.
      await memory.updateWorkingMemory({
        threadId: thread.id,
        resourceId: 'resource-schema',
        workingMemory: JSON.stringify({ name: 'Caleb', favoriteColor: 'purple' }),
      });
      const second = await wm.computeStateSignal({
        ...baseArgs,
        lastSnapshot: { contents: first.contents, metadata: { value: first.value } },
        tracking: {
          currentCacheKey: first.cacheKey,
          currentMode: 'snapshot',
          version: 1,
          lastSignalId: 's-1',
          lastSnapshotSignalId: 's-1',
          updatedAt: new Date().toISOString(),
          activeCopies: [],
        },
      });
      expect(second.mode).toBe('snapshot');
      expect(second.cacheKey).not.toBe(first.cacheKey);
      const parsed2 = JSON.parse(second.contents as string);
      expect(parsed2.favoriteColor).toBe('purple');
    });
  });
});
