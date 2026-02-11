/**
 * @mastra/claude-code
 *
 * Mastra Observational Memory plugin for Claude Code.
 * Prevents context window compaction by automatically observing and reflecting
 * on conversation history, maintaining dense compressed observations that
 * persist across sessions.
 *
 * @packageDocumentation
 */

// Core engine
export { ObservationalMemoryEngine } from './engine.js';

// Plugin
export { MastraOMPlugin } from './plugin.js';

// Storage
export { FileStorage } from './storage.js';

// Configuration
export { resolveConfig, getMemoryDir } from './config.js';

// Token counting
export { TokenCounter } from './token-counter.js';

// Prompts (for customization)
export {
  OBSERVER_SYSTEM_PROMPT,
  REFLECTOR_SYSTEM_PROMPT,
  buildObserverPrompt,
  buildReflectorPrompt,
  formatObservationsForSystemPrompt,
} from './prompts.js';

// Parsers
export { parseObserverOutput, optimizeObservations } from './observer.js';
export { parseReflectorOutput, validateCompression } from './reflector.js';

// Types
export type {
  OMConfig,
  ResolvedConfig,
  MemoryState,
  ObserverResult,
  ReflectorResult,
  PluginManifest,
  HookInvocation,
  HookResponse,
} from './types.js';
