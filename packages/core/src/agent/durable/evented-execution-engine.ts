import { EventEmitterPubSub } from '../../events/event-emitter';
import type { PubSub } from '../../events/pubsub';
import type { IMastraLogger } from '../../logger';
import type { ShouldPersistSnapshotFn } from '../../workflows/types';
import { DurableExecutionEngine } from './execution-engine';
import type { ExecutionCompletion, ExecutionOutcome } from './execution-engine';
import { DurableExecutionFenceError, EXECUTION_UNVERIFIED_ERROR_ID } from './execution-fence';
import type { ExecutionFence } from './execution-fence';
import { defaultShouldPersistSnapshot } from './workflows/create-durable-agentic-workflow';

export class EventedExecutionEngine extends DurableExecutionEngine {
  #warnedUnfencedSharedExecution = false;
  override prepareExecution(
    pubsub: PubSub | undefined,
    fence: ExecutionFence | undefined,
    workflowEngine: 'default' | 'evented',
    logger: IMastraLogger,
    guardrailLogger: IMastraLogger | undefined,
  ): { sharedExecution: boolean; usesRunPubSub: boolean } {
    const engine = this.resolveWorkflowEngine(workflowEngine, logger);
    const sharedTransport =
      engine === 'evented' && pubsub !== undefined && !(pubsub.__rawBus() instanceof EventEmitterPubSub);
    const sharedExecution = sharedTransport && fence?.generation !== undefined;
    if (sharedTransport && !sharedExecution && !this.#warnedUnfencedSharedExecution) {
      this.#warnedUnfencedSharedExecution = true;
      guardrailLogger?.warn(
        `EventedAgent '${this.id}': shared execution without storage-backed run fencing keeps its existing ` +
          'behavior: API shutdown or loss can interrupt remote workers. Use a shared fencing-capable storage adapter ' +
          'to keep workers running independently of the API process.',
      );
    }
    return { sharedExecution, usesRunPubSub: engine === 'default' };
  }

  override finishExecution(
    runId: string,
    executionFence: ExecutionFence | undefined,
    sharedExecution: boolean,
    completion: ExecutionCompletion,
  ): ExecutionOutcome {
    if (!sharedExecution) return super.finishExecution(runId, executionFence, sharedExecution, completion);
    executionFence?.detach();
    if ('error' in completion) {
      // With no successor, only the disconnected observer can close its stream.
      if (
        completion.error instanceof DurableExecutionFenceError &&
        completion.error.id === EXECUTION_UNVERIFIED_ERROR_ID
      ) {
        return { owner: 'workers', error: completion.error };
      }
      this.mastra?.getLogger()?.warn('Evented durable observer disconnected; workers retain settlement authority', {
        runId,
        error: completion.error,
      });
    }
    return { owner: 'workers' };
  }

  override resolveShouldPersistSnapshot(_predicate?: ShouldPersistSnapshotFn): ShouldPersistSnapshotFn {
    return defaultShouldPersistSnapshot;
  }
  override warnOnRiskyPersistencePolicy(
    predicate: ShouldPersistSnapshotFn | undefined,
    guardrailLogger: IMastraLogger | undefined,
  ): void {
    if (predicate)
      guardrailLogger?.warn(
        `EventedAgent '${this.id}': ignoring the shouldPersistSnapshot option. ` +
          'The evented engine requires the full snapshot set (pending|paused|suspended|running) — ' +
          `the initial 'running' write creates the base row that suspend-merges and multi-worker coordination build on.`,
      );
  }
}
