import { wrapSchemaWithNullTransform } from '@mastra/schema-compat';

import type { ActorSignal } from '../../../auth/ee';
import type { MastraBrowser } from '../../../browser/browser';
import type { BrowserContext } from '../../../browser/processor';
import { ErrorCategory, ErrorDomain, MastraError } from '../../../error';
import type { PubSub } from '../../../events/pubsub';
import { mergeProviderOptions } from '../../../llm/model/provider-options';
import { executionFailureTermination } from '../../../loop/shared/execution-outcome';
import type { AgentLoopResumeClaim } from '../../../loop/types';
import type { Mastra } from '../../../mastra';
import type { VersionOverrides } from '../../../mastra/types';
import type { ResumeTracingContext, Span } from '../../../observability';
import { createObservabilityContext, EntityType, getOrCreateSpan, SpanType } from '../../../observability';
import { MASTRA_THREAD_ID_KEY, MASTRA_VERSIONS_KEY, RequestContext } from '../../../request-context';
import { toStandardSchema } from '../../../schema';
import { usesOpenAIStrictJsonSchema } from '../../../stream/aisdk/v5/execute';
import type { FullOutput, MastraModelOutput } from '../../../stream/base/output';
import { normalizeToolPayloadTransformPolicy } from '../../../tools/payload-transform';
import type { WorkflowRunState } from '../../../workflows/types';
import type { Agent } from '../../agent';
import type { AgentExecutionOptions, AgentExecutionOptionsBase, InnerAgentExecutionOptions } from '../../agent.types';
import { convertInstructionsToString, resolveRunId, resolveVersionContext } from '../../helpers';
import type { MessageListInput } from '../../message-list';
import { modelSpanAttributes } from '../../model-span-attributes';
import { buildResumeSpanInput } from '../../resume-span-input';
import type { ResolvedAgentScopes } from '../../scopes';
import { signalSpanAttributes } from '../../signals';
import { AGENT_STREAM_TOPIC } from '../../streams/constants';
import type { AgentStreamPublisher } from '../../streams/publisher';
import { agentThreadStreamRuntime } from '../../thread-stream-runtime';
import { isSupportedLanguageModel, resolveThreadIdFromArgs } from '../../utils';
import { createPrepareStreamWorkflow } from './index';

/** Browser context is live, thread-local state and must not enter a workflow snapshot. */
export async function injectPlainBrowserContext({
  browser,
  requestContext,
  memory,
  snapshotThreadId,
}: {
  browser?: MastraBrowser;
  requestContext: RequestContext;
  memory?: AgentExecutionOptions['memory'];
  snapshotThreadId?: string;
}): Promise<void> {
  if (!browser || requestContext.has('browser')) return;
  const memoryThread = memory?.thread;
  const memoryThreadId = typeof memoryThread === 'string' ? memoryThread : memoryThread?.id;
  const browserThreadId =
    (requestContext.get(MASTRA_THREAD_ID_KEY) as string | undefined) || memoryThreadId || snapshotThreadId;
  const isThreadRunning = browserThreadId
    ? browser.hasThreadSession(browserThreadId) && browser.isBrowserRunning(browserThreadId)
    : browser.isBrowserRunning();

  const getBrowserContextState = async (): Promise<Partial<BrowserContext> | undefined> => {
    const running = browserThreadId
      ? browser.hasThreadSession(browserThreadId) && browser.isBrowserRunning(browserThreadId)
      : browser.isBrowserRunning();
    if (!running) {
      const state = browser.getLastBrowserState(browserThreadId);
      const activeTab = state?.tabs[state.activeTabIndex];
      return {
        isOpen: false,
        currentUrl: activeTab?.url,
        pageTitle: activeTab?.title,
        tabCount: state?.tabs.length,
        closeReason: state?.closeReason,
      };
    }
    try {
      const state = await browser.getBrowserState(browserThreadId);
      const activeTab = state?.tabs[state.activeTabIndex];
      return {
        isOpen: true,
        currentUrl: activeTab?.url ?? (await browser.getCurrentUrl(browserThreadId)) ?? undefined,
        pageTitle: activeTab?.title,
        tabCount: state?.tabs.length,
        activeUrlChangeSource: state?.activeUrlChangeSource,
      };
    } catch {
      return { isOpen: false, closeReason: 'error' };
    }
  };
  const currentBrowserState = await getBrowserContextState();
  requestContext.set('browser', {
    provider: browser.provider,
    providerType: browser.providerType,
    sessionId: browser.getSessionId(browserThreadId),
    headless: browser.headless,
    ...currentBrowserState,
    getState: getBrowserContextState,
    cdpUrl:
      browser.providerType === 'cli' && isThreadRunning ? (browser.getCdpUrl(browserThreadId) ?? undefined) : undefined,
  } satisfies BrowserContext);
}

type PlainRunPreparationHost<OUTPUT> = {
  agent: Agent<any, any, any, any>;
  mastra?: Mastra;
  browser?: MastraBrowser;
  storedVersionApplied: boolean;
  options: InnerAgentExecutionOptions<OUTPUT> & { _threadStreamPubSub?: PubSub };
  getPubsub: () => PubSub | undefined;
  getSnapshotMemoryInfo: (
    snapshot: WorkflowRunState | null | undefined,
  ) => { threadId?: string; resourceId?: string } | undefined;
  getSnapshotAgentId: (snapshot: WorkflowRunState) => string | undefined;
  getSnapshotAgentVersionId: (snapshot: WorkflowRunState) => string | undefined;
  warn: (message: string, details: Record<string, unknown>) => void;
  delegateToVersionedAgent: (
    agent: Agent<any, any, any, any>,
    options: InnerAgentExecutionOptions<OUTPUT> & { _threadStreamPubSub?: PubSub },
  ) => ReturnType<typeof executePlainRun<OUTPUT>>;
  getWorkspace: (requestContext: RequestContext) => Promise<any>;
  getResourceId: (input: {
    requestContext: RequestContext;
    memory?: AgentExecutionOptionsBase<OUTPUT>['memory'];
    snapshotMemoryInfo?: { threadId?: string; resourceId?: string };
  }) => string | undefined;
  getLLM: (options: any, requestContext: RequestContext) => Promise<any> | any;
  hasOwnMemory: () => boolean;
  hasKnowledge: () => boolean;
  takeSuspendedOutputProcessors: (runId: string) => unknown[] | undefined;
  getInstructions: (requestContext: RequestContext) => Promise<any> | any;
  getMcpServerGuidance: (options: any, requestContext: RequestContext) => Promise<any>;
  getSuspendedToolInfo: (snapshot: WorkflowRunState | undefined, toolCallId?: string) => any;
  getResolvedVersionId: () => string | undefined;
  tracingPolicy?: any;
  getMemory: (requestContext: RequestContext) => Promise<any>;
  resolveToolPayloadTransform: (options: any) => any;
  createWorkflowOptions: (context: {
    options: any;
    methodType: 'stream' | 'generate';
    resumeContext: any;
    threadFromArgs: ReturnType<typeof resolveThreadIdFromArgs>;
    resourceId?: string;
    runId: string;
    requestContext: RequestContext;
    agentSpan: Span<SpanType.AGENT_RUN> | undefined;
    instructions: any;
    mcpServerGuidance: any;
    memoryConfig: any;
    memory: any;
    workspace: any;
    llm: any;
    threadStreamPubSub?: PubSub;
    toolPayloadTransform: any;
    streamPublisher?: AgentStreamPublisher;
  }) => Parameters<typeof createPrepareStreamWorkflow<OUTPUT>>[0];
  assertRunIdAvailable: (
    runId: string,
    resourceId: string | undefined,
    options: { resuming: boolean },
  ) => Promise<{ status?: string } | undefined>;
  clearPriorRunTopic: (topic: string) => Promise<void>;
  createPublisher: (
    runId: string,
    options: { resourceId?: string; threadId?: string; abortSignal?: AbortSignal },
  ) => AgentStreamPublisher | undefined;
};

/** Resolve and prepare the owning Agent's live workflow before starting the plain driver. */
export async function preparePlainRun<OUTPUT>(host: PlainRunPreparationHost<OUTPUT>) {
  const { methodType: rawMethodType, resumeContext, _threadStreamPubSub, ...initialOptions } = host.options;
  const methodType = rawMethodType as 'stream' | 'generate';
  let options = initialOptions;
  const threadStreamPubSub = _threadStreamPubSub ?? host.getPubsub();
  const existingSnapshot = resumeContext?.snapshot;
  const snapshotMemoryInfo = host.getSnapshotMemoryInfo(existingSnapshot);
  const requestContext = options.requestContext || new RequestContext();

  const requestVersions = requestContext.get(MASTRA_VERSIONS_KEY) as VersionOverrides | undefined;
  const mergedVersions = resolveVersionContext(
    requestContext,
    requestVersions,
    host.mastra?.getVersionOverrides(),
    options,
  );
  const pinnedVersionId =
    existingSnapshot &&
    (() => {
      const snapshotAgentId = host.getSnapshotAgentId(existingSnapshot);
      if (snapshotAgentId && snapshotAgentId !== host.agent.id) return undefined;
      return host.getSnapshotAgentVersionId(existingSnapshot);
    })();

  if ((mergedVersions || pinnedVersionId) && !host.storedVersionApplied && host.mastra) {
    const callSiteSelector = options.versions?.agents?.[host.agent.id];
    const selfVersionSelector =
      (callSiteSelector && 'versionId' in callSiteSelector ? callSiteSelector : undefined) ??
      (pinnedVersionId ? { versionId: pinnedVersionId } : undefined) ??
      mergedVersions?.agents?.[host.agent.id] ??
      (mergedVersions?.defaultStatus ? { status: mergedVersions.defaultStatus } : undefined);
    if (selfVersionSelector) {
      try {
        const resolved = await host.mastra.resolveVersionedAgent(host.agent, selfVersionSelector);
        if (resolved !== host.agent) {
          return host.delegateToVersionedAgent(resolved, {
            methodType,
            resumeContext,
            _threadStreamPubSub,
            ...options,
            requestContext,
          } as unknown as InnerAgentExecutionOptions<OUTPUT> & { _threadStreamPubSub?: PubSub });
        }
      } catch (versionError) {
        host.warn('Failed to resolve versioned agent for direct call, using code-defined default', {
          agent: host.agent.name,
          agentId: host.agent.id,
          versionSelector: selfVersionSelector,
          error: versionError,
        });
      }
    }
  }

  const workspace = await host.getWorkspace(requestContext);
  await injectPlainBrowserContext({
    browser: host.browser ?? workspace?.browser,
    requestContext,
    memory: options.memory,
    snapshotThreadId: snapshotMemoryInfo?.threadId,
  });

  const threadFromArgs = resolveThreadIdFromArgs({
    memory: {
      ...options.memory,
      thread: options.memory?.thread || snapshotMemoryInfo?.threadId,
    },
    overrideId: requestContext.get(MASTRA_THREAD_ID_KEY) as string | undefined,
  });
  const resourceId = host.getResourceId({ requestContext, memory: options.memory, snapshotMemoryInfo });
  const memoryConfig = options.memory?.options;
  const llm = await host.getLLM(options, requestContext);
  const resolvedModel = llm.getModel();
  const isGatewayModel =
    typeof resolvedModel === 'object' &&
    resolvedModel !== null &&
    'gatewayId' in resolvedModel &&
    resolvedModel.gatewayId === 'mastra';
  if (
    options.memory?.resource &&
    options.memory?.thread &&
    !host.hasOwnMemory() &&
    !host.hasKnowledge() &&
    !isGatewayModel
  ) {
    host.warn('No memory is configured but resourceId and threadId were passed in args', {
      agent: host.agent.name,
    });
  }

  if ('structuredOutput' in options && options.structuredOutput?.schema && !options.structuredOutput?.model) {
    const structuredOutputModel = llm.getModel();
    if (
      structuredOutputModel.provider.includes('openai') ||
      structuredOutputModel.modelId?.includes('openai') ||
      usesOpenAIStrictJsonSchema(
        structuredOutputModel,
        mergeProviderOptions(options.providerOptions, llm.getProviderOptions()),
      )
    ) {
      options = {
        ...options,
        structuredOutput: {
          ...options.structuredOutput,
          schema: wrapSchemaWithNullTransform(options.structuredOutput.schema as any) as any,
        },
      };
    }
  }

  const runId =
    options.runId ||
    host.mastra?.generateId({
      idType: 'run',
      source: 'agent',
      entityId: host.agent.id,
      threadId: threadFromArgs?.id,
      resourceId,
    }) ||
    globalThis.crypto.randomUUID();
  const keptOutputProcessors = host.takeSuspendedOutputProcessors(runId);
  if (resumeContext && options.outputProcessors === undefined && keptOutputProcessors) {
    options = { ...options, outputProcessors: keptOutputProcessors as any };
  }
  const instructions = options.instructions || (await host.getInstructions(requestContext));
  const mcpServerGuidance = await host.getMcpServerGuidance(options, requestContext);

  const isResume = !!resumeContext;
  const suspendedToolInfo = isResume
    ? host.getSuspendedToolInfo(resumeContext.snapshot, options.toolCallId)
    : undefined;
  const persistedTracingContext = isResume
    ? (resumeContext.snapshot?.tracingContext as ResumeTracingContext | undefined)
    : undefined;
  const spanInput = isResume ? buildResumeSpanInput(resumeContext.resumeData, suspendedToolInfo) : options.messages;
  const startingSignal = isResume ? undefined : signalSpanAttributes(options.messages);
  const resolvedVersionId = host.getResolvedVersionId();
  const agentSpan = getOrCreateSpan({
    type: SpanType.AGENT_RUN,
    outcome: null,
    name: `agent run: '${host.agent.id}'${isResume ? ' (resumed)' : ''}`,
    entityType: EntityType.AGENT,
    entityId: host.agent.id,
    entityName: host.agent.name,
    input: spanInput,
    attributes: {
      conversationId: threadFromArgs?.id,
      instructions: convertInstructionsToString(instructions),
      ...modelSpanAttributes(resolvedModel),
      ...(startingSignal ? { signal: startingSignal } : {}),
      ...(resolvedVersionId ? { resolvedVersionId } : {}),
    },
    metadata: {
      runId,
      resourceId,
      threadId: threadFromArgs?.id,
      ...(isResume ? { resumed: true, resumedFromSpanId: persistedTracingContext?.spanId } : {}),
      ...(resolvedVersionId ? { entityVersionId: resolvedVersionId } : {}),
    },
    tracingPolicy: host.tracingPolicy,
    tracingOptions: options.tracingOptions,
    tracingContext: options.tracingContext,
    requestContext,
    mastra: host.mastra,
    resumeFrom: persistedTracingContext,
  });

  const memory = await host.getMemory(requestContext);
  const toolPayloadTransform =
    normalizeToolPayloadTransformPolicy(options.transform ?? (options as any).toolPayloadProjection) ??
    host.resolveToolPayloadTransform(options);

  return prepareAndExecutePlainWorkflow<OUTPUT>({
    runId,
    resourceId,
    threadId: threadFromArgs?.id,
    abortSignal: options.abortSignal,
    assertRunIdAvailable: () =>
      host.assertRunIdAvailable(runId, resourceId, { resuming: Boolean(resumeContext?.claim) }),
    clearPriorRunTopic: host.clearPriorRunTopic,
    createPublisher: publisherOptions => host.createPublisher(runId, publisherOptions),
    workflowOptions: streamPublisher =>
      host.createWorkflowOptions({
        options: options as InnerAgentExecutionOptions<OUTPUT>,
        methodType,
        resumeContext,
        threadFromArgs,
        resourceId,
        runId,
        requestContext,
        agentSpan,
        instructions,
        mcpServerGuidance,
        memoryConfig,
        memory,
        workspace,
        llm,
        threadStreamPubSub,
        toolPayloadTransform,
        streamPublisher,
      }),
    mastra: host.mastra,
    requestContext,
    actor: options.actor,
    agentSpan,
  });
}

/**
 * Starts the plain agent's per-call, non-snapshot workflow. Preparation stays
 * with the owning Agent, but the live workflow's run and failure settlement
 * are separate from the durable driver's checkpointed execution protocol.
 */
export async function executePlainRun<OUTPUT>({
  workflow,
  mastra,
  requestContext,
  actor,
  agentSpan,
  streamPublisher,
  runId,
}: {
  workflow: ReturnType<typeof createPrepareStreamWorkflow<OUTPUT>>;
  mastra?: Mastra;
  requestContext: RequestContext;
  actor?: ActorSignal;
  agentSpan?: Span<SpanType.AGENT_RUN>;
  streamPublisher?: AgentStreamPublisher;
  runId: string;
}) {
  if (mastra) workflow.__registerMastra(mastra);

  const observabilityContext = createObservabilityContext({ currentSpan: agentSpan });
  try {
    const run = await workflow.createRun();
    const result = await run.start({ requestContext, actor, ...observabilityContext });
    if (result.status === 'failed') void streamPublisher?.fail(result.error);
    if (result.status !== 'success' && agentSpan && !agentSpan.endTime) {
      if (result.status === 'failed') {
        const raw = result.error as unknown;
        const error =
          raw instanceof Error
            ? raw
            : new MastraError(
                {
                  id: 'AGENT_PREPARE_STREAM_FAILED',
                  domain: ErrorDomain.AGENT,
                  category: ErrorCategory.SYSTEM,
                  details: { runId },
                },
                raw,
              );
        agentSpan.error({ error, ...executionFailureTermination(error), endTree: true });
      } else {
        agentSpan.end({ endTree: true });
      }
    }
    return result;
  } catch (error) {
    const spanError =
      error instanceof Error
        ? error
        : new MastraError(
            {
              id: 'AGENT_PREPARE_STREAM_REJECTED',
              domain: ErrorDomain.AGENT,
              category: ErrorCategory.SYSTEM,
              details: { runId },
            },
            error,
          );
    agentSpan?.error({ error: spanError, ...executionFailureTermination(spanError), endTree: true });
    void streamPublisher?.fail(error);
    throw error;
  }
}

/** Prepare the live workflow only after the run ID and retained topic are safe to reuse. */
export async function prepareAndExecutePlainWorkflow<OUTPUT>({
  runId,
  resourceId,
  threadId,
  abortSignal,
  assertRunIdAvailable,
  clearPriorRunTopic,
  createPublisher,
  workflowOptions,
  mastra,
  requestContext,
  actor,
  agentSpan,
}: {
  runId: string;
  resourceId?: string;
  threadId?: string;
  abortSignal?: AbortSignal;
  assertRunIdAvailable: () => Promise<{ status?: string } | undefined>;
  clearPriorRunTopic: (topic: string) => Promise<void>;
  createPublisher: (options: {
    resourceId?: string;
    threadId?: string;
    abortSignal?: AbortSignal;
  }) => AgentStreamPublisher | undefined;
  workflowOptions: (
    publisher: AgentStreamPublisher | undefined,
  ) => Parameters<typeof createPrepareStreamWorkflow<OUTPUT>>[0];
  mastra?: Mastra;
  requestContext: RequestContext;
  actor?: ActorSignal;
  agentSpan?: Span<SpanType.AGENT_RUN>;
}) {
  const priorRunRecord = await assertRunIdAvailable();
  // A finished run can still have a retained log. A new reader must not
  // replay that old terminal frame when the caller reuses its run ID.
  if (priorRunRecord?.status === 'finished') await clearPriorRunTopic(AGENT_STREAM_TOPIC(runId));
  const streamPublisher = createPublisher({ resourceId, threadId, abortSignal });
  const workflow = createPrepareStreamWorkflow<OUTPUT>(workflowOptions(streamPublisher));
  return executePlainRun({ workflow, mastra, requestContext, actor, agentSpan, streamPublisher, runId });
}

/**
 * The plain run owns a local thread reservation until its live output is
 * registered. Unlike the durable driver, no checkpoint or replay adapter
 * sits between this output and the caller.
 */
export async function startPlainRun<OUTPUT>({
  agent,
  messages,
  options,
  resolvedScopes,
  methodType,
  pubsub,
  generateId,
  maxProcessorRetries,
  prepare,
  deleteAbortedSuspendedRun,
}: {
  agent: Agent<any, any, any, any>;
  messages: MessageListInput;
  options: AgentExecutionOptions<OUTPUT>;
  resolvedScopes: ResolvedAgentScopes;
  methodType: 'generate' | 'stream';
  pubsub: PubSub | undefined;
  generateId: () => string | undefined;
  maxProcessorRetries?: number;
  prepare: (
    options: InnerAgentExecutionOptions<OUTPUT> & { _threadStreamPubSub?: PubSub },
  ) => ReturnType<typeof executePlainRun<OUTPUT>>;
  deleteAbortedSuspendedRun: (runId: string) => Promise<boolean>;
}): Promise<FullOutput<OUTPUT> | MastraModelOutput<OUTPUT>> {
  const loopOptions = { ...options };
  const actor = options.actor;
  delete loopOptions.actor;

  // Reserve before preparation so a concurrent call on the same thread waits
  // until the output has been registered (or this reservation is released).
  options.runId ??= resolveRunId(undefined, generateId);
  await agentThreadStreamRuntime.waitForCrossAgentThreadRun(agent, { ...loopOptions, runId: options.runId }, pubsub);
  const preparedOptions = agentThreadStreamRuntime.prepareRunOptions(
    { ...loopOptions, runId: options.runId, actor },
    pubsub,
    () => deleteAbortedSuspendedRun(options.runId!),
  );
  const executeOptions = {
    ...preparedOptions,
    actor,
    structuredOutput: options.structuredOutput
      ? { ...options.structuredOutput, schema: toStandardSchema(options.structuredOutput.schema) }
      : undefined,
    messages,
    resolvedScopes: resolvedScopes.scopes,
    methodType,
    maxProcessorRetries: options.maxProcessorRetries ?? maxProcessorRetries,
    _threadStreamPubSub: pubsub,
  } as unknown as InnerAgentExecutionOptions<OUTPUT> & { _threadStreamPubSub?: PubSub };

  try {
    const result = await prepare(executeOptions);
    return await presentPlainRunResult({ result, methodType, agent, preparedOptions, pubsub });
  } catch (error) {
    agentThreadStreamRuntime.releaseThreadRunReservation(
      options.runId,
      pubsub,
      { agent, streamOptions: preparedOptions },
      preparedOptions.abortSignal,
    );
    throw error;
  }
}

type PlainResumeOptions<OUTPUT> = AgentExecutionOptionsBase<OUTPUT> & {
  structuredOutput?: { schema: any } & Record<string, unknown>;
  toolCallId?: string;
  model?: unknown;
};

type PlainResumeDriver<OUTPUT> = {
  agent: Agent<any, any, any, any>;
  agentName: string;
  methodType: 'stream' | 'generate';
  method: string;
  recover?: boolean;
  resumeData: unknown;
  callOptions?: PlainResumeOptions<OUTPUT>;
  defaultOptions?: PlainResumeOptions<OUTPUT>;
  mergedOptions: PlainResumeOptions<OUTPUT>;
  pubsub?: PubSub;
  maxProcessorRetries?: number;
  loadSnapshot: (args: { runId: string; method: string }) => Promise<WorkflowRunState>;
  getRecoverableIntent: (
    snapshot: WorkflowRunState,
    runId: string,
  ) => { toolCallId?: string; resumeData?: unknown; claimedAt?: number };
  getSnapshotMemoryInfo: (snapshot: WorkflowRunState) => { threadId?: string; resourceId?: string } | undefined;
  getSnapshotReturnScorerData: (snapshot: WorkflowRunState) => boolean | undefined;
  resolveScopes: (
    options: PlainResumeOptions<OUTPUT>,
    args: {
      callScopes?: string[];
      defaultScopes?: string[];
      existingSnapshot: WorkflowRunState;
    },
  ) => Promise<{ options: PlainResumeOptions<OUTPUT>; resolved: ResolvedAgentScopes }>;
  admit: (args: {
    requestContext: RequestContext | undefined;
    memory?: AgentExecutionOptionsBase<OUTPUT>['memory'];
    runId?: string;
    snapshotMemoryInfo?: { threadId?: string; resourceId?: string };
    actor?: ActorSignal;
  }) => Promise<void>;
  validateTarget: (args: {
    snapshot: WorkflowRunState;
    toolCallId: string | undefined;
    runId: string;
    method: string;
  }) => Promise<WorkflowRunState>;
  validateResumeData: (args: {
    snapshot: WorkflowRunState;
    toolCallId: string | undefined;
    resumeData: unknown;
    requestContext: RequestContext | undefined;
    toolsets?: AgentExecutionOptionsBase<OUTPUT>['toolsets'];
    clientTools?: AgentExecutionOptionsBase<OUTPUT>['clientTools'];
    runId: string;
    method: string;
  }) => Promise<void>;
  claim: (args: {
    snapshot: WorkflowRunState;
    runId: string;
    toolCallId: string | undefined;
    resumeData: unknown;
    recoverClaimedAt?: number;
    method: string;
  }) => Promise<AgentLoopResumeClaim>;
  getModelInfo: (options: PlainResumeOptions<OUTPUT>) => Promise<{
    modelId: string;
    provider: string;
    specificationVersion: string;
  }>;
  deleteAbortedSuspendedRun: (runId: string) => Promise<boolean>;
  prepare: (
    options: InnerAgentExecutionOptions<OUTPUT> & { _threadStreamPubSub?: PubSub },
  ) => ReturnType<typeof executePlainRun<OUTPUT>>;
};

/** Own the resumed plain run from snapshot admission through the live reader/result. */
export async function startPlainResumeRun<OUTPUT>(
  driver: PlainResumeDriver<OUTPUT>,
): Promise<FullOutput<OUTPUT> | MastraModelOutput<OUTPUT>> {
  const { agent, agentName, methodType, method, recover, resumeData, callOptions, defaultOptions, pubsub } = driver;
  const mergedOptions = driver.mergedOptions;
  const loopOptions = { ...mergedOptions };
  const actor = mergedOptions.actor;
  delete loopOptions.actor;

  const runId = callOptions?.runId ?? '';
  const existingSnapshot = await driver.loadSnapshot({ runId, method });
  const intent = recover ? driver.getRecoverableIntent(existingSnapshot, runId) : undefined;
  const toolCallId = intent ? intent.toolCallId : callOptions?.toolCallId;
  const resumeWith = intent ? intent.resumeData : resumeData;
  const snapshotMemoryInfo = driver.getSnapshotMemoryInfo(existingSnapshot);
  const persistedReturnScorerData =
    callOptions?.returnScorerData === undefined ? driver.getSnapshotReturnScorerData(existingSnapshot) : undefined;
  if (persistedReturnScorerData !== undefined) {
    mergedOptions.returnScorerData = loopOptions.returnScorerData = persistedReturnScorerData;
  }

  if (methodType === 'stream' && snapshotMemoryInfo?.threadId) {
    mergedOptions.memory = {
      ...(mergedOptions.memory ?? {}),
      thread: mergedOptions.memory?.thread ?? snapshotMemoryInfo.threadId,
      resource: mergedOptions.memory?.resource ?? snapshotMemoryInfo.resourceId,
    };
    loopOptions.memory = mergedOptions.memory;
  }

  const { options: scopedOptions, resolved: resolvedScopes } = await driver.resolveScopes(mergedOptions, {
    callScopes: callOptions?.scopes,
    defaultScopes: defaultOptions?.scopes,
    existingSnapshot,
  });
  mergedOptions.memory = loopOptions.memory = scopedOptions.memory;
  mergedOptions.requestContext = loopOptions.requestContext = scopedOptions.requestContext;

  await driver.admit({
    requestContext: mergedOptions.requestContext,
    memory: mergedOptions.memory,
    runId: mergedOptions.runId,
    snapshotMemoryInfo,
    actor,
  });
  const resumeSnapshot = await driver.validateTarget({ snapshot: existingSnapshot, toolCallId, runId, method });
  await driver.validateResumeData({
    snapshot: resumeSnapshot,
    toolCallId,
    resumeData: resumeWith,
    requestContext: mergedOptions.requestContext,
    toolsets: mergedOptions.toolsets,
    clientTools: mergedOptions.clientTools,
    runId,
    method,
  });
  const resumeClaim = await driver.claim({
    snapshot: resumeSnapshot,
    runId,
    toolCallId,
    resumeData: resumeWith,
    recoverClaimedAt: intent?.claimedAt,
    method,
  });

  let preparedOptions: AgentExecutionOptions<OUTPUT> | undefined;
  let generatedOutput: FullOutput<OUTPUT> | undefined;
  try {
    const modelInfo = await driver.getModelInfo(mergedOptions);
    if (!isSupportedLanguageModel(modelInfo as any)) {
      const modelId = modelInfo.modelId || 'unknown';
      const provider = modelInfo.provider || 'unknown';
      const specVersion = modelInfo.specificationVersion;
      throw new MastraError({
        id: methodType === 'stream' ? 'AGENT_STREAM_V1_MODEL_NOT_SUPPORTED' : 'AGENT_GENERATE_V1_MODEL_NOT_SUPPORTED',
        domain: ErrorDomain.AGENT,
        category: ErrorCategory.USER,
        text:
          methodType === 'stream'
            ? specVersion === 'v1'
              ? 'V1 models are not supported for resumeStream. Please use streamLegacy instead.'
              : `Model has unrecognized specificationVersion "${specVersion}". Supported versions: v1 (legacy), v2 (AI SDK v5), v3 (AI SDK v6), v4 (AI SDK v7). Please ensure your AI SDK provider is compatible with this version of Mastra.`
            : specVersion === 'v1'
              ? `Agent "${agentName}" is using AI SDK v4 model (${provider}:${modelId}) which is not compatible with generate(). Please use AI SDK v5+ models or call the generateLegacy() method instead. See https://mastra.ai/en/docs/streaming/overview for more information.`
              : `Agent "${agentName}" has a model (${provider}:${modelId}) with unrecognized specificationVersion "${specVersion}". Supported versions: v1 (legacy), v2 (AI SDK v5), v3 (AI SDK v6), v4 (AI SDK v7). Please ensure your AI SDK provider is compatible with this version of Mastra.`,
        details:
          methodType === 'stream'
            ? { modelId: modelInfo.modelId, provider: modelInfo.provider, specificationVersion: specVersion }
            : { agentName, modelId, provider, specificationVersion: specVersion },
      });
    }

    await agentThreadStreamRuntime.reacquireParkedRunLease(runId, pubsub);
    if (methodType === 'stream') {
      await agentThreadStreamRuntime.waitForCrossAgentThreadRun(
        agent,
        loopOptions as unknown as AgentExecutionOptions<OUTPUT>,
        pubsub,
      );
      preparedOptions = agentThreadStreamRuntime.prepareRunOptions(
        { ...loopOptions, actor } as unknown as AgentExecutionOptions<OUTPUT>,
        pubsub,
        () => driver.deleteAbortedSuspendedRun(runId),
      );
    }

    const executeOptions = {
      ...(preparedOptions ?? loopOptions),
      actor,
      structuredOutput: mergedOptions.structuredOutput
        ? { ...mergedOptions.structuredOutput, schema: toStandardSchema(mergedOptions.structuredOutput.schema) }
        : undefined,
      messages: [],
      resolvedScopes: resolvedScopes.scopes,
      toolCallId,
      resumeContext: { resumeData: resumeWith, snapshot: resumeSnapshot, claim: resumeClaim },
      methodType,
      maxProcessorRetries: mergedOptions.maxProcessorRetries ?? driver.maxProcessorRetries,
      ...(methodType === 'stream' ? { _threadStreamPubSub: pubsub } : {}),
    } as unknown as InnerAgentExecutionOptions<OUTPUT> & { _threadStreamPubSub?: PubSub };
    const result = await driver.prepare(executeOptions);

    if (methodType === 'stream') {
      return await presentPlainRunResult({ result, methodType, agent, preparedOptions: preparedOptions!, pubsub });
    }
    if (result.status !== 'success') {
      if (result.status === 'failed') {
        throw new MastraError(
          { id: 'AGENT_GENERATE_FAILED', domain: ErrorDomain.AGENT, category: ErrorCategory.USER },
          result.error,
        );
      }
      throw new MastraError({
        id: 'AGENT_GENERATE_UNKNOWN_ERROR',
        domain: ErrorDomain.AGENT,
        category: ErrorCategory.USER,
        text: 'An unknown error occurred while generating',
      });
    }
    if (typeof result.result?.getFullOutput !== 'function') {
      throw new MastraError({
        id: 'AGENT_GENERATE_MALFORMED_RESULT',
        domain: ErrorDomain.AGENT,
        category: ErrorCategory.SYSTEM,
        text: 'Execution workflow produced a result without getFullOutput',
      });
    }
    generatedOutput = (await result.result.getFullOutput()) as FullOutput<OUTPUT>;
  } catch (error) {
    await resumeClaim.release();
    if (preparedOptions) {
      agentThreadStreamRuntime.releaseThreadRunReservation(runId, pubsub, undefined, preparedOptions.abortSignal);
    }
    throw error;
  }

  if (generatedOutput!.error) throw generatedOutput!.error;
  return generatedOutput!;
}

/** Shared public result/error contract for a new plain run and a resumed one. */
export function presentPlainRunResult<OUTPUT>(args: {
  result: Awaited<ReturnType<typeof executePlainRun<OUTPUT>>>;
  methodType: 'stream';
  agent: Agent<any, any, any, any>;
  preparedOptions: AgentExecutionOptions<OUTPUT>;
  pubsub?: PubSub;
}): Promise<MastraModelOutput<OUTPUT>>;
export function presentPlainRunResult<OUTPUT>(args: {
  result: Awaited<ReturnType<typeof executePlainRun<OUTPUT>>>;
  methodType: 'generate';
  agent: Agent<any, any, any, any>;
  preparedOptions: AgentExecutionOptions<OUTPUT>;
  pubsub?: PubSub;
}): Promise<FullOutput<OUTPUT>>;
export function presentPlainRunResult<OUTPUT>(args: {
  result: Awaited<ReturnType<typeof executePlainRun<OUTPUT>>>;
  methodType: 'generate' | 'stream';
  agent: Agent<any, any, any, any>;
  preparedOptions: AgentExecutionOptions<OUTPUT>;
  pubsub?: PubSub;
}): Promise<FullOutput<OUTPUT> | MastraModelOutput<OUTPUT>>;
export async function presentPlainRunResult<OUTPUT>({
  result,
  methodType,
  agent,
  preparedOptions,
  pubsub,
}: {
  result: Awaited<ReturnType<typeof executePlainRun<OUTPUT>>>;
  methodType: 'generate' | 'stream';
  agent: Agent<any, any, any, any>;
  preparedOptions: AgentExecutionOptions<OUTPUT>;
  pubsub?: PubSub;
}): Promise<FullOutput<OUTPUT> | MastraModelOutput<OUTPUT>> {
  if (result.status !== 'success') {
    if (result.status === 'failed') {
      throw new MastraError(
        {
          id: methodType === 'generate' ? 'AGENT_GENERATE_FAILED' : 'AGENT_STREAM_FAILED',
          domain: ErrorDomain.AGENT,
          category: ErrorCategory.USER,
        },
        result.error,
      );
    }
    throw new MastraError({
      id: methodType === 'generate' ? 'AGENT_GENERATE_UNKNOWN_ERROR' : 'AGENT_STREAM_UNKNOWN_ERROR',
      domain: ErrorDomain.AGENT,
      category: ErrorCategory.USER,
      text: 'An unknown error occurred while streaming',
    });
  }
  if (methodType === 'generate' && typeof result.result?.getFullOutput !== 'function') {
    throw new MastraError({
      id: 'AGENT_GENERATE_MALFORMED_RESULT',
      domain: ErrorDomain.AGENT,
      category: ErrorCategory.SYSTEM,
      text: 'Execution workflow produced a result without getFullOutput',
    });
  }
  await agentThreadStreamRuntime.registerRun(agent, result.result, preparedOptions, pubsub);
  if (methodType === 'generate') {
    const fullOutput = await result.result.getFullOutput();
    if (fullOutput.error) throw fullOutput.error;
    return fullOutput;
  }
  return result.result;
}
