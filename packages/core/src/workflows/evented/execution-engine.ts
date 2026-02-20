import type { RequestContext } from '../../di';
import type { PubSub } from '../../events/pubsub';
import type { Event } from '../../events/types';
import type { Mastra } from '../../mastra';
import { ExecutionEngine } from '../../workflows/execution-engine';
import type { ExecutionEngineOptions, ExecutionGraph } from '../../workflows/execution-engine';
import type {
  SerializedStepFlowEntry,
  StepResult,
  StepTripwireInfo,
  RestartExecutionParams,
  TimeTravelExecutionParams,
  WorkflowRunStatus,
} from '../types';
import { cleanStepResult, hydrateSerializedStepErrors } from '../utils';
import type { WorkflowEventProcessor } from './workflow-event-processor';
import { getStep } from './workflow-event-processor/utils';

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
   * Executes a workflow run with the provided execution graph and input
   * @param graph The execution graph to execute
   * @param input The input data for the workflow
   * @returns A promise that resolves to the workflow output
   */
  async execute<TState, TInput, TOutput>(params: {
    workflowId: string;
    runId: string;
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
  }): Promise<TOutput> {
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

    const finishCb = async (event: Event, ack?: () => Promise<void>) => {
      if (event.runId !== params.runId) {
        await ack?.();
        return;
      }

      if (['workflow.end', 'workflow.fail', 'workflow.suspend'].includes(event.type)) {
        await ack?.();
        await pubsub.unsubscribe('workflows-finish', finishCb);
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
      await pubsub.subscribe('workflows-finish', finishCb);
    } catch (err) {
      this.mastra?.getLogger()?.error('Failed to subscribe to workflows-finish:', err);
      throw err;
    }

    // NOW safe to publish - listener is guaranteed to be registered
    // Wrap in try/catch to ensure proper cleanup and rejection on errors
    try {
      if (params.resume) {
        const prevStep = getStep(this.mastra!.getWorkflow(params.workflowId), params.resume.resumePath);
        const prevResult = params.resume.stepResults[prevStep?.id ?? 'input'];
        // Extract state from stepResults.__state or use initialState
        const resumeState = params.resume.stepResults?.__state ?? params.initialState ?? {};

        await pubsub.publish('workflows', {
          type: 'workflow.resume',
          runId: params.runId,
          data: {
            workflowId: params.workflowId,
            runId: params.runId,
            executionPath: params.resume.resumePath,
            stepResults: params.resume.stepResults,
            resumeSteps: params.resume.steps,
            prevResult: { status: 'success', output: prevResult?.payload },
            resumeData: params.resume.resumePayload,
            requestContext: Object.fromEntries(params.requestContext.entries()),
            format: params.format,
            perStep: params.perStep,
            initialState: resumeState,
            state: resumeState,
            outputOptions: params.outputOptions,
            forEachIndex: params.resume.forEachIndex,
          },
        });
      } else if (params.timeTravel) {
        const prevStep = getStep(this.mastra!.getWorkflow(params.workflowId), params.timeTravel.executionPath);
        const prevResult = params.timeTravel.stepResults[prevStep?.id ?? 'input'];
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
            requestContext: Object.fromEntries(params.requestContext.entries()),
            format: params.format,
            perStep: params.perStep,
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
            requestContext: Object.fromEntries(params.requestContext.entries()),
            format: params.format,
            perStep: params.perStep,
            initialState: params.initialState,
            outputOptions: params.outputOptions,
          },
        });
      }
    } catch (err) {
      // Clean up subscription and reject the promise on error
      await pubsub.unsubscribe('workflows-finish', finishCb);
      rejectResult(err);
      throw err;
    }

    // Wait for workflow to complete
    const resultData: any = await resultPromise;

    // Extract state from resultData (stored in stepResults.__state)
    const finalState = resultData.state ?? resultData.stepResults?.__state ?? params.initialState ?? {};

    // Strip __state from stepResults at top level
    const { __state: _removedState, ...stepResultsWithoutTopLevelState } = resultData.stepResults ?? {};

    // Recursively clean each step result to remove internal properties (__state, nestedRunId)
    // This handles both object and array step results (e.g., forEach outputs)
    const cleanStepResults: Record<string, any> = {};
    for (const [stepId, stepResult] of Object.entries(stepResultsWithoutTopLevelState)) {
      cleanStepResults[stepId] = cleanStepResult(stepResult);
    }

    // Build the callback argument with proper typing for invokeLifecycleCallbacks
    let callbackArg: {
      status: WorkflowRunStatus;
      result?: any;
      error?: any;
      steps: Record<string, StepResult<any, any, any, any>>;
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
          steps: cleanStepResults,
          state: finalState,
          tripwire: tripwireData,
        };
      } else {
        callbackArg = {
          status: 'failed',
          error: resultData.prevResult.error,
          steps: cleanStepResults,
          state: finalState,
        };
      }
    } else if (resultData.prevResult.status === 'suspended') {
      callbackArg = {
        status: 'suspended',
        steps: cleanStepResults,
        state: finalState,
      };
    } else if (resultData.prevResult.status === 'paused' || params.perStep) {
      callbackArg = {
        status: 'paused',
        steps: cleanStepResults,
        state: finalState,
      };
    } else {
      callbackArg = {
        status: resultData.prevResult.status,
        result: resultData.prevResult?.output,
        steps: cleanStepResults,
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
