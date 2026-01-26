import type { JSONSchema7 } from 'json-schema';
import type { CoreTool } from '../../../tools/types';
import type { MastraLanguageModel } from '../../../llm/model/shared.types';
import type { MessageList } from '../../message-list';
import type { MemoryConfig } from '../../../memory/types';
import type {
  SerializableToolMetadata,
  SerializableModelConfig,
  SerializableDurableState,
  SerializableDurableOptions,
  DurableAgenticWorkflowInput,
  DurableLLMStepOutput,
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
    // Note: We don't serialize model settings here - they come from execution options
  };
}

/**
 * Extract serializable state from _internal-like objects
 */
export function serializeDurableState(params: {
  memoryConfig?: MemoryConfig;
  threadId?: string;
  resourceId?: string;
  threadExists?: boolean;
}): SerializableDurableState {
  return {
    memoryConfig: params.memoryConfig,
    threadId: params.threadId,
    resourceId: params.resourceId,
    threadExists: params.threadExists,
  };
}

/**
 * Extract serializable options from agent execution options
 */
export function serializeDurableOptions(options: {
  maxSteps?: number;
  toolChoice?: any;
  temperature?: number;
  requireToolApproval?: boolean;
  toolCallConcurrency?: number;
  autoResumeSuspendedTools?: boolean;
  maxProcessorRetries?: number;
  includeRawChunks?: boolean;
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
    temperature: options.temperature,
    requireToolApproval: options.requireToolApproval,
    toolCallConcurrency: options.toolCallConcurrency,
    autoResumeSuspendedTools: options.autoResumeSuspendedTools,
    maxProcessorRetries: options.maxProcessorRetries,
    includeRawChunks: options.includeRawChunks,
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
  options: Parameters<typeof serializeDurableOptions>[0];
  state: Parameters<typeof serializeDurableState>[0];
  messageId: string;
}): DurableAgenticWorkflowInput {
  return {
    runId: params.runId,
    agentId: params.agentId,
    agentName: params.agentName,
    messageListState: params.messageList.serialize(),
    toolsMetadata: serializeToolsMetadata(params.tools),
    modelConfig: serializeModelConfig(params.model),
    options: serializeDurableOptions(params.options),
    state: serializeDurableState(params.state),
    messageId: params.messageId,
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
