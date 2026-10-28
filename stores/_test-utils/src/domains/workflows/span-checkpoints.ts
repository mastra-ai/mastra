import { randomUUID } from 'node:crypto';
import { SpanType } from '@mastra/core/observability';
import type { SpanSnapshot } from '@mastra/core/observability';
import type { MastraCompositeStore } from '@mastra/core/storage';
import type { WorkflowRunState } from '@mastra/core/workflows';
import { afterEach, describe, expect, it } from 'vitest';

const checkpointKey = (span: { traceId: string; id: string }) => `${span.traceId}:${span.id}`;

/** Durable cancellation must see every sibling and cannot reopen completed executions. */
export function createWorkflowSpanCheckpointTests(createStorage: () => Promise<MastraCompositeStore>) {
  describe('workflow span checkpoints', () => {
    let storage: MastraCompositeStore;
    afterEach(async () => {
      await storage?.close();
    });
    async function setup() {
      storage = await createStorage();
      const store = (await storage.getStore('workflows'))!;
      expect(store.supportsWorkflowSpanSnapshots()).toBe(true);
      const runId = randomUUID();
      const key = { workflowName: 'checkpoint-workflow', runId };
      const snapshot: WorkflowRunState = {
        runId,
        status: 'running',
        context: {},
        value: {},
        activePaths: [],
        activeStepsPath: {},
        suspendedPaths: {},
        resumeLabels: {},
        waitingPaths: {},
        serializedStepGraph: [],
        timestamp: Date.now(),
      };
      await store.persistWorkflowSnapshot({ ...key, snapshot });
      const span = (id: string): SpanSnapshot<SpanType.WORKFLOW_STEP> => ({
        id,
        traceId: runId.replaceAll('-', ''),
        name: id,
        type: SpanType.WORKFLOW_STEP,
        startTime: new Date(),
        isEvent: false,
        isRootSpan: false,
        outcome: null,
      });
      const write = (value: SpanSnapshot<SpanType.WORKFLOW_STEP>) => {
        const opts = {
          status: 'running' as const,
          expectedStatus: 'running' as const,
          tracingSpans: { [checkpointKey(value)]: value },
        };
        return store.updateWorkflowState({ ...key, opts });
      };
      const read = async () =>
        JSON.parse(JSON.stringify(await store.loadWorkflowSnapshot(key))) as WorkflowRunState & {
          tracingSpans?: Record<string, SpanSnapshot<SpanType.WORKFLOW_STEP>>;
        };
      return { store, key, snapshot, span, write, read };
    }
    it('retains concurrently started siblings for cancellation handoff', async () => {
      const { span, write, read, store, key, snapshot } = await setup();
      const siblings = Array.from({ length: 20 }, (_, index) => span(`branch-${index}`));
      await Promise.all(siblings.flatMap(value => [write(value), store.persistWorkflowSnapshot({ ...key, snapshot })]));
      expect((await read()).tracingSpans).toEqual(
        JSON.parse(JSON.stringify(Object.fromEntries(siblings.map(value => [checkpointKey(value), value])))),
      );
    });
    it('retains the current execution root across stale snapshots and independent resume lineage', async () => {
      const { store, key, snapshot, span, read } = await setup();
      const first = { ...span('first-root'), type: SpanType.WORKFLOW_RUN };
      const next = { ...span('resumed-root'), type: SpanType.WORKFLOW_RUN };
      const identity = (value: typeof first) => ({ traceId: value.traceId, spanId: value.id });
      await store.updateWorkflowState({
        ...key,
        opts: {
          status: 'running',
          executionSpan: identity(first),
          tracingSpans: { [checkpointKey(first)]: first },
        },
      });
      const stale = await read();
      await Promise.all([
        store.updateWorkflowState({
          ...key,
          opts: {
            status: 'running',
            executionSpan: identity(next),
            tracingSpans: { [checkpointKey(next)]: next },
          },
        }),
        ...Array.from({ length: 20 }, () => store.persistWorkflowSnapshot({ ...key, snapshot: stale })),
      ]);
      await store.persistWorkflowSnapshot({ ...key, snapshot });
      await store.updateWorkflowState({ ...key, opts: { status: 'suspended', tracingContext: identity(first) } });
      expect(await read()).toMatchObject({ executionSpan: identity(next), tracingContext: identity(first) });
    });
    it('isolates persisted checkpoints from caller-owned snapshot objects', async () => {
      const { span, write, read } = await setup();
      const original = span('isolated');
      await write(original);
      original.name = 'changed after persistence';
      expect((await read()).tracingSpans?.[checkpointKey(original)]?.name).toBe('isolated');
    });
    it('keeps a completed execution when late starts or conflicting completions arrive', async () => {
      const { span, write, read } = await setup();
      const started = span('completed');
      const completed = { ...started, endTime: new Date(), outcome: 'success' as const, stopReason: null };
      await write(started);
      await write(completed);
      await write(started);
      await write({ ...completed, outcome: 'error', stopReason: 'runtime_error' });
      expect((await read()).tracingSpans?.[checkpointKey(completed)]).toEqual(JSON.parse(JSON.stringify(completed)));
    });
    it('keeps equal span IDs in different execution traces independent', async () => {
      const { span, write, read } = await setup();
      const first = span('same-id');
      const second = { ...first, traceId: randomUUID().replaceAll('-', '') };
      await write(first);
      await write(second);
      expect((await read()).tracingSpans).toEqual(
        JSON.parse(JSON.stringify({ [checkpointKey(first)]: first, [checkpointKey(second)]: second })),
      );
    });
    it('rejects mismatched span identities without changing stored checkpoints', async () => {
      const { store, key, span, write, read } = await setup();
      const original = span('identity');
      await write(original);
      await expect(
        store.updateWorkflowState({
          ...key,
          opts: {
            status: 'running',
            tracingSpans: { wrong: original },
          },
        }),
      ).rejects.toThrow();
      expect((await read()).tracingSpans).toEqual(JSON.parse(JSON.stringify({ [checkpointKey(original)]: original })));
    });
    it('preserves checkpoints across stale full snapshots and rejects updates after cancellation', async () => {
      const { store, key, snapshot, span, write, read } = await setup();
      const active = span('active');
      await write(active);
      await store.persistWorkflowSnapshot({ ...key, snapshot });
      expect((await read()).tracingSpans?.[checkpointKey(active)]).toEqual(JSON.parse(JSON.stringify(active)));
      await store.updateWorkflowState({ ...key, opts: { status: 'canceled', expectedStatus: 'running' } });
      expect(await write(span('late'))).toBeUndefined();
      expect(await read()).toMatchObject({
        status: 'canceled',
        tracingSpans: { [checkpointKey(active)]: { outcome: null } },
      });
      expect((await read()).tracingSpans?.[checkpointKey(span('late'))]).toBeUndefined();
    });
  });
}
