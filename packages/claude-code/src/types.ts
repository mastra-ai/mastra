/**
 * Configuration for the Mastra Observational Memory Claude Code plugin.
 */
export interface OMConfig {
  /**
   * Directory to store memory files.
   * @default '.mastra/memory'
   */
  memoryDir?: string;

  /**
   * Token threshold for triggering observation.
   * When conversation context tokens exceed this, the Observer runs.
   * @default 80000
   */
  observationThreshold?: number;

  /**
   * Token threshold for triggering reflection.
   * When observation tokens exceed this, the Reflector runs.
   * @default 40000
   */
  reflectionThreshold?: number;

  /**
   * Model to use for Observer and Reflector.
   * Must be accessible via `claude` CLI or compatible API.
   * @default 'claude-sonnet-4-20250514'
   */
  model?: string;

  /**
   * Enable debug logging.
   * @default false
   */
  debug?: boolean;
}

/**
 * Resolved configuration with all defaults applied.
 */
export interface ResolvedConfig {
  memoryDir: string;
  observationThreshold: number;
  reflectionThreshold: number;
  model: string;
  debug: boolean;
}

/**
 * Persisted state for the memory system.
 */
export interface MemoryState {
  /** Currently active observations */
  observations: string;
  /** Token count of current observations */
  observationTokens: number;
  /** Number of reflection generations */
  generationCount: number;
  /** Timestamp of last observation */
  lastObservedAt: string | null;
  /** Current task being worked on */
  currentTask: string | null;
  /** Suggested continuation */
  suggestedResponse: string | null;
}

/**
 * Result from the Observer.
 */
export interface ObserverResult {
  /** Extracted observations */
  observations: string;
  /** Current task */
  currentTask?: string;
  /** Suggested continuation */
  suggestedResponse?: string;
}

/**
 * Result from the Reflector.
 */
export interface ReflectorResult {
  /** Condensed observations */
  observations: string;
  /** Token count of condensed observations */
  tokenCount: number;
}

// ═══════════════════════════════════════════════════════════════
// Claude Code Plugin Protocol Types
// ═══════════════════════════════════════════════════════════════

/**
 * Claude Code plugin manifest returned during initialization.
 */
export interface PluginManifest {
  name: string;
  version: string;
  description: string;
  hooks: string[];
}

/**
 * Hook invocation from Claude Code.
 */
export interface HookInvocation {
  hook: string;
  payload: Record<string, unknown>;
  session_id: string;
}

/**
 * Response to a hook invocation.
 */
export interface HookResponse {
  /** Whether the hook succeeded */
  success: boolean;
  /** Optional message to display */
  message?: string;
  /** System prompt injection content */
  system_prompt?: string;
  /** Additional context to prepend */
  context?: string;
}
