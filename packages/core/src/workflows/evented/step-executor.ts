import EventEmitter from 'events';
import type { Emitter, LoopConditionFunction, Mastra, Step, StepFlowEntry, StepResult } from '../..';
import { MastraBase } from '../../base';
import type { RuntimeContext } from '../../di';
import type { PubSub } from '../../events';
import { RegisteredLogger } from '../../logger';
import { EMITTER_SYMBOL, STREAM_FORMAT_SYMBOL } from '../constants';
import { getStepResult } from '../step';
import { validateStepInput } from '../utils';

export class StepExecutor extends MastraBase {
  protected mastra?: Mastra;
  constructor({ mastra }: { mastra?: Mastra }) {
    super({ name: 'StepExecutor', component: RegisteredLogger.WORKFLOW });
    this.mastra = mastra;
  }

  __registerMastra(mastra: Mastra) {
    this.mastra = mastra;
  }

  async execute(params: {
    workflowId: string;
    step: Step<any, any, any, any>;
    runId: string;
    input?: any;
    resumeData?: any;
    stepResults: Record<string, StepResult<any, any, any, any>>;
    state: Record<string, any>;
    emitter: EventEmitter;
    runtimeContext: RuntimeContext;
    retryCount?: number;
    foreachIdx?: number;
    validateInputs?: boolean;
  }): Promise<StepResult<any, any, any, any>> {
    const { step, stepResults, runId, runtimeContext, retryCount = 0 } = params;

    const abortController = new AbortController();

    let suspended: { payload: any } | undefined;
    let bailed: { payload: any } | undefined;
    const startedAt = Date.now();
    const { inputData, validationError } = await validateStepInput({
      prevOutput: typeof params.foreachIdx === 'number' ? params.input?.[params.foreachIdx] : params.input,
      step,
      validateInputs: params.validateInputs ?? false,
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
      delete stepInfo.suspendPayload?.['__workflow_meta'];
      stepInfo.resumePayload = params.resumeData;
      stepInfo.resumedAt = Date.now();
    }

    try {
      if (validationError) {
        throw validationError;
      }

      const stepResult = await step.execute({
        workflowId: params.workflowId,
        runId,
        mastra: this.mastra!,
        runtimeContext,
        inputData,
        state: params.state,
        setState: (state: any) => {
          // TODO
          params.state = state;
        },
        runCount: retryCount,
        retryCount,
        resumeData: params.resumeData,
        getInitData: () => stepResults?.input as any,
        getStepResult: getStepResult.bind(this, stepResults),
        suspend: async (suspendPayload: any): Promise<any> => {
          suspended = { payload: { ...suspendPayload, __workflow_meta: { runId, path: [step.id] } } };
        },
        bail: (result: any) => {
          bailed = { payload: result };
        },
        // TODO
        writer: undefined as any,
        abort: () => {
          abortController?.abort();
        },
        [EMITTER_SYMBOL]: params.emitter as unknown as Emitter, // TODO: refactor this to use our PubSub actually
        [STREAM_FORMAT_SYMBOL]: undefined, // TODO
        engine: {},
        abortSignal: abortController?.signal,
        // TODO
        tracingContext: {},
      });

      const endedAt = Date.now();

      let finalResult: StepResult<any, any, any, any>;
      if (suspended) {
        finalResult = {
          ...stepInfo,
          status: 'suspended',
          suspendedAt: endedAt,
        };

        if (suspended.payload) {
          finalResult.suspendPayload = suspended.payload;
        }
      } else if (bailed) {
        finalResult = {
          ...stepInfo,
          // @ts-ignore
          status: 'bailed',
          endedAt,
          output: bailed.payload,
        };
      } else {
        finalResult = {
          ...stepInfo,
          status: 'success',
          endedAt,
          output: stepResult,
        };
      }

      return finalResult;
    } catch (error: any) {
      const endedAt = Date.now();

      return {
        ...stepInfo,
        status: 'failed',
        endedAt,
        error: error instanceof Error ? (error?.stack ?? error.message) : error,
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
    emitter: { runtime: PubSub; events: PubSub };
    runtimeContext: RuntimeContext;
    retryCount?: number;
  }): Promise<number[]> {
    const { step, stepResults, runId, runtimeContext, retryCount = 0 } = params;

    const abortController = new AbortController();
    const ee = new EventEmitter();

    const results = await Promise.all(
      step.conditions.map(condition => {
        try {
          return this.evaluateCondition({
            workflowId: params.workflowId,
            condition,
            runId,
            runtimeContext,
            inputData: params.input,
            state: params.state,
            retryCount,
            resumeData: params.resumeData,
            abortController,
            stepResults,
            emitter: ee,
            iterationCount: 0,
          });
        } catch (e) {
          console.error('error evaluating condition', e);
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
    runtimeContext,
    emitter,
    abortController,
    retryCount = 0,
    iterationCount,
  }: {
    workflowId: string;
    condition: LoopConditionFunction<any, any, any, any, any>;
    runId: string;
    inputData?: any;
    resumeData?: any;
    stepResults: Record<string, StepResult<any, any, any, any>>;
    state: Record<string, any>;
    emitter: EventEmitter;
    runtimeContext: RuntimeContext;
    abortController: AbortController;
    retryCount?: number;
    iterationCount: number;
  }): Promise<boolean> {
    return condition({
      workflowId,
      runId,
      mastra: this.mastra!,
      runtimeContext,
      inputData,
      state,
      setState: (_state: any) => {
        // TODO
      },
      runCount: retryCount,
      retryCount,
      resumeData: resumeData,
      getInitData: () => stepResults?.input as any,
      getStepResult: getStepResult.bind(this, stepResults),
      suspend: async (_suspendPayload: any): Promise<any> => {
        throw new Error('Not implemented');
      },
      bail: (_result: any) => {
        throw new Error('Not implemented');
      },
      // TODO
      writer: undefined as any,
      abort: () => {
        abortController?.abort();
      },
      [EMITTER_SYMBOL]: emitter as unknown as Emitter, // TODO: refactor this to use our PubSub actually
      [STREAM_FORMAT_SYMBOL]: undefined, // TODO
      engine: {},
      abortSignal: abortController?.signal,
      // TODO
      tracingContext: {},
      iterationCount,
    });
  }

  async resolveSleep(params: {
    workflowId: string;
    step: Extract<StepFlowEntry, { type: 'sleep' }>;
    runId: string;
    input?: any;
    resumeData?: any;
    stepResults: Record<string, StepResult<any, any, any, any>>;
    emitter: { runtime: PubSub; events: PubSub };
    runtimeContext: RuntimeContext;
    retryCount?: number;
  }): Promise<number> {
    const { step, stepResults, runId, runtimeContext, retryCount = 0 } = params;

    const abortController = new AbortController();
    const ee = new EventEmitter();

    if (step.duration) {
      return step.duration;
    }

    if (!step.fn) {
      return 0;
    }

    try {
      return await step.fn({
        workflowId: params.workflowId,
        runId,
        mastra: this.mastra!,
        runtimeContext,
        inputData: params.input,
        // TODO: implement state
        state: {},
        setState: (_state: any) => {
          // TODO
        },
        runCount: retryCount,
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
        // TODO
        writer: undefined as any,
        [EMITTER_SYMBOL]: ee as unknown as Emitter, // TODO: refactor this to use our PubSub actually
        [STREAM_FORMAT_SYMBOL]: undefined, // TODO
        engine: {},
        abortSignal: abortController?.signal,
        // TODO
        tracingContext: {},
      });
    } catch (e) {
      console.error('error evaluating condition', e);
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
    emitter: { runtime: PubSub; events: PubSub };
    runtimeContext: RuntimeContext;
    retryCount?: number;
  }): Promise<number> {
    const { step, stepResults, runId, runtimeContext, retryCount = 0 } = params;

    const abortController = new AbortController();
    const ee = new EventEmitter();

    if (step.date) {
      return step.date.getTime() - Date.now();
    }

    if (!step.fn) {
      return 0;
    }

    try {
      const result = await step.fn({
        workflowId: params.workflowId,
        runId,
        mastra: this.mastra!,
        runtimeContext,
        inputData: params.input,
        // TODO: implement state
        state: {},
        setState: (_state: any) => {
          // TODO
        },
        runCount: retryCount,
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
        // TODO
        writer: undefined as any,
        [EMITTER_SYMBOL]: ee as unknown as Emitter, // TODO: refactor this to use our PubSub actually
        [STREAM_FORMAT_SYMBOL]: undefined, // TODO
        engine: {},
        abortSignal: abortController?.signal,
        // TODO
        tracingContext: {},
      });

      return result.getTime() - Date.now();
    } catch (e) {
      console.error('error evaluating condition', e);
      return 0;
    }
  }
}
