import { afterEach, describe, expect, it, vi } from 'vitest';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { Mastra } from '../../../mastra';
import { RequestContext } from '../../../request-context';
import { InMemoryStore } from '../../../storage';
import type { SuspendOptions } from '../../../workflows/step';
import {
  DurableExecutionFenceError,
  EXECUTION_SUPERSEDED_ERROR_ID,
  EXECUTION_UNVERIFIED_ERROR_ID,
  ExecutionFence,
  __resetExecutionFencesForTests,
  assertExecutionOwned,
  resolveLeaseProvider,
  setExecutionClaim,
} from '../execution-fence';
import { bridgeBackgroundSuspend } from '../workflows/steps/tool-call';

const agentId = 'bg-suspend-agent';
const runId = 'bg-suspend-run';
const details = { agentId, runId, executionId: 'bg-suspend-execution' };
const payload = { awaiting: 'analyst-approval', topic: 'solana' };
const options: SuspendOptions = { resumeSchema: undefined };

const pubsubs: EventEmitterPubSub[] = [];

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(pubsubs.splice(0).map(pubsub => pubsub.close()));
});

describe('bridgeBackgroundSuspend (#30182)', () => {
  it.each([EXECUTION_UNVERIFIED_ERROR_ID, EXECUTION_SUPERSEDED_ERROR_ID] as const)(
    'still suspends the task when the settled origin run rejects with %s',
    async errorId => {
      const originSuspend = vi.fn(async () => {
        throw new DurableExecutionFenceError(errorId, details);
      });
      const taskSuspend = vi.fn(async () => undefined);
      const onOriginLost = vi.fn();

      await expect(
        bridgeBackgroundSuspend({ originSuspend, taskSuspend, onOriginLost, data: payload, options }),
      ).resolves.toBeUndefined();

      expect(originSuspend).toHaveBeenCalledWith(payload, options);
      expect(taskSuspend).toHaveBeenCalledWith(payload, options);
      expect(onOriginLost).toHaveBeenCalledTimes(1);
      expect(onOriginLost.mock.calls[0]![0]).toMatchObject({ id: errorId });
    },
  );

  it('still suspends the task when the ownership check of a released run rejects', async () => {
    const storage = new InMemoryStore();
    const workflows = storage.stores.workflows!;
    const pubsub = new EventEmitterPubSub();
    pubsubs.push(pubsub);
    const mastra = new Mastra({ storage, pubsub, logger: false });
    const fence = await ExecutionFence.claim({
      agentId,
      runId,
      leaseProvider: resolveLeaseProvider(pubsub),
      workflowsStore: workflows,
      mode: 'acquire',
    });
    const requestContext = new RequestContext();
    setExecutionClaim(requestContext, runId, fence.claim);
    await workflows.releaseRunOwnership({ runId, ownerId: fence.executionId, generation: fence.generation! });
    // Drop the local fence so the check has to consult ownership remotely, as it
    // does once the settling execution released the run.
    __resetExecutionFencesForTests();

    const taskSuspend = vi.fn(async () => undefined);
    const onOriginLost = vi.fn();
    await expect(
      bridgeBackgroundSuspend({
        originSuspend: () => assertExecutionOwned({ agentId, runId, mastra, requestContext }),
        taskSuspend,
        onOriginLost,
        data: payload,
      }),
    ).resolves.toBeUndefined();

    expect(onOriginLost.mock.calls[0]![0]).toMatchObject({ id: EXECUTION_UNVERIFIED_ERROR_ID });
    expect(taskSuspend).toHaveBeenCalledWith(payload, undefined);
  });

  it('still suspends the task when the fence error arrives wrapped in a cause chain', async () => {
    const fenceError = new DurableExecutionFenceError(EXECUTION_SUPERSEDED_ERROR_ID, details);
    const originSuspend = vi.fn(async () => {
      throw new Error('save queue rejected the write', { cause: fenceError });
    });
    const taskSuspend = vi.fn(async () => 'suspended');

    await expect(bridgeBackgroundSuspend({ originSuspend, taskSuspend, data: payload })).resolves.toBe('suspended');
    expect(taskSuspend).toHaveBeenCalledWith(payload, undefined);
  });

  it('rethrows a non-fence failure instead of pretending the task suspended', async () => {
    const failure = new Error('tool wiring is broken');
    const originSuspend = vi.fn(async () => {
      throw failure;
    });
    const taskSuspend = vi.fn(async () => undefined);
    const onOriginLost = vi.fn();

    await expect(bridgeBackgroundSuspend({ originSuspend, taskSuspend, onOriginLost, data: payload })).rejects.toBe(
      failure,
    );

    expect(taskSuspend).not.toHaveBeenCalled();
    expect(onOriginLost).not.toHaveBeenCalled();
  });

  it('runs the origin run bookkeeping before the task suspension while the run is live', async () => {
    const order: string[] = [];
    const originSuspend = vi.fn(async () => {
      order.push('origin');
    });
    const taskSuspend = vi.fn(async () => {
      order.push('task');
    });

    await bridgeBackgroundSuspend({ originSuspend, taskSuspend, data: payload, options });

    expect(order).toEqual(['origin', 'task']);
  });

  it('suspends the task when the origin run exposes no suspend callback', async () => {
    const taskSuspend = vi.fn(async () => undefined);

    await bridgeBackgroundSuspend({ taskSuspend, data: payload, options });

    expect(taskSuspend).toHaveBeenCalledWith(payload, options);
  });

  it('resolves without a task suspend callback', async () => {
    const originSuspend = vi.fn(async () => undefined);

    await expect(bridgeBackgroundSuspend({ originSuspend, data: payload })).resolves.toBeUndefined();
    expect(originSuspend).toHaveBeenCalledWith(payload, undefined);
  });
});
