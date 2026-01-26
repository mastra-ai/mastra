/**
 * Durable Agent Module
 *
 * This module provides a durable execution pattern for AI agents.
 * Unlike the standard Agent, DurableAgent:
 *
 * 1. Separates preparation (non-durable) from execution (durable)
 * 2. Uses pubsub for streaming instead of closures
 * 3. Stores non-serializable state in a registry keyed by runId
 * 4. Creates fully serializable workflow inputs
 *
 * This enables the agent to work with durable execution engines like
 * Cloudflare Workflows, Inngest, Temporal, etc. that replay workflow
 * code and require serializable state.
 *
 * @example
 * ```typescript
 * import { DurableAgent } from '@mastra/core/agent/durable';
 * import { InMemoryPubSub } from '@mastra/core/events';
 *
 * const pubsub = new InMemoryPubSub();
 *
 * const durableAgent = new DurableAgent({
 *   id: 'my-durable-agent',
 *   name: 'My Durable Agent',
 *   instructions: 'You are a helpful assistant',
 *   model: 'openai/gpt-4',
 *   tools: { ... },
 *   pubsub,
 * });
 *
 * const { output, runId, cleanup } = await durableAgent.stream('Hello!', {
 *   onChunk: (chunk) => console.log('Chunk:', chunk),
 *   onFinish: (result) => console.log('Done:', result),
 * });
 *
 * const text = await output.text;
 * cleanup();
 * ```
 */

// Main DurableAgent class and types
export {
  DurableAgent,
  type DurableAgentConfig,
  type DurableAgentStreamOptions,
  type DurableAgentStreamResult,
} from './durable-agent';

// Preparation utilities
export { prepareForDurableExecution, type PreparationOptions, type PreparationResult } from './preparation';

// Run registry for non-serializable state
export { RunRegistry, ExtendedRunRegistry, type ExtendedRunRegistryEntry } from './run-registry';

// Stream adapter for pubsub-based streaming
export {
  createDurableAgentStream,
  emitChunkEvent,
  emitStepStartEvent,
  emitStepFinishEvent,
  emitFinishEvent,
  emitErrorEvent,
  emitSuspendedEvent,
  type DurableAgentStreamOptions as StreamAdapterOptions,
  type DurableAgentStreamResult as StreamAdapterResult,
} from './stream-adapter';

// Constants
export { AGENT_STREAM_TOPIC, AgentStreamEventTypes, DurableAgentDefaults, DurableStepIds } from './constants';

// Types
export type {
  // Serializable types for workflow state
  SerializableToolMetadata,
  SerializableModelConfig,
  SerializableDurableState,
  SerializableDurableOptions,
  DurableAgenticWorkflowInput,
  // Step I/O types
  DurableLLMStepOutput,
  DurableToolCallInput,
  DurableToolCallOutput,
  DurableAgenticExecutionOutput,
  DurableAgenticLoopOutput,
  // Event types
  AgentStreamEventType,
  AgentStreamEvent,
  AgentChunkEventData,
  AgentStepFinishEventData,
  AgentFinishEventData,
  AgentErrorEventData,
  AgentSuspendedEventData,
  // Registry types
  RunRegistryEntry,
  DurableStepContext,
} from './types';

// Utility functions for serialization
export {
  createWorkflowInput,
  serializeToolsMetadata,
  serializeModelConfig,
  serializeDurableState,
  serializeDurableOptions,
} from './utils/serialize-state';

// Utility functions for runtime resolution
export {
  resolveRuntimeDependencies,
  resolveModel,
  resolveInternalState,
  resolveTool,
  toolRequiresApproval,
  type ResolvedRuntimeDependencies,
  type ResolveRuntimeOptions,
} from './utils/resolve-runtime';

// Workflow creation
export { createDurableAgenticWorkflow, type DurableAgenticWorkflowOptions } from './workflows';

// Workflow steps (for advanced customization)
export {
  createDurableLLMExecutionStep,
  createDurableToolCallStep,
  createDurableLLMMappingStep,
} from './workflows/steps';
