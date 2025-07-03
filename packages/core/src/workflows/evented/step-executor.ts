import EventEmitter from 'events';
import type { Emitter, Mastra, StepFlowEntry, StepResult } from '../..';
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

  async execute(params: {
    step: Extract<StepFlowEntry, { type: 'step' }>;
    runId: string;
    input?: any;
    resumeData?: any;
    stepResults: Record<string, StepResult<any, any, any, any>>;
    emitter: { runtime: PubSub; events: PubSub };
    runtimeContext: RuntimeContext;
  }): Promise<StepResult<any, any, any, any>> {
    const { step, stepResults, runId, runtimeContext } = params;

    const abortController = new AbortController();
    const ee = new EventEmitter();

    let suspended: { payload: any } | undefined;
    let bailed: { payload: any } | undefined;
    const startedAt = Date.now();
    let stepInfo = {
      startedAt,
      payload: params.input,
      resumePayload: undefined,
    };

    if (params.resumeData) {
      stepInfo.resumePayload = params.resumeData;
    }

    try {
      const stepResult = await step.step.execute({
        runId,
        mastra: this.mastra!,
        runtimeContext,
        inputData: params.input,
        runCount: 0, // TODO: implement this
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
          suspended = { payload: suspendPayload };
        },
        bail: (result: any) => {
          bailed = { payload: result };
        },
        abort: () => {
          abortController?.abort();
        },
        [EMITTER_SYMBOL]: ee as unknown as Emitter, // TODO: refactor this to use our PubSub actually
        engine: {},
        abortSignal: abortController?.signal,
      });

      const endedAt = Date.now();

      let finalResult: StepResult<any, any, any, any>;
      if (suspended) {
        finalResult = {
          ...stepInfo,
          status: 'suspended',
          suspendedAt: endedAt,
          suspendPayload: suspended.payload,
        };
      } else if (bailed) {
        finalResult = {
          ...stepInfo,
          status: 'waiting',
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
    } catch (e: any) {
      const endedAt = Date.now();

      return {
        ...stepInfo,
        status: 'failed',
        endedAt,
        error: e,
      };
    }
  }
}
