/**
 * Pins the storage-capability fallback for durable agents (COR-1410, harness T9).
 * The harness uses LibSQL with a capability override; these tests use the existing
 * MockStore supportsConcurrentUpdates spy, not real-adapter atomicity coverage.
 *
 * The evented engine advances a run from concurrent workers, so its `createRun()`
 * refuses to start on a store that cannot apply concurrent updates atomically
 * (Redis, Valkey, ClickHouse, LanceDB, Cloudflare, Elasticsearch). Durable agents
 * must not inherit that error: before the evented engine was re-enabled they ran
 * the loop in-process regardless of storage, so throwing here would turn a working
 * agent into a hard failure on upgrade. They degrade with a warning instead, the
 * same way a hostless EventedAgent does (see DurableExecutionEngine.resolveWorkflowEngine).
 *
 * A workflow that opts into the engine directly via `schedule` still gets the
 * error — see workflows/evented/storage-capability-gate.test.ts.
 */

import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createTextStreamModel } from '@internal/test-utils';
import { describe, expect, it, vi } from 'vitest';
import type { PubSub } from '../../../events';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { UnixSocketPubSub } from '../../../events/unix-socket-pubsub';
import { noopLogger } from '../../../logger/noop-logger';
import { Mastra } from '../../../mastra';
import type { WorkflowsStorage } from '../../../storage/domains/workflows/base';
import { MockStore } from '../../../storage/mock';
import { Agent } from '../../agent';
import { createDurableAgent } from '../create-durable-agent';
import { createEventedAgent } from '../create-evented-agent';
import { DurableAgent } from '../durable-agent';
import { EventedAgent } from '../evented-agent';
import { DurableExecutionEngine } from '../execution-engine';
import type { ExecutionFence } from '../execution-fence';
import type { DurableAgenticWorkflowInput } from '../types';

/**
 * Installs a capturing logger that survives Mastra's `__setLogger`, which would
 * otherwise throw on a getter-only spy. Must be installed before `new Mastra(...)`:
 * the engine resolves during agent registration, which happens before Mastra
 * installs its own logger on the wrapper.
 */
function captureWarnings(agent: unknown) {
  const warn = vi.fn();
  const logger = { ...noopLogger, warn };
  Object.defineProperty(agent, 'logger', { get: () => logger, set: () => {}, configurable: true });
  return warn;
}

function buildEventedAgent(id: string) {
  return createEventedAgent({
    agent: new Agent({
      id,
      name: id,
      instructions: 'You are a helpful assistant',
      model: createTextStreamModel('hello'),
    }),
  });
}

describe('Durable workflow run cleanup', () => {
  it.each([
    { replaced: true, status: 'success', retained: true },
    { replaced: false, status: 'success', retained: false },
    { replaced: false, status: 'suspended', retained: true },
  ])(
    'retains the registered run: $retained (replaced: $replaced, status: $status)',
    async ({ replaced, status, retained }) => {
      const agent = createDurableAgent({
        agent: new Agent({
          id: 'run-cleanup',
          name: 'Run cleanup',
          instructions: 'Answer.',
          model: createTextStreamModel('hello'),
        }),
      });
      const mastra = new Mastra({ storage: new MockStore(), agents: { agent }, logger: false });
      try {
        const workflow = agent.getWorkflow();
        const engine = new DurableExecutionEngine(agent.id, mastra);
        const runId = 'cleanup-run';
        const original = await engine.createRun(workflow, { runId });
        let current = original;
        if (replaced) {
          workflow.runs.delete(runId);
          current = await engine.createRun(workflow, { runId });
          expect(current).not.toBe(original);
        }
        engine.releaseRun(workflow, runId, original, status);
        expect(workflow.runs.get(runId)).toBe(retained ? current : undefined);
      } finally {
        await mastra.shutdown();
      }
    },
  );
});

describe('Durable workflow subclass dispatch', () => {
  it.each([
    ['durable-default', DurableAgent, 'default', 'success'],
    ['durable-evented', DurableAgent, 'evented', 'success'],
    ['evented-default', EventedAgent, 'default', undefined],
    ['evented-evented', EventedAgent, 'evented', undefined],
  ] as const)(
    'preserves %s subclass super calls and late workflow patches',
    async (kind, Base, strategy, expectedStatus) => {
      let constructed = false;
      class CustomAgent extends Base {
        executionStatuses: (string | undefined)[] = [];
        settledRuns: string[] = [];
        deletedRuns: string[] = [];
        fencedRuns: string[] = [];

        protected override fenceRunPubSub(
          fence: ExecutionFence | undefined,
          abortController: AbortController | undefined,
          pubsub: PubSub = this.pubsub,
        ): PubSub {
          if (fence) this.fencedRuns.push(fence.runId);
          return super.fenceRunPubSub(fence, abortController, pubsub);
        }

        protected override async settleExecution(
          runId: string,
          fence: ExecutionFence | undefined,
          outcome: { status?: string; error?: Error },
        ): Promise<void> {
          await super.settleExecution(runId, fence, outcome);
          this.settledRuns.push(runId);
        }

        protected override async deleteRunSnapshots(runId: string): Promise<void> {
          await super.deleteRunSnapshots(runId);
          this.deletedRuns.push(runId);
        }

        protected override get workflowEngine(): 'default' | 'evented' {
          if (!constructed) throw new Error('Execution policy read during construction');
          return strategy;
        }

        protected override createWorkflow(): never {
          throw new Error('Run reached the Agent compatibility workflow factory');
        }

        protected override resolveWorkflowEngine(): never {
          throw new Error('Run reached the Agent compatibility engine resolver');
        }

        protected override resolveShouldPersistSnapshot(): never {
          throw new Error('Run reached the Agent compatibility persistence policy');
        }

        protected override warnOnRiskyPersistencePolicy(): never {
          throw new Error('Run reached the Agent compatibility persistence warning');
        }

        protected override async ensureEngineWorkersStarted(): Promise<never> {
          throw new Error('Run reached the Agent compatibility worker startup');
        }

        protected override async executeWorkflow(runId: string, input: DurableAgenticWorkflowInput) {
          const result = await super.executeWorkflow(runId, input);
          this.executionStatuses.push(result?.status);
          return result;
        }
      }

      const agent = new CustomAgent({
        agent: new Agent({
          id: `subclass-${kind}`,
          name: `subclass-${kind}`,
          instructions: 'Say hello',
          model: createTextStreamModel('hello'),
        }),
      });
      constructed = true;
      const storage = new MockStore();
      vi.spyOn(storage.stores.workflows, 'supportsConcurrentUpdates').mockReturnValue(false);
      const mastra = new Mastra({ storage, agents: { agent }, logger: false });
      // Registration has already created the workflow. Execution must still call
      // the current Agent method rather than retain an earlier bound function.
      const getWorkflow = vi.spyOn(agent, 'getWorkflow');
      try {
        const { output, cleanup } = await agent.stream('Hi');
        try {
          await output.consumeStream();
          expect(await output.text).toBe('hello');
        } finally {
          await cleanup();
        }
        await expect.poll(() => agent.executionStatuses).toEqual([expectedStatus]);
        await expect.poll(() => agent.settledRuns).toHaveLength(1);
        expect(agent.deletedRuns).toEqual(agent.settledRuns);
        expect(agent.fencedRuns).toContain(agent.settledRuns[0]);
        expect(getWorkflow).toHaveBeenCalled();
      } finally {
        getWorkflow.mockRestore();
        await mastra.shutdown();
      }
    },
  );
});

describe('EventedAgent on storage without atomic concurrent updates', () => {
  it.each(['sync', 'async'] as const)(
    'keeps streaming with a warning when shared storage reports no fencing (%s)',
    async probe => {
      const directory = await mkdtemp(join(tmpdir(), 'fence-'));
      const pubsub = new UnixSocketPubSub(join(directory, 'bus.sock'));
      const storage = new MockStore();
      const workflows: WorkflowsStorage = storage.stores.workflows;
      const capability = vi.spyOn(workflows, 'supportsRunFencing');
      if (probe === 'async') capability.mockResolvedValue(false);
      else capability.mockReturnValue(false);
      const agent = buildEventedAgent(`unfenced-${probe}`);
      const warn = captureWarnings(agent);
      let mastra: Mastra | undefined;
      try {
        mastra = new Mastra({ storage, pubsub, agents: { agent }, logger: { ...noopLogger, warn } });
        for (let i = 0; i < 2; i++) {
          const { output, cleanup } = await agent.stream('Hi');
          try {
            await output.consumeStream();
            expect(await output.text).toBe('hello');
          } finally {
            await cleanup();
          }
        }
        const warnings = warn.mock.calls.filter(([message]) => String(message).includes('storage-backed run fencing'));
        expect(warnings).toHaveLength(1);
        expect(String(warnings[0]![0])).toMatch(/API shutdown/);
      } finally {
        await mastra?.shutdown();
        await pubsub.close();
        await rm(directory, { recursive: true, force: true });
      }
    },
  );

  it('keeps streaming with a private agent transport on a shared evented host', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'mixed-'));
    const pubsub = new UnixSocketPubSub(join(directory, 'bus.sock'));
    const agent = createEventedAgent({
      agent: new Agent({
        id: 'private-bus',
        name: 'private-bus',
        instructions: 'Say hello',
        model: createTextStreamModel('hello'),
        pubsub: new EventEmitterPubSub(),
      }),
    });
    let mastra: Mastra | undefined;
    try {
      mastra = new Mastra({ storage: new MockStore(), pubsub, agents: { agent }, logger: false });
      const { output, cleanup } = await agent.stream('Hi');
      try {
        await output.consumeStream();
        expect(await output.text).toBe('hello');
      } finally {
        await cleanup();
      }
    } finally {
      await mastra?.shutdown();
      await pubsub.close();
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('falls back to the default in-process engine with a warning and still streams', async () => {
    const agent = buildEventedAgent('non-atomic-store-agent');

    const storage = new MockStore();
    // Stand in for Redis/Valkey/ClickHouse et al. Spied before `new Mastra(...)`:
    // the engine resolves during agent registration and is memoized.
    vi.spyOn(storage.stores.workflows as any, 'supportsConcurrentUpdates').mockReturnValue(false);

    const warn = captureWarnings(agent);

    new Mastra({ storage, agents: { 'non-atomic-store-agent': agent }, logger: false });

    // The agent resolved onto the default engine rather than throwing.
    expect((agent.getWorkflow() as any).engineType).toBe('default');

    const { output, cleanup } = await agent.stream('Hi');
    try {
      await output.consumeStream();
      expect(await output.text).toBe('hello');
      const capabilityWarnings = warn.mock.calls.filter(([message]) =>
        String(message).includes('supportsConcurrentUpdates'),
      );
      expect(capabilityWarnings).toHaveLength(1);
      expect(String(capabilityWarnings[0]![0])).toMatch(/will not resume on their own/);
      expect(warn.mock.calls.filter(([message]) => String(message).includes('no Mastra host'))).toHaveLength(0);
    } finally {
      await cleanup();
    }
  }, 30_000);

  it('stays on the evented engine when the store supports atomic concurrent updates', async () => {
    const agent = buildEventedAgent('atomic-store-agent');

    const warn = captureWarnings(agent);

    new Mastra({ storage: new MockStore(), agents: { 'atomic-store-agent': agent }, logger: false });

    expect((agent.getWorkflow() as any).engineType).toBe('evented');
    const { output, cleanup } = await agent.stream('Hi');
    try {
      await output.consumeStream();
      expect(await output.text).toBe('hello');
      expect(warn.mock.calls.filter(([message]) => String(message).includes('supportsConcurrentUpdates'))).toHaveLength(
        0,
      );
      expect(warn.mock.calls.filter(([message]) => String(message).includes('no Mastra host'))).toHaveLength(0);
    } finally {
      await cleanup();
    }
  });

  it('keeps an ordinary hosted DurableAgent on the default engine without fallback warnings', async () => {
    const agent = createDurableAgent({
      agent: new Agent({
        id: 'durable-default',
        name: 'durable-default',
        instructions: 'Say hello',
        model: createTextStreamModel('hello'),
      }),
    });
    const warn = captureWarnings(agent);
    new Mastra({ storage: new MockStore(), agents: { agent }, logger: false });

    expect(agent.getWorkflow().engineType).toBe('default');
    const { output, cleanup } = await agent.stream('Hi');
    try {
      await output.consumeStream();
      expect(await output.text).toBe('hello');
      expect(warn.mock.calls.filter(([message]) => String(message).includes('supportsConcurrentUpdates'))).toHaveLength(
        0,
      );
      expect(warn.mock.calls.filter(([message]) => String(message).includes('no Mastra host'))).toHaveLength(0);
    } finally {
      await cleanup();
    }
  });
});
