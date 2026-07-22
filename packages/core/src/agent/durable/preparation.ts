import type { AgentBackgroundConfig } from '../../background-tasks/types';
import type { MastraLanguageModel } from '../../llm/model/shared.types';
import type { IMastraLogger } from '../../logger';
import type { Mastra } from '../../mastra';
import type { MastraMemory } from '../../memory/memory';
import type { MemoryConfig, MemoryConfig as _MemoryConfig, StorageThreadType } from '../../memory/types';
import { EntityType, SpanType, createObservabilityContext, getOrCreateSpan } from '../../observability';
import type { InputProcessorOrWorkflow, OutputProcessorOrWorkflow, ErrorProcessorOrWorkflow } from '../../processors';
import type { ProcessorState } from '../../processors/runner';
import { RequestContext, MASTRA_VERSIONS_KEY, mergeVersionOverrides } from '../../request-context';
import type { VersionOverrides } from '../../request-context';
import { toStandardSchema } from '../../schema';
import { normalizeToolPayloadTransformPolicy } from '../../tools/payload-transform';
import type { CoreTool, ToolHooks, ToolPayloadTransformPolicy } from '../../tools/types';
import { deepMerge } from '../../utils';
import type { Workspace } from '../../workspace';
import type { Agent } from '../agent';
import type { AgentExecutionOptions, DelegationConfig } from '../agent.types';
import { MessageList } from '../message-list';
import type { MessageListInput } from '../message-list';
import { SaveQueueManager } from '../save-queue';
import type { CreatedAgentSignal } from '../signals';
import { mastraDBMessageToSignal } from '../signals';
import { TripWire } from '../trip-wire';
import type {
  AgentInstructions,
  AgentMethodType,
  AgentModelManagerConfig,
  GoalConfig,
  ToolsetsInput,
  ToolsInput,
} from '../types';
import type { DurableAgenticWorkflowInput, RunRegistryEntry, SerializableStructuredOutput } from './types';
import { createWorkflowInput } from './utils/serialize-state';

/**
 * JSON-safe snapshot of `requestContext.entries()` so durable steps (e.g.
 * is-task-complete scorers) can see the same `customContext` the non-durable
 * path passes. Best-effort: entries that fail a JSON round-trip are skipped
 * so a single non-serializable value can't break the workflow input.
 */
function snapshotRequestContextEntries(
  requestContext: RequestContext | undefined,
): Record<string, unknown> | undefined {
  if (!requestContext) return undefined;
  const out: Record<string, unknown> = {};
  let any = false;
  for (const [key, value] of requestContext.entries()) {
    try {
      const cloned = JSON.parse(JSON.stringify(value));
      out[key as string] = cloned;
      any = true;
    } catch {
      // Skip non-serializable entries silently — they wouldn't survive the
      // wire on cross-process engines anyway.
    }
  }
  return any ? out : undefined;
}

/**
 * Mirror of Agent#convertInstructionsToString — used for the AGENT_RUN span
 * `attributes.instructions` field so durable runs publish the same shape as
 * non-durable runs. Kept local to avoid promoting the private method.
 */
function convertInstructionsToString(instructions: AgentInstructions | undefined): string {
  if (!instructions) return '';
  if (typeof instructions === 'string') return instructions;
  if (Array.isArray(instructions)) {
    return instructions
      .map(msg => (typeof msg === 'string' ? msg : typeof msg.content === 'string' ? msg.content : ''))
      .filter(Boolean)
      .join('\n\n');
  }
  return typeof instructions.content === 'string' ? instructions.content : '';
}

/**
 * Extract signal messages already present in the messageList at run start
 * (from persisted history) so they can be echoed as data-signal stream parts
 * on the first LLM step. Mirrors `prepare-memory-step.ts#getInitialSignalEchoes`.
 */
function getInitialSignalEchoes(messageList: MessageList): CreatedAgentSignal[] {
  const inputMessageIds = messageList.makeMessageSourceChecker().input;
  return messageList.get.all
    .db()
    .filter(message => message.role === 'signal' && inputMessageIds.has(message.id))
    .map(mastraDBMessageToSignal);
}

/**
 * Interface for the Agent methods needed during durable preparation.
 * This provides proper typing for the public Agent methods we call.
 */
interface DurablePreparationAgent {
  id: string;
  name?: string;
  getDefaultOptions(opts: { requestContext: RequestContext }): AgentExecutionOptions | Promise<AgentExecutionOptions>;
  getInstructions(opts: { requestContext: RequestContext }): AgentInstructions | Promise<AgentInstructions>;
  getModel(opts: { requestContext: RequestContext }): MastraLanguageModel | Promise<MastraLanguageModel>;
  getModelList(requestContext: RequestContext): Promise<AgentModelManagerConfig[] | null>;
  getMemory(opts: { requestContext: RequestContext }): Promise<MastraMemory | undefined>;
  getWorkspace(opts: { requestContext: RequestContext }): Promise<Workspace | undefined>;
  listScorers(opts: {
    requestContext: RequestContext;
  }): Promise<Record<string, { scorer: unknown; sampling?: unknown }> | undefined>;
  getToolsForExecution(opts: {
    toolsets?: ToolsetsInput;
    clientTools?: ToolsInput;
    threadId?: string;
    resourceId?: string;
    runId?: string;
    requestContext?: RequestContext;
    memoryConfig?: MemoryConfig;
    autoResumeSuspendedTools?: boolean;
    hooks?: ToolHooks;
    delegation?: DelegationConfig;
    methodType?: AgentMethodType;
    backgroundTaskPolicy?: AgentExecutionOptions<any>['backgroundTaskPolicy'];
  }): Promise<Record<string, CoreTool>>;
  listInputProcessors(requestContext?: RequestContext): Promise<InputProcessorOrWorkflow[]>;
  listOutputProcessors(requestContext?: RequestContext): Promise<OutputProcessorOrWorkflow[]>;
  listErrorProcessors(requestContext?: RequestContext): Promise<ErrorProcessorOrWorkflow[]>;
  getBackgroundTasksConfig(): AgentBackgroundConfig | undefined;
  getToolPayloadTransform?(): ToolPayloadTransformPolicy | undefined;
  __getDrainPendingSignals(): (runId: string, scope?: 'pending' | 'pre-run') => CreatedAgentSignal[];
  __getGoalConfig(): GoalConfig | undefined;
  __listLLMRequestProcessors(requestContext?: RequestContext): Promise<InputProcessorOrWorkflow[]>;
}

/**
 * Result from the preparation phase
 */
export interface PreparationResult<_OUTPUT = undefined> {
  /** Unique run identifier */
  runId: string;
  /** Message ID for this generation */
  messageId: string;
  /** Serialized workflow input */
  workflowInput: DurableAgenticWorkflowInput;
  /** Non-serializable state for the run registry */
  registryEntry: RunRegistryEntry;
  /** MessageList for callback access */
  messageList: MessageList;
  /** Thread ID if using memory */
  threadId?: string;
  /** Resource ID if using memory */
  resourceId?: string;
}

/**
 * Options for preparation phase
 */
export interface PreparationOptions<OUTPUT = undefined> {
  /** The agent instance (wrapped agent — used for config resolution: tools, model, instructions, memory) */
  agent: Agent<string, any, OUTPUT>;
  /** User messages to process */
  messages: MessageListInput;
  /** Execution options */
  options?: AgentExecutionOptions<OUTPUT>;
  /** Whether execution options already include the agent defaults. */
  optionsAreResolved?: boolean;
  /** Run ID (will be generated if not provided) */
  runId?: string;
  /** Request context */
  requestContext?: RequestContext;
  /** Logger */
  logger?: IMastraLogger;
  /** Mastra instance (for version overrides, background tasks, etc.) */
  mastra?: Mastra;
  /** Method type */
  methodType?: AgentMethodType;
  /**
   * The public-facing agent ID (the DurableAgent wrapper's ID).
   * Used for spans, background tasks, scorers, and all identification visible to Studio.
   * Falls back to `agent.id` if not provided.
   */
  durableAgentId?: string;
  /**
   * The public-facing agent name (the DurableAgent wrapper's name).
   * Used for spans, background tasks, scorers, and all identification visible to Studio.
   * Falls back to `agent.name` if not provided.
   */
  durableAgentName?: string;
}

/**
 * Prepare for durable agent execution.
 *
 * This function performs the non-durable preparation phase:
 * 1. Generates run ID and message ID
 * 2. Resolves thread/memory context
 * 3. Creates MessageList with instructions and messages
 * 4. Converts tools to CoreTool format
 * 5. Gets the model configuration
 * 6. Creates serialized workflow input
 * 7. Creates run registry entry for non-serializable state
 *
 * The result includes both the serialized workflow input (for the durable
 * workflow) and the run registry entry (for non-serializable state).
 */
export async function prepareForDurableExecution<OUTPUT = undefined>(
  options: PreparationOptions<OUTPUT>,
): Promise<PreparationResult<OUTPUT>> {
  const {
    agent,
    messages,
    options: rawExecOptions,
    optionsAreResolved = false,
    runId: providedRunId,
    requestContext: providedRequestContext,
    logger,
    mastra,
    methodType = 'stream',
    durableAgentId,
    durableAgentName,
  } = options;

  // Public-facing identity: use the durable wrapper's ID/name for all
  // external-facing identification (spans, background tasks, scorers, Studio).
  // Fall back to the wrapped agent's ID/name when called outside the durable wrapper.
  const publicAgentId = durableAgentId ?? agent.id;
  const publicAgentName = durableAgentName ?? agent.name ?? agent.id;

  const typedAgent = agent as unknown as DurablePreparationAgent;

  // 1. Generate IDs
  const runId = providedRunId ?? crypto.randomUUID();
  const messageId = crypto.randomUUID();

  // 2. Get request context
  const requestContext = providedRequestContext ?? new RequestContext();

  // 2a. Snapshot caller-provided RequestContext entries *before* preparation
  // mutates the context (version overrides at step 3, MastraMemory at step 4).
  // The persisted `customContext` should reflect only what the caller passed in,
  // not internal-key state added during prep.
  const requestContextEntriesSnapshot = snapshotRequestContextEntries(requestContext);

  // 2b. Merge the wrapped agent's defaultOptions under the per-request options,
  // mirroring the non-durable Agent.stream()/generate() paths. Without this the
  // agent's configured defaults (maxSteps, providerOptions, etc.) are silently
  // dropped and durable runs fall back to DurableAgentDefaults.MAX_STEPS.
  const execOptions: AgentExecutionOptions<OUTPUT> = optionsAreResolved
    ? (rawExecOptions ?? ({} as AgentExecutionOptions<OUTPUT>))
    : (deepMerge(
        ((await typedAgent.getDefaultOptions({ requestContext })) ?? {}) as Record<string, unknown>,
        (rawExecOptions ?? {}) as Record<string, unknown>,
      ) as AgentExecutionOptions<OUTPUT>);

  // 3. Merge version overrides (Mastra defaults < requestContext < call-site)
  const requestVersions = requestContext.get(MASTRA_VERSIONS_KEY) as VersionOverrides | undefined;
  let mergedVersions = mergeVersionOverrides(mastra?.getVersionOverrides?.(), requestVersions);
  if ((execOptions as any)?.versions) {
    mergedVersions = mergeVersionOverrides(mergedVersions, (execOptions as any).versions);
  }
  if (mergedVersions) {
    requestContext.set(MASTRA_VERSIONS_KEY, mergedVersions);
  }

  // 4. Resolve thread/memory context
  const thread =
    typeof execOptions?.memory?.thread === 'string' ? { id: execOptions.memory.thread } : execOptions?.memory?.thread;
  const threadId = thread?.id;
  const resourceId = execOptions?.memory?.resource;
  let threadObject: StorageThreadType | undefined;
  let threadExists = false;

  // 5. Create MessageList
  const messageList = new MessageList({
    threadId,
    resourceId,
  });

  // Add agent instructions. Per-call `options.instructions` overrides the
  // agent's default instructions to mirror non-durable Agent.stream() behavior.
  const instructions = execOptions?.instructions || (await typedAgent.getInstructions({ requestContext }));
  if (instructions) {
    if (typeof instructions === 'string') {
      messageList.addSystem(instructions);
    } else if (Array.isArray(instructions)) {
      for (const inst of instructions) {
        messageList.addSystem(inst);
      }
    } else {
      messageList.addSystem(instructions);
    }
  }
  const workspace = await typedAgent.getWorkspace({ requestContext });

  // Durable preparation runs processInput processors below, but workspace
  // instructions are a processInputStep concern in the non-durable path.
  // Add them here once so durable runs get the same workspace context.
  if (workspace) {
    const hasFs =
      typeof workspace.hasFilesystemConfig === 'function' ? workspace.hasFilesystemConfig() : !!workspace.filesystem;
    const hasSb = typeof workspace.hasSandboxConfig === 'function' ? workspace.hasSandboxConfig() : !!workspace.sandbox;
    if (hasFs || hasSb) {
      const wsInstructions =
        typeof workspace.getInstructionsAsync === 'function'
          ? await workspace.getInstructionsAsync({ requestContext })
          : workspace.getInstructions({ requestContext });
      if (wsInstructions) {
        messageList.addSystem({ role: 'system', content: wsInstructions });
      }
    }
  }

  // Add context messages if provided
  if (execOptions?.context) {
    messageList.add(execOptions.context, 'context');
  }

  // Per-call `options.system` is appended as an additional system message after
  // context. Mirrors the non-durable Agent.stream() prepare-memory-step path.
  if (execOptions?.system) {
    const sys = execOptions.system;
    if (typeof sys === 'string') {
      messageList.addSystem(sys);
    } else if (Array.isArray(sys)) {
      for (const s of sys) {
        messageList.addSystem(s);
      }
    } else {
      messageList.addSystem(sys);
    }
  }

  // Add user messages
  messageList.add(messages, 'input');

  // 6. Establish the memory/thread context BEFORE resolving input processors.
  //
  // Memory.getInputProcessors() decides whether to add the working-memory
  // injector by reading requestContext.get('MastraMemory')?.memoryConfig. When
  // working memory is disabled in the constructor and enabled per-request (the
  // documented setup), that runtime config is the only signal that turns the
  // injector on. If we resolve processors before setting MastraMemory, the
  // per-request config is invisible, the chain falls back to the constructor
  // config, and the injector is silently omitted — so stored working memory is
  // saved by the update-working-memory tool but never read back into the prompt.
  // Setting the context first keeps read (inject) and write (tool) in sync.
  const memory = await typedAgent.getMemory({ requestContext });
  const memoryConfig = execOptions?.memory?.options;
  if (memory && threadId && resourceId) {
    const existingThread = await memory.getThreadById({ threadId });
    threadObject =
      existingThread ??
      (await memory.createThread({
        threadId,
        metadata: thread?.metadata,
        title: thread?.title,
        memoryConfig,
        resourceId,
        saveThread: true,
      }));
    threadExists = true;
    requestContext.set('MastraMemory', { thread: threadObject, resourceId, memoryConfig });
  } else {
    // This run has no complete per-request memory context. Clear any
    // MastraMemory inherited from a caller-provided requestContext (e.g. a
    // parent agent's context during sub-agent delegation) so processor
    // resolution can't pick up the working-memory injector from stale/parent
    // memory — that would both leak prior resource memory into this prompt and
    // break the "no per-request memory options means no injection" gate.
    requestContext.delete('MastraMemory');
  }

  // Resolve input processors now that the memory context is in place.
  const processorStates = new Map<string, ProcessorState>();
  let inputProcessors: InputProcessorOrWorkflow[] = [];
  let llmRequestInputProcessors: InputProcessorOrWorkflow[] = [];
  let outputProcessors: OutputProcessorOrWorkflow[] = [];
  let errorProcessors: ErrorProcessorOrWorkflow[] = [];

  try {
    inputProcessors = await typedAgent.listInputProcessors(requestContext);
    // Uncombined processors for processLLMRequest — combined (workflow-wrapped)
    // processors are skipped by ProcessorRunner.runProcessLLMRequest.
    llmRequestInputProcessors = await typedAgent.__listLLMRequestProcessors(requestContext);
    // Call-time outputProcessors replace constructor-level ones (parity with
    // Agent.listResolvedOutputProcessors which uses overrides-first semantics).
    outputProcessors = execOptions?.outputProcessors
      ? execOptions.outputProcessors
      : await typedAgent.listOutputProcessors(requestContext);
    errorProcessors = await typedAgent.listErrorProcessors(requestContext);
  } catch (error) {
    logger?.warn?.(`[DurableAgent] Error resolving processors: ${error}`);
  }

  // Open AGENT_RUN here so processor_run spans (and their MEMORY_OPERATION
  // children) parent to it. MODEL_GENERATION is opened later under it.
  //
  // Mirrors non-durable Agent.stream(): forward attributes (conversationId,
  // resolved instructions string, resolvedVersionId), metadata (entityVersionId),
  // and the agent-level tracingPolicy so durable runs land in the same span
  // shape as in-process runs.
  const rawConfig = typeof (agent as any).toRawConfig === 'function' ? (agent as any).toRawConfig() : undefined;
  const resolvedVersionId = rawConfig?.resolvedVersionId as string | undefined;
  const agentTracingPolicy =
    typeof (agent as any).getTracingPolicy === 'function' ? (agent as any).getTracingPolicy() : undefined;
  const agentSpan = getOrCreateSpan({
    type: SpanType.AGENT_RUN,
    name: `agent run: '${publicAgentId}'`,
    entityType: EntityType.AGENT,
    entityId: publicAgentId,
    entityName: publicAgentName,
    input: messages,
    attributes: {
      conversationId: threadId,
      instructions: convertInstructionsToString(instructions),
      // @deprecated — use entityVersionId (top-level span context field) instead.
      // Kept for backward compatibility during migration.
      ...(resolvedVersionId ? { resolvedVersionId } : {}),
    },
    metadata: {
      runId,
      resourceId,
      threadId,
      ...(resolvedVersionId ? { entityVersionId: resolvedVersionId } : {}),
    },
    tracingPolicy: agentTracingPolicy,
    tracingContext: execOptions?.tracingContext,
    tracingOptions: execOptions?.tracingOptions,
    requestContext,
    mastra,
  });
  // Run processInput (once, before execution) if we have any processors.
  // The MastraMemory context (thread + memoryConfig) was already established
  // above, before processor resolution, so processors that need it (working
  // memory, OM, message history) can access it here.
  let tripwireData: RunRegistryEntry['tripwire'];
  if (inputProcessors.length > 0) {
    try {
      const { ProcessorRunner } = await import('../../processors/runner');
      const runner = new ProcessorRunner({
        inputProcessors,
        outputProcessors,
        errorProcessors,
        logger: logger as any,
        agentName: publicAgentName,
        processorStates,
      });
      await runner.runInputProcessors(
        messageList,
        createObservabilityContext({ currentSpan: agentSpan }),
        requestContext,
        0,
      );
    } catch (error) {
      if (error instanceof TripWire) {
        tripwireData = {
          reason: error.message,
          retry: error.options?.retry,
          metadata: error.options?.metadata,
          processorId: error.processorId,
        };
        logger?.warn?.('Input processor tripwire triggered', {
          agent: publicAgentName,
          reason: error.message,
          processorId: error.processorId,
          retry: error.options?.retry,
        });
      } else {
        logger?.warn?.(`[DurableAgent] Error running input processors: ${error}`);
      }
    }
  }

  // 7. Convert tools to CoreTool format for execution
  let tools: Record<string, CoreTool> = {};
  try {
    tools = await typedAgent.getToolsForExecution({
      toolsets: execOptions?.toolsets,
      clientTools: execOptions?.clientTools,
      threadId,
      resourceId,
      runId,
      requestContext,
      memoryConfig: execOptions?.memory?.options,
      autoResumeSuspendedTools: execOptions?.autoResumeSuspendedTools,
      hooks: execOptions?.hooks,
      delegation: execOptions?.delegation,
      methodType,
      backgroundTaskPolicy: execOptions?.backgroundTaskPolicy,
    });
  } catch (error) {
    logger?.warn?.(`[DurableAgent] Error converting tools: ${error}`);
  }

  // 8. Get model (and model list if configured)
  const model = await typedAgent.getModel({ requestContext });
  if (!model) {
    throw new Error('Agent model not available');
  }

  const modelList = await typedAgent.getModelList(requestContext);

  // 8b. Get scorers configuration
  const overrideScorers = (execOptions as any)?.scorers;
  let scorers: Record<string, { scorer: any; sampling?: any }> | undefined;

  if (overrideScorers) {
    scorers = overrideScorers;
  } else {
    try {
      const agentScorers = await typedAgent.listScorers({ requestContext });
      if (agentScorers && Object.keys(agentScorers).length > 0) {
        scorers = agentScorers;
      }
    } catch (error) {
      logger?.debug?.(`[DurableAgent] Error getting scorers: ${error}`);
    }
  }

  // 9. Create SaveQueueManager (memory + memoryConfig were resolved in step 6)
  const saveQueueManager = memory
    ? new SaveQueueManager({
        logger,
        memory,
      })
    : undefined;

  // 10. Serialize structured output if provided
  let serializedStructuredOutput: SerializableStructuredOutput | undefined;
  if (execOptions?.structuredOutput) {
    const so = execOptions.structuredOutput as any;
    if (so.schema) {
      serializedStructuredOutput = {
        jsonPromptInjection: so.jsonPromptInjection,
        useAgent: so.useAgent,
      };
      // Convert Zod schema to JSON Schema if possible
      if (typeof so.schema === 'object' && 'type' in so.schema) {
        serializedStructuredOutput.schema = so.schema;
      } else if (typeof so.schema === 'object' && 'jsonSchema' in so.schema) {
        serializedStructuredOutput.schema = so.schema.jsonSchema;
      }
    }
  }

  // 11. Get background task config. When the caller opts out with
  // `disableBackgroundTasks: true`, drop the manager so the registry entry
  // signals "no background tasks for this run" to the check step.
  const backgroundTasksConfig = typedAgent.getBackgroundTasksConfig?.();
  const backgroundTaskManager =
    execOptions?.disableBackgroundTasks || execOptions?.backgroundTaskPolicy?.allowToolDispatch === false
      ? undefined
      : mastra?.backgroundTaskManager;

  // Resolve tool payload transform policy with the same precedence the
  // non-durable Agent uses: per-call > agent-level > mastra-level. The
  // resolved policy carries a closure, so it lives on the run registry; the
  // JSON-safe `targets` shadow is serialized into workflow input below.
  const toolPayloadTransform =
    normalizeToolPayloadTransformPolicy(execOptions?.transform) ??
    typedAgent.getToolPayloadTransform?.() ??
    normalizeToolPayloadTransformPolicy(
      mastra?.getToolPayloadTransform?.() ?? (mastra as any)?.getToolPayloadProjection?.(),
    );

  // 12. Resolve memory persistence flags
  const savePerStep = execOptions?.savePerStep;
  const observationalMemory = !!memoryConfig?.observationalMemory;

  // 12b. Open MODEL_GENERATION under the AGENT_RUN opened in step 6, and export both
  // into the workflow input so each durable step can rebuild them. No-ops when
  // observability is off.
  const modelSpan = agentSpan?.createChildSpan({
    type: SpanType.MODEL_GENERATION,
    name: `llm: '${model.modelId}'`,
    attributes: {
      model: model.modelId,
      provider: model.provider,
      streaming: true,
    },
    metadata: {
      runId,
      threadId,
      resourceId,
    },
    requestContext,
  });

  // 13. Create serialized workflow input
  const workflowInput = createWorkflowInput({
    runId,
    agentId: publicAgentId,
    agentName: publicAgentName,
    messageList,
    tools,
    model,
    modelList: modelList ?? undefined,
    scorers,
    options: {
      maxSteps: execOptions?.maxSteps,
      toolChoice: execOptions?.toolChoice as any,
      activeTools: execOptions?.activeTools,
      modelSettings: execOptions?.modelSettings as any,
      // Function-form approval policies are closures that can't ride on the
      // serialized workflow input — the live closure is parked on the run
      // registry below. This boolean shadow is the cross-process fallback:
      // function policies degrade to "require approval for every tool call"
      // when the registry slot is unavailable (e.g. Inngest after a worker
      // restart), which is the safe default.
      requireToolApproval:
        typeof execOptions?.requireToolApproval === 'function' ? true : execOptions?.requireToolApproval,
      toolCallConcurrency: execOptions?.toolCallConcurrency,
      autoResumeSuspendedTools: execOptions?.autoResumeSuspendedTools,
      maxProcessorRetries: execOptions?.maxProcessorRetries,
      includeRawChunks: execOptions?.includeRawChunks,
      returnScorerData: (execOptions as any)?.returnScorerData,
      hasErrorProcessors: errorProcessors.length > 0,
      providerOptions: execOptions?.providerOptions,
      structuredOutput: serializedStructuredOutput,
      skipBgTaskWait: (execOptions as any)?._skipBgTaskWait,
      disableBackgroundTasks: execOptions?.disableBackgroundTasks,
      backgroundTaskPolicy: execOptions?.backgroundTaskPolicy,
      tracingOptions: execOptions?.tracingOptions,
      actor: execOptions?.actor,
      instructionsOverride: execOptions?.instructions,
      systemMessage: execOptions?.system,
      transform: toolPayloadTransform?.targets ? { targets: toolPayloadTransform.targets } : undefined,
      isTaskComplete: execOptions?.isTaskComplete
        ? {
            scorerNames: execOptions.isTaskComplete.scorers?.map(s => s.name).filter((n): n is string => !!n),
            strategy: execOptions.isTaskComplete.strategy,
            timeout: execOptions.isTaskComplete.timeout,
            parallel: execOptions.isTaskComplete.parallel,
            suppressFeedback: execOptions.isTaskComplete.suppressFeedback,
          }
        : undefined,
    },
    state: {
      memoryConfig,
      threadId,
      resourceId,
      threadExists,
      savePerStep,
      observationalMemory,
    },
    messageId,
    agentSpanData: agentSpan?.exportSpan(),
    modelSpanData: modelSpan?.exportSpan(),
    requestContextEntries: requestContextEntriesSnapshot,
  });

  // 14. Create registry entry for non-serializable state
  const registryEntry: RunRegistryEntry = {
    tools,
    saveQueueManager,
    memory,
    model,
    modelList: modelList
      ? modelList.map((entry: AgentModelManagerConfig) => ({
          id: entry.id,
          model: entry.model,
          maxRetries: entry.maxRetries ?? 0,
          enabled: entry.enabled ?? true,
          headers: entry.headers,
        }))
      : undefined,
    workspace,
    requestContext,
    inputProcessors,
    llmRequestInputProcessors,
    outputProcessors,
    errorProcessors,
    processorStates,
    backgroundTaskManager,
    backgroundTasksConfig,
    agentSpan,
    modelSpan,
    // Park the stopWhen predicate(s) on the registry so the durable agentic
    // loop can evaluate them on each iteration. The predicate is a closure and
    // cannot ride on the serialized workflow input; in-process engines read it
    // back via globalRunRegistry, cross-process engines degrade to maxSteps.
    stopWhen: execOptions?.stopWhen,
    onIterationComplete: execOptions?.onIterationComplete,
    prepareStep: execOptions?.prepareStep,
    toolPayloadTransform,
    isTaskComplete: execOptions?.isTaskComplete,
    // Park the per-call requireToolApproval policy on the registry so the
    // durable tool-call step can evaluate function-form policies with the
    // real (toolName, args) on each call. The boolean shadow on the
    // serialized workflow input is the cross-process fallback.
    requireToolApproval: execOptions?.requireToolApproval,
    // Signal drain — the closure reads from AgentThreadStreamRuntime's queues.
    // Non-serializable; cross-process engines lose it and signals go undelivered.
    drainPendingSignals: scope => typedAgent.__getDrainPendingSignals()(runId, scope),
    // Thread title generation — mirrors the non-durable `#executeOnFinish` branch,
    // which was never ported to the durable finish step (so `generateTitle` never
    // fired for durable/evented agents). Parked here because the agent instance is
    // in scope; the durable finish step invokes it after the run completes. No-op
    // when the merged config has no `generateTitle` or the thread already has a
    // title. Non-serializable — cross-process engines skip title generation.
    generateThreadTitle: memory
      ? async ({ threadId, resourceId, memoryConfig, messageListState, requestContext: rc, tracingContext }) => {
          // Re-read the thread so a title written mid-run isn't regenerated, and so we only
          // generate on the first turn (mirrors the non-durable `!thread.title` guard).
          const thread = await memory.getThreadById?.({ threadId });
          const mergedConfig = memory.getMergedThreadConfig?.(memoryConfig);
          const { shouldGenerate, model, instructions, minMessages } = agent.resolveTitleGenerationConfig(
            mergedConfig?.generateTitle as Parameters<typeof agent.resolveTitleGenerationConfig>[0],
          );
          if (!shouldGenerate || thread?.title) return;

          const titleMessageList = new MessageList().deserialize(messageListState);
          const uiMessages = titleMessageList.get.all.ui();
          const coreMessages = titleMessageList.get.all.core();
          if (coreMessages.length < (minMessages ?? 1)) return;

          const userMessage = agent.getMostRecentUserMessage(uiMessages);
          if (!userMessage) return;

          const title = await agent.genTitle(
            userMessage,
            rc ?? new RequestContext(),
            createObservabilityContext(tracingContext),
            model,
            instructions,
            uiMessages,
          );
          if (!title) return;

          // Title-only late write. Prefer updateThread when the thread record
          // already exists so its original createdAt is preserved (createThread
          // rebuilds the record with a fresh createdAt). Fall back to createThread
          // for the first-turn case where the record may not be persisted yet.
          if (thread) {
            await memory.updateThread({
              id: threadId,
              title,
              metadata: thread.metadata ?? {},
              memoryConfig,
            });
          } else {
            await memory.createThread({
              threadId,
              resourceId,
              memoryConfig,
              title,
            });
          }
        }
      : undefined,
    // Signal messages already in the messageList at run start (from persisted
    // history). Echoed as data-signal parts on the first LLM step so the client
    // sees them without refetching. Spliced once, never re-emitted.
    initialSignalEchoes: getInitialSignalEchoes(messageList),
    // Agent-level goal config (judge resolver, tools resolver, scorer).
    // Non-serializable — cross-process engines skip goal evaluation.
    goal: agent.__getGoalConfig(),
    // Tripwire from processInput (initial input processing). When an input
    // processor calls abort() during runInputProcessors, we store the tripwire
    // data here so the first llm-execution step can emit a tripwire chunk and
    // bail immediately without calling the model.
    tripwire: tripwireData,
    // Call-time headers from modelSettings.headers. Kept off the serialized
    // workflow input so they never reach durable storage; the durable
    // llm-execution step reads them from this registry slot instead.
    callTimeHeaders: extractCallTimeHeaders(execOptions?.modelSettings),
    // Call-time structured output config with the live schema. The schema is
    // non-serializable (Zod / standard-schema instance), so it lives on the
    // in-process registry. The durable stream adapter reads it to pipe LLM
    // text through `createObjectStreamTransformer`, producing `object-result`
    // chunks. Cross-process engines lose this slot and structured output
    // degrades to raw text.
    structuredOutput: execOptions?.structuredOutput?.schema
      ? {
          ...execOptions.structuredOutput,
          schema: toStandardSchema(execOptions.structuredOutput.schema),
        }
      : undefined,
    cleanup: () => {},
  };

  return {
    runId,
    messageId,
    workflowInput,
    registryEntry,
    messageList,
    threadId,
    resourceId,
  };
}

/**
 * Extract string-valued headers from `modelSettings.headers` for storage on the
 * in-process `RunRegistryEntry`. Returns `undefined` when no valid headers are
 * present so the registry slot stays empty rather than carrying an empty object.
 */
function extractCallTimeHeaders(
  modelSettings: Record<string, unknown> | undefined,
): Record<string, string> | undefined {
  const raw = (modelSettings as Record<string, unknown> | undefined)?.headers;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;

  const headers: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value === 'string') headers[key] = value;
  }
  return Object.keys(headers).length > 0 ? headers : undefined;
}
