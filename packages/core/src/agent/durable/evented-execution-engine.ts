import { EventEmitterPubSub } from '../../events/event-emitter';
import { createObservabilityContext } from '../../observability';
import { agentThreadStreamRuntime } from '../thread-stream-runtime';
import { DurableExecutionEngine } from './execution-engine';
import { DurableExecutionFenceError, EXECUTION_UNVERIFIED_ERROR_ID, setExecutionClaim } from './execution-fence';
import { getRunRegistryEntry } from './run-registry';
import type { DurableAgenticWorkflowInput } from './types';

export class EventedExecutionEngine extends DurableExecutionEngine {
  #warnedUnfencedSharedExecution = false;

  override async executeWorkflow(runId: string, workflowInput: DurableAgenticWorkflowInput): Promise<void> {
    // Captured now: a later resume() replaces the registry's fence before this
    // segment's background promise settles.
    const entry = getRunRegistryEntry(runId, this.host.getMastraInstance());
    const executionFence = entry?.executionFence;
    const pubsub = this.host.getMastraInstance()?.pubsub ?? this.host.getPubSub();
    const sharedTransport =
      this.host.resolveWorkflowEngine() === 'evented' &&
      pubsub !== undefined &&
      !(pubsub.__rawBus() instanceof EventEmitterPubSub);
    const sharedExecution = sharedTransport && executionFence?.generation !== undefined;
    if (entry) entry.eventedExecution = sharedExecution;
    try {
      if (sharedTransport && !sharedExecution && !this.#warnedUnfencedSharedExecution) {
        this.#warnedUnfencedSharedExecution = true;
        this.host.guardrailLogger?.warn(
          `EventedAgent '${this.host.id}': shared execution without storage-backed run fencing keeps its existing ` +
            'behavior: API shutdown or loss can interrupt remote workers. Use a shared fencing-capable storage adapter ' +
            'to keep workers running independently of the API process.',
        );
      }
      const workflow = this.host.getWorkflow();
      // The evented engine executes via pubsub events consumed by in-process
      // workers — without them `run.start()` never resolves (it waits on the
      // `workflows-finish` topic). Idempotent; a no-op when the server has
      // already booted the workers.
      await this.host.ensureEngineWorkersStarted();
      // Populate the run row's resourceId column so storage-level resource
      // filters (listSuspendedRuns / listActiveRuns) can narrow the query.
      const memoryInfo = (
        workflowInput.messageListState as { memoryInfo?: { threadId?: string; resourceId?: string } } | undefined
      )?.memoryInfo;
      const threadId = workflowInput.state?.threadId ?? memoryInfo?.threadId;
      if (sharedExecution && entry?.requestContext && executionFence && threadId) {
        await agentThreadStreamRuntime.claimDurableThreadLease(
          pubsub,
          runId,
          threadId,
          workflowInput.state?.resourceId ?? memoryInfo?.resourceId,
          executionFence.generation,
          executionFence.executionId,
        );
        setExecutionClaim(entry.requestContext, runId, {
          ...executionFence.claim,
          threadId,
          resourceId: workflowInput.state?.resourceId ?? memoryInfo?.resourceId,
        });
      }
      // Note: unlike the default engine, evented `createRun` accepts no
      // `pubsub` — the engine always publishes on `mastra.pubsub` so any
      // worker in a fleet can execute a step. The agent's stream still sees
      // those events because its CachingPubSub follows `mastra.pubsub` as its
      // source (wired at registration; see #ensurePubsubInitialized).
      //
      // On the hostless fallback (default engine, see resolveWorkflowEngine)
      // there is no `mastra.pubsub`: the default engine publishes on the
      // pubsub handed to `createRun`, so pass the agent's own transport —
      // otherwise the caller's stream never sees a single event and hangs.
      // This mirrors the previously shipped standalone behavior.
      const run = await workflow.createRun({
        runId,
        resourceId: workflowInput.state?.resourceId ?? memoryInfo?.resourceId,
        ...(this.host.resolveWorkflowEngine() === 'default'
          ? { pubsub: this.host.fenceRunPubSub(executionFence, entry?.abortController) }
          : {}),
      });
      // stream() runs executeWorkflow in the background. Track the full run here
      // so an immediate resume waits for the suspension snapshot to be persisted.
      // Pass the caller's requestContext (so config selectors pick the same observability
      // instance the root spans were created with) and parent the run under the AGENT_RUN span.
      await run
        .start({
          inputData: workflowInput,
          requestContext: entry?.requestContext,
          actor: workflowInput.options?.actor,
          ...createObservabilityContext({ currentSpan: entry?.agentSpan }),
        })
        .then(
          // A failure the loop itself didn't catch resolves (not rejects) with
          // status 'failed' — mirror DurableAgent.executeWorkflow and publish
          // an ERROR event, otherwise the caller's stream never terminates
          // (#17727's idle-start gap on the evented transport). Non-suspended
          // terminal runs also drop their snapshots so they stop being
          // re-driven by recoverActiveRuns() (#22209). If the process dies
          // before this fires, the recover path performs the same cleanup.
          result => {
            if (sharedExecution) {
              executionFence?.detach();
              return;
            }
            return this.host.settleExecution(runId, executionFence, {
              status: result?.status,
              error:
                result?.status === 'failed'
                  ? this.host.workflowFailureError((result as any).error, 'Workflow execution failed')
                  : undefined,
            });
          },
          // settleExecution never rejects: a pubsub already closing during
          // shutdown must not become an unhandledRejection (#23168).
          error => {
            if (sharedExecution) {
              executionFence?.detach();
              // A claim released with no successor leaves nobody to publish to this run's stream, so end it here
              // without touching run state. After a takeover the successor publishes on the same topic.
              if (error instanceof DurableExecutionFenceError && error.id === EXECUTION_UNVERIFIED_ERROR_ID) {
                return this.host.emitError(runId, error, executionFence?.generation).catch(publishError =>
                  this.host.logger.warn(`Failed to publish error event for run ${runId}`, {
                    runId,
                    error: publishError,
                  }),
                );
              }
              this.host
                .getMastraInstance()
                ?.getLogger()
                ?.warn('Evented durable observer disconnected; workers retain settlement authority', {
                  runId,
                  error,
                });
              return;
            }
            return this.host.settleExecution(runId, executionFence, {
              error: this.host.workflowExecutionError(error, 'Workflow execution failed'),
            });
          },
        );
    } catch (error) {
      await this.host.settleExecution(runId, executionFence, {
        error: this.host.workflowExecutionError(error, 'Workflow execution failed'),
      });
    }
  }
}
