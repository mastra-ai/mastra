import type { AgentBackgroundConfig } from '../../background-tasks/types';
import type { MastraLanguageModel } from '../../llm/model/shared.types';
import type { IMastraLogger } from '../../logger';
import type { Mastra } from '../../mastra';
import type { MastraMemory } from '../../memory/memory';
import type { MemoryConfig, MemoryConfig as _MemoryConfig, StorageThreadType } from '../../memory/types';
import type { InputProcessorOrWorkflow, OutputProcessorOrWorkflow, ErrorProcessorOrWorkflow } from '../../processors';
import type { ProcessorState } from '../../processors/runner';
import { RequestContext, MASTRA_VERSIONS_KEY, mergeVersionOverrides } from '../../request-context';
import type { VersionOverrides } from '../../request-context';
import type { CoreTool } from '../../tools/types';
import type { Workspace } from '../../workspace';
import type { Agent } from '../agent';
import type { AgentExecutionOptions } from '../agent.types';
import { MessageList } from '../message-list';
import type { MessageListInput } from '../message-list';
import { SaveQueueManager } from '../save-queue';
import type { AgentModelManagerConfig, ToolsetsInput, ToolsInput } from '../types';
import type { DurableAgenticWorkflowInput, RunRegistryEntry, SerializableStructuredOutput } from './types';
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
  listInputProcessors(requestContext?: RequestContext): Promise<InputProcessorOrWorkflow[]>;
  listOutputProcessors(requestContext?: RequestContext): Promise<OutputProcessorOrWorkflow[]>;
  listErrorProcessors(requestContext?: RequestContext): Promise<ErrorProcessorOrWorkflow[]>;
  getBackgroundTasksConfig(): AgentBackgroundConfig | undefined;
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
  /** Mastra instance (for version overrides, background tasks, etc.) */
  mastra?: Mastra;
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
    mastra,
  } = options;

  const typedAgent = agent as unknown as DurablePreparationAgent;

  // 1. Generate IDs
  const runId = providedRunId ?? crypto.randomUUID();
  const messageId = crypto.randomUUID();

  // 2. Get request context
  const requestContext = providedRequestContext ?? new RequestContext();

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

  // 6. Run input processors on the message list
  const processorStates = new Map<string, ProcessorState>();
  let inputProcessors: InputProcessorOrWorkflow[] = [];
  let outputProcessors: OutputProcessorOrWorkflow[] = [];
  let errorProcessors: ErrorProcessorOrWorkflow[] = [];

  try {
    inputProcessors = await typedAgent.listInputProcessors(requestContext);
    outputProcessors = await typedAgent.listOutputProcessors(requestContext);
    errorProcessors = await typedAgent.listErrorProcessors(requestContext);
  } catch (error) {
    logger?.warn?.(`[DurableAgent] Error resolving processors: ${error}`);
  }

  // Run processInput (once, before execution) if we have any processors
  if (inputProcessors.length > 0) {
    try {
      // Set MastraMemory context so processors that need it (OM, message history) can access it
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
      }

      const { ProcessorRunner } = await import('../../processors/runner');
      const runner = new ProcessorRunner({
        inputProcessors,
        outputProcessors,
        errorProcessors,
        logger: logger as any,
        agentName: agent.name,
        processorStates,
      });
      await runner.runInputProcessors(messageList, {} as any, requestContext, 0);
    } catch (error) {
      logger?.warn?.(`[DurableAgent] Error running input processors: ${error}`);
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

  // 9. Get memory and create SaveQueueManager
  const memory = await typedAgent.getMemory({ requestContext });
  const memoryConfig = execOptions?.memory?.options;

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

  // 11. Get background task config
  const backgroundTasksConfig = typedAgent.getBackgroundTasksConfig?.();
  const backgroundTaskManager = mastra?.backgroundTaskManager;

  // 12. Resolve memory persistence flags
  const savePerStep = execOptions?.savePerStep;
  const observationalMemory = !!memoryConfig?.observationalMemory;

  // 13. Create serialized workflow input
  const workflowInput = createWorkflowInput({
    runId,
    agentId: agent.id,
    agentName: agent.name,
    messageList,
    tools,
    model,
    modelList: modelList ?? undefined,
    scorers,
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
      hasErrorProcessors: errorProcessors.length > 0,
      structuredOutput: serializedStructuredOutput,
      skipBgTaskWait: (execOptions as any)?._skipBgTaskWait,
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
        }))
      : undefined,
    workspace,
    requestContext,
    inputProcessors,
    outputProcessors,
    errorProcessors,
    processorStates,
    backgroundTaskManager,
    backgroundTasksConfig,
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
