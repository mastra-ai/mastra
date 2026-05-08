import { randomUUID } from 'node:crypto';
import type { RequestContext } from '../../di';
import type { PubSub } from '../../events/pubsub';
import { SpanType, createObservabilityContext, resolveObservabilityContext } from '../../observability';
import type { ObservabilityContext } from '../../observability';
import { ToolStream } from '../../tools/stream';
import { PUBSUB_SYMBOL, STREAM_FORMAT_SYMBOL } from '../constants';
import type { DefaultExecutionEngine } from '../default';
import type { ExecuteFunction, InnerOutput } from '../step';
import { getStepResult } from '../step';
import type {
  DefaultEngineType,
  ExecutionContext,
  OutputWriter,
  SerializedStepFlowEntry,
  StepFlowEntry,
  StepResult,
} from '../types';

export interface ExecuteSleepParams extends ObservabilityContext {
  workflowId: string;
  runId: string;
  serializedStepGraph: SerializedStepFlowEntry[];
  entry: {
    type: 'sleep';
    id: string;
    duration?: number;
    fn?: ExecuteFunction<any, any, any, any, any, DefaultEngineType>;
  };
  prevStep: StepFlowEntry;
  prevOutput: any;
  stepResults: Record<string, StepResult<any, any, any, any>>;
  resume?: {
    steps: string[];
    stepResults: Record<string, StepResult<any, any, any, any>>;
    resumePayload: any;
    resumePath: number[];
  };
  executionContext: ExecutionContext;
  pubsub: PubSub;
  abortController: AbortController;
  requestContext: RequestContext;
  outputWriter?: OutputWriter;
}

export async function executeSleep(engine: DefaultExecutionEngine, params: ExecuteSleepParams): Promise<void> {
  const {
    workflowId,
    runId,
    entry,
    prevOutput,
    stepResults,
    pubsub,
    abortController,
    requestContext,
    executionContext,
    outputWriter,
    ...rest
  } = params;

  const observabilityContext = resolveObservabilityContext(rest);

  let { duration, fn } = entry;

  const sleepSpan = await engine.createChildSpan({
    parentSpan: observabilityContext.tracingContext.currentSpan,
    operationId: `workflow.${workflowId}.run.${runId}.sleep.${entry.id}.span.start`,
    options: {
      type: SpanType.WORKFLOW_SLEEP,
      name: `sleep: ${duration ? `${duration}ms` : 'dynamic'}`,
      attributes: {
        durationMs: duration,
        sleepType: fn ? 'dynamic' : 'fixed',
      },
    },
    executionContext,
  });

  if (fn) {
    const stepCallId = randomUUID();
    duration = await engine.wrapDurableOperation(`workflow.${workflowId}.sleep.${entry.id}`, async () => {
      return fn({
        runId,
        workflowId,
        mastra: engine.mastra!,
        requestContext,
        inputData: prevOutput,
        state: executionContext.state,
        setState: async (state: any) => {
          executionContext.state = state;
        },
        retryCount: -1,
        ...createObservabilityContext({ currentSpan: sleepSpan }),
        getInitData: () => stepResults?.input as any,
        getStepResult: getStepResult.bind(null, stepResults),
        // TODO: this function shouldn't have suspend probably?
        suspend: async (_suspendPayload: any): Promise<any> => {},
        bail: (() => {}) as () => InnerOutput,
        abort: () => {
          abortController?.abort();
        },
        [PUBSUB_SYMBOL]: pubsub,
        [STREAM_FORMAT_SYMBOL]: executionContext.format,
        engine: engine.getEngineContext(),
        abortSignal: abortController?.signal,
        writer: new ToolStream(
          {
            prefix: 'workflow-step',
            callId: stepCallId,
            name: 'sleep',
            runId,
          },
          outputWriter,
        ),
      });
    });

    // Update sleep span with dynamic duration
    sleepSpan?.update({
      attributes: {
        durationMs: duration,
      },
    });
  }

  try {
    await engine.executeSleepDuration(!duration || duration < 0 ? 0 : duration, entry.id, workflowId);
    await engine.endChildSpan({
      span: sleepSpan,
      operationId: `workflow.${workflowId}.run.${runId}.sleep.${entry.id}.span.end`,
    });
  } catch (e) {
    await engine.errorChildSpan({
      span: sleepSpan,
      operationId: `workflow.${workflowId}.run.${runId}.sleep.${entry.id}.span.error`,
      errorOptions: { error: e as Error },
    });
    throw e;
  }
}

export interface ExecuteSleepUntilParams extends ObservabilityContext {
  workflowId: string;
  runId: string;
  serializedStepGraph: SerializedStepFlowEntry[];
  entry: {
    type: 'sleepUntil';
    id: string;
    date?: Date;
    fn?: ExecuteFunction<any, any, any, any, any, DefaultEngineType>;
  };
  prevStep: StepFlowEntry;
  prevOutput: any;
  stepResults: Record<string, StepResult<any, any, any, any>>;
  resume?: {
    steps: string[];
    stepResults: Record<string, StepResult<any, any, any, any>>;
    resumePayload: any;
    resumePath: number[];
  };
  executionContext: ExecutionContext;
  pubsub: PubSub;
  abortController: AbortController;
  requestContext: RequestContext;
  outputWriter?: OutputWriter;
}

export async function executeSleepUntil(
  engine: DefaultExecutionEngine,
  params: ExecuteSleepUntilParams,
): Promise<void> {
  const {
    workflowId,
    runId,
    entry,
    prevOutput,
    stepResults,
    pubsub,
    abortController,
    requestContext,
    executionContext,
    outputWriter,
    ...rest
  } = params;

  const observabilityContext = resolveObservabilityContext(rest);

  let { date, fn } = entry;

  const sleepUntilSpan = await engine.createChildSpan({
    parentSpan: observabilityContext.tracingContext.currentSpan,
    operationId: `workflow.${workflowId}.run.${runId}.sleepUntil.${entry.id}.span.start`,
    options: {
      type: SpanType.WORKFLOW_SLEEP,
      name: `sleepUntil: ${date ? date.toISOString() : 'dynamic'}`,
      attributes: {
        untilDate: date,
        durationMs: date ? Math.max(0, date.getTime() - Date.now()) : undefined,
        sleepType: fn ? 'dynamic' : 'fixed',
      },
    },
    executionContext,
  });

  if (fn) {
    const stepCallId = randomUUID();
    const dateResult = await engine.wrapDurableOperation(`workflow.${workflowId}.sleepUntil.${entry.id}`, async () => {
      return fn({
        runId,
        workflowId,
        mastra: engine.mastra!,
        requestContext,
        inputData: prevOutput,
        state: executionContext.state,
        setState: async (state: any) => {
          executionContext.state = state;
        },
        retryCount: -1,
        ...createObservabilityContext({ currentSpan: sleepUntilSpan }),
        getInitData: () => stepResults?.input as any,
        getStepResult: getStepResult.bind(null, stepResults),
        // TODO: this function shouldn't have suspend probably?
        suspend: async (_suspendPayload: any): Promise<any> => {},
        bail: (() => {}) as () => InnerOutput,
        abort: () => {
          abortController?.abort();
        },
        [PUBSUB_SYMBOL]: pubsub,
        [STREAM_FORMAT_SYMBOL]: executionContext.format,
        engine: engine.getEngineContext(),
        abortSignal: abortController?.signal,
        writer: new ToolStream(
          {
            prefix: 'workflow-step',
            callId: stepCallId,
            name: 'sleepUntil',
            runId,
          },
          outputWriter,
        ),
      });
    });
    // Ensure date is a Date object (may be serialized as string by durable execution engines)
    date = dateResult instanceof Date ? dateResult : new Date(dateResult);

    // Update sleep until span with dynamic duration
    const time = !date ? 0 : date.getTime() - Date.now();
    sleepUntilSpan?.update({
      attributes: {
        durationMs: Math.max(0, time),
      },
    });
  }

  if (!date) {
    await engine.endChildSpan({
      span: sleepUntilSpan,
      operationId: `workflow.${workflowId}.run.${runId}.sleepUntil.${entry.id}.span.end.nodate`,
    });
    return;
  }

  try {
    await engine.executeSleepUntilDate(date, entry.id, workflowId);
    await engine.endChildSpan({
      span: sleepUntilSpan,
      operationId: `workflow.${workflowId}.run.${runId}.sleepUntil.${entry.id}.span.end`,
    });
  } catch (e) {
    await engine.errorChildSpan({
      span: sleepUntilSpan,
      operationId: `workflow.${workflowId}.run.${runId}.sleepUntil.${entry.id}.span.error`,
      errorOptions: { error: e as Error },
    });
    throw e;
  }
}
