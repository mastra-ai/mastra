import type { JSONSchema7 } from 'json-schema';
import type { MastraLanguageModel } from '../../../llm/model/shared.types';
import type { MemoryConfig } from '../../../memory/types';
import type { CoreTool } from '../../../tools/types';
import type { MessageList } from '../../message-list';
import type { AgentModelManagerConfig } from '../../types';
import type {
  SerializableToolMetadata,
  SerializableModelConfig,
  SerializableModelListEntry,
  SerializableDurableState,
  SerializableDurableOptions,
  SerializableModelSettings,
  SerializableScorersConfig,
  SerializableScorerEntry,
  DurableAgenticWorkflowInput,
} from '../types';

/**
 * Extract serializable metadata from a CoreTool
 * This strips out the execute function and converts the schema to JSON Schema
 */
export function serializeToolMetadata(name: string, tool: CoreTool): SerializableToolMetadata {
  // Extract JSON Schema from the parameters
  let inputSchema: JSONSchema7 = { type: 'object' };

  if (tool.parameters) {
    // If it's already a JSON Schema object
    if ('type' in tool.parameters && typeof tool.parameters.type === 'string') {
      inputSchema = tool.parameters as JSONSchema7;
    }
    // If it has a jsonSchema property (zod schema converted)
    else if ('jsonSchema' in tool.parameters) {
      inputSchema = (tool.parameters as any).jsonSchema as JSONSchema7;
    }
    // If it's a Zod schema with _def (try to extract)
    else if ('_def' in tool.parameters) {
      // We'll need to use zodToJsonSchema at runtime if available
      // For now, use a basic object schema
      inputSchema = { type: 'object' };
    }
  }

  return {
    id: 'id' in tool && typeof tool.id === 'string' ? tool.id : name,
    name,
    description: tool.description,
    inputSchema,
    requireApproval: (tool as any).requireApproval,
    hasSuspendSchema: (tool as any).hasSuspendSchema,
  };
}

/**
 * Extract serializable metadata from all tools
 */
export function serializeToolsMetadata(tools: Record<string, CoreTool>): SerializableToolMetadata[] {
  return Object.entries(tools).map(([name, tool]) => serializeToolMetadata(name, tool));
}

/**
 * Extract serializable model configuration
 */
export function serializeModelConfig(model: MastraLanguageModel): SerializableModelConfig {
  return {
    provider: model.provider,
    modelId: model.modelId,
    specificationVersion: model.specificationVersion,
    // Store the original config string for runtime resolution (e.g., 'openai/gpt-4o')
    originalConfig: `${model.provider}/${model.modelId}`,
    // Note: We don't serialize model settings here - they come from execution options
  };
}

/**
 * Extract serializable model list entry from AgentModelManagerConfig
 */
export function serializeModelListEntry(entry: AgentModelManagerConfig): SerializableModelListEntry {
  const model = entry.model;
  return {
    id: entry.id,
    config: {
      provider: model.provider,
      modelId: model.modelId,
      specificationVersion: model.specificationVersion,
      originalConfig: `${model.provider}/${model.modelId}`,
      providerOptions: entry.providerOptions,
    },
    maxRetries: entry.maxRetries,
    enabled: entry.enabled,
  };
}

/**
 * Serialize an array of model configs into a model list.
 * Filters out disabled models since they shouldn't be included in durable execution.
 */
export function serializeModelList(models: AgentModelManagerConfig[]): SerializableModelListEntry[] {
  return models.filter(m => m.enabled !== false).map(serializeModelListEntry);
}

/**
 * Serialize scorers configuration for durable execution.
 *
 * This extracts the scorer name (for resolution at runtime) and sampling config.
 * The actual scorer objects are resolved from Mastra at step execution time.
 *
 * @param scorers The agent's scorers configuration (from agent.scorers or options.scorers)
 * @returns Serializable scorer configuration
 */
export function serializeScorersConfig(
  scorers: Record<
    string,
    { scorer: { name: string } | string; sampling?: { type: 'none' } | { type: 'ratio'; rate: number } }
  >,
): SerializableScorersConfig {
  const result: SerializableScorersConfig = {};

  for (const [key, entry] of Object.entries(scorers)) {
    // Get the scorer name - can be a string directly or from scorer.name
    const scorerName = typeof entry.scorer === 'string' ? entry.scorer : entry.scorer.name;

    const scorerEntry: SerializableScorerEntry = {
      scorerName,
    };

    // Include sampling if provided
    if (entry.sampling) {
      scorerEntry.sampling = entry.sampling;
    }

    result[key] = scorerEntry;
  }

  return result;
}

/**
 * Extract serializable state from _internal-like objects
 */
export function serializeDurableState(params: {
  memoryConfig?: MemoryConfig;
  threadId?: string;
  resourceId?: string;
  threadExists?: boolean;
  savePerStep?: boolean;
  observationalMemory?: boolean;
}): SerializableDurableState {
  return {
    memoryConfig: params.memoryConfig,
    threadId: params.threadId,
    resourceId: params.resourceId,
    threadExists: params.threadExists,
    savePerStep: params.savePerStep,
    observationalMemory: params.observationalMemory,
  };
}

/**
 * Pick the JSON-safe call settings out of an arbitrary `modelSettings` input.
 * Drops any field that is not a primitive value of the expected type so that
 * non-serializable fields (functions, AbortSignal, etc.) never reach the
 * workflow input.
 */
export function serializeModelSettings(
  settings: SerializableModelSettings | Record<string, unknown> | undefined,
): SerializableModelSettings | undefined {
  if (!settings || typeof settings !== 'object') return undefined;

  const source = settings as Record<string, unknown>;
  const out: SerializableModelSettings = {};
  const pickNumber = (key: keyof SerializableModelSettings) => {
    const value = source[key as string];
    if (typeof value === 'number' && Number.isFinite(value)) {
      (out as Record<string, unknown>)[key as string] = value;
    }
  };

  pickNumber('maxOutputTokens');
  pickNumber('temperature');
  pickNumber('topP');
  pickNumber('topK');
  pickNumber('presencePenalty');
  pickNumber('frequencyPenalty');
  pickNumber('seed');
  pickNumber('maxRetries');

  if (Array.isArray(source.stopSequences) && source.stopSequences.every(v => typeof v === 'string')) {
    out.stopSequences = source.stopSequences as string[];
  }

  // Headers are never serialized into the workflow input. They are stored
  // exclusively on the in-process RunRegistryEntry so they never reach
  // durable storage. The durable llm-execution step merges them back from
  // the registry at call time.
  // (Previously we had a denylist of "sensitive" header names, but any
  // header could carry credentials — the safest approach is to keep them
  // all off the wire.)

  return Object.keys(out).length > 0 ? out : undefined;
}

/**
 * Extract serializable options from agent execution options
 */
export function serializeDurableOptions(options: {
  maxSteps?: number;
  toolChoice?: any;
  activeTools?: string[];
  modelSettings?: SerializableModelSettings | Record<string, unknown>;
  requireToolApproval?: boolean;
  toolCallConcurrency?: number;
  autoResumeSuspendedTools?: boolean;
  maxProcessorRetries?: number;
  includeRawChunks?: boolean;
  returnScorerData?: boolean;
  hasErrorProcessors?: boolean;
  providerOptions?: SerializableDurableOptions['providerOptions'];
  structuredOutput?: SerializableDurableOptions['structuredOutput'];
  skipBgTaskWait?: boolean;
  disableBackgroundTasks?: boolean;
  backgroundTaskPolicy?: SerializableDurableOptions['backgroundTaskPolicy'];
  tracingOptions?: SerializableDurableOptions['tracingOptions'];
  actor?: SerializableDurableOptions['actor'];
  instructionsOverride?: SerializableDurableOptions['instructionsOverride'];
  systemMessage?: SerializableDurableOptions['systemMessage'];
  transform?: SerializableDurableOptions['transform'];
  isTaskComplete?: SerializableDurableOptions['isTaskComplete'];
}): SerializableDurableOptions {
  // Normalize toolChoice to serializable form
  let serializedToolChoice: SerializableDurableOptions['toolChoice'];
  if (options.toolChoice) {
    if (typeof options.toolChoice === 'string') {
      serializedToolChoice = options.toolChoice as 'auto' | 'none' | 'required';
    } else if (typeof options.toolChoice === 'object' && 'type' in options.toolChoice) {
      if (options.toolChoice.type === 'tool' && 'toolName' in options.toolChoice) {
        serializedToolChoice = {
          type: 'tool',
          toolName: options.toolChoice.toolName as string,
        };
      }
    }
  }

  return {
    maxSteps: options.maxSteps,
    toolChoice: serializedToolChoice,
    activeTools: options.activeTools,
    modelSettings: serializeModelSettings(options.modelSettings),
    requireToolApproval: options.requireToolApproval,
    toolCallConcurrency: options.toolCallConcurrency,
    autoResumeSuspendedTools: options.autoResumeSuspendedTools,
    maxProcessorRetries: options.maxProcessorRetries,
    includeRawChunks: options.includeRawChunks,
    returnScorerData: options.returnScorerData,
    hasErrorProcessors: options.hasErrorProcessors,
    providerOptions: options.providerOptions,
    structuredOutput: options.structuredOutput,
    skipBgTaskWait: options.skipBgTaskWait,
    disableBackgroundTasks: options.disableBackgroundTasks,
    backgroundTaskPolicy: options.backgroundTaskPolicy,
    tracingOptions: options.tracingOptions,
    actor: options.actor,
    instructionsOverride: options.instructionsOverride,
    systemMessage: options.systemMessage,
    transform: options.transform,
    isTaskComplete: options.isTaskComplete,
  };
}

/**
 * Create the full workflow input from all components
 */
export function createWorkflowInput(params: {
  runId: string;
  agentId: string;
  agentName?: string;
  messageList: MessageList;
  tools: Record<string, CoreTool>;
  model: MastraLanguageModel;
  modelList?: AgentModelManagerConfig[];
  scorers?: Parameters<typeof serializeScorersConfig>[0];
  options: Parameters<typeof serializeDurableOptions>[0];
  state: Parameters<typeof serializeDurableState>[0];
  messageId: string;
  agentSpanData?: unknown;
  modelSpanData?: unknown;
  requestContextEntries?: Record<string, unknown>;
}): DurableAgenticWorkflowInput {
  return {
    __workflowKind: 'durable-agent',
    runId: params.runId,
    agentId: params.agentId,
    agentName: params.agentName,
    messageListState: params.messageList.serialize(),
    toolsMetadata: serializeToolsMetadata(params.tools),
    modelConfig: serializeModelConfig(params.model),
    modelList: params.modelList ? serializeModelList(params.modelList) : undefined,
    scorers: params.scorers ? serializeScorersConfig(params.scorers) : undefined,
    options: serializeDurableOptions(params.options),
    state: serializeDurableState(params.state),
    messageId: params.messageId,
    agentSpanData: params.agentSpanData,
    modelSpanData: params.modelSpanData,
    requestContextEntries: params.requestContextEntries,
  };
}

/**
 * Serialize an error for workflow state
 */
export function serializeError(error: unknown): { name: string; message: string; stack?: string } {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }
  return {
    name: 'Error',
    message: String(error),
  };
}

/**
 * Serialize a Date to ISO string for workflow state
 */
export function serializeDate(date: Date | undefined): string | undefined {
  return date?.toISOString();
}

/**
 * Deserialize an ISO string back to Date
 */
export function deserializeDate(isoString: string | undefined): Date | undefined {
  return isoString ? new Date(isoString) : undefined;
}
