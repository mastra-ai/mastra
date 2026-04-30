/**
 * Observational Memory (OM)
 *
 * A memory system that keeps agents performant across long conversations by:
 * 1. Automatically compressing turn-based message history into structured observations
 * 2. Reflecting on observations when they grow too large
 *
 * Three-agent architecture:
 * - Actor: The main agent, sees observations + recent unobserved messages
 * - Observer: Extracts observations when history exceeds threshold
 * - Reflector: Condenses observations when they exceed threshold
 */

// Engine
export { ObservationalMemory } from './observational-memory';

// Constants
export {
  OBSERVATIONAL_MEMORY_DEFAULTS,
  OBSERVATION_CONTINUATION_HINT,
  OBSERVATION_CONTEXT_PROMPT,
  OBSERVATION_CONTEXT_INSTRUCTIONS,
} from './constants';

// Processor adapter
export { ObservationalMemoryProcessor } from './processor';
export type { MemoryContextProvider } from './processor';

// Observation utilities
export { getObservationsAsOf } from './observation-utils';

// Types
export { ModelByInputTokens, type ModelByInputTokensConfig } from './model-by-input-tokens';

export type {
  ObservationalMemoryConfig,
  ObservationDebugEvent,
  ObserveHooks,
  ObserveHookUsage,
  ObservationConfig,
  ReflectionConfig,
  ObserverResult,
  ReflectorResult,
  // Buffering data parts
  DataOmBufferingStartPart,
  DataOmBufferingEndPart,
  DataOmBufferingFailedPart,
  DataOmBufferingPart,
  // Activation data part
  DataOmActivationPart,
  DataOmPart,
} from './types';

// Observer Agent
export {
  OBSERVER_SYSTEM_PROMPT,
  buildObserverSystemPrompt,
  buildObserverPrompt,
  parseObserverOutput,
  optimizeObservationsForContext,
  formatMessagesForObserver,
  hasCurrentTaskSection,
  extractCurrentTask,
  type ObserverResult as ObserverAgentResult,
} from './observer-agent';

// Re-export storage types from core for convenience
export type {
  ObservationalMemoryRecord,
  ObservationalMemoryScope,
  ObservationalMemoryOriginType,
  CreateObservationalMemoryInput,
  UpdateActiveObservationsInput,
  UpdateBufferedObservationsInput,
  CreateReflectionGenerationInput,
} from '@mastra/core/storage';

// Utilities
export { TokenCounter } from './token-counter';
export { injectAnchorIds, stripEphemeralAnchorIds, parseAnchorId } from './anchor-ids';
export {
  parseObservationGroups,
  stripObservationGroups,
  wrapInObservationGroup,
  renderObservationGroupsForReflection,
  reconcileObservationGroupsFromReflection,
  deriveObservationGroupProvenance,
  combineObservationGroupRanges,
  type ObservationGroup,
} from './observation-groups';
