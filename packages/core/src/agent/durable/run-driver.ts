import { ErrorCategory, ErrorDomain, MastraError } from '../../error';
import type { PubSub } from '../../events/pubsub';
import { validateModelTimeoutSettings } from '../../llm/model/model-settings';
import type { IMastraLogger } from '../../logger';
import { LOCAL_MODEL_REQUEST_KEY } from '../../loop/run-scope-keys';
import type { Mastra } from '../../mastra';
import { createRunScope } from '../../mastra/run-scope';
import {
  createObservabilityContext,
  EntityType,
  getOrCreateSpan,
  getWorkflowResumeTracingContext,
  SpanType,
} from '../../observability';
import { MASTRA_SCOPES_KEY, RequestContext, withoutLiveRequestKeys } from '../../request-context';
import { ChunkFrom } from '../../stream';
import type { ToolCallChunk } from '../../stream/types';
import type { CoreTool } from '../../tools/types';
import { rebindProcessorTools } from '../../utils';
import type { WorkflowRunState } from '../../workflows/types';
import type { Agent } from '../agent';
import type { AgentExecutionOptions } from '../agent.types';
import { beginGoalActivity, stopGoalActivity } from '../goal';
import { resolveRunId } from '../helpers';
import type { MessageList, MessageListInput } from '../message-list';
import { modelSpanAttributes } from '../model-span-attributes';
import { buildResumeSpanInput } from '../resume-span-input';
import { restoreRunAgentScopes } from '../scopes';
import type { AgentScopesSnapshot } from '../scopes';
import { agentThreadStreamRuntime } from '../thread-stream-runtime';
import { DurableStepIds } from './constants';
import type { DefaultAgentExecutionEngine, DurableWorkflow } from './execution-engine';
import type { ExecutionFence } from './execution-fence';
import { fencePubSub, setExecutionClaim } from './execution-fence';
import type { PreparationResult } from './preparation';
import { prepareForDurableExecution, RESUMED_SPAN_DATA, SCOPES_ALREADY_APPLIED } from './preparation';
import { createRunAbortController } from './run-abort';
import { createRunCleanup } from './run-cleanup';
import type { ExtendedRunRegistry } from './run-registry';
import { getRunRegistryEntry, globalRunRegistry } from './run-registry';
import { carrySegmentSpans, openedSegment } from './segment-spans';
import type { SegmentSpanData } from './segment-spans';
import type { DurableStreamAdapterOptions } from './stream-adapter';
import { createDurableAgentStream, emitChunkEvent } from './stream-adapter';
import type {
  DurableAgenticWorkflowInput,
  DurableAgentStreamOptions,
  DurableAgentStreamResult,
  RunRegistryEntry,
} from './types';

interface DurableRunDriver {
  engine: DefaultAgentExecutionEngine;
  getWorkflow: () => DurableWorkflow;
  getEntry: () => RunRegistryEntry | undefined;
  workflowEngine: 'default' | 'evented';
  runId: string;
  input: DurableAgenticWorkflowInput;
  hostPubsub?: PubSub;
  getLocalPubsub: () => PubSub | undefined;
  logger: IMastraLogger;
  guardrailLogger: IMastraLogger;
  fenceRunPubSub: (fence: ExecutionFence | undefined, controller: AbortController | undefined) => PubSub;
  afterSuspensionPersisted: <T>(runId: string, execute: () => Promise<T>) => Promise<T>;
  settle: (
    runId: string,
    fence: ExecutionFence | undefined,
    outcome: { status?: string; error?: Error },
  ) => Promise<void>;
  discardStart: (runId: string, agentId: string) => Promise<void>;
  emitError: (runId: string, error: Error, generation?: number) => Promise<void>;
}

/**
 * Claim before touching memory or starting a span. A preparation failure must
 * settle the claim, while a successful preparation transfers ownership of the
 * serialized input and local state to this execution segment.
 */
export async function prepareDurableRun<OUTPUT>({
  runId,
  requestContext,
  claim,
  prepare,
  rememberInput,
}: {
  runId: string;
  requestContext: RequestContext;
  claim: () => Promise<ExecutionFence>;
  prepare: () => Promise<PreparationResult<OUTPUT>>;
  rememberInput: (fence: ExecutionFence, input: DurableAgenticWorkflowInput) => void;
}) {
  const executionFence = await claim();
  let preparation: PreparationResult<OUTPUT>;
  try {
    preparation = await prepare();
  } catch (error) {
    await executionFence.settle(async () => {});
    throw error;
  }
  setExecutionClaim(requestContext, runId, executionFence.claim);
  preparation.registryEntry.executionFence = executionFence;
  rememberInput(executionFence, preparation.workflowInput);
  return { executionFence, preparation };
}

/**
 * Register the live, non-serializable half of a prepared durable run. The
 * release closure only removes entries and topics still owned by this segment.
 */
export async function registerDurableRun({
  runId,
  agentId,
  methodType,
  registryEntry,
  messageList,
  threadId,
  resourceId,
  mastra,
  registry,
  attachPublisher,
  beginSegment,
  releaseSegment,
  readerIsUnverified,
  clearTopic,
}: {
  runId: string;
  agentId: string;
  methodType: 'stream' | 'generate';
  registryEntry: RunRegistryEntry;
  messageList: MessageList;
  threadId?: string;
  resourceId?: string;
  mastra?: Mastra;
  registry: ExtendedRunRegistry;
  attachPublisher: () => Promise<void>;
  beginSegment: () => symbol;
  releaseSegment: (segment: symbol) => boolean;
  readerIsUnverified: () => boolean;
  clearTopic: (entry: RunRegistryEntry) => void;
}) {
  registryEntry.agentId = agentId;
  registry.registerWithMessageList(runId, registryEntry, messageList, { threadId, resourceId });
  const globalRegistryEntry = { ...registryEntry, messageList };
  globalRunRegistry.set(runId, globalRegistryEntry);
  await attachPublisher();
  const segment = methodType === 'stream' ? beginSegment() : undefined;
  const releaseRunState = () => {
    if (segment !== undefined) {
      if (!releaseSegment(segment)) return;
    } else if (registry.get(runId) === registryEntry) {
      registry.cleanup(runId);
    }
    if (getRunRegistryEntry(runId, mastra) === globalRegistryEntry) {
      globalRunRegistry.delete(runId);
      if (!readerIsUnverified() && (globalRegistryEntry.executionFence?.ownsRunTopics() ?? true)) {
        clearTopic(globalRegistryEntry);
      }
    }
  };
  return releaseRunState;
}

function createLocalRequestReader(runId: string, entry: RunRegistryEntry, mastra: Mastra | undefined) {
  const scope = (entry.runScope ??= createRunScope());
  scope.delete(LOCAL_MODEL_REQUEST_KEY);
  const fence = entry.executionFence;
  return () => {
    const current = getRunRegistryEntry(runId, mastra);
    if (current?.runScope !== scope || current.executionFence !== fence || fence?.isLost()) return undefined;
    return scope.get(LOCAL_MODEL_REQUEST_KEY);
  };
}

type StartDurableRunHost<OUTPUT> = {
  agent: Agent<any, any, any, any>;
  executionAgent: Agent<string, any, OUTPUT>;
  mastra?: Mastra;
  engine: DefaultAgentExecutionEngine;
  runPubsub: PubSub;
  getLocalPubsub: () => PubSub | undefined;
  registry: ExtendedRunRegistry;
  messages: MessageListInput;
  options: DurableAgentStreamOptions<OUTPUT>;
  methodType: 'stream' | 'generate';
  resolvedDefaultOptions?: AgentExecutionOptions<OUTPUT>;
  executionPolicyInherited: boolean;
  warnRequestContextSnapshot: () => void;
  admit: (options: {
    requestContext?: RequestContext;
    memory?: AgentExecutionOptions<OUTPUT>['memory'];
    runId?: string;
    actor?: AgentExecutionOptions<OUTPUT>['actor'];
  }) => Promise<void>;
  claimExecution: (runId: string, requestContext: RequestContext) => Promise<ExecutionFence>;
  rememberInput: (fence: ExecutionFence, input: DurableAgenticWorkflowInput) => void;
  installAbortWithTotalTimeout: (
    entry: RunRegistryEntry,
    abortController: AbortController,
    fence: ExecutionFence,
  ) => void;
  attachPublisher: (runId: string, ids: { threadId?: string; resourceId?: string }) => Promise<void>;
  beginSegment: (runId: string) => symbol;
  releaseSegment: (runId: string, segment: symbol, entry: RunRegistryEntry) => boolean;
  readerIsUnverified: (fence: ExecutionFence) => boolean;
  clearTopic: (runId: string, entry: RunRegistryEntry) => void;
  onTerminalEvent: (runId: string, fence: ExecutionFence) => DurableStreamAdapterOptions<OUTPUT>['onTerminalEvent'];
  scheduleReaderCleanup: (fence: ExecutionFence, cleanup: () => void) => NodeJS.Timeout | undefined;
  redeliverDeadlineError: (entry: RunRegistryEntry, fence: ExecutionFence) => Promise<boolean>;
  persistInitialInput: (runId: string, input: DurableAgenticWorkflowInput) => Promise<void>;
  executeWorkflow: (runId: string, input: DurableAgenticWorkflowInput) => Promise<{ status?: string } | void>;
  discardStart: (runId: string, agentId: string) => Promise<void>;
  releaseRestartableStart: (runId: string) => void;
  settle: (runId: string, fence: ExecutionFence, error: Error) => Promise<void>;
  hasGoal: () => boolean;
  requestRemoteAbort: (runId: string) => Promise<void>;
  abortRunStream: (runId: string) => void;
};

/** Own the durable start protocol from admission through the returned replayable reader. */
export async function startDurableRun<OUTPUT>(
  host: StartDurableRunHost<OUTPUT>,
): Promise<DurableAgentStreamResult<OUTPUT>> {
  const { options } = host;
  await host.admit({
    requestContext: options.requestContext,
    memory: options.memory,
    runId: options.runId,
    actor: options.actor,
  });
  validateModelTimeoutSettings(options.modelSettings?.timeout);

  const runId = resolveRunId(options.runId);
  const requestContext = options.requestContext ?? new RequestContext();
  const localPubsub = host.getLocalPubsub();
  const reserved =
    (await agentThreadStreamRuntime.waitForCrossAgentThreadRun(
      host.agent,
      { memory: options.memory, requestContext: options.requestContext, runId },
      localPubsub,
    )) === 'reserved';

  try {
    const { executionFence, preparation } = await prepareDurableRun({
      runId,
      requestContext,
      claim: () => host.claimExecution(runId, requestContext),
      prepare: () =>
        prepareForDurableExecution<OUTPUT>({
          agent: host.executionAgent,
          messages: host.messages,
          options: options as AgentExecutionOptions<OUTPUT>,
          runId,
          requestContext,
          optionsAreResolved: true,
          resolvedDefaultOptions: host.resolvedDefaultOptions,
          scopesResolved: true,
          onRequestContextEntryOmitted: host.executionPolicyInherited ? host.warnRequestContextSnapshot : undefined,
          mastra: host.mastra,
          methodType: host.methodType,
          durableAgentId: host.agent.id,
          durableAgentName: host.agent.name,
        }),
      rememberInput: host.rememberInput,
    });
    const { messageId, workflowInput, registryEntry, messageList, threadId, resourceId } = preparation;

    const { controller: abortController } = createRunAbortController(options.abortSignal);
    if (agentThreadStreamRuntime.isRunAborted(runId, localPubsub)) abortController.abort();
    host.installAbortWithTotalTimeout(registryEntry, abortController, executionFence);
    const readLocalRequest = createLocalRequestReader(runId, registryEntry, host.mastra);

    const releaseRunState = await registerDurableRun({
      runId,
      agentId: host.agent.id,
      methodType: host.methodType,
      registryEntry,
      messageList,
      threadId,
      resourceId,
      mastra: host.mastra,
      registry: host.registry,
      attachPublisher: () => host.attachPublisher(runId, { threadId, resourceId }),
      beginSegment: () => host.beginSegment(runId),
      releaseSegment: segment => host.releaseSegment(runId, segment, registryEntry),
      readerIsUnverified: () => host.readerIsUnverified(executionFence),
      clearTopic: entry => host.clearTopic(runId, entry),
    });

    return startDurableRunSession({
      agent: host.agent,
      mastra: host.mastra,
      engine: host.engine,
      runPubsub: host.runPubsub,
      getLocalPubsub: host.getLocalPubsub,
      runId,
      methodType: host.methodType,
      options,
      workflowInput,
      registryEntry,
      messageList,
      messageId,
      threadId,
      resourceId,
      executionFence,
      abortController,
      readLocalRequest,
      onTerminalEvent: host.onTerminalEvent(runId, executionFence),
      releaseRunState,
      scheduleReaderCleanup: cleanup => host.scheduleReaderCleanup(executionFence, cleanup),
      redeliverDeadlineError: () => host.redeliverDeadlineError(registryEntry, executionFence),
      persistInitialInput: () => host.persistInitialInput(runId, workflowInput),
      executeWorkflow: () => host.executeWorkflow(runId, workflowInput),
      discardStart: () => host.discardStart(runId, workflowInput.agentId),
      releaseRestartableStart: () => host.releaseRestartableStart(runId),
      settle: error => host.settle(runId, executionFence, error),
      hasGoal: host.hasGoal,
      requestRemoteAbort: () => host.requestRemoteAbort(runId),
      abortRunStream: () => host.abortRunStream(runId),
    });
  } catch (error) {
    if (reserved) agentThreadStreamRuntime.releaseThreadRunReservation(runId, localPubsub);
    throw error;
  }
}

/**
 * Owns the physical workflow start after the durable driver prepares and registers the run.
 * The selected engine determines local vs evented execution. Settlement and fencing
 * remain delegated to the owning Agent so subclasses can override executeWorkflow().
 */
export async function executeDurableRun(driver: DurableRunDriver): Promise<{ status?: string } | void> {
  const { engine, runId, input } = driver;

  if (engine.executionMode === 'blocking') {
    const workflow = driver.getWorkflow();
    const entry = driver.getEntry();
    const fence = entry?.executionFence;
    const memoryInfo = (input.messageListState as { memoryInfo?: { resourceId?: string } } | undefined)?.memoryInfo;
    const resourceId = input.state?.resourceId ?? memoryInfo?.resourceId;
    const run = await engine.createRun(workflow, {
      runId,
      resourceId,
      pubsub: driver.fenceRunPubSub(fence, entry?.abortController),
    });
    let result: Awaited<ReturnType<typeof engine.startRun>> | undefined;
    try {
      result = await driver.afterSuspensionPersisted(runId, () =>
        engine.startRun(
          run,
          input,
          entry?.requestContext,
          createObservabilityContext({ currentSpan: entry?.agentSpan }),
        ),
      );
      const outcome = engine.finishExecution(runId, fence, false, { result });
      if (outcome.owner === 'agent') await driver.settle(runId, fence, outcome);
      return result;
    } finally {
      engine.releaseRun(workflow, runId, run, result?.status);
    }
  }

  // A later resume may replace the registry's fence while this segment is
  // running; only the fence captured at start owns this segment's settlement.
  const entry = driver.getEntry();
  const fence = entry?.executionFence;
  const pubsub = driver.hostPubsub ?? driver.getLocalPubsub();
  const { sharedExecution, usesRunPubSub } = engine.prepareExecution(
    pubsub,
    fence,
    driver.workflowEngine,
    driver.logger,
    driver.guardrailLogger,
  );
  if (entry) entry.eventedExecution = sharedExecution;
  try {
    const workflow = driver.getWorkflow();
    await engine.ensureEngineWorkersStarted(driver.workflowEngine, driver.logger);
    const memoryInfo = (
      input.messageListState as { memoryInfo?: { threadId?: string; resourceId?: string } } | undefined
    )?.memoryInfo;
    const threadId = input.state?.threadId ?? memoryInfo?.threadId;
    const resourceId = input.state?.resourceId ?? memoryInfo?.resourceId;
    if (sharedExecution && pubsub && entry?.requestContext && fence && threadId) {
      await agentThreadStreamRuntime.claimDurableThreadLease(
        pubsub,
        runId,
        threadId,
        resourceId,
        fence.generation,
        fence.executionId,
        true,
      );
      try {
        await fence.verify();
      } catch (error) {
        await agentThreadStreamRuntime
          .abandonDurableThreadLease(pubsub, runId, threadId, resourceId, fence.generation, fence.executionId)
          .catch(releaseError =>
            driver.logger.warn('Failed to release thread lease after losing execution ownership', {
              runId,
              error: releaseError,
            }),
          );
        throw error;
      }
      setExecutionClaim(entry.requestContext, runId, { ...fence.claim, threadId, resourceId });
    }
    // Workers publish on the host bus; a hostless evented fallback needs this
    // run's pubsub or its reader would never see a terminal frame.
    const run = await engine.createRun(workflow, {
      runId,
      resourceId,
      ...(usesRunPubSub ? { pubsub: driver.fenceRunPubSub(fence, entry?.abortController) } : {}),
    });
    await engine
      .startRun(run, input, entry?.requestContext, createObservabilityContext({ currentSpan: entry?.agentSpan }))
      .then(
        result => engine.finishExecution(runId, fence, sharedExecution, { result }),
        async error => {
          await driver.discardStart(runId, input.agentId);
          return engine.finishExecution(runId, fence, sharedExecution, { error });
        },
      )
      .then(outcome => {
        if (outcome.owner === 'agent') return driver.settle(runId, fence, outcome);
        if (outcome.error) {
          return driver
            .emitError(runId, outcome.error, fence?.generation)
            .catch(publishError =>
              driver.logger.warn(`Failed to publish error event for run ${runId}`, { runId, error: publishError }),
            );
        }
      });
  } catch (error) {
    await driver.discardStart(runId, input.agentId);
    await driver.settle(runId, fence, {
      error: engine.workflowExecutionError(error, 'Workflow execution failed'),
    });
  }
}

/**
 * A durable stream is a subscriber of a checkpointed run, not the workflow's
 * live output. Subscribe and register its thread before emitting `start` or
 * dispatching execution; retain the reader through terminal delivery.
 */
export async function startDurableRunSession<OUTPUT>({
  agent,
  mastra,
  engine,
  runPubsub,
  getLocalPubsub,
  runId,
  methodType,
  options,
  workflowInput,
  registryEntry,
  messageList,
  messageId,
  threadId,
  resourceId,
  executionFence,
  abortController,
  readLocalRequest,
  onTerminalEvent,
  releaseRunState,
  scheduleReaderCleanup,
  redeliverDeadlineError,
  persistInitialInput,
  executeWorkflow,
  discardStart,
  releaseRestartableStart,
  settle,
  hasGoal,
  requestRemoteAbort,
  abortRunStream,
}: {
  agent: Agent<any, any, any, any>;
  mastra?: Mastra;
  engine: DefaultAgentExecutionEngine;
  runPubsub: PubSub;
  getLocalPubsub: () => PubSub | undefined;
  runId: string;
  methodType: 'stream' | 'generate';
  options: DurableAgentStreamOptions<OUTPUT>;
  workflowInput: DurableAgenticWorkflowInput;
  registryEntry: RunRegistryEntry;
  messageList: MessageList;
  messageId: string;
  threadId?: string;
  resourceId?: string;
  executionFence: ExecutionFence;
  abortController: AbortController;
  readLocalRequest: DurableStreamAdapterOptions<OUTPUT>['readLocalRequest'];
  onTerminalEvent: DurableStreamAdapterOptions<OUTPUT>['onTerminalEvent'];
  releaseRunState: () => void;
  scheduleReaderCleanup: (cleanup: () => void) => NodeJS.Timeout | undefined;
  redeliverDeadlineError: () => Promise<boolean>;
  persistInitialInput: () => Promise<void>;
  executeWorkflow: () => Promise<{ status?: string } | void>;
  discardStart: () => Promise<void>;
  releaseRestartableStart: () => void;
  settle: (error: Error) => Promise<void>;
  hasGoal: () => boolean;
  requestRemoteAbort: () => Promise<void>;
  abortRunStream: () => void;
}): Promise<DurableAgentStreamResult<OUTPUT>> {
  let streamCleanup: (() => void) | undefined;
  const runCleanup = createRunCleanup({
    scheduleTimer: scheduleReaderCleanup,
    release: () => {
      agentThreadStreamRuntime.closeRunContinuation(output, getLocalPubsub());
      streamCleanup?.();
      releaseRunState();
    },
    ...(methodType === 'generate' ? { releaseOnTimer: releaseRunState } : {}),
  });
  const closeOnSuspend = methodType === 'generate' || (options.closeOnSuspend ?? false);
  const closeOnPersistedSuspend = methodType === 'stream' && closeOnSuspend && engine.suspendPersistedOnReturn;
  const {
    output,
    cleanup: createdStreamCleanup,
    detach: detachStream,
    waitForEventDelivery,
    ready,
  } = createDurableAgentStream<OUTPUT>({
    pubsub: runPubsub,
    runId,
    minGeneration: executionFence.generation,
    onTerminalEvent,
    readLocalRequest,
    messageId,
    model: {
      modelId: workflowInput.modelConfig.modelId,
      provider: workflowInput.modelConfig.provider,
      version: 'v3',
    },
    threadId,
    resourceId,
    onChunk: options.onChunk,
    experimentalTransform: options.experimentalTransform,
    onStepFinish: options.onStepFinish,
    onFinish: options.onFinish,
    onStreamFinished: runCleanup.schedule,
    onError: async error => {
      await options.onError?.(error);
      runCleanup.schedule();
    },
    onSuspended: options.onSuspended,
    onAbort: async data => {
      try {
        await (options.onAbort as ((event: any) => void | Promise<void>) | undefined)?.(data);
      } finally {
        runCleanup.schedule();
      }
    },
    // Iteration callbacks run in the durable loop. A persisted suspension
    // closes only after the workflow returns, not on its early event.
    closeOnSuspend: closeOnSuspend && !closeOnPersistedSuspend,
    ...(methodType === 'stream' ? { hideSignals: options.hideSignals } : {}),
    structuredOutput: registryEntry.structuredOutput as any,
    outputProcessors: registryEntry.outputProcessors,
    processorStates: registryEntry.processorStates,
    agent: registryEntry.agent,
    requestContext: registryEntry.requestContext,
    returnScorerData: workflowInput.options.returnScorerData,
    tracingContext: registryEntry.agentSpan ? { currentSpan: registryEntry.agentSpan } : undefined,
    messageList,
    messageListFollowsStream: () => !engine.executesStepsLocally,
  });
  streamCleanup = createdStreamCleanup;

  const getEntry = () => getRunRegistryEntry(runId, mastra);
  const threadRegistration = agentThreadStreamRuntime.registerRun(
    agent,
    output,
    options as AgentExecutionOptions<OUTPUT>,
    getLocalPubsub(),
    {
      continuation: methodType === 'stream' && !closeOnSuspend ? 'across-suspension' : undefined,
      generation: executionFence.generation,
      ownershipLost: () => executionFence.isLost(),
      stepOwner: getEntry,
    },
  );

  const workflowExecution = executionFence.run(() =>
    Promise.all([ready, threadRegistration])
      .then(async () => {
        if (await redeliverDeadlineError()) return;
        await emitChunkEvent(fencePubSub(runPubsub, executionFence), runId, {
          type: 'start',
          runId,
          from: ChunkFrom.AGENT,
          payload: { id: workflowInput.agentId, messageId },
        });
        if (hasGoal()) {
          await beginGoalActivity({
            mastra,
            agentId: workflowInput.agentId,
            threadId,
            runId,
            requestContext: getEntry()?.requestContext,
          });
        }
        let result: { status?: string } | void;
        try {
          await persistInitialInput();
          result = await executeWorkflow();
        } catch (error) {
          await discardStart();
          throw error;
        } finally {
          releaseRestartableStart();
          await stopGoalActivity({ agentId: workflowInput.agentId, runId });
        }
        if (closeOnPersistedSuspend && result?.status === 'suspended') {
          await runPubsub.flush();
          await waitForEventDelivery();
          detachStream();
        }
        if (methodType === 'generate') return result;
      })
      .catch(error => settle(engine.workflowExecutionError(error, 'Workflow execution failed'))),
  );
  const trackedEntry = getEntry();
  if (trackedEntry) trackedEntry.workflowExecution = workflowExecution;
  await threadRegistration;

  const cleanup = () => {
    if (methodType === 'generate' || runCleanup.done || output.status !== 'running') return runCleanup.run();
    void Promise.race([workflowExecution, executionFence.whenSettled])
      .then(() => runPubsub.flush())
      .then(() => waitForEventDelivery())
      .catch(() => {})
      .finally(runCleanup.run);
  };
  const abort = async (reason?: unknown) => {
    if (!abortController.signal.aborted) abortController.abort(reason);
    await requestRemoteAbort();
    if (agentThreadStreamRuntime.isRunParked(runId, getLocalPubsub())) abortRunStream();
  };
  return {
    output,
    get fullStream() {
      return output.fullStream as ReadableStream<any>;
    },
    runId,
    threadId,
    resourceId,
    traceId: output.traceId,
    spanId: output.spanId,
    cleanup,
    abort,
  };
}

type ResumeDurableRunHost<OUTPUT> = {
  agent: Agent<any, any, OUTPUT>;
  executionAgent: Agent<any, any, OUTPUT>;
  mastra?: Mastra;
  engine: DefaultAgentExecutionEngine;
  workflowEngine: 'default' | 'evented';
  runPubsub: PubSub;
  getLocalPubsub: () => PubSub | undefined;
  registry: ExtendedRunRegistry;
  logger: IMastraLogger;
  storedVersionApplied: boolean;
  resolveOptions: (
    options?: DurableAgentStreamOptions<OUTPUT>,
    snapshot?: AgentScopesSnapshot,
  ) => Promise<DurableAgentStreamOptions<OUTPUT>>;
  takeOverResumeClaim: (runId: string, workflowsStore: any) => Promise<WorkflowRunState>;
  prepare: (messages: MessageListInput, options: AgentExecutionOptions<OUTPUT>) => Promise<any>;
  runUntilIdle: (
    options: DurableAgentStreamOptions<OUTPUT> & { maxIdleMs?: number },
    tracingOptions: Record<string, unknown> | undefined,
  ) => Promise<DurableAgentStreamResult<OUTPUT>>;
  admit: (args: {
    requestContext?: RequestContext;
    memory?: DurableAgentStreamOptions<OUTPUT>['memory'];
    runId: string;
    snapshotMemoryInfo?: { resourceId?: string; threadId?: string };
    actor?: DurableAgentStreamOptions<OUTPUT>['actor'];
  }) => Promise<void>;
  claimExecution: (runId: string, mode: 'acquire') => Promise<ExecutionFence>;
  coverMemory: (fence: ExecutionFence, requestContext: RequestContext) => Promise<void>;
  loadSuspendedIteration: (
    runId: string,
  ) => Promise<{ toolCalls: ToolCallChunk[]; resumedText?: { priorText: string; stepText: string } }>;
  loadRecalledMessages: (
    runId: string,
    snapshot: WorkflowRunState | undefined,
    requestContext: RequestContext,
  ) => Promise<void>;
  installAbortWithTotalTimeout: (
    entry: RunRegistryEntry,
    abortController: AbortController,
    fence: ExecutionFence,
  ) => void;
  rememberInput: (fence: ExecutionFence, input: DurableAgenticWorkflowInput) => void;
  beginSegment: (runId: string) => symbol;
  releaseSegment: (runId: string, segment: symbol, entry: RunRegistryEntry) => boolean;
  readerIsUnverified: (fence: ExecutionFence) => boolean;
  clearTopic: (runId: string, entry?: RunRegistryEntry) => void;
  onTerminalEvent: (runId: string, fence: ExecutionFence) => DurableStreamAdapterOptions<OUTPUT>['onTerminalEvent'];
  scheduleReaderCleanup: (fence: ExecutionFence, cleanup: () => void) => NodeJS.Timeout | undefined;
  redeliverDeadlineError: (entry: RunRegistryEntry, fence: ExecutionFence) => Promise<boolean>;
  getWorkflow: () => DurableWorkflow;
  fenceRunPubSub: (fence: ExecutionFence, controller?: AbortController) => PubSub;
  hasGoal: () => boolean;
  afterSuspensionPersisted: <T>(
    runId: string,
    operation: () => Promise<T>,
    options?: { workflowEngine?: 'default' | 'evented'; timeoutMs?: number },
  ) => Promise<T>;
  settle: (runId: string, fence: ExecutionFence, outcome: { status?: string; error?: Error }) => Promise<void>;
  requestRemoteAbort: (runId: string) => Promise<void>;
  abortRunStream: (runId: string) => boolean | void;
};

/**
 * Rehydrates or acquires a durable run, then starts the resumed reader segment.
 * The driver owns resume ordering and session lifecycle while the Agent supplies
 * its overridable preparation, admission, workflow, and registry primitives.
 */
export async function resumeDurableRun<OUTPUT>({
  host,
  runId,
  resumeData,
  options,
  releaseResumeMarker,
}: {
  host: ResumeDurableRunHost<OUTPUT>;
  runId: string;
  resumeData: unknown;
  options?: DurableAgentStreamOptions<OUTPUT>;
  releaseResumeMarker: () => void;
}): Promise<DurableAgentStreamResult<OUTPUT>> {
  let entry = host.registry.get(runId);
  // Scopes persisted with a run rebuilt from storage. They are the suspended run's set even when
  // the caller passes its own request context.
  let rehydratedScopes: unknown;
  let coldSnapshot: WorkflowRunState | undefined;
  if (!entry) {
    // A persisted durable run can outlive this process (or the registry TTL).
    // Rebuild the non-serializable runtime state before resuming the stored
    // workflow snapshot. Keep warm resumes on the existing path to avoid
    // racing an active registry entry with a second preparation pass.
    const workflowsStore = await host.mastra?.getStorage()?.getStore('workflows');
    const persisted = workflowsStore ? await host.engine.loadPersistedRunSnapshot(workflowsStore, runId) : undefined;
    if (!persisted) {
      throw new MastraError({
        id: 'AGENT_RESUME_NO_SNAPSHOT_FOUND',
        domain: ErrorDomain.AGENT,
        category: ErrorCategory.USER,
        text: `No registry entry found for run ${runId}. Cannot resume.`,
        details: { agentName: host.agent.name, runId },
      });
    }

    let snapshot = persisted.snapshot;
    const readWorkflowInput = (snapshot: WorkflowRunState, allowRunning = false) => {
      if (snapshot?.status !== 'suspended' && !(allowRunning && snapshot?.status === 'running')) {
        throw new MastraError({
          id: 'AGENT_RESUME_RUN_NOT_SUSPENDED',
          domain: ErrorDomain.AGENT,
          category: ErrorCategory.USER,
          text: `DurableAgent "${host.agent.name}" resume(${runId}) cannot resume the run because it is not waiting to be resumed (status: ${snapshot?.status}).`,
          details: { agentName: host.agent.name, runId, status: snapshot?.status },
        });
      }
      const input = snapshot?.context?.input as DurableAgenticWorkflowInput | undefined;
      if (!input || input.__workflowKind !== 'durable-agent') {
        throw new MastraError({
          id: 'DURABLE_AGENT_RESUME_INVALID_SNAPSHOT',
          domain: ErrorDomain.AGENT,
          category: ErrorCategory.SYSTEM,
          text: `DurableAgent "${host.agent.name}" resume(${runId}): persisted snapshot does not contain a durable-agent workflow input.`,
          details: { agentName: host.agent.name, runId },
        });
      }
      if (input.agentId !== host.agent.id) {
        throw new MastraError({
          id: 'DURABLE_AGENT_RESUME_AGENT_MISMATCH',
          domain: ErrorDomain.AGENT,
          category: ErrorCategory.USER,
          text: `DurableAgent "${host.agent.name}" resume(${runId}): persisted run belongs to agent "${input.agentId}", not "${host.agent.id}".`,
          details: { agentName: host.agent.name, runId, ownerAgentId: input.agentId },
        });
      }
      return input;
    };
    let workflowInput = readWorkflowInput(snapshot, true);

    // A run that suspended while executing a stored version must resume on
    // *that* version. Cold rehydration rebuilds tools/model/instructions
    // from whatever `this` currently resolves to — which, for status
    // selectors, hot-switches to the latest publish mid-flight. Re-resolve
    // to the pinned id and delegate. An explicit exact version at the call
    // site is an operator escape hatch and wins over the pin, and forks
    // already produced by `resolveVersionedAgent` are left alone (they are
    // either this very delegation or an explicit server-side resolution).
    const pinnedVersionId = workflowInput.agentVersionId;
    if (pinnedVersionId && host.mastra && !host.storedVersionApplied) {
      const callSiteSelector = options?.versions?.agents?.[host.agent.id];
      const hasExplicitVersion = !!callSiteSelector && 'versionId' in callSiteSelector;
      const currentVersionId = host.agent.toRawConfig()?.resolvedVersionId as string | undefined;
      if (!hasExplicitVersion && pinnedVersionId !== currentVersionId) {
        let resolved: Agent | undefined;
        try {
          resolved = await host.mastra.resolveVersionedAgent(host.agent as unknown as Agent, {
            versionId: pinnedVersionId,
          });
        } catch (versionError) {
          // The pinned version may have been deleted while the run sat
          // suspended — resume on the current definition rather than
          // failing at the approver (mirrors Agent#prepareAndStartPlainWorkflow's fallback).
          host.logger.warn('Failed to resolve pinned agent version for durable resume, using current definition', {
            agentId: host.agent.id,
            runId,
            pinnedVersionId,
            error: versionError,
          });
        }
        if (resolved && resolved !== (host.agent as unknown as Agent)) {
          // Hand the tool-call marker to the pinned agent's resume(), which
          // re-takes it synchronously before its first await.
          releaseResumeMarker();
          return (resolved as unknown as Agent<any, any, OUTPUT>).resume(runId, resumeData, options);
        }
      }
    }

    if (snapshot?.status === 'running' && workflowsStore) {
      // Recovery can execute the run. Dynamic defaults still require the rehydrated context below.
      host.executionAgent.__validateStaticModelTimeoutSettings(options?.modelSettings);
      validateModelTimeoutSettings((options?.modelSettings ?? workflowInput.options?.modelSettings)?.timeout);
      snapshot = await host.takeOverResumeClaim(runId, workflowsStore);
      workflowInput = readWorkflowInput(snapshot);
    }
    coldSnapshot = snapshot;

    const messageListMemoryInfo = (
      workflowInput.messageListState as { memoryInfo?: { threadId?: string; resourceId?: string } } | undefined
    )?.memoryInfo;
    const threadId = workflowInput.state?.threadId ?? messageListMemoryInfo?.threadId;
    const resourceId = workflowInput.state?.resourceId ?? messageListMemoryInfo?.resourceId;
    // The starting request's user and token are left out, so they come only from this resume.
    const snapshotRequestContext = workflowInput.requestContextEntries
      ? new RequestContext<unknown>(Object.entries(withoutLiveRequestKeys(workflowInput.requestContextEntries)))
      : undefined;
    if (snapshotRequestContext) restoreRunAgentScopes(snapshotRequestContext);
    const persistedScopes = workflowInput.requestContextEntries?.[MASTRA_SCOPES_KEY];
    if (
      persistedScopes !== undefined &&
      (!Array.isArray(persistedScopes) || persistedScopes.some(scope => typeof scope !== 'string'))
    ) {
      // A malformed persisted set must not be coerced to "no scopes": that would both
      // drop the run's scopes and falsely reject re-supplied ones as additions.
      throw new MastraError({
        id: 'AGENT_SCOPES_INVALID',
        domain: ErrorDomain.AGENT,
        category: ErrorCategory.SYSTEM,
        // Corrupted persisted state is a system fault, not a caller error: no
        // `details.status`, so server handlers surface it as HTTP 500.
        text: `DurableAgent "${host.agent.name}" resume(${runId}): persisted run scopes are malformed; expected an array of strings.`,
        details: { agentName: host.agent.name, runId },
      });
    }
    // Absent (vs recorded []) marks a run suspended before the scopes upgrade; the resume
    // adopts the supplied scopes with the same trust posture as a fresh run.
    rehydratedScopes = persistedScopes;
    const memory = threadId
      ? {
          ...options?.memory,
          thread: threadId,
          resource: resourceId ?? options?.memory?.resource,
        }
      : options?.memory;

    // The resume below applies the suspended run's scopes, so preparation does not resolve them again.
    await host.prepare([], {
      [SCOPES_ALREADY_APPLIED]: true,
      [RESUMED_SPAN_DATA]: { agentSpanData: workflowInput.agentSpanData, modelSpanData: workflowInput.modelSpanData },
      ...(options as AgentExecutionOptions<OUTPUT>),
      runId,
      requestContext: options?.requestContext ?? snapshotRequestContext,
      memory,
      // Restore the original run's flag from the persisted snapshot so a
      // cross-process resume still returns scoringData; caller override wins.
      returnScorerData: options?.returnScorerData ?? workflowInput.options?.returnScorerData,
      // Restore the original run's modelSettings so the rebuilt registry
      // entry re-arms the run-level timeout budget (#21724); caller
      // override wins.
      modelSettings: options?.modelSettings ?? (workflowInput.options?.modelSettings as any),
    } as AgentExecutionOptions<OUTPUT>);
    entry = host.registry.get(runId);
  }
  if (!entry) {
    throw new Error(`Failed to rehydrate registry entry for run ${runId}. Cannot resume.`);
  }

  const memoryInfo = host.registry.getMemoryInfo(runId);
  const registeredMemory = memoryInfo?.threadId
    ? ({
        ...options?.memory,
        thread: memoryInfo.threadId,
        resource: memoryInfo.resourceId ?? options?.memory?.resource,
      } as DurableAgentStreamOptions<OUTPUT>['memory'])
    : options?.memory;

  // The suspended run's non-identity scopes live on its persisted request context;
  // its identity is the registered memory. A resume keeps that set (rule: re-supplied
  // scopes may only be a subset of it).
  // A recorded set — [] included — is authoritative: a resume may not add scopes.
  // Cold resumes read the persisted entries, which preparation stamps unconditionally,
  // so an absent value there marks a pre-upgrade snapshot whose resume adopts the
  // supplied scopes. Warm registry entries only exist for runs this (post-upgrade)
  // process started, so an absent live value simply means the run held no scopes.
  const snapshotScopes = coldSnapshot ? rehydratedScopes : (entry.requestContext?.get(MASTRA_SCOPES_KEY) ?? []);
  const resumeScopesSnapshot: AgentScopesSnapshot = {
    resourceId: memoryInfo?.resourceId,
    threadId: memoryInfo?.threadId,
    scopes: Array.isArray(snapshotScopes) ? snapshotScopes : undefined,
  };

  // The suspended run's values carry over, except the starting request's user and
  // token: those come only from this resume, so a resume without a signed-in user
  // can't act as the user who started the run.
  const carriedEntries = entry.requestContext
    ? Object.entries(withoutLiveRequestKeys(Object.fromEntries(entry.requestContext.entries())))
    : undefined;
  // Tools built for the starting request are bound to its context, so they are rebuilt below.
  const droppedStartingUser = carriedEntries !== undefined && carriedEntries.length < entry.requestContext!.size();
  // Copy only when user keys were removed; otherwise keep the run's own instance.
  let resumeRequestContext = droppedStartingUser ? new RequestContext<unknown>(carriedEntries) : entry.requestContext;
  if (options?.requestContext) {
    // Keep the caller's instance so schema-transformed contexts retain their
    // input source. Caller values win except for framework-managed memory.
    resumeRequestContext = options.requestContext;
    for (const [key, value] of carriedEntries ?? []) {
      // The suspended run's scopes are applied on the run's own context below, never the caller's.
      if (key === MASTRA_SCOPES_KEY) continue;
      if (!resumeRequestContext.has(key)) resumeRequestContext.set(key, value);
    }
    if (entry.requestContext?.has('MastraMemory')) {
      resumeRequestContext.set('MastraMemory', entry.requestContext.get('MastraMemory'));
    } else {
      resumeRequestContext.delete('MastraMemory');
    }
  }

  // The resumed segment always carries its own claim: without a context the
  // engine would restore the previous segment's claim from the snapshot.
  resumeRequestContext ??= new RequestContext();
  const resolvedOptions = (await host.resolveOptions(
    {
      ...(options as DurableAgentStreamOptions<OUTPUT>),
      requestContext: resumeRequestContext as DurableAgentStreamOptions<OUTPUT>['requestContext'],
      memory: registeredMemory ?? options?.memory,
    },
    resumeScopesSnapshot,
  )) as DurableAgentStreamOptions<OUTPUT> & { toolCallId?: string };
  validateModelTimeoutSettings(resolvedOptions.modelSettings?.timeout);
  // The first call's trace settings hold unless this resume call sets its own. The agent's
  // defaults are already part of them, so they must not win here.
  const { hideInput, hideOutput, requestContextKeys } = options?.tracingOptions ?? {};
  const resumeTracingOptions = { ...resolvedOptions.tracingOptions, hideInput, hideOutput, requestContextKeys };
  // Scoped runs execute on a run-scoped copy of the request context.
  resumeRequestContext = (resolvedOptions.requestContext as typeof resumeRequestContext) ?? resumeRequestContext;

  // Delegate to the idle-loop wrapper when `untilIdle` is set.
  if (resolvedOptions.untilIdle) {
    const { untilIdle, ...rest } = resolvedOptions;
    const maxIdleMs = typeof untilIdle === 'object' ? untilIdle.maxIdleMs : undefined;
    releaseResumeMarker();
    return host.runUntilIdle({ ...rest, maxIdleMs }, resumeTracingOptions);
  }

  await host.admit({
    requestContext: resolvedOptions.requestContext,
    memory: resolvedOptions.memory,
    runId,
    snapshotMemoryInfo: memoryInfo,
    actor: resolvedOptions.actor,
  });

  // Settle the prior segment before claiming the run and reading its snapshot
  // and event offset. The suspension chunk can arrive before the suspended
  // snapshot is persisted, and a late suspension event replayed into the new
  // segment would close it early.
  const priorExecution = getRunRegistryEntry(runId, host.mastra)?.workflowExecution;
  await priorExecution?.catch(() => {
    /* errors already handled by the prior segment */
  });
  // Claimed before the abort controller and timeout are replaced, so a
  // conflicting resume leaves the executing segment's state untouched.
  // Memory is covered only once the run is known to be resumable below, so a
  // resume that lost the race never raises the memory fence past the winner.
  const executionFence = await host.claimExecution(runId, 'acquire');
  let initialToolCalls: ToolCallChunk[];
  let resumedText: { priorText: string; stepText: string } | undefined;
  let resumeOffset: number | 'latest';
  let persistedInput: DurableAgenticWorkflowInput | undefined;
  let suspendedToolCallIds: string[] = [];
  try {
    // A concurrent resume of the same suspension may have claimed and run it while this one
    // waited for the execution claim. Report that as a lost race, not a generic failure.
    const workflowsStore = await host.mastra?.getStorage()?.getStore('workflows');
    const current = await workflowsStore?.loadWorkflowSnapshot({
      workflowName: DurableStepIds.AGENTIC_LOOP,
      runId,
    });
    // The row is gone once a run finishes (possibly in another process). When
    // this process already ran a segment of the run (settled above), a missing
    // row means there is nothing left to resume; resuming anyway would write a
    // fresh `pending` row. A run that was only prepared has no row yet.
    if (workflowsStore && !current && priorExecution) {
      throw new MastraError({
        id: 'AGENT_RESUME_NO_SNAPSHOT_FOUND',
        domain: ErrorDomain.AGENT,
        category: ErrorCategory.USER,
        text: `DurableAgent "${host.agent.name}" resume(${runId}) could not find a suspended run for this runId. The run has already finished (for example, an earlier approval or resume already handled it), never suspended, or the runId is invalid.`,
        details: { agentName: host.agent.name, runId },
      });
    }
    // Only a settled run counts: a just-suspended run's row can still read `running`
    // briefly, because the suspension chunk is emitted before the row is durable.
    if (current && !['suspended', 'running', 'pending', 'waiting'].includes(current.status)) {
      throw new MastraError({
        id: 'AGENT_RESUME_ALREADY_CLAIMED',
        domain: ErrorDomain.AGENT,
        category: ErrorCategory.USER,
        text: `DurableAgent "${host.agent.name}" resume(${runId}) cannot resume the run because another resume of it already ran.`,
        details: { agentName: host.agent.name, runId },
      });
    }
    if (resumeRequestContext) await host.coverMemory(executionFence, resumeRequestContext);
    ({ toolCalls: initialToolCalls, resumedText } = await host.loadSuspendedIteration(runId));
    // Skip events already broadcast by the original run (e.g. the SUSPENDED
    // chunk that paused it). Without this, a resume that closes on suspend
    // (resumeGenerate) would immediately close on the replayed SUSPENDED.
    resumeOffset = await host.engine.getPubsubOffset(host.runPubsub, runId);
    persistedInput = current?.context?.input as DurableAgenticWorkflowInput | undefined;
    suspendedToolCallIds = Object.keys(current?.resumeLabels ?? {});
    // A parked run that lost its thread lease must hold it again before the segment runs. Later
    // registration fails open, so take it here: a successor that now holds the thread refuses this
    // resume instead of running beside it, and the run stays parked.
    await agentThreadStreamRuntime.reacquireParkedRunLease(runId, host.getLocalPubsub());

    // A rejected resume must not replace the context of the active segment.
    entry.requestContext = resumeRequestContext;
    entry.requestContextRebuilt = false;
    const globalEntryForContext = getRunRegistryEntry(runId, host.mastra);
    if (globalEntryForContext) {
      globalEntryForContext.requestContext = resumeRequestContext;
      globalEntryForContext.requestContextRebuilt = false;
    }
    await host.loadRecalledMessages(runId, coldSnapshot, resumeRequestContext);
  } catch (error) {
    // The segment never started: release the run so it can be resumed again.
    await executionFence.settle(async () => {});
    throw error;
  }
  // A warm resume reuses the tools built for the first request, which close
  // over its request context, delegation hooks, and tool hooks (#25960). Rebuild them for
  // this call and swap in only entries still holding a request-built tool, so
  // tools a processor added or replaced are kept. Processor-added tools are
  // rebuilt for this call's request context instead (#27544). Cold resumes already
  // rebuilt everything in prepare() above.
  if (!coldSnapshot && (options?.requestContext || options?.delegation || options?.hooks || droppedStartingUser)) {
    try {
      const requestTools = await host.executionAgent.getToolsForExecution({
        toolsets: resolvedOptions.toolsets,
        clientTools: resolvedOptions.clientTools,
        threadId: memoryInfo?.threadId,
        resourceId: memoryInfo?.resourceId,
        runId,
        requestContext: resumeRequestContext,
        memoryConfig: resolvedOptions.memory?.options,
        autoResumeSuspendedTools: resolvedOptions.autoResumeSuspendedTools,
        // resolvedOptions always carries defaultOptions.delegation, so only a delegation passed
        // to this resume may replace the one the first call parked on the entry.
        delegation: options?.delegation ? resolvedOptions.delegation : (entry.delegation ?? resolvedOptions.delegation),
        hooks: resolvedOptions.hooks,
        // Build for the method that started the run. `closeOnSuspend` is also a
        // stream() option and resumeStream() always sets it, so it cannot tell (#29436).
        methodType: entry.methodType ?? 'stream',
        backgroundTaskEnabled: Boolean(entry.backgroundTaskManager),
        backgroundTaskPolicy: resolvedOptions.backgroundTaskPolicy,
        model: entry.model,
      });
      const refresh = (current: Record<string, CoreTool>, previous: Record<string, CoreTool> | undefined) => {
        const next = { ...current };
        for (const [name, tool] of Object.entries(requestTools)) {
          // A name missing from current but present in previous was withheld by a processor.
          const configured = name in current ? current[name] === previous?.[name] : !previous || !(name in previous);
          if (configured) next[name] = tool;
        }
        return next;
      };
      for (const reg of new Set([entry, getRunRegistryEntry(runId, host.mastra)])) {
        if (!reg) continue;
        reg.tools = rebindProcessorTools(refresh(reg.tools ?? {}, reg.requestTools), resumeRequestContext);
        if (reg.baseTools)
          reg.baseTools = rebindProcessorTools(refresh(reg.baseTools, reg.requestTools), resumeRequestContext);
        // Tools this rebuild did not produce still hold their earlier build, so
        // keep that as their baseline; otherwise a later resume can never refresh them.
        reg.requestTools = { ...reg.requestTools, ...requestTools };
        if (options?.delegation) reg.delegation = resolvedOptions.delegation;
      }
    } catch (error) {
      host.mastra?.getLogger?.()?.warn?.(`[DurableAgent] resume(${runId}) tool resolution failed: ${error}`);
    }
  }
  setExecutionClaim(resumeRequestContext, runId, executionFence.claim);
  for (const reg of [entry, getRunRegistryEntry(runId, host.mastra)]) {
    if (!reg) continue;
    reg.executionFence = executionFence;
    reg.resumeToolCallId = resolvedOptions.toolCallId;
  }

  // Install a fresh abort controller for the resumed segment. The original
  // controller is gone (the stream that owned it has already settled), so
  // we overwrite the registry slot. If the caller passed an external
  // signal, forward it onto the new internal controller.
  const { controller: abortController, detach: detachExternalAbort } = createRunAbortController(
    resolvedOptions.abortSignal,
  );
  if (agentThreadStreamRuntime.isRunAborted(runId, host.getLocalPubsub())) {
    abortController.abort();
  }
  // Re-arm the run-level execution budget for the resumed session (#21724).
  // Warm resumes read the original budget parked on the registry entry;
  // cold resumes restored it from the persisted workflow input during
  // prepare(). A caller-supplied modelSettings on the resume call wins.
  const resumeTotalMs = (resolvedOptions.modelSettings as { timeout?: { totalMs?: number } } | undefined)?.timeout
    ?.totalMs;
  if (resumeTotalMs !== undefined) {
    entry.timeoutTotalMs = resumeTotalMs;
  }
  // The resumed segment's deadline saves the turn from the run's persisted input, as a first segment does.
  if (persistedInput) host.rememberInput(executionFence, persistedInput);
  host.installAbortWithTotalTimeout(entry, abortController, executionFence);
  const globalEntryForAbort = getRunRegistryEntry(runId, host.mastra);
  if (globalEntryForAbort) {
    globalEntryForAbort.abortController = abortController;
    globalEntryForAbort.abortSignal = entry.abortSignal;
  }

  const segment = host.beginSegment(runId);

  // Set when a concurrent resume ran the run first: the topic is that resume's.
  let lostResumeRace = false;
  const releaseRunState = () => {
    if (host.releaseSegment(runId, segment, entry)) {
      if (getRunRegistryEntry(runId, host.mastra) === globalEntryForAbort) {
        globalRunRegistry.delete(runId);
        if (
          !host.readerIsUnverified(executionFence) &&
          !lostResumeRace &&
          (globalEntryForAbort?.executionFence ?? executionFence).ownsRunTopics()
        ) {
          host.clearTopic(runId, globalEntryForAbort);
        }
      }
    }
  };

  const globalEntry = getRunRegistryEntry(runId, host.mastra);
  const resumeModel = globalEntry?.model as any;

  // Open a fresh AGENT_RUN + MODEL_GENERATION for the resumed segment on the same
  // traceId — the originals were ended as `suspended` and can't be reopened. Post-resume
  // steps + terminal end() target these via the registry override.
  // Opened before the stream adapter so per-chunk processor spans parent under it.
  const origTraceId = entry.agentSpan?.traceId;
  const origSpanId = entry.agentSpan?.id;
  // Spans this resume opened, ended by it alone if it turns out to have lost the run.
  const ownResumeSpans: Array<{ error: (options: { error: Error; endSpan: boolean }) => void } | undefined> = [];
  // The pair every worker's steps report under for this segment; none when it opened no spans.
  let resumeSegment: SegmentSpanData | null = null;
  if (origTraceId && host.mastra?.observability) {
    try {
      const ag = host.executionAgent as Agent<string, any, any>;
      // Match non-durable Agent.stream() resume-span shape.
      const rawConfig = typeof (ag as any).toRawConfig === 'function' ? (ag as any).toRawConfig() : undefined;
      const resolvedVersionId = rawConfig?.resolvedVersionId as string | undefined;
      const agentTracingPolicy = typeof ag.getTracingPolicy === 'function' ? ag.getTracingPolicy() : undefined;
      const suspendedToolCallId = resolvedOptions.toolCallId ?? suspendedToolCallIds[0];
      const resumeAgentSpan = getOrCreateSpan({
        type: SpanType.AGENT_RUN,
        outcome: null,
        name: `agent run: '${ag.id}' (resumed)`,
        entityType: EntityType.AGENT,
        entityId: ag.id,
        entityName: ag.name,
        input: buildResumeSpanInput(resumeData, {
          toolCallId: suspendedToolCallId,
          toolName: initialToolCalls.find(call => call.payload.toolCallId === suspendedToolCallId)?.payload.toolName,
        }),
        attributes: { conversationId: memoryInfo?.threadId, ...modelSpanAttributes(resumeModel) },
        metadata: {
          runId,
          resourceId: memoryInfo?.resourceId,
          threadId: memoryInfo?.threadId,
          resumed: true,
          ...(origSpanId ? { resumedFromSpanId: origSpanId } : {}),
          ...(resolvedVersionId ? { entityVersionId: resolvedVersionId } : {}),
        },
        resumeFrom: getWorkflowResumeTracingContext(entry.agentSpan),
        tracingPolicy: agentTracingPolicy,
        tracingOptions: { ...resumeTracingOptions, traceId: origTraceId },
        samplingDecision: entry.agentSpan?.isValid,
        requestContext: resolvedOptions.requestContext,
        mastra: host.mastra,
      });
      const resumeModelSpan = resumeAgentSpan?.createChildSpan({
        type: SpanType.MODEL_GENERATION,
        outcome: null,
        name: `llm: '${resumeModel?.modelId ?? ''}'`,
        attributes: { model: resumeModel?.modelId, provider: resumeModel?.provider, streaming: true },
        tracingPolicy: agentTracingPolicy,
        metadata: { runId, resumed: true },
        requestContext: resolvedOptions.requestContext,
      });
      ownResumeSpans.push(resumeModelSpan, resumeAgentSpan);
      if (resumeAgentSpan) {
        resumeSegment = openedSegment(resumeAgentSpan, resumeModelSpan);
      }
      for (const reg of [entry, getRunRegistryEntry(runId, host.mastra)]) {
        if (!reg) continue;
        reg.resumeAgentSpan = resumeAgentSpan;
        reg.resumeModelSpan = resumeModelSpan;
        // Fresh spans capture their own first-chunk clock, never a prior segment's.
        reg.resumeCompletionStartTime = undefined;
        reg.resumeTimeToFirstTokenMs = undefined;
      }
    } catch (error) {
      // Span bookkeeping must never block resume.
      host.mastra?.getLogger?.()?.warn?.(`[DurableAgent] Failed to open resume spans: ${error}`);
    }
  }
  carrySegmentSpans(resumeRequestContext, runId, resumeSegment);
  const resumeSegmentSpan = entry.resumeAgentSpan ?? entry.agentSpan;

  // Same default-false semantics as the initial stream() path.
  const closeOnSuspend = (resolvedOptions as DurableAgentStreamOptions<OUTPUT>).closeOnSuspend ?? false;

  return startDurableResumeSession<OUTPUT>({
    agent: host.agent,
    runId,
    executionFence,
    getLocalPubsub: () => host.getLocalPubsub(),
    threadId: memoryInfo?.threadId,
    resourceId: memoryInfo?.resourceId,
    readerOptions: {
      pubsub: host.runPubsub,
      runId,
      minGeneration: executionFence.generation,
      onTerminalEvent: host.onTerminalEvent(runId, executionFence),
      messageId: crypto.randomUUID(),
      initialToolCalls,
      resumedText,
      model: {
        modelId: resumeModel?.modelId,
        provider: resumeModel?.provider,
        version: 'v3',
      },
      threadId: memoryInfo?.threadId,
      resourceId: memoryInfo?.resourceId,
      offset: resumeOffset,
      onChunk: resolvedOptions.onChunk,
      experimentalTransform: resolvedOptions.experimentalTransform,
      hideSignals: resolvedOptions.hideSignals,
      onStepFinish: resolvedOptions.onStepFinish,
      onFinish: resolvedOptions.onFinish,
      onSuspended: resolvedOptions.onSuspended,
      // A resume closes only after its persisted workflow result.
      closeOnSuspend: false,
      structuredOutput: entry.structuredOutput as any,
      outputProcessors: entry.outputProcessors,
      processorStates: entry.processorStates,
      agent: entry.agent,
      requestContext: resolvedOptions.requestContext,
      returnScorerData: options?.returnScorerData ?? entry.returnScorerData ?? resolvedOptions.returnScorerData,
      tracingContext: resumeSegmentSpan ? { currentSpan: resumeSegmentSpan } : undefined,
      messageList: globalEntry?.messageList ?? host.registry.getMessageList(runId),
      messageListFollowsStream: () => !host.engine.executesStepsLocally,
    },
    resumeOptions: { ...resolvedOptions, runId } as AgentExecutionOptions<OUTPUT>,
    closeOnSuspend,
    abortController,
    scheduleReaderCleanup: cleanup => host.scheduleReaderCleanup(executionFence, cleanup),
    releaseRunState,
    resumeWorkflow: async ({ fail, detach, waitForEventDelivery }) => {
      const requestContext = resolvedOptions.requestContext;
      if (await host.redeliverDeadlineError(entry, executionFence)) return;
      // Looked up inside the chain so a throw settles (releases) the claim.
      const workflow = host.getWorkflow();
      // The prior segment was settled above (before the event-offset
      // capture), so the snapshot is already persisted as 'suspended'.
      // Evented engine: make sure the workflow event workers are running
      // before resume — a resume in a fresh process (or after shutdown())
      // would otherwise publish events nobody consumes and hang.
      await host.engine.ensureEngineWorkersStarted(host.workflowEngine, host.logger);
      const run = await workflow.createRun({
        runId,
        resourceId: memoryInfo?.resourceId,
        pubsub: host.fenceRunPubSub(executionFence, abortController),
      });
      if (host.hasGoal()) {
        await beginGoalActivity({
          mastra: host.mastra,
          agentId: host.agent.id,
          threadId: memoryInfo?.threadId,
          runId,
          requestContext,
        });
      }
      let result;
      try {
        result = await host.afterSuspensionPersisted(runId, () =>
          run.resume({
            resumeData,
            label: resolvedOptions.toolCallId,
            requestContext,
            actor: resolvedOptions.actor,
            ...createObservabilityContext({ currentSpan: entry.resumeAgentSpan ?? entry.agentSpan }),
          }),
        );
      } catch (error) {
        // A competing resume may have claimed the suspended workflow first.
        if (
          error instanceof MastraError &&
          (error.id === 'WORKFLOW_RUN_NOT_SUSPENDED' || error.id === 'WORKFLOW_RESUME_ALREADY_CLAIMED')
        ) {
          const lost = new MastraError({
            id: 'AGENT_RESUME_ALREADY_CLAIMED',
            domain: ErrorDomain.AGENT,
            category: ErrorCategory.USER,
            text: `DurableAgent "${host.agent.name}" resume(${runId}) cannot resume the run because another resume of it already ran.`,
            details: { agentName: host.agent.name, runId },
          });
          lostResumeRace = true;
          await executionFence.settle(async () => {});
          for (const span of ownResumeSpans) span?.error({ error: lost, endSpan: true });
          await fail(lost);
          return;
        }
        throw error;
      } finally {
        await stopGoalActivity({ agentId: host.agent.id, runId });
        if (result?.status !== 'suspended' && workflow.runs.get(runId) === run) {
          workflow.runs.delete(runId);
        }
      }
      await host.settle(runId, executionFence, {
        status: result?.status,
        error:
          result?.status === 'failed'
            ? host.engine.workflowFailureError((result as any).error, 'Workflow resume failed')
            : undefined,
      });
      if (result?.status === 'suspended' && closeOnSuspend) {
        // Deliver buffered callbacks after the persisted suspension, then
        // close only this reader so a queued resume can proceed.
        await host.runPubsub.flush();
        await waitForEventDelivery();
        detach();
      }
    },
    settleError: error =>
      host.settle(runId, executionFence, {
        error: host.engine.workflowExecutionError(error, 'Workflow resume failed'),
      }),
    detachExternalAbort,
    releaseResumeMarker,
    requestRemoteAbort: () => host.requestRemoteAbort(runId),
    abortRunStream: () => {
      host.abortRunStream(runId);
    },
    getEntry: () => getRunRegistryEntry(runId, host.mastra),
  });
}

/**
 * A resumed segment has its own reader but continues the existing run/topic.
 * Keep the segment subscribed through its terminal event; the owning Agent
 * supplies the snapshot-specific resume operation and lost-claim handling.
 */
export async function startDurableResumeSession<OUTPUT>({
  agent,
  runId,
  executionFence,
  getLocalPubsub,
  readerOptions,
  resumeOptions,
  closeOnSuspend,
  abortController,
  scheduleReaderCleanup,
  releaseRunState,
  resumeWorkflow,
  settleError,
  detachExternalAbort,
  releaseResumeMarker,
  requestRemoteAbort,
  abortRunStream,
  getEntry,
  threadId,
  resourceId,
}: {
  agent: Agent<any, any, any, any>;
  runId: string;
  executionFence: ExecutionFence;
  getLocalPubsub: () => PubSub | undefined;
  readerOptions: Omit<DurableStreamAdapterOptions<OUTPUT>, 'onStreamFinished' | 'onError' | 'onAbort'>;
  resumeOptions: AgentExecutionOptions<OUTPUT>;
  closeOnSuspend: boolean;
  abortController: AbortController;
  scheduleReaderCleanup: (cleanup: () => void) => NodeJS.Timeout | undefined;
  releaseRunState: () => void;
  resumeWorkflow: (reader: {
    fail: (error: Error) => Promise<void>;
    detach: () => void;
    waitForEventDelivery: () => Promise<void>;
  }) => Promise<void>;
  settleError: (error: unknown) => Promise<void>;
  detachExternalAbort: () => void;
  releaseResumeMarker: () => void;
  requestRemoteAbort: () => Promise<void>;
  abortRunStream: () => void;
  getEntry: () => RunRegistryEntry | undefined;
  threadId?: string;
  resourceId?: string;
}): Promise<DurableAgentStreamResult<OUTPUT>> {
  let streamCleanup: (() => void) | undefined;
  const runCleanup = createRunCleanup({
    scheduleTimer: scheduleReaderCleanup,
    release: () => {
      agentThreadStreamRuntime.closeRunContinuation(output, getLocalPubsub());
      streamCleanup?.();
      releaseRunState();
    },
  });
  const { output, cleanup, detach, fail, waitForEventDelivery, ready } = createDurableAgentStream<OUTPUT>({
    ...readerOptions,
    onStreamFinished: runCleanup.schedule,
    onError: async error => {
      await resumeOptions.onError?.(error);
      runCleanup.schedule();
    },
    onAbort: async data => {
      try {
        await resumeOptions.onAbort?.(data);
      } finally {
        runCleanup.schedule();
      }
    },
  });
  streamCleanup = cleanup;

  const workflowExecution = executionFence.run(() =>
    ready
      .then(() => resumeWorkflow({ fail, detach, waitForEventDelivery }))
      .catch(settleError)
      .finally(detachExternalAbort),
  );
  const trackedEntry = getEntry();
  if (trackedEntry) trackedEntry.workflowExecution = workflowExecution;
  void workflowExecution.then(releaseResumeMarker, releaseResumeMarker);

  const continued = agentThreadStreamRuntime.continueRun(agent, output, resumeOptions, getLocalPubsub(), {
    generation: executionFence.generation,
    ownershipLost: () => executionFence.isLost(),
  });
  if (!continued) {
    await agentThreadStreamRuntime.registerRun(agent, output, resumeOptions, getLocalPubsub(), {
      continuation: closeOnSuspend ? undefined : 'across-suspension',
      generation: executionFence.generation,
      ownershipLost: () => executionFence.isLost(),
      stepOwner: getEntry,
    });
  }

  const abort = async (reason?: unknown) => {
    if (!abortController.signal.aborted) abortController.abort(reason);
    await requestRemoteAbort();
    if (agentThreadStreamRuntime.isRunParked(runId, getLocalPubsub())) abortRunStream();
  };
  return {
    output,
    get fullStream() {
      return output.fullStream as ReadableStream<any>;
    },
    runId,
    threadId,
    resourceId,
    traceId: output.traceId,
    spanId: output.spanId,
    cleanup: runCleanup.run,
    abort,
  };
}
