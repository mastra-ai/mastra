import { getErrorFromUnknown } from '../../error';
import type { Event } from '../../events/types';
import type { Mastra } from '../../mastra';
import { createRunScopeKey } from '../../mastra/run-scope';
import { unwrapMastraTracingProxy } from '../../observability/context';
import { RequestContext } from '../../request-context';
import { matchesRunFence } from '../../storage/run-fencing';
import { agentThreadStreamRuntime } from '../thread-stream-runtime';
import { DURABLE_STOP_WHEN_ERROR_ID, DurableStepIds } from './constants';
import {
  DURABLE_PARTICIPANT_FENCES,
  assertExecutionOwned,
  ExecutionFence,
  getExecutionClaim,
  isExecutionFenceError,
  MASTRA_DURABLE_EXECUTIONS_KEY,
} from './execution-fence';
import { emitErrorEvent } from './stream-adapter';

type Participant = { fence: Promise<ExecutionFence | undefined>; stop: (interrupt?: boolean) => Promise<void> };
const PARTICIPANTS = createRunScopeKey<Map<string, Participant>>('durable-evented-execution-participants');
const participantStops = new WeakMap<Mastra, Set<Participant['stop']>>();

function isRootTerminal(event: Event): boolean {
  return (
    event.data?.workflowId === DurableStepIds.AGENTIC_LOOP &&
    !event.data?.parentWorkflow &&
    !event.data?.perStep &&
    ['workflow.end', 'workflow.fail', 'workflow.suspend'].includes(event.type)
  );
}

/** Stop local renewal without changing the shared claim or broadcasting workflow cancellation. */
export async function stopDurableExecutionParticipants(mastra: Mastra): Promise<void> {
  await Promise.allSettled([...(participantStops.get(unwrapMastraTracingProxy(mastra)) ?? [])].map(stop => stop(true)));
}

/** Keep the original claim alive across deliveries until its root settles or ownership is lost. */
export async function participateInDurableExecution<T>(
  mastra: Mastra,
  event: Event,
  execute: () => Promise<T>,
): Promise<T> {
  const context = new RequestContext<unknown>(Object.entries(event.data?.requestContext ?? {}));
  const claims = context.getRaw(MASTRA_DURABLE_EXECUTIONS_KEY);
  const releases: (() => void)[] = [];
  let invoke = execute;
  try {
    for (const runId of Object.keys(claims ?? {})) {
      const claim = getExecutionClaim(context, runId);
      if (!claim?.agentId) continue;
      const scope = mastra.__createRunScope(runId);
      releases.push(() => mastra.__releaseRunScope(runId));
      let participants = scope.get(PARTICIPANTS);
      if (!participants) scope.set(PARTICIPANTS, (participants = new Map()));
      let participant = participants.get(claim.executionId);
      if (!participant) {
        // Hold a reference across broker handoff gaps, not just while an invocation is active.
        mastra.__createRunScope(runId);
        const owner = unwrapMastraTracingProxy(mastra);
        let stops = participantStops.get(owner);
        if (!stops) participantStops.set(owner, (stops = new Set()));
        let stopped = false;
        let unsubscribeLoss: (() => void) | undefined;
        const current: Participant = {
          fence: Promise.resolve(undefined),
          stop: async (interrupt = false) => {
            if (stopped) return;
            stopped = true;
            unsubscribeLoss?.();
            stops.delete(current.stop);
            if (participants.get(claim.executionId) === current) participants.delete(claim.executionId);
            void current.fence.then(
              fence => {
                scope.get(DURABLE_PARTICIPANT_FENCES)?.delete(claim.executionId);
                if (interrupt) fence?.interruptParticipant();
                else fence?.stopHeartbeat();
              },
              () => {},
            );
            mastra.__releaseRunScope(runId);
          },
        };
        current.fence = (async () => {
          try {
            const fence = await ExecutionFence.follow(mastra, runId, claim);
            if (fence) {
              let fences = scope.get(DURABLE_PARTICIPANT_FENCES);
              if (!fences) scope.set(DURABLE_PARTICIPANT_FENCES, (fences = new Map()));
              fences.set(claim.executionId, fence);
              unsubscribeLoss = fence.onLost(() => {
                void current
                  .stop()
                  .catch(error => mastra.getLogger()?.warn('Failed to detach durable participant', { runId, error }));
              });
            }
            return fence;
          } catch (error) {
            await current.stop();
            throw error;
          }
        })();
        stops.add(current.stop);
        participants.set(claim.executionId, current);
        participant = current;
      }
      const fence = await participant.fence;
      if (fence) {
        await fence.verify();
        fence.coverNestedRun(runId, event.runId);
        const next = invoke;
        invoke = () => fence.run(next);
      }
    }
    return await invoke();
  } finally {
    for (const release of releases) release();
  }
}

/** Retry only conditional cleanup after a terminal delivery released its claim before broker acknowledgement. */
export async function retrySettledDurableExecution(mastra: Mastra, event: Event): Promise<boolean> {
  if (!isRootTerminal(event)) return false;
  const context = new RequestContext<unknown>(Object.entries(event.data?.requestContext ?? {}));
  const claim = getExecutionClaim(context, event.runId);
  if (claim?.generation === undefined) return false;
  const record = await (await mastra.getStorage()?.getStore('workflows'))?.getRunOwnership({ runId: event.runId });
  if (
    !record ||
    record.leaseExpiresAt !== null ||
    !matchesRunFence(record, {
      runId: event.runId,
      ownerId: claim.executionId,
      generation: claim.generation,
    })
  )
    return false;
  await settleEventedDurableExecution(mastra, event);
  return true;
}

/** Called only after the root terminal handler has persisted and published its outcome. */
export async function settleEventedDurableExecution(mastra: Mastra, event: Event): Promise<void> {
  if (!isRootTerminal(event)) return;
  const context = new RequestContext<unknown>(Object.entries(event.data?.requestContext ?? {}));
  const claim = getExecutionClaim(context, event.runId);
  if (!claim) return;
  const failure = event.data?.prevResult?.error;
  if (isExecutionFenceError(failure)) return;
  const store = await mastra.getStorage()?.getStore('workflows');
  const fence =
    claim.generation === undefined
      ? undefined
      : {
          runId: event.runId,
          ownerId: claim.executionId,
          generation: claim.generation,
        };
  let released = false;
  if (fence) {
    const record = await store?.getRunOwnership({ runId: event.runId });
    if (!record || !matchesRunFence(record, fence)) return;
    released = record.leaseExpiresAt === null;
  } else if (claim.agentId) {
    await assertExecutionOwned({ mastra, runId: event.runId, agentId: claim.agentId, requestContext: context });
  }
  if (event.type === 'workflow.fail' && !released) {
    const error = getErrorFromUnknown(failure ?? 'Workflow execution failed');
    const delivery =
      failure?.code === DURABLE_STOP_WHEN_ERROR_ID || failure?.id === DURABLE_STOP_WHEN_ERROR_ID ? 'reject' : undefined;
    await emitErrorEvent(mastra.pubsub, event.runId, error, claim.generation, delivery);
  }
  // Storage-backed deletes are fenced; lease-only stores retain their existing best-effort write guarantees.
  if (event.type !== 'workflow.suspend') {
    for (const workflowName of [DurableStepIds.AGENTIC_LOOP, DurableStepIds.AGENTIC_EXECUTION]) {
      await store?.deleteWorkflowRunById({ runId: event.runId, workflowName, fence });
    }
  }
  // Keep the released generation as the retry barrier before dropping the thread token.
  await ExecutionFence.releaseSharedClaim(mastra, event.runId, claim);
  if (claim.threadId && event.type !== 'workflow.suspend') {
    await agentThreadStreamRuntime.releaseDurableThreadLease(
      mastra.pubsub,
      event.runId,
      claim.threadId,
      claim.resourceId,
      claim.generation,
      claim.executionId,
    );
  }
  if (claim.memoryFenced && fence) await (await mastra.getStorage()?.getStore('memory'))?.retireRunFence(fence);
  await mastra.__getRunScope(event.runId)?.get(PARTICIPANTS)?.get(claim.executionId)?.stop();
}
