/**
 * Durable Agent Module
 *
 * This module provides durable execution patterns for AI agents with
 * resumable streams. If a client disconnects and reconnects, they can
 * receive missed events from the cache.
 *
 * ## Factory Functions
 *
 * - `createDurableAgent({ agent })` - Local execution with resumable streams
 * - `createEventedAgent({ agent })` - Built-in evented workflow engine (fire-and-forget)
 * - `createInngestAgent({ agent, inngest })` - Inngest durable execution (from @mastra/inngest)
 *
 * ## Class Hierarchy
 *
 * - `DurableAgent` extends `Agent` - Base durable agent with resumable streams
 * - `EventedAgent` extends `DurableAgent` - Fire-and-forget execution
 * - `InngestAgent` extends `DurableAgent` - Inngest-powered execution (from @mastra/inngest)
 *
 * ## Features
 *
 * 1. **Resumable Streams**: Events are cached, allowing reconnection without missing data
 * 2. **Pluggable Cache**: Use InMemoryServerCache (default) or custom backends (Redis, etc.)
 * 3. **Cache Inheritance**: Durable agents inherit cache from Mastra if not explicitly provided
 * 4. **Durable Execution**: Run agentic loops on workflow engines (Inngest, evented, etc.)
 *
 * @example Basic usage with resumable streams
 * ```typescript
 * import { Agent } from '@mastra/core/agent';
 * import { createDurableAgent } from '@mastra/core/agent/durable';
 *
 * const agent = new Agent({
 *   id: 'my-agent',
 *   instructions: 'You are a helpful assistant',
 *   model: openai('gpt-4'),
 * });
 *
 * // Wrap with resumable streams
 * const durableAgent = createDurableAgent({ agent });
 *
 * const { output, runId, cleanup } = await durableAgent.stream('Hello!');
 * const text = await output.text;
 * cleanup();
 * ```
 *
 * @example Custom cache backend (e.g., Redis)
 * ```typescript
 * import { RedisServerCache } from '@mastra/redis'; // hypothetical
 *
 * const durableAgent = createDurableAgent({
 *   agent,
 *   cache: new RedisServerCache({ url: 'redis://...' }),
 * });
 * ```
 *
 * @example Cache inheritance from Mastra
 * ```typescript
 * const mastra = new Mastra({
 *   cache: new RedisServerCache({ url: 'redis://...' }),
 *   agents: {
 *     myAgent: createDurableAgent({ agent }), // Inherits Redis cache from Mastra
 *   },
 * });
 * ```
 */

// Main factory function for durable agents with resumable streams
export {
  createDurableAgent,
  isDurableAgent,
  isLocalDurableAgent, // Backwards compatibility alias
  type CreateDurableAgentOptions,
  type LocalDurableAgent, // Backwards compatibility alias
} from './create-durable-agent';

// DurableAgent class (base class for durable agents)
export {
  DurableAgent,
  type DurableAgentConfig,
  type DurableAgentStreamOptions,
  type DurableAgentStreamResult,
} from './durable-agent';

// EventedAgent class (extends DurableAgent with fire-and-forget execution)
export { EventedAgent, isEventedAgentClass, type EventedAgentConfig } from './evented-agent';

// Evented Agent factory
export { createEventedAgent, isEventedAgent, type CreateEventedAgentOptions } from './create-evented-agent';

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

// Shared workflow utilities
export {
  executeDurableToolCalls,
  modelConfigSchema,
  modelListEntrySchema,
  accumulatedUsageSchema,
  durableAgenticOutputSchema,
  baseDurableAgenticInputSchema,
  baseIterationStateSchema,
  calculateAccumulatedUsage,
  buildStepRecord,
  createBaseIterationStateUpdate,
} from './workflows/shared';
export type {
  ToolExecutionContext,
  ToolExecutionError,
  BaseIterationState,
  AccumulatedUsage,
  IterationStateUpdateInput,
  StepRecord,
} from './workflows/shared';

// Workflow executors
export { LocalWorkflowExecutor, localExecutor } from './executors';
export type { WorkflowExecutor, WorkflowExecutionResult } from './executors';
