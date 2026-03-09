import { randomUUID } from 'node:crypto';
import { TripWire } from '../../agent/trip-wire';
import { MastraBase } from '../../base';
import type { RequestContext } from '../../di';
import { MastraError, ErrorDomain, ErrorCategory } from '../../error';
import { getErrorFromUnknown } from '../../error/utils.js';
import { RegisteredLogger } from '../../logger';
import type { Mastra } from '../../mastra';
import { createObservabilityContext } from '../../observability';
import { ToolStream } from '../../tools/stream';
import { PUBSUB_SYMBOL, STREAM_FORMAT_SYMBOL } from '../constants';
import { getStepResult } from '../step';
import type { InnerOutput, LoopConditionFunction, Step, SuspendOptions } from '../step';
import type { StepFlowEntry, StepResult } from '../types';
import {
  validateStepInput,
  createDeprecationProxy,
  runCountDeprecationMessage,
  validateStepSuspendData,
} from '../utils';

export class StepExecutor extends MastraBase {
  protected mastra?: Mastra;
  constructor({ mastra }: { mastra?: Mastra }) {
    super({ name: 'StepExecutor', component: RegisteredLogger.WORKFLOW });
    this.mastra = mastra;
  }

  __registerMastra(mastra: Mastra) {
    this.mastra = mastra;
    const logger = mastra?.getLogger();
    if (logger) {
      this.__setLogger(logger);
    }
  }

  /**
   * Creates an output writer function that publishes chunks to the workflow event stream.
   * @param runId - The workflow run ID
   * @returns An async function that writes chunks to the pubsub
   */
  private createOutputWriter(runId: string): (chunk: unknown) => Promise<void> {
    return async (chunk: unknown) => {
      try {
        if (this.mastra?.pubsub) {
          await this.mastra.pubsub.publish(`workflow.events.v2.${runId}`, {
            type: 'watch',
            runId,
            data: chunk,
          });
        }
      } catch (err) {
        // Non-critical: streaming events are observational
        // Errors here should not fail step execution
        this.logger.debug('Failed to publish workflow watch event', { runId, error: err });
      }
    };
  }

  async execute(params: {
    workflowId: string;
    step: Step<any, any, any, any>;
    runId: string;
    input?: any;
    resumeData?: any;
    stepResults: Record<string, StepResult<any, any, any, any>>;
    state: Record<string, any>;
    requestContext: RequestContext;
    retryCount?: number;
    foreachIdx?: number;
    validateInputs?: boolean;
    abortController?: AbortController;
    perStep?: boolean;
  }): Promise<StepResult<any, any, any, any>> {
    const { step, stepResults, runId, requestContext, retryCount = 0, perStep } = params;

    // Use provided abortController or create a new one for backwards compatibility
    const abortController = params.abortController ?? new AbortController();

    let suspended: { payload: any } | undefined;
    let bailed: { payload: any } | undefined;
    const startedAt = Date.now();
    const { inputData, validationError } = await validateStepInput({
      prevOutput: typeof params.foreachIdx === 'number' ? params.input?.[params.foreachIdx] : params.input,
      step,
      validateInputs: params.validateInputs ?? true,
    });

    let stepInfo: {
      startedAt: number;
      payload: any;
      resumePayload?: any;
      resumedAt?: number;
      [key: string]: any;
    } = {
      ...stepResults[step.id],
      startedAt,
      payload: (typeof params.foreachIdx === 'number' ? params.input : inputData) ?? {},
    };

    if (params.resumeData) {
      stepInfo.resumePayload = params.resumeData;
      stepInfo.resumedAt = Date.now();
      // Strip __workflow_meta from suspendPayload when step is resumed
      // This metadata is only needed during suspend, not in the final completed result
      if (stepInfo.suspendPayload && '__workflow_meta' in stepInfo.suspendPayload) {
        const { __workflow_meta, ...userSuspendPayload } = stepInfo.suspendPayload;
        stepInfo.suspendPayload = userSuspendPayload;
      }
    }

    // Extract suspend data if this step was previously suspended
    let suspendDataToUse =
      params.stepResults[step.id]?.status === 'suspended' ? params.stepResults[step.id]?.suspendPayload : undefined;

    // Filter out internal workflow metadata before exposing to step code
    if (suspendDataToUse && '__workflow_meta' in suspendDataToUse) {
      const { __workflow_meta, ...userSuspendData } = suspendDataToUse;
      suspendDataToUse = userSuspendData;
    }

    // Track state updates - don't mutate params.state in place
    // This matches the default engine's behavior where setState captures
    // the update and applies it AFTER the step completes
    let stateUpdate: Record<string, any> | undefined;

    try {
      if (validationError) {
        throw validationError;
      }

      const callId = randomUUID();
      const outputWriter = this.createOutputWriter(runId);

      const stepOutput = await step.execute(
        createDeprecationProxy(
          {
            workflowId: params.workflowId,
            runId,
            mastra: this.mastra!,
            requestContext,
            inputData,
            state: params.state,
            setState: async (newState: Record<string, any>) => {
              // Capture state update - don't mutate params.state in place
              // This matches default engine behavior where state changes
              // are applied AFTER the step completes, not during execution
              stateUpdate = { ...(stateUpdate ?? params.state), ...newState };
            },
            retryCount,
            resumeData: params.resumeData,
            suspendData: suspendDataToUse,
            getInitData: () => stepResults?.input as any,
            getStepResult: getStepResult.bind(this, stepResults),
            suspend: async (suspendPayload: unknown, suspendOptions?: SuspendOptions): Promise<InnerOutput> => {
              const { suspendData, validationError } = await validateStepSuspendData({
                suspendData: suspendPayload,
                step,
                validateInputs: params.validateInputs ?? true,
              });
              if (validationError) {
                throw validationError;
              }
              // Build resume labels if provided
              const resumeLabels: Record<string, { stepId: string; foreachIndex?: number }> = {};
              if (suspendOptions?.resumeLabel) {
                const labels = Array.isArray(suspendOptions.resumeLabel)
                  ? suspendOptions.resumeLabel
                  : [suspendOptions.resumeLabel];
                for (const label of labels) {
                  resumeLabels[label] = {
                    stepId: step.id,
                    foreachIndex: params.foreachIdx,
                  };
                }
              }
              suspended = {
                payload: {
                  ...suspendData,
                  __workflow_meta: {
                    runId,
                    path: [step.id],
                    foreachIndex: params.foreachIdx,
                    resumeLabels: Object.keys(resumeLabels).length > 0 ? resumeLabels : undefined,
                  },
                },
              };
            },
            bail: (result: any): InnerOutput => {
              bailed = { payload: result };
            },
            writer: new ToolStream(
              {
                prefix: 'workflow-step',
                callId,
                name: step.id,
                runId,
              },
              outputWriter,
            ),
            abort: () => {
              abortController?.abort();
            },
            [PUBSUB_SYMBOL]: this.mastra!.pubsub,
            [STREAM_FORMAT_SYMBOL]: undefined, // TODO
            engine: {},
            abortSignal: abortController?.signal,
            // TODO
            ...createObservabilityContext(),
          },
          {
            paramName: 'runCount',
            deprecationMessage: runCountDeprecationMessage,
            logger: this.logger,
          },
        ),
      );

      const isNestedWorkflowStep = step.component === 'WORKFLOW';

      const nestedWflowStepPaused = isNestedWorkflowStep && perStep;

      const endedAt = Date.now();

      // Use stateUpdate if setState was called, otherwise use original state
      const finalState = stateUpdate ?? params.state;

      let finalResult: StepResult<any, any, any, any> & { __state?: Record<string, any> };
      if (suspended) {
        finalResult = {
          ...stepInfo,
          status: 'suspended',
          suspendedAt: endedAt,
          ...(stepOutput ? { suspendOutput: stepOutput } : {}),
          __state: finalState,
        };

        if (suspended.payload) {
          finalResult.suspendPayload = suspended.payload;
        }
      } else if (bailed) {
        finalResult = {
          ...stepInfo,
          // @ts-expect-error - bailed status not in type
          status: 'bailed',
          endedAt,
          output: bailed.payload,
          __state: finalState,
        };
      } else if (nestedWflowStepPaused) {
        finalResult = {
          ...stepInfo,
          status: 'paused',
          __state: finalState,
        };
      } else {
        finalResult = {
          ...stepInfo,
          status: 'success',
          endedAt,
          output: stepOutput,
          __state: finalState,
        };
      }

      return finalResult;
    } catch (error: any) {
      const endedAt = Date.now();

      const errorInstance = getErrorFromUnknown(error, {
        serializeStack: false,
        fallbackMessage: 'Unknown step execution error',
      });

      // Log the error for observability (matching default engine behavior)
      const stepId = params.step.id;
      const mastraError = new MastraError(
        {
          id: 'WORKFLOW_STEP_INVOKE_FAILED',
          domain: ErrorDomain.MASTRA_WORKFLOW,
          category: ErrorCategory.USER,
          details: { workflowId: params.workflowId, runId: params.runId, stepId },
        },
        errorInstance,
      );
      this.logger?.trackException(mastraError);
      this.logger?.error(`Error executing step ${stepId}: ` + errorInstance?.stack);

      return {
        ...stepInfo,
        status: 'failed',
        endedAt,
        error: errorInstance,
        // Preserve TripWire data as plain object for proper serialization
        // Important: Check `error` not `errorInstance` because getErrorFromUnknown
        // converts the error and loses the prototype chain
        tripwire:
          error instanceof TripWire
            ? {
                reason: error.message,
                retry: error.options?.retry,
                metadata: error.options?.metadata,
                processorId: error.processorId,
              }
            : undefined,
      };
    }
  }

  async evaluateConditions(params: {
    workflowId: string;
    step: Extract<StepFlowEntry, { type: 'conditional' }>;
    runId: string;
    input?: any;
    resumeData?: any;
    stepResults: Record<string, StepResult<any, any, any, any>>;
    state: Record<string, any>;
    requestContext: RequestContext;
    retryCount?: number;
    abortController?: AbortController;
  }): Promise<number[]> {
    const { step, stepResults, runId, requestContext, retryCount = 0 } = params;

    const abortController = params.abortController ?? new AbortController();

    const results = await Promise.all(
      step.conditions.map(condition => {
        try {
          return this.evaluateCondition({
            workflowId: params.workflowId,
            condition,
            runId,
            requestContext,
            inputData: params.input,
            state: params.state,
            retryCount,
            resumeData: params.resumeData,
            abortController,
            stepResults,
            iterationCount: 0,
          });
        } catch (e) {
          this.mastra?.getLogger()?.error('error evaluating condition', e);
          return false;
        }
      }),
    );

    const idxs = results.reduce((acc, result, idx) => {
      if (result) {
        acc.push(idx);
      }

      return acc;
    }, [] as number[]);

    return idxs;
  }

  async evaluateCondition({
    workflowId,
    condition,
    runId,
    inputData,
    resumeData,
    stepResults,
    state,
    requestContext,
    abortController,
    retryCount = 0,
    iterationCount,
  }: {
    workflowId: string;
    condition: LoopConditionFunction<any, any, any, any, any, any>;
    runId: string;
    inputData?: any;
    resumeData?: any;
    stepResults: Record<string, StepResult<any, any, any, any>>;
    state: Record<string, any>;
    requestContext: RequestContext;
    abortController: AbortController;
    retryCount?: number;
    iterationCount: number;
  }): Promise<boolean> {
    const callId = randomUUID();
    const outputWriter = this.createOutputWriter(runId);

    return condition(
      createDeprecationProxy(
        {
          workflowId,
          runId,
          mastra: this.mastra!,
          requestContext,
          inputData,
          state,
          retryCount,
          resumeData: resumeData,
          getInitData: () => stepResults?.input as any,
          getStepResult: getStepResult.bind(this, stepResults),
          bail: (_result: any) => {
            throw new Error('Not implemented');
          },
          writer: new ToolStream(
            {
              prefix: 'workflow-step',
              callId,
              name: 'condition',
              runId,
            },
            outputWriter,
          ),
          abort: () => {
            abortController?.abort();
          },
          [PUBSUB_SYMBOL]: this.mastra!.pubsub,
          [STREAM_FORMAT_SYMBOL]: undefined, // TODO
          engine: {},
          abortSignal: abortController?.signal,
          // TODO
          ...createObservabilityContext(),
          iterationCount,
        },
        {
          paramName: 'runCount',
          deprecationMessage: runCountDeprecationMessage,
          logger: this.logger,
        },
      ),
    );
  }

  async resolveSleep(params: {
    workflowId: string;
    step: Extract<StepFlowEntry, { type: 'sleep' }>;
    runId: string;
    input?: any;
    resumeData?: any;
    stepResults: Record<string, StepResult<any, any, any, any>>;
    state?: Record<string, any>;
    requestContext: RequestContext;
    retryCount?: number;
    abortController?: AbortController;
  }): Promise<number> {
    const { step, stepResults, runId, requestContext, retryCount = 0 } = params;
    const currentState = params.state ?? stepResults?.__state ?? {};

    const abortController = params.abortController ?? new AbortController();

    if (step.duration) {
      return step.duration;
    }

    if (!step.fn) {
      return 0;
    }

    try {
      const callId = randomUUID();
      const outputWriter = this.createOutputWriter(runId);

      return await step.fn(
        createDeprecationProxy(
          {
            workflowId: params.workflowId,
            runId,
            mastra: this.mastra!,
            requestContext,
            inputData: params.input,
            state: currentState,
            setState: async (newState: Record<string, any>) => {
              Object.assign(currentState, newState);
            },
            retryCount,
            resumeData: params.resumeData,
            getInitData: () => stepResults?.input as any,
            getStepResult: getStepResult.bind(this, stepResults),
            suspend: async (_suspendPayload: any): Promise<any> => {
              throw new Error('Not implemented');
            },
            bail: (_result: any) => {
              throw new Error('Not implemented');
            },
            abort: () => {
              abortController?.abort();
            },
            writer: new ToolStream(
              {
                prefix: 'workflow-step',
                callId,
                name: step.id,
                runId,
              },
              outputWriter,
            ),
            [PUBSUB_SYMBOL]: this.mastra!.pubsub,
            [STREAM_FORMAT_SYMBOL]: undefined, // TODO
            engine: {},
            abortSignal: abortController?.signal,
            // TODO
            ...createObservabilityContext(),
          },
          {
            paramName: 'runCount',
            deprecationMessage: runCountDeprecationMessage,
            logger: this.logger,
          },
        ),
      );
    } catch (e) {
      this.mastra?.getLogger()?.error('error evaluating condition', e);
      return 0;
    }
  }

  async resolveSleepUntil(params: {
    workflowId: string;
    step: Extract<StepFlowEntry, { type: 'sleepUntil' }>;
    runId: string;
    input?: any;
    resumeData?: any;
    stepResults: Record<string, StepResult<any, any, any, any>>;
    state?: Record<string, any>;
    requestContext: RequestContext;
    retryCount?: number;
    abortController?: AbortController;
  }): Promise<number> {
    const { step, stepResults, runId, requestContext, retryCount = 0 } = params;
    const currentState = params.state ?? stepResults?.__state ?? {};

    const abortController = params.abortController ?? new AbortController();

    if (step.date) {
      return step.date.getTime() - Date.now();
    }

    if (!step.fn) {
      return 0;
    }

    try {
      const callId = randomUUID();
      const outputWriter = this.createOutputWriter(runId);

      const result = await step.fn(
        createDeprecationProxy(
          {
            workflowId: params.workflowId,
            runId,
            mastra: this.mastra!,
            requestContext,
            inputData: params.input,
            state: currentState,
            setState: async (newState: Record<string, any>) => {
              Object.assign(currentState, newState);
            },
            retryCount,
            resumeData: params.resumeData,
            getInitData: () => stepResults?.input as any,
            getStepResult: getStepResult.bind(this, stepResults),
            suspend: async (_suspendPayload: any): Promise<any> => {
              throw new Error('Not implemented');
            },
            bail: (_result: any) => {
              throw new Error('Not implemented');
            },
            abort: () => {
              abortController?.abort();
            },
            writer: new ToolStream(
              {
                prefix: 'workflow-step',
                callId,
                name: step.id,
                runId,
              },
              outputWriter,
            ),
            [PUBSUB_SYMBOL]: this.mastra!.pubsub,
            [STREAM_FORMAT_SYMBOL]: undefined, // TODO
            engine: {},
            abortSignal: abortController?.signal,
            // TODO
            ...createObservabilityContext(),
          },
          {
            paramName: 'runCount',
            deprecationMessage: runCountDeprecationMessage,
            logger: this.logger,
          },
        ),
      );

      return result.getTime() - Date.now();
    } catch (e) {
      this.mastra?.getLogger()?.error('error evaluating condition', e);
      return 0;
    }
  }
}
