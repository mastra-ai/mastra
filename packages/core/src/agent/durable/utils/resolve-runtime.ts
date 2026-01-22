import type { ToolSet } from '@internal/ai-sdk-v5';
import type { Mastra } from '../../../mastra';
import type { MastraMemory } from '../../../memory/memory';
import type { CoreTool } from '../../../tools/types';
import type { StreamInternal } from '../../../loop/types';
import type { MastraLanguageModel } from '../../../llm/model/shared.types';
import { SaveQueueManager } from '../../save-queue';
import { MessageList } from '../../message-list';
import type {
  SerializableDurableState,
  SerializableModelConfig,
  SerializableToolMetadata,
  DurableAgenticWorkflowInput,
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
  /** Deserialized MessageList */
  messageList: MessageList;
  /** Memory instance (if available) */
  memory?: MastraMemory;
  /** SaveQueueManager for message persistence */
  saveQueueManager?: SaveQueueManager;
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
  const messageList = new MessageList({
    threadId: input.state.threadId,
    resourceId: input.state.resourceId,
  });
  messageList.deserialize(input.messageListState);

  // 2. Get agent from Mastra and resolve tools
  let tools: Record<string, CoreTool> = {};
  let model: MastraLanguageModel;
  let memory: MastraMemory | undefined;

  if (mastra) {
    try {
      const agent = mastra.getAgentById(agentId);

      // Get tools from agent - this reconstructs them fresh
      tools = await agent.getToolsForExecution({
        runId,
        threadId: input.state.threadId,
        resourceId: input.state.resourceId,
        memoryConfig: input.state.memoryConfig,
        autoResumeSuspendedTools: input.options?.autoResumeSuspendedTools,
      });

      // Get model from agent
      model = (await (agent as any).getModel?.({})) ?? resolveModel(input.modelConfig, mastra);

      // Get memory from agent
      memory = await (agent as any).getMemory?.({});
    } catch (error) {
      logger?.debug?.(`[DurableAgent:${agentId}] Failed to get agent from Mastra: ${error}`);
      // Fallback to config-based model resolution
      model = resolveModel(input.modelConfig, mastra);
    }
  } else {
    logger?.debug?.(`[DurableAgent:${agentId}] No Mastra instance available, using fallback model`);
    model = resolveModel(input.modelConfig);
  }

  if (Object.keys(tools).length === 0) {
    logger?.debug?.(`[DurableAgent:${agentId}] No tools resolved for run ${runId}`);
  }

  // 3. Get or create SaveQueueManager
  let saveQueueManager: SaveQueueManager | undefined;
  if (memory) {
    saveQueueManager = new SaveQueueManager({
      logger: mastra?.getLogger?.(),
      memory,
    });
  }

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
    messageList,
    memory,
    saveQueueManager,
  };
}

/**
 * Resolve the language model from serialized config.
 *
 * Note: This is a fallback when the model is not in the run registry.
 * The preferred approach is to store the actual model instance in the
 * run registry during preparation and retrieve it via runRegistry.getModel().
 *
 * This fallback returns a metadata-only object that may not work for
 * actual LLM execution (no doStream method).
 */
export function resolveModel(config: SerializableModelConfig, mastra?: Mastra): MastraLanguageModel {
  // Try to get model from Mastra's model registry if available
  // This would work if Mastra has a global model registry
  // const model = mastra?.getModel?.(config.modelId);

  // Fallback: return metadata-only object
  // This should only be used for serialization/logging, not actual execution
  return {
    provider: config.provider,
    modelId: config.modelId,
    specificationVersion: config.specificationVersion ?? 'v2',
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
 * Check if a tool requires human approval
 */
export function toolRequiresApproval(tool: CoreTool, globalRequireApproval?: boolean): boolean {
  // Global flag takes precedence
  if (globalRequireApproval) {
    return true;
  }

  // Check tool-level flag
  if ((tool as any).requireApproval) {
    return true;
  }

  return false;
}

/**
 * Extract tool metadata needed for LLM from resolved tools
 * This is useful when we need to pass tool info to the model
 */
export function extractToolsForModel(
  tools: Record<string, CoreTool>,
  toolsMetadata: SerializableToolMetadata[],
): Record<string, CoreTool> {
  // Return the tools as-is since they're already in CoreTool format
  // The metadata is just for reference/serialization
  return tools;
}
