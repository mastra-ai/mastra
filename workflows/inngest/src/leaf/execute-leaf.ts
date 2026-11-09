import { TripWire } from '@mastra/core/agent';
import { getErrorFromUnknown } from '@mastra/core/error';
import type { PubSub } from '@mastra/core/events';
import type { Mastra } from '@mastra/core/mastra';
import { createObservabilityContext } from '@mastra/core/observability';
import { RequestContext } from '@mastra/core/request-context';
import { diffState } from '@mastra/core/storage';
import type { StatePatchOp, WorkflowsStorage } from '@mastra/core/storage';
import { DefaultExecutionEngine } from '@mastra/core/workflows';
import type {
  ExecutionEngineOptions,
  OutputWriter,
  SerializedStepFlowEntry,
  Step,
  StepFlowEntry,
} from '@mastra/core/workflows';
import { isNonRetryableStepFailure } from '../step-failure';
import type { LeafOutcome, LeafRequest } from './contracts';
import { LeafInfrastructureError } from './contracts';

type ExecuteStepParams = Parameters<DefaultExecutionEngine['executeStep']>[0];

/** The step a leaf runs: a plain `step` entry anywhere in the graph, found by id. */
export function findGraphStep(entries: StepFlowEntry[], stepId: string): Step<any, any, any> | undefined {
  for (const entry of entries) {
    const found = findInEntry(entry as StepFlowEntry, stepId);
    if (found) return found;
  }
  return undefined;
}

function findInEntry(entry: StepFlowEntry, stepId: string): Step<any, any, any> | undefined {
  switch (entry.type) {
    case 'step':
      return entry.step.id === stepId ? entry.step : undefined;
    case 'parallel':
    case 'conditional':
      return findGraphStep(entry.steps as StepFlowEntry[], stepId);
    case 'loop':
    case 'foreach':
      return findInEntry(entry.step as StepFlowEntry, stepId);
    default:
      return undefined;
  }
}

class LeafCaptured {
  constructor(readonly outcome: LeafOutcome & { stateUpdate?: Record<string, any> | null }) {}
}

/**
 * Runs one step through core's step handler, once, without writing anything: the parent run owns
 * persistence, retries, spans for the step's lifecycle, and scorers. It captures what the step
 * runner returned, or what the step's code threw, and stops the handler there.
 */
class LeafExecutionEngine extends DefaultExecutionEngine {
  constructor(
    mastra: Mastra | undefined,
    options: ExecutionEngineOptions,
    private readonly attempt: number,
  ) {
    super({ mastra, options });
  }

  override getOrGenerateRetryCount(): number {
    return this.attempt;
  }

  override requiresDurableContextSerialization(): boolean {
    return true;
  }

  override async persistStepUpdate(): Promise<void> {}

  override async executeStepWithRetry<T>(_stepId: string, runStep: () => Promise<T>): Promise<never> {
    let result: any;
    try {
      result = await runStep();
    } catch (e) {
      const error = getErrorFromUnknown(e, { serializeStack: false, fallbackMessage: 'Unknown step execution error' });
      throw new LeafCaptured({
        status: 'failed',
        error: error.toJSON(),
        endedAt: Date.now(),
        ...(isNonRetryableStepFailure(e) && { nonRetryable: true as const }),
        ...(e instanceof TripWire && {
          tripwire: {
            reason: e.message,
            retry: e.options?.retry,
            metadata: e.options?.metadata,
            processorId: e.processorId,
          },
        }),
      });
    }
    const { contextMutations, ...rest } = result;
    const { stateUpdate, stateBase: _stateBase, ...mutations } = contextMutations;
    throw new LeafCaptured({ status: 'completed', result: { ...rest, contextMutations: mutations }, stateUpdate });
  }
}

/** Runs a leaf request's step once. Infrastructure failures throw; the step's own failures are an outcome. */
export async function executeLeaf(args: {
  mastra: Mastra | undefined;
  store: WorkflowsStorage;
  options: ExecutionEngineOptions;
  graph: StepFlowEntry[];
  serializedStepGraph: SerializedStepFlowEntry[];
  request: LeafRequest;
  pubsub: PubSub;
  outputWriter: OutputWriter;
  actor?: unknown;
}): Promise<{ outcome: LeafOutcome; statePatch: StatePatchOp[] }> {
  const { request, store } = args;
  const step = findGraphStep(args.graph, request.stepId);
  if (!step) {
    throw new LeafInfrastructureError(`Workflow ${request.workflowId} has no step ${request.stepId} to run as a leaf`);
  }
  const base = await store.loadWorkflowRunState({
    workflowName: request.workflowId,
    runId: request.runId,
    seq: request.baseSeq,
  });
  const run = await store.loadWorkflowRun({
    workflowName: request.workflowId,
    runId: request.runId,
    successfulSteps: 'full',
  });
  if (!base || !run) {
    throw new LeafInfrastructureError(`Storage v2 run ${request.workflowId}/${request.runId} is not stored`);
  }

  const engine = new LeafExecutionEngine(args.mastra, args.options, request.attempt);
  const params: ExecuteStepParams = {
    workflowId: request.workflowId,
    runId: request.runId,
    resourceId: request.resourceId,
    step,
    stepResults: run.steps as ExecuteStepParams['stepResults'],
    executionContext: { ...request.executionContext, state: structuredClone(base) },
    resume: request.resume,
    prevOutput: request.prevOutput,
    pubsub: args.pubsub,
    abortController: new AbortController(),
    requestContext: new RequestContext(Object.entries(request.requestContext ?? {})),
    actor: args.actor as ExecuteStepParams['actor'],
    // The parent run emits the step's lifecycle events and runs its scorers.
    skipEmits: true,
    disableScorers: true,
    outputWriter: args.outputWriter,
    serializedStepGraph: args.serializedStepGraph,
    iterationCount: request.iterationCount,
    perStep: request.perStep,
    // The parent run owns the step span; the leaf records none.
    ...createObservabilityContext(),
  };

  try {
    await engine.executeStep(params);
  } catch (e) {
    if (!(e instanceof LeafCaptured)) throw e;
    const { stateUpdate, ...outcome } = e.outcome as LeafOutcome & { stateUpdate?: Record<string, any> | null };
    // The parent merges a step's state update into its state key by key, so the leaf's patch is
    // the change from the base to the base merged with the update.
    const statePatch =
      outcome.status === 'completed' && stateUpdate ? diffState(base, { ...base, ...stateUpdate }) : [];
    return { outcome, statePatch };
  }
  throw new LeafInfrastructureError(`Step ${request.stepId} of ${request.workflowId} ended before its code ran`);
}
