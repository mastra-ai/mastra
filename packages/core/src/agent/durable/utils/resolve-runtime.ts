import type { ToolSet } from '@internal/ai-sdk-v5';
import { resolveModelConfig } from '../../../llm/model/resolve-model';
import type { MastraLanguageModel } from '../../../llm/model/shared.types';
import type { StreamInternal } from '../../../loop/types';
import type { Mastra } from '../../../mastra';
import type { MastraMemory } from '../../../memory/memory';
import type {
  ProcessorState,
  ErrorProcessorOrWorkflow,
  InputProcessorOrWorkflow,
  OutputProcessorOrWorkflow,
} from '../../../processors';
import { RequestContext } from '../../../request-context';
import { getNeedsApprovalFn } from '../../../tools/toolchecks';
import type { CoreTool, RequireToolApproval, ToolApprovalContext } from '../../../tools/types';
import type { Workspace } from '../../../workspace';
import type { Agent } from '../../agent';
import { MessageList } from '../../message-list';
import { SaveQueueManager } from '../../save-queue';
import { globalRunRegistry } from '../run-registry';
import type {
  RunRegistryEntry,
  SerializableDurableState,
  SerializableDurableOptions,
  SerializableModelConfig,
  SerializableModelListEntry,
  SerializableToolMetadata,
  DurableAgenticWorkflowInput,
  RegistryModelListEntry,
} from '../types';

/**
 * Runtime dependencies that need to be resolved at step execution time.
 * These cannot be serialized and must be recreated from available context.
 */
export interface ResolvedRuntimeDependencies {
  /** Reconstructed _internal object for compatibility with existing code */
  _internal: StreamInternal;
  /** Resolved tools with execute functions */
  tools: Record<string, CoreTool>;
  /** Resolved language model */
  model: MastraLanguageModel;
  /** Resolved model list for fallback support (actual model instances) */
  modelList?: RegistryModelListEntry[];
  /** Deserialized MessageList */
  messageList: MessageList;
  /** Owning base agent reconstructed from the registry or Mastra instance. */
  agent?: Agent<any, any, any, any>;
  /** Memory instance (if available) */
  memory?: MastraMemory;
  /** SaveQueueManager for message persistence */
  saveQueueManager?: SaveQueueManager;
  /** Workspace for file/sandbox operations */
  workspace?: Workspace;
  /** Resolved input processors (rebuilt from the agent when the registry is empty) */
  inputProcessors?: InputProcessorOrWorkflow[];
  /** Uncombined input processors for processLLMRequest */
  llmRequestInputProcessors?: InputProcessorOrWorkflow[];
  /** Resolved output processors */
  outputProcessors?: OutputProcessorOrWorkflow[];
  /** Resolved error processors */
  errorProcessors?: ErrorProcessorOrWorkflow[];
  /** Processor state map */
  processorStates?: Map<string, ProcessorState>;
}

/**
 * Build a SaveQueueManager for a run's memory, or `undefined` when no memory
 * is configured. Shared by `resolveRuntimeDependencies` and
 * `rebuildRunToolsFromMastra` so the construction lives in one place.
 */
function makeSaveQueueManager(memory: MastraMemory | undefined, mastra?: Mastra): SaveQueueManager | undefined {
  if (!memory) return undefined;
  return new SaveQueueManager({ logger: mastra?.getLogger?.(), memory });
}

/**
 * Options for resolving runtime dependencies
 */
export interface ResolveRuntimeOptions {
  /** Mastra instance for accessing services */
  mastra?: Mastra;
  /** Run identifier */
  runId: string;
  /** Agent identifier */
  agentId: string;
  /** Workflow input containing serialized state */
  input: DurableAgenticWorkflowInput;
  /** Logger for debugging */
  logger?: { debug?: (...args: any[]) => void; error?: (...args: any[]) => void };
}

/**
 * Restore a RequestContext from the JSON-safe `requestContextEntries`
 * snapshot serialized onto the workflow input (see preparation.ts). Returns
 * an empty context when no snapshot is present.
 */
function restoreRequestContext(entries?: Record<string, unknown>): RequestContext {
  return entries
    ? new RequestContext(Object.entries(entries) as Iterable<readonly [string, unknown]>)
    : new RequestContext();
}

/**
 * Thrown when the per-request processor pipeline cannot be rebuilt during
 * cross-process rehydration. Propagated (not swallowed) because continuing
 * without the rebuilt processors would silently drop skills / workspace
 * instructions — the exact failure mode this rebuild exists to fix.
 */
export class DurableProcessorRebuildError extends Error {
  constructor(agentId: string, cause: unknown) {
    super(
      `[DurableAgent:${agentId}] Failed to rebuild processor pipeline during cross-process rehydration: ${cause instanceof Error ? cause.message : String(cause)}`,
    );
    this.name = 'DurableProcessorRebuildError';
    this.cause = cause;
  }
}

/**
 * Resolve all runtime dependencies needed for durable step execution.
 *
 * This function reconstructs the non-serializable state needed to execute
 * agent steps from:
 * 1. The Mastra instance (for agent lookup, tools, model)
 * 2. The serialized workflow input (for MessageList, state)
 *
 * Unlike the registry-based approach, this reconstructs tools and model
 * from the agent registered with Mastra, making it truly durable across
 * process restarts.
 */
export async function resolveRuntimeDependencies(options: ResolveRuntimeOptions): Promise<ResolvedRuntimeDependencies> {
  const { mastra, runId, agentId, input, logger } = options;

  // 1. Deserialize MessageList
  // Reuse the existing MessageList from the registry if available so that
  // external consumers (e.g. the stream adapter) that hold a reference to it
  // see the updated state.  Creating a new instance each iteration would
  // orphan those references (their newResponseMessages Set would point at
  // stale objects).
  const existingEntry = globalRunRegistry.get(runId);
  const messageList = existingEntry?.messageList
    ? existingEntry.messageList.deserialize(input.messageListState)
    : new MessageList({
        threadId: input.state.threadId,
        resourceId: input.state.resourceId,
      }).deserialize(input.messageListState);

  // 2. Check global registry first (for local/test execution).
  // This is necessary because workflow steps don't have direct access to
  // DurableAgent's registry.
  //
  // On a cross-process engine (e.g. the @mastra/inngest connect() worker) the
  // durable steps run in a DIFFERENT process than the one that prepared the run,
  // so this process's registry has either no entry or a minimal placeholder
  // (see @mastra/inngest resume(): `{ isPlaceholder: true, tools: {}, model:
  // undefined }`). In that case we MUST rebuild tools / processors / model from
  // the agent registered on the Mastra instance — otherwise per-request closure
  // tools (workspace/skill tools) and per-request processors (SkillsProcessor,
  // WorkspaceInstructions) silently drop cross-process.
  //
  // IMPORTANT: an empty `tools` map is NOT a placeholder signal — agents with
  // zero tools legitimately register `{ tools: {} }` in-process. Placeholders
  // are detected by the explicit `isPlaceholder` flag or by the absence of a
  // real model instance (every in-process seeding site stores the live model;
  // placeholders and metadata-only stubs do not).
  const globalEntry = globalRunRegistry.get(runId);
  const registryModel = globalEntry?.model as (MastraLanguageModel & { __metadataOnly?: boolean }) | undefined;
  const hasHydratedEntry =
    !!globalEntry && globalEntry.isPlaceholder !== true && !!registryModel && registryModel.__metadataOnly !== true;
  let tools: Record<string, CoreTool> = globalEntry?.tools ?? {};
  let model: MastraLanguageModel = globalEntry?.model as MastraLanguageModel;
  let modelList: RegistryModelListEntry[] | undefined = globalEntry?.modelList;
  let agent: Agent<any, any, any, any> | undefined = globalEntry?.agent;
  let workspace: Workspace | undefined = globalEntry?.workspace;
  let memory: MastraMemory | undefined = globalEntry?.memory;
  let inputProcessors: InputProcessorOrWorkflow[] | undefined = globalEntry?.inputProcessors;
  let llmRequestInputProcessors: InputProcessorOrWorkflow[] | undefined = globalEntry?.llmRequestInputProcessors;
  let outputProcessors: OutputProcessorOrWorkflow[] | undefined = globalEntry?.outputProcessors;
  let errorProcessors: ErrorProcessorOrWorkflow[] | undefined = globalEntry?.errorProcessors;
  let processorStates: Map<string, ProcessorState> | undefined = globalEntry?.processorStates;
  let rehydratedFromMastra = false;

  // If the registry entry is a real (non-placeholder) in-process entry we
  // trust it wholesale (in-process / same-process resume). Otherwise fall
  // through and rebuild from the Mastra instance.
  if (hasHydratedEntry) {
    logger?.debug?.(`[DurableAgent:${agentId}] Using model and tools from global registry for run ${runId}`);
  } else if (mastra) {
    try {
      const registeredAgent = mastra.getAgentById(agentId) as Agent<any, any, any, any>;
      const rehydratedAgent: Agent<any, any, any, any> = (registeredAgent as any).agent ?? registeredAgent;
      agent = rehydratedAgent;

      // Restore the caller's request context from the JSON-safe snapshot on
      // the workflow input (mirrors durable-agent.ts resume handling), so
      // request-scoped tools / workspace / memory / processors resolve with
      // the same configuration as the original call site.
      const resolveRequestContext = restoreRequestContext(input.requestContextEntries);

      tools = await rehydratedAgent.getToolsForExecution({
        runId,
        threadId: input.state.threadId,
        resourceId: input.state.resourceId,
        requestContext: resolveRequestContext,
        memoryConfig: input.state.memoryConfig,
        autoResumeSuspendedTools: input.options?.autoResumeSuspendedTools,
      });

      model =
        (await (rehydratedAgent as any).getModel?.({ requestContext: resolveRequestContext })) ??
        resolveModel(input.modelConfig, mastra);

      const rawModelList = await (rehydratedAgent as any).getModelList?.(resolveRequestContext);
      if (rawModelList && Array.isArray(rawModelList)) {
        modelList = rawModelList.map((entry: any) => ({
          id: entry.id,
          model: entry.model,
          maxRetries: entry.maxRetries ?? 0,
          enabled: entry.enabled ?? true,
          headers: entry.headers,
        }));
      }

      memory = await (rehydratedAgent as any).getMemory?.({ requestContext: resolveRequestContext });
      workspace = await (rehydratedAgent as any).getWorkspace?.({ requestContext: resolveRequestContext });

      // Rebuild the per-request processor pipeline. `listInputProcessors` /
      // `listOutputProcessors` already inject the SkillsProcessor and
      // WorkspaceInstructionsProcessor (see Agent.listInputProcessors), so this
      // restores the missing available-skills list + workspace instructions in
      // the cross-process system prompt. Mirrors preparation.ts.
      try {
        inputProcessors = await (rehydratedAgent as any).listInputProcessors?.(resolveRequestContext);
        llmRequestInputProcessors = await (rehydratedAgent as any).__listLLMRequestProcessors?.(resolveRequestContext);
        outputProcessors = await (rehydratedAgent as any).listOutputProcessors?.(resolveRequestContext);
        errorProcessors = await (rehydratedAgent as any).listErrorProcessors?.(resolveRequestContext);
        // A fresh processor-state map is correct here: on a cross-process worker
        // there is no prior state to carry, and processors are re-run per step.
        processorStates = globalEntry?.processorStates ?? new Map<string, ProcessorState>();
      } catch (processorError) {
        // Fail the step loudly rather than continuing (and writing back) an
        // incomplete pipeline: running without the rebuilt processors would
        // silently drop skills / workspace instructions.
        logger?.error?.(`[DurableAgent:${agentId}] Failed to rebuild processors from Mastra: ${processorError}`);
        throw new DurableProcessorRebuildError(agentId, processorError);
      }

      rehydratedFromMastra = true;
    } catch (error) {
      if (error instanceof DurableProcessorRebuildError) throw error;
      logger?.debug?.(`[DurableAgent:${agentId}] Failed to get agent from Mastra: ${error}`);
      model = resolveModel(input.modelConfig, mastra);
    }
  } else {
    logger?.debug?.(`[DurableAgent:${agentId}] No Mastra instance available, using fallback model`);
    model = resolveModel(input.modelConfig);
  }

  if (Object.keys(tools).length === 0) {
    logger?.debug?.(`[DurableAgent:${agentId}] No tools resolved for run ${runId}`);
  }

  // Write the rebuilt state back into the per-process registry so sibling
  // durable steps in THIS process (e.g. the tool-call step that runs after the
  // LLM step on the same worker) reuse it instead of rebuilding per call. Only
  // persist when we actually rehydrated from Mastra — never clobber a fully
  // populated in-process entry.
  if (rehydratedFromMastra) {
    const rebuilt: Partial<RunRegistryEntry> = {
      // The entry now carries real runtime state — drop the placeholder mark
      // so sibling steps in this process trust it instead of rebuilding.
      isPlaceholder: false,
      tools,
      model,
      modelList,
      agent,
      workspace,
      memory,
      inputProcessors,
      llmRequestInputProcessors,
      outputProcessors,
      errorProcessors,
      processorStates,
    };
    if (globalEntry) {
      Object.assign(globalEntry, rebuilt);
    } else {
      globalRunRegistry.set(runId, rebuilt as RunRegistryEntry);
    }
  }

  // 3. Get or create SaveQueueManager
  const saveQueueManager = makeSaveQueueManager(memory, mastra);

  // 4. Reconstruct _internal for compatibility with existing code
  const _internal = resolveInternalState({
    state: input.state,
    memory,
    saveQueueManager,
    tools,
  });

  return {
    _internal,
    tools,
    model,
    modelList,
    messageList,
    agent,
    memory,
    saveQueueManager,
    workspace,
    inputProcessors,
    llmRequestInputProcessors,
    outputProcessors,
    errorProcessors,
    processorStates,
  };
}

/**
 * Tool + workspace state rebuilt for the durable tool-call step.
 */
export interface RebuiltRunTools {
  tools: Record<string, CoreTool>;
  agent?: Agent<any, any, any, any>;
  workspace?: Workspace;
  memory?: MastraMemory;
  saveQueueManager?: SaveQueueManager;
  outputProcessors?: OutputProcessorOrWorkflow[];
  processorStates?: Map<string, ProcessorState>;
}

/**
 * Rebuild the run's tools (and workspace/memory) from the agent registered on
 * the Mastra instance, then write them back into the per-process run registry.
 *
 * The durable tool-call step runs as a SEPARATE step from the LLM-execution
 * step and, on a cross-process engine (e.g. the @mastra/inngest connect()
 * worker), can execute in a different process than the one that prepared the
 * run. In that process `globalRunRegistry.get(runId)` is empty (or a minimal
 * placeholder), so per-request closure tools (workspace/skill tools:
 * `skill`, `skill_read`, `skill_search`, `mastra_workspace_*`) are absent and
 * the model's tool call rejects with `ToolNotFoundError`.
 *
 * The LLM step already rebuilds the full toolset via
 * `resolveRuntimeDependencies` → `getToolsForExecution`; this helper gives the
 * tool-call step the same rebuild so tool resolution is symmetric cross-process.
 * The writeback means the first unresolved tool call rebuilds once and later
 * calls in the same process hit the registry.
 *
 * Returns `undefined` when no Mastra instance is available or the agent can't
 * be resolved — callers fall back to their existing `ToolNotFoundError`.
 */
export async function rebuildRunToolsFromMastra(options: {
  mastra?: Mastra;
  runId: string;
  agentId: string;
  state: SerializableDurableState;
  options?: SerializableDurableOptions;
  /** JSON-safe request-context snapshot from the workflow input (see preparation.ts). */
  requestContextEntries?: Record<string, unknown>;
  logger?: { debug?: (...args: any[]) => void };
}): Promise<RebuiltRunTools | undefined> {
  const { mastra, runId, agentId, state, options: execOptions, requestContextEntries, logger } = options;
  if (!mastra) return undefined;

  try {
    const registeredAgent = mastra.getAgentById(agentId) as Agent<any, any, any, any>;
    const agent: Agent<any, any, any, any> = (registeredAgent as any).agent ?? registeredAgent;
    // Restore the caller's request context so request-scoped tools, workspace
    // and memory resolve with the same configuration as the original call.
    const resolveRequestContext = restoreRequestContext(requestContextEntries);

    const tools = await agent.getToolsForExecution({
      runId,
      threadId: state.threadId,
      resourceId: state.resourceId,
      requestContext: resolveRequestContext,
      memoryConfig: state.memoryConfig,
      autoResumeSuspendedTools: execOptions?.autoResumeSuspendedTools,
    });

    const memory = await (agent as any).getMemory?.({ requestContext: resolveRequestContext });
    const workspace = await (agent as any).getWorkspace?.({ requestContext: resolveRequestContext });
    const outputProcessors = await (agent as any).listOutputProcessors?.(resolveRequestContext);
    const processorStates = globalRunRegistry.get(runId)?.processorStates ?? new Map<string, ProcessorState>();
    const saveQueueManager = makeSaveQueueManager(memory, mastra);

    // Write back so sibling steps in this process reuse the rebuilt tools.
    const existing = globalRunRegistry.get(runId);
    const patch: Partial<RunRegistryEntry> = {
      tools,
      agent,
      workspace,
      memory,
      saveQueueManager,
      outputProcessors,
      processorStates,
    };
    if (existing) {
      // Only fill fields the entry is missing — never clobber a populated entry.
      if (Object.keys(existing.tools ?? {}).length === 0) existing.tools = tools;
      existing.agent ??= agent;
      existing.workspace ??= workspace;
      existing.memory ??= memory;
      existing.saveQueueManager ??= saveQueueManager;
      existing.outputProcessors ??= outputProcessors;
      existing.processorStates ??= processorStates;
    } else {
      globalRunRegistry.set(runId, patch as RunRegistryEntry);
    }

    return { tools, agent, workspace, memory, saveQueueManager, outputProcessors, processorStates };
  } catch (error) {
    logger?.debug?.(`[DurableAgent:${agentId}] Failed to rebuild tools from Mastra for run ${runId}: ${error}`);
    return undefined;
  }
}

/**
 * Resolve the language model from serialized config.
 *
 * Note: This is a fallback when the model is not in the run registry.
 * The preferred approach is to store the actual model instance in the
 * run registry during preparation and retrieve it via runRegistry.getModel().
 *
 * This fallback returns a metadata-only stub that will fail the
 * isSupportedLanguageModel check with a descriptive error message.
 */
export function resolveModel(config: SerializableModelConfig, _mastra?: Mastra): MastraLanguageModel {
  const metadataError = () => {
    throw new Error(
      `Model ${config.provider}/${config.modelId} is a metadata-only stub. ` +
        `The actual model instance should be resolved from the run registry.`,
    );
  };

  return {
    provider: config.provider,
    modelId: config.modelId,
    specificationVersion: config.specificationVersion ?? 'v2',
    supportedUrls: {},
    doGenerate: metadataError,
    doStream: metadataError,
    __metadataOnly: true,
  } as MastraLanguageModel;
}

/**
 * Reconstruct the _internal (StreamInternal) object from available state
 */
export function resolveInternalState(options: {
  state: SerializableDurableState;
  memory?: MastraMemory;
  saveQueueManager?: SaveQueueManager;
  tools?: Record<string, CoreTool>;
}): StreamInternal {
  const { state, memory, saveQueueManager, tools } = options;

  return {
    // Functions - create fresh
    now: () => Date.now(),
    generateId: () => crypto.randomUUID(),
    currentDate: () => new Date(),

    // Class instances - from resolved state
    saveQueueManager,
    memory,

    // Serializable state
    memoryConfig: state.memoryConfig,
    threadId: state.threadId,
    resourceId: state.resourceId,
    threadExists: state.threadExists,

    // Tools if provided - cast to ToolSet for compatibility
    // CoreTool and ToolSet are structurally compatible at runtime
    stepTools: tools as ToolSet | undefined,
  };
}

/**
 * Resolve a single tool by name from Mastra's global tool registry
 */
export function resolveTool(toolName: string, mastra?: Mastra): CoreTool | undefined {
  // Get from Mastra's global tool registry
  try {
    return mastra?.getTool?.(toolName as any) as CoreTool | undefined;
  } catch {
    // Tool not found in global registry
    return undefined;
  }
}

/**
 * Check if a tool requires human approval.
 *
 * Mirrors the non-durable precedence:
 *  - Function-form global `requireToolApproval` is evaluated per call with
 *    `(toolName, args, ...)`. Throwing defaults to "require approval" (safe).
 *  - Boolean global / tool-level `requireApproval` seed the decision.
 *  - A per-tool `needsApprovalFn` (e.g. skill tools) is authoritative when
 *    present and overrides the seed.
 *
 * In durable execution the function form lives on the run registry, not on
 * the serialized workflow input — pass the resolved value from the caller.
 */
export async function toolRequiresApproval(
  tool: CoreTool,
  globalRequireApproval?: RequireToolApproval,
  args?: Record<string, unknown>,
  approvalContext?: Partial<ToolApprovalContext> & { toolName: string },
): Promise<boolean> {
  let globalRequires: boolean;
  if (typeof globalRequireApproval === 'function') {
    try {
      globalRequires = !!(await globalRequireApproval({
        toolName: approvalContext?.toolName ?? '',
        args: args ?? {},
        requestContext: approvalContext?.requestContext,
        workspace: approvalContext?.workspace,
      }));
    } catch {
      // On error, default to requiring approval (safe default).
      globalRequires = true;
    }
  } else {
    globalRequires = !!globalRequireApproval;
  }

  let requires = globalRequires || !!(tool as any).requireApproval;

  // needsApprovalFn overrides all other flags (e.g., skill tools return false)
  const needsApprovalFn = getNeedsApprovalFn(tool);
  if (needsApprovalFn) {
    try {
      requires = !!(await needsApprovalFn(args ?? {}));
    } catch {
      // On error, default to requiring approval (safe default)
      requires = true;
    }
  }

  return requires;
}

/**
 * Extract tool metadata needed for LLM from resolved tools
 * This is useful when we need to pass tool info to the model
 */
export function extractToolsForModel(
  tools: Record<string, CoreTool>,
  _toolsMetadata: SerializableToolMetadata[],
): Record<string, CoreTool> {
  // Return the tools as-is since they're already in CoreTool format
  // The metadata is just for reference/serialization
  return tools;
}

/**
 * Resolve a language model from a serialized model config.
 *
 * This is used during durable execution to reconstruct models from
 * serialized configuration. It uses the originalConfig string (e.g., 'openai/gpt-4o')
 * to resolve the model through the standard model resolution pipeline.
 *
 * @param config The serialized model configuration
 * @param mastra Optional Mastra instance for custom gateways
 * @returns Resolved language model
 */
export async function resolveModelFromConfig(
  config: SerializableModelConfig,
  mastra?: Mastra,
): Promise<MastraLanguageModel> {
  const requestContext = new RequestContext();

  // Use originalConfig if available (e.g., 'openai/gpt-4o'), otherwise construct from provider/modelId
  const modelConfigString = config.originalConfig ?? `${config.provider}/${config.modelId}`;

  if (typeof modelConfigString === 'string') {
    return (await resolveModelConfig(modelConfigString, requestContext, mastra)) as MastraLanguageModel;
  }

  // If originalConfig is an object, pass it through
  return (await resolveModelConfig(
    modelConfigString as Parameters<typeof resolveModelConfig>[0],
    requestContext,
    mastra,
  )) as MastraLanguageModel;
}

/**
 * Resolve a model from a model list entry.
 *
 * @param entry The model list entry with config, maxRetries, enabled
 * @param mastra Optional Mastra instance
 * @returns Resolved language model
 */
export async function resolveModelFromListEntry(
  entry: SerializableModelListEntry,
  mastra?: Mastra,
): Promise<MastraLanguageModel> {
  return resolveModelFromConfig(entry.config, mastra);
}
