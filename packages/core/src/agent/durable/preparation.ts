import type { CoreTool } from '../../tools/types';
import type { MastraLanguageModel } from '../../llm/model/shared.types';
import type { MastraMemory } from '../../memory/memory';
import type { MemoryConfig } from '../../memory/types';
import type { RequestContext } from '../../request-context';
import { MessageList } from '../message-list';
import type { MessageListInput } from '../message-list';
import { SaveQueueManager } from '../save-queue';
import type { IMastraLogger } from '../../logger';
import type { Agent } from '../agent';
import type { AgentExecutionOptions } from '../agent.types';
import type { DurableAgenticWorkflowInput, RunRegistryEntry } from './types';
import {
  createWorkflowInput,
  serializeToolsMetadata,
  serializeModelConfig,
  serializeDurableState,
  serializeDurableOptions,
} from './utils/serialize-state';

/**
 * Result from the preparation phase
 */
export interface PreparationResult<OUTPUT = undefined> {
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
  const instructions = (await (agent as any).getInstructions?.({ requestContext })) ?? (agent as any).instructions;
  if (instructions) {
    if (typeof instructions === 'string') {
      messageList.addSystem(instructions);
    } else if (Array.isArray(instructions)) {
      for (const inst of instructions) {
        messageList.addSystem(inst);
      }
    }
  }

  // Add context messages if provided
  if (execOptions?.context) {
    messageList.add(execOptions.context, 'context');
  }

  // Add user messages
  messageList.add(messages, 'input');

  // 5. Convert tools
  // Note: This calls the agent's private convertTools method
  // In a real implementation, we'd need to expose this or use a different pattern
  let tools: Record<string, CoreTool> = {};
  try {
    tools =
      (await (agent as any).convertTools?.({
        toolsets: execOptions?.toolsets,
        clientTools: execOptions?.clientTools,
        threadId,
        resourceId,
        runId,
        requestContext,
        methodType: 'stream',
        memoryConfig: execOptions?.memory?.options,
        autoResumeSuspendedTools: execOptions?.autoResumeSuspendedTools,
      })) ?? {};
  } catch (error) {
    logger?.debug?.(`[DurableAgent] Error converting tools: ${error}`);
  }

  // 6. Get model
  // Note: This gets the first model from the agent's model configuration
  const model = (await (agent as any).getModel?.({ requestContext })) as MastraLanguageModel;
  if (!model) {
    throw new Error('Agent model not available');
  }

  // 7. Get memory and create SaveQueueManager
  const memory = (await (agent as any).getMemory?.({ requestContext })) as MastraMemory | undefined;
  const memoryConfig = execOptions?.memory?.options;

  const saveQueueManager = memory
    ? new SaveQueueManager({
        logger,
        memory,
      })
    : undefined;

  // 8. Create serialized workflow input
  const workflowInput = createWorkflowInput({
    runId,
    agentId: agent.id,
    agentName: agent.name,
    messageList,
    tools,
    model,
    options: {
      maxSteps: execOptions?.maxSteps,
      toolChoice: execOptions?.toolChoice as any,
      temperature: execOptions?.modelSettings?.temperature,
      requireToolApproval: execOptions?.requireToolApproval,
      toolCallConcurrency: execOptions?.toolCallConcurrency,
      autoResumeSuspendedTools: execOptions?.autoResumeSuspendedTools,
      maxProcessorRetries: execOptions?.maxProcessorRetries,
      includeRawChunks: execOptions?.includeRawChunks,
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
    saveQueueManager: saveQueueManager!,
    model,
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
