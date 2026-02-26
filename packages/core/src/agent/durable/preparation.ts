import type { MastraLanguageModel } from '../../llm/model/shared.types';
import type { IMastraLogger } from '../../logger';
import type { MastraMemory } from '../../memory/memory';
import type { MemoryConfig, MemoryConfig as _MemoryConfig } from '../../memory/types';
import type { RequestContext } from '../../request-context';
import type { CoreTool } from '../../tools/types';
import type { Workspace } from '../../workspace';
import type { Agent } from '../agent';
import type { AgentExecutionOptions } from '../agent.types';
import { MessageList } from '../message-list';
import type { MessageListInput } from '../message-list';
import { SaveQueueManager } from '../save-queue';
import type { AgentModelManagerConfig, ToolsetsInput, ToolsInput } from '../types';
import type { DurableAgenticWorkflowInput, RunRegistryEntry } from './types';
import { createWorkflowInput } from './utils/serialize-state';

/**
 * Interface for the Agent methods needed during durable preparation.
 * This provides proper typing for the public Agent methods we call.
 */
interface DurablePreparationAgent {
  id: string;
  name?: string;
  getInstructions(opts: { requestContext: RequestContext }): string | string[] | Promise<string | string[]>;
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
  }): Promise<Record<string, CoreTool>>;
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
  /** The agent instance */
  agent: Agent<string, any, OUTPUT>;
  /** User messages to process */
  messages: MessageListInput;
  /** Execution options */
  options?: AgentExecutionOptions<OUTPUT>;
  /** Run ID (will be generated if not provided) */
  runId?: string;
  /** Request context */
  requestContext?: RequestContext;
  /** Logger */
  logger?: IMastraLogger;
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
    options: execOptions,
    runId: providedRunId,
    requestContext: providedRequestContext,
    logger,
  } = options;

  // Cast agent to typed interface for proper method access
  // All these methods are public on Agent, but TypeScript generics hide them
  const typedAgent = agent as unknown as DurablePreparationAgent;

  // 1. Generate IDs
  const runId = providedRunId ?? crypto.randomUUID();
  const messageId = crypto.randomUUID();

  // 2. Get request context
  const requestContext = providedRequestContext ?? new (await import('../../request-context')).RequestContext();

  // 3. Resolve thread/memory context from the new memory option
  // The memory option contains thread and resource information
  const threadId =
    typeof execOptions?.memory?.thread === 'string' ? execOptions.memory.thread : execOptions?.memory?.thread?.id;
  const resourceId = execOptions?.memory?.resource;

  // 4. Create MessageList
  const messageList = new MessageList({
    threadId,
    resourceId,
  });

  // Add agent instructions
  const instructions = await typedAgent.getInstructions({ requestContext });
  if (instructions) {
    if (typeof instructions === 'string') {
      messageList.addSystem(instructions);
    } else if (Array.isArray(instructions)) {
      for (const inst of instructions) {
        messageList.addSystem(inst);
      }
    }
  }

  // Add workspace instructions (matches WorkspaceInstructionsProcessor behavior)
  const workspace = await typedAgent.getWorkspace({ requestContext });
  if (workspace?.filesystem || workspace?.sandbox) {
    const wsInstructions = workspace.getInstructions({ requestContext });
    if (wsInstructions) {
      messageList.addSystem({ role: 'system', content: wsInstructions });
    }
  }

  // Add context messages if provided
  if (execOptions?.context) {
    messageList.add(execOptions.context, 'context');
  }

  // Add user messages
  messageList.add(messages, 'input');

  // 5. Convert tools to CoreTool format for execution
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
    });
  } catch (error) {
    logger?.debug?.(`[DurableAgent] Error converting tools: ${error}`);
  }

  // 6. Get model (and model list if configured)
  const model = await typedAgent.getModel({ requestContext });
  if (!model) {
    throw new Error('Agent model not available');
  }

  // Check if agent has a model list (for fallback support)
  const modelList = await typedAgent.getModelList(requestContext);

  // 6b. Get scorers configuration
  // Scorers can come from agent config or be overridden via execOptions
  const overrideScorers = (execOptions as any)?.scorers;
  let scorers: Record<string, { scorer: any; sampling?: any }> | undefined;

  if (overrideScorers) {
    scorers = overrideScorers;
  } else {
    // Try to get scorers from the agent using listScorers method
    try {
      const agentScorers = await typedAgent.listScorers({ requestContext });
      if (agentScorers && Object.keys(agentScorers).length > 0) {
        scorers = agentScorers;
      }
    } catch (error) {
      logger?.debug?.(`[DurableAgent] Error getting scorers: ${error}`);
    }
  }

  // 7. Get memory and create SaveQueueManager
  const memory = await typedAgent.getMemory({ requestContext });
  const memoryConfig = execOptions?.memory?.options;

  const saveQueueManager = memory
    ? new SaveQueueManager({
        logger,
        memory,
      })
    : undefined;

  // 7b. Workspace was already fetched above for instructions injection

  // 8. Create serialized workflow input
  const workflowInput = createWorkflowInput({
    runId,
    agentId: agent.id,
    agentName: agent.name,
    messageList,
    tools,
    model,
    modelList: modelList ?? undefined, // Include model list for fallback support
    scorers, // Include scorers for evaluation (if configured)
    options: {
      maxSteps: execOptions?.maxSteps,
      toolChoice: execOptions?.toolChoice as any,
      temperature: execOptions?.modelSettings?.temperature,
      requireToolApproval: execOptions?.requireToolApproval,
      toolCallConcurrency: execOptions?.toolCallConcurrency,
      autoResumeSuspendedTools: execOptions?.autoResumeSuspendedTools,
      maxProcessorRetries: execOptions?.maxProcessorRetries,
      includeRawChunks: execOptions?.includeRawChunks,
      returnScorerData: (execOptions as any)?.returnScorerData,
    },
    state: {
      memoryConfig,
      threadId,
      resourceId,
      threadExists: false, // Will be updated during execution
    },
    messageId,
  });

  // 9. Create registry entry for non-serializable state
  const registryEntry: RunRegistryEntry = {
    tools,
    saveQueueManager,
    memory,
    model,
    // Store model list instances for fallback support (enables testing with mock models)
    modelList: modelList
      ? modelList.map((entry: AgentModelManagerConfig) => ({
          id: entry.id,
          model: entry.model,
          maxRetries: entry.maxRetries ?? 0,
          enabled: entry.enabled ?? true,
        }))
      : undefined,
    // Store workspace for tool execution context
    workspace,
    // Store request context for forwarding to tools during execution
    requestContext,
    cleanup: () => {
      // Cleanup resources when run completes
      // Note: SaveQueueManager handles cleanup internally via flushMessages
    },
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
