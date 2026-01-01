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

// Main processor
export {
  ObservationalMemory,
  type ObservationalMemoryConfig,
  type ObservationDebugEvent,
} from './observational-memory';

// Types
export type {
  ObserverConfig,
  ReflectorConfig,
  ObserverResult,
  ReflectorResult,
  ObservationFocus,
  ObservationFocusType,
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
