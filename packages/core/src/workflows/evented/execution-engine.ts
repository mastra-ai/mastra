import type { ActorSignal } from '../../auth/ee';
import type { RequestContext } from '../../di';
import { getErrorFromUnknown } from '../../error/utils.js';
import type { PubSub } from '../../events/pubsub';
import type { Event } from '../../events/types';
import type { Mastra } from '../../mastra';
import type { Span, SpanType } from '../../observability';
import { executionFailureTermination } from '../../observability/execution-outcome';
import { ExecutionEngine } from '../../workflows/execution-engine';
import type { ExecutionEngineOptions, ExecutionGraph } from '../../workflows/execution-engine';
import { workflowTermination } from '../execution-outcome';
import { residentStepResultsLoader } from '../run-journal';
import type {
  SerializedStepFlowEntry,
  StepResult,
  StepTripwireInfo,
  RestartExecutionParams,
  TimeTravelExecutionParams,
  WorkflowRunStatus,
  WorkflowStepResults,
  NestedWorkflowParent,
} from '../types';
import { cleanStepResult, hydrateSerializedStepErrors } from '../utils';
import type { ParentWorkflow, WorkflowEventProcessor } from './workflow-event-processor';
import { getStepId } from './workflow-event-processor/utils';

export class EventedExecutionEngine extends ExecutionEngine {
  protected eventProcessor: WorkflowEventProcessor;

  constructor({
    mastra,
    eventProcessor,
    options,
  }: {
    mastra?: Mastra;
    eventProcessor: WorkflowEventProcessor;
    options: ExecutionEngineOptions;
  }) {
    super({ mastra, options });
    this.eventProcessor = eventProcessor;
  }

  __registerMastra(mastra: Mastra) {
    super.__registerMastra(mastra);
    this.eventProcessor.__registerMastra(mastra);
  }

  /**
   * Internal workflows (registered via `Mastra.__registerInternalWorkflow`)
   * are resolvable from the workflow event processor but `Mastra.getWorkflow`
   * intentionally only sees public ones. The `execute` resume/time-travel
   * branches need access to the workflow's step graph by id, so prefer the
   * internal registry when present.
   */
  private resolveWorkflow(workflowId: string, runId?: string) {
    if (this.mastra?.__hasInternalWorkflow(workflowId, runId)) {
      return this.mastra.__getInternalWorkflow(workflowId, runId);
    }
    return this.mastra!.getWorkflow(workflowId);
  }

  /**
   * `Run.restart()` and `Run.timeTravel()` hand the engine a WORKFLOW_RUN span to own. Evented
   * steps only find a span registered on Mastra for their run, so hold it there while the run
   * executes, then end it with the run's result as the default engine does.
   */
  private async executeInRunSpan<TOutput>(
    runId: string,
    workflowSpan: Span<SpanType.WORKFLOW_RUN>,
    execute: () => Promise<TOutput>,
  ): Promise<TOutput> {
    this.mastra?.__registerRunTracingContext(runId, { currentSpan: workflowSpan });
    try {
      const result = await execute();
      const settled = result as {
        status: WorkflowRunStatus;
        result?: unknown;
        error?: unknown;
        tripwire?: StepTripwireInfo;
      };
      const termination = workflowTermination(settled);
      if (settled.error) {
        workflowSpan.error({
          ...termination,
          error: getErrorFromUnknown(settled.error),
          attributes: { status: settled.status },
        });
      } else {
        workflowSpan.end({ ...termination, output: settled.result, attributes: { status: settled.status } });
      }
      return result;
    } catch (error) {
      workflowSpan.error({ ...executionFailureTermination(error), error: getErrorFromUnknown(error) });
      throw error;
    } finally {
      // Another execution of this run may have registered its own span since.
      if (this.mastra?.__getRunTracingContext(runId)?.currentSpan === workflowSpan) {
        this.mastra.__unregisterRunTracingContext(runId);
      }
    }
  }

  /**
   * Executes a workflow run with the provided execution graph and input
   * @param graph The execution graph to execute
   * @param input The input data for the workflow
   * @returns A promise that resolves to the workflow output
   */
  async execute<TState, TInput, TOutput>(params: {
    workflowId: string;
    runId: string;
    parentWorkflow?: NestedWorkflowParent;
    resourceId?: string;
    graph: ExecutionGraph;
    serializedStepGraph: SerializedStepFlowEntry[];
    input?: TInput;
    initialState?: TState;
    restart?: RestartExecutionParams;
    timeTravel?: TimeTravelExecutionParams;
    resume?: {
      steps: string[];
      stepResults: Record<string, StepResult<any, any, any, any>>;
      resumePayload: any;
      resumePath: number[];
      forEachIndex?: number;
    };
    pubsub?: PubSub; // Not used - evented engine uses this.mastra.pubsub directly
    requestContext: RequestContext;
    actor?: ActorSignal;
    retryConfig?: {
      attempts?: number;
      delay?: number;
    };
    abortController: AbortController;
    format?: 'legacy' | 'vnext' | undefined;
    outputOptions?: {
      includeState?: boolean;
      includeResumeLabels?: boolean;
    };
    perStep?: boolean;
    storageVersion?: 1 | 2;
    workflowSpan?: Span<SpanType.WORKFLOW_RUN>;
  }): Promise<TOutput> {
    const { workflowSpan, ...executeParams } = params;
    if (workflowSpan) {
      return this.executeInRunSpan(params.runId, workflowSpan, () =>
        this.execute<TState, TInput, TOutput>(executeParams),
      );
    }

    const pubsub = this.mastra?.pubsub;
    if (!pubsub) {
      throw new Error('No Pubsub adapter configured on the Mastra instance');
    }

    // Set up promise that will resolve when workflow finishes
    // CRITICAL: Must subscribe BEFORE publishing events to avoid race condition
    let resolveResult!: (data: any) => void;
    let rejectResult!: (error: any) => void;
    const resultPromise = new Promise<any>((resolve, reject) => {
      resolveResult = resolve;
      rejectResult = reject;
    });
    // Let Mastra.shutdown() drain this run before it tears down the pubsub
    // subscriptions the run needs to make progress.
    const releaseTracking = this.mastra?.__trackEventedRun(resultPromise) ?? (() => {});

    // Resolved up front: a finishing run unregisters its run-scoped workflow.
    // A workflow Mastra can't resolve sets no such option.
    let isForeignExecution: ((eventRequestContext: unknown, requestContext: RequestContext) => boolean) | undefined;
    try {
      isForeignExecution = this.resolveWorkflow(params.workflowId, params.runId)?.options?.isForeignExecution;
    } catch {
      isForeignExecution = undefined;
    }

    let watchExecutionLoss:
      | ((requestContext: RequestContext, runId: string, onLost: (error: Error) => void) => () => void)
      | undefined;
    try {
      watchExecutionLoss = this.resolveWorkflow(params.workflowId, params.runId)?.options?.watchExecutionLoss;
    } catch {
      watchExecutionLoss = undefined;
    }

    let pendingCleanupFinish: Event | undefined;
    const finishCb = async (event: Event, ack?: () => Promise<void>) => {
      // Another execution of this run (one that lost it to recover(), say) still
      // publishes its finish under the same runId; it isn't this caller's result.
      if (event.runId !== params.runId || isForeignExecution?.(event.data?.requestContext, params.requestContext)) {
        await ack?.();
        return;
      }

      if (
        [
          'workflow.end',
          'workflow.fail',
          'workflow.suspend',
          'workflow.publish-failed',
          'workflow.finish-cleanup-complete',
        ].includes(event.type)
      ) {
        await ack?.();
        if (
          (event.type === 'workflow.end' ||
            event.type === 'workflow.fail' ||
            event.type === 'workflow.publish-failed') &&
          event.data.finishPendingCleanup
        ) {
          pendingCleanupFinish = event;
          return;
        }
        if (event.type === 'workflow.finish-cleanup-complete') {
          if (!pendingCleanupFinish) return;
          event = pendingCleanupFinish;
        }
        await pubsub.unsubscribe('workflows-finish', finishCb);
        if (event.type === 'workflow.publish-failed') {
          rejectResult(new Error(event.data.message));
          return;
        }
        // Re-hydrate serialized errors back to Error instances when workflow fails
        if (event.type === 'workflow.fail' && event.data.stepResults) {
          event.data.stepResults = hydrateSerializedStepErrors(event.data.stepResults);
        }
        resolveResult(event.data);
        return;
      }

      await ack?.();
    };

    // AWAIT subscription first - ensures listener is registered before any events fire
    try {
      // Live-tail: persistent pubsubs replay retained events from 'earliest', which
      // would hand this waiter stale finish events (e.g. this run's own prior suspend).
      // Safe because we subscribe before publishing the start/resume event below.
      await pubsub.subscribe('workflows-finish', finishCb, { startFrom: 'latest' });
    } catch (err) {
      releaseTracking();
      this.mastra?.getLogger()?.error('Failed to subscribe to workflows-finish:', err);
      throw err;
    }

    // A caller whose execution lost the run would otherwise wait forever: a successor's finish is foreign to it,
    // and a run released with nobody left to finish it publishes none. Stop waiting, without writing anything.
    const stopWatchingLoss = watchExecutionLoss?.(params.requestContext, params.runId, error => {
      void pubsub
        .unsubscribe('workflows-finish', finishCb)
        .catch(err => this.mastra?.getLogger()?.error('Failed to unsubscribe from workflows-finish:', err))
        .finally(() => rejectResult(error));
    });
    if (stopWatchingLoss) void resultPromise.then(stopWatchingLoss, stopWatchingLoss);

    // NOW safe to publish - listener is guaranteed to be registered
    // Wrap in try/catch to ensure proper cleanup and rejection on errors
    // The processor reads a run's storage version off each event; it can't look it up.
    const storageVersionTag = params.storageVersion === 2 ? { storageVersion: 2 as const } : {};
    try {
      if (params.resume) {
        const prevStepId = getStepId(this.resolveWorkflow(params.workflowId, params.runId), params.resume.resumePath);
        const prevResult = params.resume.stepResults[prevStepId ?? 'input'];
        // Extract state from stepResults.__state or use initialState
        const resumeState = params.resume.stepResults?.__state ?? params.initialState ?? {};

        await pubsub.publish('workflows', {
          type: 'workflow.resume',
          runId: params.runId,
          data: {
            workflowId: params.workflowId,
            runId: params.runId,
            parentWorkflow: params.parentWorkflow
              ? await this.eventProcessor.restoreParentWorkflow(params.parentWorkflow)
              : undefined,
            executionPath: params.resume.resumePath,
            // On storage v2 successful steps were loaded as summaries; the processor loads them.
            ...(params.storageVersion !== 2 && { stepResults: params.resume.stepResults }),
            resumeSteps: params.resume.steps,
            prevResult: { status: 'success', output: prevResult?.payload },
            resumeData: params.resume.resumePayload,
            requestContext: params.requestContext.toJSON(),
            actor: params.actor,
            format: params.format,
            perStep: params.perStep,
            initialState: resumeState,
            state: resumeState,
            outputOptions: params.outputOptions,
            forEachIndex: params.resume.forEachIndex,
            ...storageVersionTag,
          },
        });
      } else if (params.timeTravel) {
        const prevStepId = getStepId(
          this.resolveWorkflow(params.workflowId, params.runId),
          params.timeTravel.executionPath,
        );
        const prevResult = params.timeTravel.stepResults[prevStepId ?? 'input'];
        await pubsub.publish('workflows', {
          type: 'workflow.start',
          runId: params.runId,
          data: {
            workflowId: params.workflowId,
            runId: params.runId,
            executionPath: params.timeTravel.executionPath,
            stepResults: params.timeTravel.stepResults,
            timeTravel: params.timeTravel,
            prevResult: { status: 'success', output: prevResult?.payload },
            requestContext: params.requestContext.toJSON(),
            actor: params.actor,
            format: params.format,
            perStep: params.perStep,
            state: params.timeTravel.state,
            ...storageVersionTag,
          },
        });
      } else if (params.restart) {
        // A restart publishes an event that a worker has to consume. Unlike the
        // durable-agent recovery path (`DurableAgent.recover()` calls
        // `ensureEngineWorkersStarted()` first) this path never started them, so
        // a restart issued before `startWorkers()` was published to no one: the
        // run stalled forever with no error and no rejection. Starting them here
        // is a no-op when they are already running or are disabled.
        await this.mastra?.__ensureExecutionWorkersStarted();
        const prevStepId = getStepId(this.resolveWorkflow(params.workflowId, params.runId), params.restart.activePaths);
        const prevResult =
          params.restart.stepResults[params.restart.isPreFirstStepRestart ? 'input' : (prevStepId ?? 'input')];
        await pubsub.publish('workflows', {
          type: 'workflow.start',
          runId: params.runId,
          data: {
            workflowId: params.workflowId,
            runId: params.runId,
            executionPath: params.restart.activePaths,
            stepResults: params.restart.stepResults,
            restart: params.restart,
            prevResult: {
              status: 'success',
              output: params.restart.isPreFirstStepRestart ? prevResult : prevResult?.payload,
            },
            requestContext: params.requestContext.toJSON(),
            actor: params.actor,
            format: params.format,
            perStep: params.perStep,
            state: params.restart.state,
            ...storageVersionTag,
          },
        });
      } else {
        await pubsub.publish('workflows', {
          type: 'workflow.start',
          runId: params.runId,
          data: {
            workflowId: params.workflowId,
            runId: params.runId,
            prevResult: { status: 'success', output: params.input },
            requestContext: params.requestContext.toJSON(),
            actor: params.actor,
            format: params.format,
            perStep: params.perStep,
            initialState: params.initialState,
            outputOptions: params.outputOptions,
            ...storageVersionTag,
          },
        });
      }
    } catch (err) {
      // Clean up subscription and reject the promise on error
      await pubsub.unsubscribe('workflows-finish', finishCb);
      rejectResult(err);
      releaseTracking();
      throw err;
    }

    // Wait for workflow to complete
    let resultData: any;
    try {
      resultData = await resultPromise;
    } finally {
      releaseTracking();
    }

    // Extract state from resultData (stored in stepResults.__state)
    const finalState = resultData.state ?? resultData.stepResults?.__state ?? params.initialState ?? {};

    // Strip __state from stepResults at top level
    const { __state: _removedState, ...stepResultsWithoutTopLevelState } = resultData.stepResults ?? {};

    // Recursively clean each step result to remove internal properties (__state, nestedRunId).
    // This handles both object and array step results (e.g., forEach outputs).
    // `skipped` entries are internal bookkeeping for un-taken conditional branches (used to
    // know when every branch has reported in) — the default engine never surfaces them, so
    // they're dropped from the user-facing step results too.
    const cleanStepResults: Record<string, any> = {};
    for (const [stepId, stepResult] of Object.entries(stepResultsWithoutTopLevelState)) {
      if ((stepResult as any)?.status === 'skipped') {
        continue;
      }
      cleanStepResults[stepId] = cleanStepResult(stepResult);
    }
    // On storage v2 the result's steps are a loader, as on the default engine. The finish event
    // carries every step result, so the loader holds them all and reads none from storage.
    const steps = params.storageVersion === 2 ? residentStepResultsLoader(cleanStepResults) : cleanStepResults;

    // Build the callback argument with proper typing for invokeLifecycleCallbacks
    let callbackArg: {
      status: WorkflowRunStatus;
      result?: any;
      error?: any;
      steps: WorkflowStepResults<Record<string, StepResult<any, any, any, any>>, 1 | 2>;
      state?: Record<string, any>;
      tripwire?: StepTripwireInfo;
    };

    if (resultData.prevResult.status === 'failed') {
      // Check if failure was due to TripWire by scanning step results
      let tripwireData: StepTripwireInfo | undefined;
      for (const stepResult of Object.values(cleanStepResults)) {
        if (stepResult?.status === 'failed' && stepResult?.tripwire) {
          tripwireData = stepResult.tripwire;
          break;
        }
      }

      if (tripwireData && typeof tripwireData === 'object' && 'reason' in tripwireData) {
        callbackArg = {
          status: 'tripwire',
          steps,
          state: finalState,
          tripwire: tripwireData,
        };
      } else {
        callbackArg = {
          status: 'failed',
          error: resultData.prevResult.error,
          steps,
          state: finalState,
        };
      }
    } else if (resultData.prevResult.status === 'suspended') {
      callbackArg = {
        status: 'suspended',
        steps,
        state: finalState,
      };
    } else if (resultData.prevResult.status === 'paused' || params.perStep) {
      callbackArg = {
        status: 'paused',
        steps,
        state: finalState,
      };
    } else {
      callbackArg = {
        status: resultData.prevResult.status,
        result: resultData.prevResult?.output,
        steps,
        state: finalState,
      };
    }

    if (callbackArg.status !== 'paused') {
      // Invoke lifecycle callbacks before returning
      await this.invokeLifecycleCallbacks({
        status: callbackArg.status,
        result: callbackArg.result,
        error: callbackArg.error,
        steps: callbackArg.steps,
        tripwire: callbackArg.tripwire,
        runId: params.runId,
        workflowId: params.workflowId,
        resourceId: params.resourceId,
        input: params.input,
        requestContext: params.requestContext,
        state: finalState,
      });
    }

    // Build the final result with any additional fields needed for the return type
    // Exclude state from result unless outputOptions.includeState is true
    let result: TOutput;
    if (resultData.prevResult.status === 'suspended') {
      const suspendedSteps = Object.entries(resultData.stepResults)
        .map(([stepId, stepResult]: [string, any]) => {
          if (stepResult.status === 'suspended') {
            const existingPath = stepResult.suspendPayload?.__workflow_meta?.path ?? [];
            // Prepend stepId to match default engine's suspended array format
            return [stepId, ...existingPath];
          }
          return null;
        })
        .filter(Boolean);
      // Don't spread callbackArg directly to avoid including state
      result = {
        status: callbackArg.status,
        steps: callbackArg.steps,
        suspended: suspendedSteps,
      } as TOutput;
    } else if (resultData.prevResult.status === 'failed') {
      // Check if this is actually a tripwire status (detected in callbackArg building)
      if (callbackArg.status === 'tripwire' && callbackArg.tripwire) {
        result = {
          status: 'tripwire',
          tripwire: callbackArg.tripwire,
          steps: callbackArg.steps,
        } as TOutput;
      } else {
        result = {
          status: callbackArg.status,
          error: callbackArg.error,
          steps: callbackArg.steps,
        } as TOutput;
      }
    } else if (resultData.prevResult.status === 'paused' || params.perStep) {
      result = {
        status: 'paused',
        steps: callbackArg.steps,
      } as TOutput;
    } else {
      result = {
        status: callbackArg.status,
        result: callbackArg.result,
        steps: callbackArg.steps,
      } as TOutput;
    }

    // Include state in result only if outputOptions.includeState is true
    if (params.outputOptions?.includeState) {
      (result as any).state = finalState;
    }

    return result;
  }
}
