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
 * same way a hostless EventedAgent does (see DurableAgent.resolveWorkflowEngine).
 *
 * A workflow that opts into the engine directly via `schedule` still gets the
 * error — see workflows/evented/storage-capability-gate.test.ts.
 */

import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createTextStreamModel } from '@internal/test-utils';
import { describe, expect, it, vi } from 'vitest';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { UnixSocketPubSub } from '../../../events/unix-socket-pubsub';
import { noopLogger } from '../../../logger/noop-logger';
import { Mastra } from '../../../mastra';
import type { WorkflowsStorage } from '../../../storage/domains/workflows/base';
import { MockStore } from '../../../storage/mock';
import { Agent } from '../../agent';
import { createDurableAgent } from '../create-durable-agent';
import { createEventedAgent } from '../create-evented-agent';

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

describe('EventedAgent on storage without atomic concurrent updates', () => {
  it('rejects shared execution without storage-backed run fencing before dispatch', async () => {
    const pubsub = new UnixSocketPubSub(join(tmpdir(), `fencing-${randomUUID()}.sock`));
    const storage = new MockStore();
    vi.spyOn(storage.stores.workflows, 'supportsRunFencing').mockReturnValue(false);
    try {
      expect(
        () => new Mastra({ storage, pubsub, agents: { agent: buildEventedAgent('unfenced') }, logger: false }),
      ).toThrow(/shared evented execution requires storage-backed run fencing/);
    } finally {
      await pubsub.close();
    }
  });

  it('rejects an asynchronously unsupported fencing backend before workflow dispatch', async () => {
    const pubsub = new UnixSocketPubSub(join(tmpdir(), `async-fencing-${randomUUID()}.sock`));
    const storage = new MockStore();
    const workflows: WorkflowsStorage = storage.stores.workflows;
    vi.spyOn(workflows, 'supportsRunFencing').mockResolvedValue(false);
    const agent = buildEventedAgent('async-unfenced');
    const mastra = new Mastra({ storage, pubsub, agents: { agent }, logger: false });
    const publish = vi.spyOn(pubsub, 'publish');
    try {
      const { output, cleanup } = await agent.stream('Hi');
      try {
        await expect(output.text).rejects.toThrow(/shared evented execution requires storage-backed run fencing/);
        expect(publish.mock.calls.some(([topic]) => topic === 'workflows')).toBe(false);
      } finally {
        await cleanup();
      }
    } finally {
      await mastra.shutdown();
      await pubsub.close();
    }
  });

  it('rejects a private agent transport on a shared evented host', async () => {
    const pubsub = new UnixSocketPubSub(join(tmpdir(), `mixed-bus-${randomUUID()}.sock`));
    const agent = createEventedAgent({
      agent: new Agent({
        id: 'private-bus',
        name: 'private-bus',
        instructions: 'Say hello',
        model: createTextStreamModel('hello'),
        pubsub: new EventEmitterPubSub(),
      }),
    });
    try {
      expect(() => new Mastra({ storage: new MockStore(), pubsub, agents: { agent }, logger: false })).toThrow(
        /same pubsub transport/,
      );
    } finally {
      await pubsub.close();
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
