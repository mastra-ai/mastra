import type { AgentBackgroundConfig } from '../../background-tasks/types';
import { ErrorCategory, ErrorDomain, MastraError } from '../../error';
import { validateMaxSteps, validateRecoveryMaxSteps } from '../../llm/model/max-steps';
import type { MastraLanguageModel } from '../../llm/model/shared.types';
import type { IMastraLogger } from '../../logger';
import type { Mastra } from '../../mastra';
import type { MastraMemory } from '../../memory/memory';
import type { MemoryConfig, MemoryConfig as _MemoryConfig, StorageThreadType } from '../../memory/types';
import { EntityType, SpanType, createObservabilityContext, getOrCreateSpan } from '../../observability';
import type { InputProcessorOrWorkflow, OutputProcessorOrWorkflow, ErrorProcessorOrWorkflow } from '../../processors';
import type { ProcessorState } from '../../processors/runner';
import {
  MASTRA_AUTH_TOKEN_KEY,
  RequestContext,
  MASTRA_RESOURCE_ID_KEY,
  MASTRA_THREAD_ID_KEY,
  MASTRA_VERSIONS_KEY,
  isInfrastructureRequestContextKey,
  mergeVersionOverrides,
} from '../../request-context';
import type { VersionOverrides } from '../../request-context';
import { toStandardSchema } from '../../schema';
import { normalizeToolPayloadTransformPolicy } from '../../tools/payload-transform';
import type { CoreTool, ToolHooks, ToolPayloadTransformPolicy } from '../../tools/types';
import { boundedStringify } from '../../utils';
import type { Workspace } from '../../workspace';
import type { Agent } from '../agent';
import type { AgentDefaultOptions, AgentExecutionOptions, DelegationConfig } from '../agent.types';
import type { ResolvedAgentMemory } from '../execution-memory';
import { assertThreadOwnedByResource } from '../memory-thread-ownership';
import { mergeAgentExecutionOptions, omitLogicalMessageIdentity } from '../merge-execution-options';
import { MessageList } from '../message-list';
import type { MastraDBMessage, MessageListInput } from '../message-list';
import { SaveQueueManager } from '../save-queue';
import type { CreatedAgentSignal } from '../signals';
import { mastraDBMessageToSignal } from '../signals';
import { TOOL_PERMISSION_POLICY_KEY } from '../tool-permission-prefilter';
import {
  clearToolSurfaceFence,
  createToolSurfaceFence,
  materializeToolSurfaceFence,
  readToolSurfaceFence,
} from '../tool-surface-fence';
import { TripWire } from '../trip-wire';
import type {
  AgentInstructions,
  AgentMethodType,
  AgentModelManagerConfig,
  GoalConfig,
  ToolsetsInput,
  ToolsInput,
} from '../types';
import {
  applyClientToolModelOutput,
  fireClientToolOutputHooks,
} from '../workflows/prepare-stream/client-tool-output-hooks';
import type { DurableAgenticWorkflowInput, RunRegistryEntry, SerializableStructuredOutput } from './types';
import { createRuntimeDependencyFingerprint, createWorkflowInput } from './utils/serialize-state';

/**
 * Persist only explicitly allowlisted, non-infrastructure RequestContext
 * entries. Durable snapshots can outlive the process and must never become a
 * credential cache. An allowlisted value that cannot be preserved exactly as
 * bounded JSON fails preparation instead of silently changing recovery
 * semantics.
 */
const MAX_DURABLE_REQUEST_CONTEXT_KEYS = 100;
const MAX_DURABLE_REQUEST_CONTEXT_KEY_BYTES = 256;
const MAX_DURABLE_REQUEST_CONTEXT_VALUE_BYTES = 8_192;
const MAX_DURABLE_REQUEST_CONTEXT_TOTAL_BYTES = 32_768;
const durableRequestContextEncoder = new TextEncoder();

/**
 * RequestContext allowlists are an application boundary, not permission to
 * turn durable workflow state into a credential store. Reject names that are
 * conventionally used for raw credentials even when the caller explicitly
 * allowlists them. Stable references such as `connectionId` remain valid.
 */
function isCredentialLikeDurableRequestContextKey(key: string): boolean {
  const normalized = key
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  const segments = normalized.split('_').filter(Boolean);
  const segmentSet = new Set(segments);

  if (
    segments.some(segment =>
      [
        'credential',
        'credentials',
        'password',
        'passphrase',
        'secret',
        'secrets',
        'authorization',
        'jwt',
        'cookie',
        'cookies',
      ].includes(segment),
    )
  ) {
    return true;
  }

  if (
    ['apikey', 'privatekey', 'clientsecret', 'auth', 'authentication', 'headers', 'oauth', 'session', 'token'].includes(
      normalized,
    )
  ) {
    return true;
  }

  return (
    (segmentSet.has('api') && segmentSet.has('key')) ||
    (segmentSet.has('access') && segmentSet.has('key')) ||
    (segmentSet.has('private') && segmentSet.has('key')) ||
    (segmentSet.has('client') && segmentSet.has('key')) ||
    (segmentSet.has('session') && segmentSet.has('key')) ||
    (segmentSet.has('service') && segmentSet.has('account') && segmentSet.has('key')) ||
    (segmentSet.has('signing') && segmentSet.has('key')) ||
    (segmentSet.has('encryption') && segmentSet.has('key')) ||
    (segmentSet.has('ssh') && segmentSet.has('key')) ||
    (segmentSet.has('client') && segmentSet.has('secret')) ||
    (segmentSet.has('token') &&
      [
        'access',
        'refresh',
        'auth',
        'authentication',
        'bearer',
        'session',
        'identity',
        'id',
        'oauth',
        'api',
        'csrf',
        'xsrf',
      ].some(segment => segmentSet.has(segment)))
  );
}

export function snapshotDurableRequestContextEntries(
  requestContext: RequestContext | undefined,
  allowedKeys: readonly string[] | undefined,
): Record<string, unknown> | undefined {
  if (!requestContext || !allowedKeys || allowedKeys.length === 0) return undefined;
  const uniqueKeys = [...new Set(allowedKeys)];
  if (uniqueKeys.length > MAX_DURABLE_REQUEST_CONTEXT_KEYS) {
    throw new MastraError({
      id: 'DURABLE_AGENT_REQUEST_CONTEXT_ALLOWLIST_TOO_LARGE',
      domain: ErrorDomain.AGENT,
      category: ErrorCategory.USER,
      text: `DurableAgent request-context persistence allows at most ${MAX_DURABLE_REQUEST_CONTEXT_KEYS} keys.`,
    });
  }
  const out: Record<string, unknown> = {};
  for (const key of uniqueKeys) {
    // Rebuilt from persisted run state; never snapshot a caller's parent-run
    // memory context even when it appears in the application allowlist.
    if (key === 'MastraMemory') continue;
    if (isInfrastructureRequestContextKey(key)) {
      throw new MastraError({
        id: 'DURABLE_AGENT_REQUEST_CONTEXT_INFRASTRUCTURE_KEY_FORBIDDEN',
        domain: ErrorDomain.AGENT,
        category: ErrorCategory.USER,
        text: `DurableAgent cannot persist infrastructure request-context key "${key}". Persist a non-secret application reference instead.`,
      });
    }
    if (isCredentialLikeDurableRequestContextKey(key)) {
      throw new MastraError({
        id: 'DURABLE_AGENT_REQUEST_CONTEXT_CREDENTIAL_KEY_FORBIDDEN',
        domain: ErrorDomain.AGENT,
        category: ErrorCategory.USER,
        text: `DurableAgent cannot persist credential-like request-context key "${key}". Persist a stable application reference instead.`,
      });
    }
    if (durableRequestContextEncoder.encode(key).byteLength > MAX_DURABLE_REQUEST_CONTEXT_KEY_BYTES) {
      throw new MastraError({
        id: 'DURABLE_AGENT_REQUEST_CONTEXT_KEY_TOO_LARGE',
        domain: ErrorDomain.AGENT,
        category: ErrorCategory.USER,
        text: `DurableAgent request-context persistence key "${key.slice(0, 64)}" is too large.`,
      });
    }
    if (!requestContext.has(key)) continue;
    const value = requestContext.get(key);
    try {
      const json = boundedStringify(value);
      if (json === undefined) {
        throw new MastraError({
          id: 'DURABLE_AGENT_REQUEST_CONTEXT_VALUE_NOT_SERIALIZABLE',
          domain: ErrorDomain.AGENT,
          category: ErrorCategory.USER,
          text: `DurableAgent request-context persistence value for "${key}" is not JSON serializable.`,
        });
      }
      if (durableRequestContextEncoder.encode(json).byteLength > MAX_DURABLE_REQUEST_CONTEXT_VALUE_BYTES) {
        throw new MastraError({
          id: 'DURABLE_AGENT_REQUEST_CONTEXT_VALUE_TOO_LARGE',
          domain: ErrorDomain.AGENT,
          category: ErrorCategory.USER,
          text: `DurableAgent request-context persistence value for "${key}" exceeds ${MAX_DURABLE_REQUEST_CONTEXT_VALUE_BYTES} bytes.`,
        });
      }
      out[key] = JSON.parse(json) as unknown;
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: 'DURABLE_AGENT_REQUEST_CONTEXT_VALUE_NOT_SERIALIZABLE',
          domain: ErrorDomain.AGENT,
          category: ErrorCategory.USER,
          text: `DurableAgent request-context persistence value for "${key}" is not JSON serializable.`,
        },
        error,
      );
    }
  }
  if (Object.keys(out).length === 0) return undefined;
  if (durableRequestContextEncoder.encode(JSON.stringify(out)).byteLength > MAX_DURABLE_REQUEST_CONTEXT_TOTAL_BYTES) {
    throw new MastraError({
      id: 'DURABLE_AGENT_REQUEST_CONTEXT_SNAPSHOT_TOO_LARGE',
      domain: ErrorDomain.AGENT,
      category: ErrorCategory.USER,
      text: `DurableAgent request-context persistence snapshot exceeds ${MAX_DURABLE_REQUEST_CONTEXT_TOTAL_BYTES} bytes.`,
    });
  }
  return out;
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
  getDefaultOptions(opts: { requestContext: RequestContext }): AgentDefaultOptions | Promise<AgentDefaultOptions>;
  getInstructions(opts: { requestContext: RequestContext }): AgentInstructions | Promise<AgentInstructions>;
  getModel(opts: { requestContext: RequestContext }): MastraLanguageModel | Promise<MastraLanguageModel>;
  getModelList(requestContext: RequestContext): Promise<AgentModelManagerConfig[] | null>;
  __resolveExecutionModels(opts: { requestContext: RequestContext }): Promise<{
    model: MastraLanguageModel;
    modelList: AgentModelManagerConfig[] | null;
  }>;
  getMemory(opts: { requestContext: RequestContext }): Promise<MastraMemory | undefined>;
  getWorkspace(opts: { requestContext: RequestContext }): Promise<Workspace | undefined>;
  listScorers(opts: {
    requestContext: RequestContext;
  }): Promise<Record<string, { scorer: unknown; sampling?: unknown }> | undefined>;
  getToolsForExecution(opts: {
    toolsets?: ToolsetsInput;
    toolsetsMode?: AgentExecutionOptions['toolsetsMode'];
    clientTools?: ToolsInput;
    threadId?: string;
    resourceId?: string;
    runId?: string;
    requestContext?: RequestContext;
    memoryConfig?: MemoryConfig;
    autoResumeSuspendedTools?: boolean;
    agentId?: string;
    agentName?: string;
    hooks?: ToolHooks;
    delegation?: DelegationConfig;
    methodType?: AgentMethodType;
    _toolSurfaceFenceOwnerId?: string;
    resolvedDefaultOptions?: AgentExecutionOptions<any>;
    resolvedMemory?: ResolvedAgentMemory;
    resolvedModel?: MastraLanguageModel;
    resolvedInputProcessors?: InputProcessorOrWorkflow[];
    processorMessages?: MastraDBMessage[];
    backgroundTaskEnabled?: boolean;
    backgroundTaskPolicy?: AgentExecutionOptions<any>['backgroundTaskPolicy'];
  }): Promise<Record<string, CoreTool>>;
  listInputProcessors(
    requestContext?: RequestContext,
    resolvedMemory?: ResolvedAgentMemory,
  ): Promise<InputProcessorOrWorkflow[]>;
  listOutputProcessors(
    requestContext?: RequestContext,
    resolvedMemory?: ResolvedAgentMemory,
  ): Promise<OutputProcessorOrWorkflow[]>;
  listErrorProcessors(requestContext?: RequestContext): Promise<ErrorProcessorOrWorkflow[]>;
  getBackgroundTasksConfig(): AgentBackgroundConfig | undefined;
  __assertAgentResumePreflight(options: {
    requestContext?: RequestContext;
    memory?: AgentExecutionOptions<any>['memory'];
    runId?: string;
    agentId?: string;
    agentName?: string;
    actor?: AgentExecutionOptions<any>['actor'];
  }): Promise<void>;
  getToolPayloadTransform?(): ToolPayloadTransformPolicy | undefined;
  __getDrainPendingSignals(): (runId: string, scope?: 'pending' | 'pre-run') => CreatedAgentSignal[];
  __getGoalConfig(): GoalConfig | undefined;
  __listLLMRequestProcessors(
    requestContext?: RequestContext,
    resolvedMemory?: ResolvedAgentMemory,
  ): Promise<InputProcessorOrWorkflow[]>;
  __resolveExecutionProcessors(
    requestContext?: RequestContext,
    resolvedMemory?: ResolvedAgentMemory,
    outputProcessorOverrides?: OutputProcessorOrWorkflow[],
  ): Promise<{
    configuredInputProcessors: InputProcessorOrWorkflow[];
    inputProcessors: InputProcessorOrWorkflow[];
    llmRequestInputProcessors: InputProcessorOrWorkflow[];
    outputProcessors: OutputProcessorOrWorkflow[];
    errorProcessors: ErrorProcessorOrWorkflow[];
  }>;
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
  /**
   * Defaults already resolved by an enclosing execution boundary. Internal
   * callers use this to keep dynamic defaults single-resolution.
   */
  resolvedDefaultOptions?: AgentExecutionOptions<OUTPUT>;
  /** Whether execution options already include the agent defaults. */
  optionsAreResolved?: boolean;
  /** Memory already resolved by an enclosing execution boundary. */
  resolvedMemory?: ResolvedAgentMemory;
  /** Explicit non-secret application keys that may cross the durable boundary. */
  durableRequestContextKeys?: readonly string[];
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

/** Completed authorization/version boundary for the preparation phase. */
interface PreparationPreflightResult {
  runId: string;
  requestContext: RequestContext;
  mergedVersions?: VersionOverrides;
}

/** @internal Runs the durable request-context/FGA boundary without resolving runtime dependencies. */
async function preflightDurableExecution<OUTPUT = undefined>(
  options: PreparationOptions<OUTPUT>,
): Promise<PreparationPreflightResult> {
  const {
    agent,
    options: execOptions,
    runId: providedRunId,
    requestContext: providedRequestContext,
    durableAgentId,
    durableAgentName,
    logger,
    mastra,
  } = options;

  validateMaxSteps(execOptions?.maxSteps, logger);
  validateRecoveryMaxSteps(execOptions?.recoveryMaxSteps, logger);
  if (providedRunId !== undefined && providedRunId.trim().length === 0) {
    throw new Error('DurableAgent runId must be a non-empty string.');
  }
  const runId = providedRunId ?? crypto.randomUUID();
  const requestContext = providedRequestContext ?? new RequestContext();
  const requestVersions = requestContext.get(MASTRA_VERSIONS_KEY) as VersionOverrides | undefined;
  let effectiveVersions = mergeVersionOverrides(mastra?.getVersionOverrides?.(), requestVersions);
  if ((execOptions as any)?.versions) {
    effectiveVersions = mergeVersionOverrides(effectiveVersions, (execOptions as any).versions);
  }
  const mergedVersions = effectiveVersions ? structuredClone(effectiveVersions) : undefined;
  if (mergedVersions) {
    requestContext.set(MASTRA_VERSIONS_KEY, structuredClone(mergedVersions));
  }

  const typedAgent = agent as unknown as DurablePreparationAgent;
  await typedAgent.__assertAgentResumePreflight({
    requestContext,
    memory: execOptions?.memory,
    runId,
    agentId: durableAgentId ?? agent.id,
    agentName: durableAgentName ?? agent.name,
    actor: execOptions?.actor,
  });

  return { runId, requestContext, mergedVersions };
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
  // 2. Get request context
  let requestContext = providedRequestContext ?? new RequestContext();

  // 2b. Merge the wrapped agent's defaultOptions under the per-request options,
  // mirroring the non-durable Agent.stream()/generate() paths. Without this the
  // agent's configured defaults (maxSteps, providerOptions, etc.) are silently
  // dropped and durable runs fall back to DurableAgentDefaults.MAX_STEPS.
  // Dynamic defaults resolve exactly once per run: the pre-resolved lane must
  // reuse the caller-provided snapshot and never re-invoke getDefaultOptions.
  const resolvedDefaultOptions = optionsAreResolved
    ? options.resolvedDefaultOptions
    : (options.resolvedDefaultOptions ?? (await typedAgent.getDefaultOptions({ requestContext })));
  const defaultOptions = resolvedDefaultOptions
    ? (omitLogicalMessageIdentity(resolvedDefaultOptions as Record<string, any>) as AgentExecutionOptions<OUTPUT>)
    : undefined;
  const execOptions: AgentExecutionOptions<OUTPUT> = optionsAreResolved
    ? (rawExecOptions ?? ({} as AgentExecutionOptions<OUTPUT>))
    : (mergeAgentExecutionOptions(
        (defaultOptions ?? {}) as Record<string, any>,
        (rawExecOptions ?? {}) as Record<string, any>,
      ) as AgentExecutionOptions<OUTPUT>);
  // Actor is a per-call trust signal: an explicit value replaces the default
  // actor as a whole rather than field-merging with it (a default's
  // sourceWorkflow must never tag a caller-supplied actor).
  if (!optionsAreResolved && rawExecOptions?.actor !== undefined) {
    execOptions.actor = rawExecOptions.actor;
  }
  // An explicit context wins. Otherwise the context supplied by dynamic
  // defaults is the execution context and must drive preflight, dependency
  // resolution, and cold-recovery persistence rather than the empty bootstrap
  // context used to resolve those defaults.
  requestContext = providedRequestContext ?? execOptions.requestContext ?? requestContext;
  execOptions.requestContext = requestContext;

  // Snapshot the effective external context before preparation adds internal
  // version or memory keys. Dynamic-default context is part of the execution
  // contract and must survive cold recovery just like caller context.
  const requestContextEntriesSnapshot = snapshotDurableRequestContextEntries(
    requestContext,
    options.durableRequestContextKeys,
  );
  const requiredRequestContextCapabilities = requestContext.has(MASTRA_AUTH_TOKEN_KEY)
    ? { authToken: true as const }
    : undefined;
  const preflight = await preflightDurableExecution({
    ...options,
    options: execOptions,
    requestContext,
    durableAgentId: publicAgentId,
    durableAgentName: publicAgentName,
  });
  const { runId, mergedVersions } = preflight;
  const messageId = crypto.randomUUID();
  const runtimeBindingId = crypto.randomUUID();

  // 4. Resolve thread/memory context
  const requestedThread =
    typeof execOptions?.memory?.thread === 'string' ? { id: execOptions.memory.thread } : execOptions?.memory?.thread;
  const contextThreadId = requestContext.get(MASTRA_THREAD_ID_KEY);
  const contextResourceId = requestContext.get(MASTRA_RESOURCE_ID_KEY);
  const hasFga = Boolean(mastra?.getServer()?.fga);
  if (hasFga && requestedThread?.id && typeof contextThreadId !== 'string') {
    throw new Error('DurableAgent requires a verified request-context thread id when FGA is enabled.');
  }
  const threadId = typeof contextThreadId === 'string' ? contextThreadId : requestedThread?.id;
  const resourceId = typeof contextResourceId === 'string' ? contextResourceId : execOptions?.memory?.resource;
  const thread = requestedThread
    ? {
        ...requestedThread,
        id: threadId ?? requestedThread.id,
      }
    : threadId
      ? { id: threadId }
      : undefined;
  let threadObject: StorageThreadType | undefined;
  let threadExists = false;
  let processorMemory: MastraMemory | undefined;
  let createdThreadDuringPreparation = false;
  const inheritedMastraMemory = requestContext.get('MastraMemory');
  let agentSpan: RunRegistryEntry['agentSpan'];
  let toolSurfaceFenceOwnerId: string | undefined;

  // 5. Create MessageList
  const messageList = new MessageList({
    threadId,
    resourceId,
    logicalMessageIdentity: execOptions?.logicalMessageIdentity,
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
  try {
    const memory = options.resolvedMemory
      ? options.resolvedMemory.value
      : await typedAgent.getMemory({ requestContext });
    // Tracked so a failed replacement-mode preparation below can roll back a
    // thread this preparation created (never a pre-existing one).
    processorMemory = memory;
    const memoryConfig = execOptions?.memory?.options;
    if (memory && threadId && resourceId) {
      const existingThread = await memory.getThreadById({ threadId });
      if (existingThread) {
        assertThreadOwnedByResource({ thread: existingThread, resourceId, agentName: publicAgentName });
        threadObject = existingThread;
      } else {
        threadObject = await memory.createThread({
          threadId,
          metadata: thread?.metadata,
          title: thread?.title,
          memoryConfig,
          resourceId,
          saveThread: true,
        });
        createdThreadDuringPreparation = true;
      }
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
    const resolvedMemory = { value: memory } satisfies ResolvedAgentMemory;
    const { configuredInputProcessors, inputProcessors, llmRequestInputProcessors, outputProcessors, errorProcessors } =
      await typedAgent.__resolveExecutionProcessors(requestContext, resolvedMemory, execOptions?.outputProcessors);

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
    agentSpan = getOrCreateSpan({
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
          agent: agent as unknown as Agent<any, any, any, any>,
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
          const processorError = new MastraError(
            {
              id: 'AGENT_INPUT_PROCESSOR_ERROR',
              domain: ErrorDomain.AGENT,
              category: ErrorCategory.USER,
              text: `[Agent:${publicAgentName}] - Input processor error`,
            },
            error,
          );
          throw processorError;
        }
      }
    }
    // Resolve background task configuration before converting tools so eligible
    // tools expose the per-call `_background` override in their input schemas.
    const backgroundTasksConfig = typedAgent.getBackgroundTasksConfig?.();
    const backgroundTaskManager =
      execOptions?.disableBackgroundTasks || execOptions?.backgroundTaskPolicy?.allowToolDispatch === false
        ? undefined
        : mastra?.backgroundTaskManager;

    // 7. Convert tools to CoreTool format for execution
    let tools: Record<string, CoreTool> = {};
    const perExecutionToolHooks =
      typeof execOptions?.hooks?.beforeToolCall === 'function' ||
      typeof execOptions?.hooks?.afterToolCall === 'function'
        ? execOptions.hooks
        : undefined;
    const toolHookPolicy = perExecutionToolHooks
      ? {
          kind: 'run-registry' as const,
          id: crypto.randomUUID(),
          beforeToolCall: typeof perExecutionToolHooks.beforeToolCall === 'function',
          afterToolCall: typeof perExecutionToolHooks.afterToolCall === 'function',
        }
      : undefined;
    toolSurfaceFenceOwnerId = crypto.randomUUID();
    const resolvedModels = await typedAgent.__resolveExecutionModels({ requestContext });
    try {
      tools = await typedAgent.getToolsForExecution({
        toolsets: execOptions?.toolsets,
        toolsetsMode: execOptions?.toolsetsMode,
        clientTools: execOptions?.clientTools,
        threadId,
        resourceId,
        runId,
        requestContext,
        memoryConfig: execOptions?.memory?.options,
        autoResumeSuspendedTools: execOptions?.autoResumeSuspendedTools,
        agentId: publicAgentId,
        agentName: publicAgentName,
        hooks: execOptions?.hooks,
        delegation: execOptions?.delegation,
        methodType,
        _toolSurfaceFenceOwnerId: toolSurfaceFenceOwnerId,
        resolvedDefaultOptions: defaultOptions as AgentExecutionOptions<any>,
        resolvedMemory,
        resolvedModel: resolvedModels.model,
        resolvedInputProcessors: configuredInputProcessors,
        processorMessages: messageList.get.all.db(),
        backgroundTaskEnabled: Boolean(backgroundTaskManager),
        backgroundTaskPolicy: execOptions?.backgroundTaskPolicy,
      });
    } catch (error) {
      logger?.warn?.(`[DurableAgent] Error converting tools: ${error}`);
      if (error instanceof MastraError) throw error;
      const toolResolutionError = new MastraError(
        {
          id: 'AGENT_TOOL_RESOLUTION_ERROR',
          domain: ErrorDomain.AGENT,
          category: ErrorCategory.USER,
          text: `[Agent:${publicAgentName}] - Tool resolution error`,
        },
        error,
      );
      throw toolResolutionError;
    }
    const replacementFence = readToolSurfaceFence(requestContext, runId);
    const ownsReplacementFence = replacementFence
      ? clearToolSurfaceFence(requestContext, runId, toolSurfaceFenceOwnerId)
      : false;
    const toolSurfaceFence = ownsReplacementFence ? [...replacementFence!.allowedNames] : undefined;

    // 8. Get model (and model list if configured)
    const model = resolvedModels.model;
    if (!model) {
      throw new Error('Agent model not available');
    }

    // Client-executed results fire only after processors accept the request and
    // the required runtime model has resolved.
    if (!tripwireData) {
      await fireClientToolOutputHooks({
        messages,
        tools,
        abortSignal: execOptions?.abortSignal,
        logger,
      });
      await applyClientToolModelOutput({
        messageList,
        tools,
        logger,
      });
    }

    const modelList = resolvedModels.modelList;

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
      runtimeBindingId,
      agentId: publicAgentId,
      agentName: publicAgentName,
      versions: mergedVersions,
      hasProcessors: inputProcessors.length > 0 || outputProcessors.length > 0 || errorProcessors.length > 0,
      runtimeBindings: {
        memory: createRuntimeDependencyFingerprint(memory),
        workspace: createRuntimeDependencyFingerprint(workspace),
      },
      messageList,
      tools,
      model,
      modelList: modelList ?? undefined,
      scorers,
      options: {
        maxSteps: execOptions?.maxSteps,
        recoveryMaxSteps: execOptions?.recoveryMaxSteps,
        toolChoice: execOptions?.toolChoice as any,
        activeTools: execOptions?.activeTools?.filter((name): name is string => typeof name === 'string'),
        toolSurfaceFence,
        toolHookPolicy,
        modelSettings: execOptions?.modelSettings as any,
        // Function-form approval policies are closures that can't ride on the
        // serialized workflow input — the live closure is parked on the run
        // registry below. This boolean shadow is the cross-process fallback:
        // function policies degrade to "require approval for every tool call"
        // when the registry slot is unavailable (e.g. Inngest after a worker
        // restart), which is the safe default.
        requireToolApproval:
          typeof execOptions?.requireToolApproval === 'function' ? true : execOptions?.requireToolApproval,
        // Persist only the fact that an authoritative host policy is required.
        // The policy closure itself remains in RequestContext/RunRegistry and
        // must be reconstructed by the trusted resume caller. A cold worker
        // that cannot recover it denies at the action boundary.
        permissionPolicyRequired: typeof requestContext.get(TOOL_PERMISSION_POLICY_KEY) === 'function',
        toolCallConcurrency: execOptions?.toolCallConcurrency,
        autoResumeSuspendedTools: execOptions?.autoResumeSuspendedTools,
        maxProcessorRetries: execOptions?.maxProcessorRetries,
        includeRawChunks: execOptions?.includeRawChunks,
        returnScorerData: execOptions?.returnScorerData,
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
        memoryConfigured: Boolean(memory),
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
      requiredRequestContextCapabilities,
    });

    // 14. Create registry entry for non-serializable state.
    // For a replacement run, capture an immutable surface bound to the ORIGINAL
    // fenced implementations now, before any per-step input processor can mutate
    // the shared `tools` map in place. The tool-call step dispatches from this
    // instead of re-snapshotting the mutable registry object.
    const replacementToolSurface =
      toolSurfaceFence !== undefined
        ? (Object.freeze(materializeToolSurfaceFence(createToolSurfaceFence(tools, toolSurfaceFence))) as Record<
            string,
            CoreTool
          >)
        : undefined;
    const registryEntry: RunRegistryEntry = {
      // Owning Mastra instance — graceful shutdown awaits only the durable
      // workflow executions that belong to it.
      mastra,
      runtimeBindingId,
      agentId: publicAgentId,
      threadId,
      resourceId,
      tools,
      replacementToolSurface,
      toolHookPolicy: perExecutionToolHooks ? { id: toolHookPolicy!.id, hooks: perExecutionToolHooks } : undefined,
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
      mcp: execOptions?.mcp,
      versions: mergedVersions ? structuredClone(mergedVersions) : undefined,
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
            // Only messages of the thread being titled — resource-scoped memory can
            // load messages from other threads into the deserialized list.
            const uiMessages = agent.filterUiMessagesByThread(
              titleMessageList,
              threadId,
              titleMessageList.get.all.ui(),
            );
            if (uiMessages.length < (minMessages ?? 1)) return;

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

            await execOptions?.memory?.onTitleGenerated?.(title);
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
      // Retain the call-time flag for warm resume/observe paths that rebuild
      // scoring data without rereading the persisted workflow input.
      returnScorerData: execOptions?.returnScorerData,
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
  } catch (error) {
    if (toolSurfaceFenceOwnerId) {
      clearToolSurfaceFence(requestContext, runId, toolSurfaceFenceOwnerId);
    }
    if (createdThreadDuringPreparation && processorMemory && threadId) {
      try {
        await processorMemory.deleteThread(threadId);
      } catch (rollbackError) {
        logger?.warn?.(`[DurableAgent] Error rolling back preparation thread: ${rollbackError}`);
      }
    }
    if (inheritedMastraMemory === undefined) {
      requestContext.delete('MastraMemory');
    } else {
      requestContext.set('MastraMemory', inheritedMastraMemory);
    }
    const preparationError = error instanceof Error ? error : new Error(String(error));
    agentSpan?.error({ error: preparationError, endSpan: true });
    throw error;
  }
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
