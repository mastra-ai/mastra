import EventEmitter from 'events';
import type { Emitter, ExecuteFunction, Mastra, Step, StepFlowEntry, StepResult } from '../..';
import { MastraBase } from '../../base';
import type { RuntimeContext } from '../../di';
import type { PubSub } from '../../events';
import { RegisteredLogger } from '../../logger';
import { EMITTER_SYMBOL } from '../constants';

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
    emitter: EventEmitter;
    runtimeContext: RuntimeContext;
    runCount?: number;
    foreachIdx?: number;
  }): Promise<StepResult<any, any, any, any>> {
    const { step, stepResults, runId, runtimeContext, runCount = 0 } = params;

    const abortController = new AbortController();

    let suspended: { payload: any } | undefined;
    let bailed: { payload: any } | undefined;
    const startedAt = Date.now();
    let stepInfo: {
      startedAt: number;
      payload: any;
      resumePayload?: any;
      resumedAt?: number;
      [key: string]: any;
    } = {
      ...stepResults[step.id],
      startedAt,
      payload: params.input ?? {},
    };

    if (params.resumeData) {
      delete stepInfo.suspendPayload?.['__workflow_meta'];
      stepInfo.resumePayload = params.resumeData;
      stepInfo.resumedAt = Date.now();
    }

    try {
      const stepResult = await step.execute({
        workflowId: params.workflowId,
        runId,
        mastra: this.mastra!,
        runtimeContext,
        inputData: typeof params.foreachIdx === 'number' ? params.input?.[params.foreachIdx] : params.input,
        runCount,
        resumeData: params.resumeData,
        getInitData: () => stepResults?.input as any,
        getStepResult: (step: any) => {
          if (!step?.id) {
            return null;
          }

          const result = stepResults[step.id];
          if (result?.status === 'success') {
            return result.output;
          }

          return null;
        },
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
    emitter: { runtime: PubSub; events: PubSub };
    runtimeContext: RuntimeContext;
    runCount?: number;
  }): Promise<number[]> {
    const { step, stepResults, runId, runtimeContext, runCount = 0 } = params;

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
            runCount,
            resumeData: params.resumeData,
            abortController,
            stepResults,
            emitter: ee,
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
    runtimeContext,
    emitter,
    abortController,
    runCount = 0,
  }: {
    workflowId: string;
    condition: ExecuteFunction<any, any, any, any, any>;
    runId: string;
    inputData?: any;
    resumeData?: any;
    stepResults: Record<string, StepResult<any, any, any, any>>;
    emitter: EventEmitter;
    runtimeContext: RuntimeContext;
    abortController: AbortController;
    runCount?: number;
  }): Promise<boolean> {
    return condition({
      workflowId,
      runId,
      mastra: this.mastra!,
      runtimeContext,
      inputData,
      runCount,
      resumeData: resumeData,
      getInitData: () => stepResults?.input as any,
      getStepResult: (step: any) => {
        if (!step?.id) {
          return null;
        }

        const result = stepResults[step.id];
        if (result?.status === 'success') {
          return result.output;
        }

        return null;
      },
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
      engine: {},
      abortSignal: abortController?.signal,
      // TODO
      tracingContext: {},
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
    runCount?: number;
  }): Promise<number> {
    const { step, stepResults, runId, runtimeContext, runCount = 0 } = params;

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
        runCount,
        resumeData: params.resumeData,
        getInitData: () => stepResults?.input as any,
        getStepResult: (step: any) => {
          if (!step?.id) {
            return null;
          }

          const result = stepResults[step.id];
          if (result?.status === 'success') {
            return result.output;
          }

          return null;
        },
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
    runCount?: number;
  }): Promise<number> {
    const { step, stepResults, runId, runtimeContext, runCount = 0 } = params;

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
        runCount,
        resumeData: params.resumeData,
        getInitData: () => stepResults?.input as any,
        getStepResult: (step: any) => {
          if (!step?.id) {
            return null;
          }

          const result = stepResults[step.id];
          if (result?.status === 'success') {
            return result.output;
          }

          return null;
        },
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
