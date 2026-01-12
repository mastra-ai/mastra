import { MemoryConfig } from '@mastra/core/memory';
import { MemoryConfigOptions, MemoryConfigType } from './data/types';

// ============================================================================
// Memory Configuration Definitions
// ============================================================================

/**
 * Static definition of a memory configuration's properties.
 * All derived flags are computed once here, not scattered across prepare/run.
 */
export interface MemoryConfigDefinition {
  /** The config type identifier */
  type: MemoryConfigType;

  /** Memory options passed to Mastra Memory */
  memoryOptions: MemoryConfig;

  // --- Derived flags ---

  /** Requires a real LLM model (not mock) */
  needsRealModel: boolean;

  /** Uses semantic recall for embeddings */
  usesSemanticRecall: boolean;

  /** Uses working memory */
  usesWorkingMemory: boolean;

  /** Uses tailored (per-question) templates */
  usesTailored: boolean;

  /** Uses observational memory */
  usesObservationalMemory: boolean;

  /** Uses shortcut OM (finalize at end) */
  usesShortcutOM: boolean;

  /** Uses Cerebras GLM model for OM */
  usesGlmModel: boolean;

  /** Model to use for OM Observer/Reflector (null = use default) */
  omModel: string | null;

  /** Max input tokens for finalize (null = no limit) */
  omMaxInputTokens: number | null;

  /** Requires sequential processing (no concurrency) */
  requiresSequential: boolean;

  /** Model to use for the main agent (defaults to openai/gpt-4o) */
  agentModel?: string;

  /** Model to use for the eval agent (defaults to openai/gpt-4o) */
  evalModel?: string;
}

// --- Shared config values ---

const semanticRecall = {
  topK: 10,
  messageRange: 2,
  scope: 'resource',
} as const;

const lastMessages = 10;

// Cerebras GLM model config
export const CEREBRAS_GLM_MODEL = 'cerebras/glm-4.7';
export const CEREBRAS_GLM_MAX_TOKENS = 200000;

// ============================================================================
// Config Definitions Map
// ============================================================================

const MEMORY_CONFIGS: Record<MemoryConfigType, MemoryConfigDefinition> = {
  'semantic-recall': {
    type: 'semantic-recall',
    memoryOptions: {
      lastMessages,
      semanticRecall,
      workingMemory: { enabled: false },
    },
    needsRealModel: false,
    usesSemanticRecall: true,
    usesWorkingMemory: false,
    usesTailored: false,
    usesObservationalMemory: false,
    usesShortcutOM: false,
    usesGlmModel: false,
    omModel: null,
    omMaxInputTokens: null,
    requiresSequential: false,
  },

  'working-memory': {
    type: 'working-memory',
    memoryOptions: {
      lastMessages,
      semanticRecall: false,
      workingMemory: {
        enabled: true,
        scope: 'resource',
        version: 'vnext',
      },
    },
    needsRealModel: true,
    usesSemanticRecall: false,
    usesWorkingMemory: true,
    usesTailored: false,
    usesObservationalMemory: false,
    usesShortcutOM: false,
    usesGlmModel: false,
    omModel: null,
    omMaxInputTokens: null,
    requiresSequential: true,
    agentModel: 'openai/gpt-4o',
    evalModel: 'openai/gpt-4o',
  },

  'working-memory-tailored': {
    type: 'working-memory-tailored',
    memoryOptions: {
      lastMessages,
      semanticRecall: false,
      workingMemory: {
        enabled: true,
        scope: 'resource',
        version: 'vnext',
      },
    },
    needsRealModel: true,
    usesSemanticRecall: false,
    usesWorkingMemory: true,
    usesTailored: true,
    usesObservationalMemory: false,
    usesShortcutOM: false,
    usesGlmModel: false,
    omModel: null,
    omMaxInputTokens: null,
    requiresSequential: true,
    agentModel: 'gpt-4o',
  },

  combined: {
    type: 'combined',
    memoryOptions: {
      lastMessages,
      semanticRecall,
      workingMemory: {
        enabled: true,
        scope: 'resource',
      },
    },
    needsRealModel: true,
    usesSemanticRecall: true,
    usesWorkingMemory: true,
    usesTailored: false,
    usesObservationalMemory: false,
    usesShortcutOM: false,
    usesGlmModel: false,
    omModel: null,
    omMaxInputTokens: null,
    requiresSequential: true,
    agentModel: 'openai/gpt-4o',
    evalModel: 'openai/gpt-4o',
  },

  'combined-tailored': {
    type: 'combined-tailored',
    memoryOptions: {
      lastMessages,
      semanticRecall,
      workingMemory: {
        enabled: true,
        scope: 'resource',
        version: 'vnext',
      },
    },
    needsRealModel: true,
    usesSemanticRecall: true,
    usesWorkingMemory: true,
    usesTailored: true,
    usesObservationalMemory: false,
    usesShortcutOM: false,
    usesGlmModel: false,
    omModel: null,
    omMaxInputTokens: null,
    requiresSequential: true,
    agentModel: 'openai/gpt-4o',
    evalModel: 'openai/gpt-4o',
  },

  'observational-memory': {
    type: 'observational-memory',
    memoryOptions: {
      lastMessages: 5, // OM handles context, just keep minimal recent
      semanticRecall: false,
      workingMemory: { enabled: false },
    },
    needsRealModel: true,
    usesSemanticRecall: false,
    usesWorkingMemory: false,
    usesTailored: false,
    usesObservationalMemory: true,
    usesShortcutOM: false,
    usesGlmModel: false,
    omModel: null,
    omMaxInputTokens: null,
    requiresSequential: true,
    agentModel: 'openai/gpt-4o',
    evalModel: 'openai/gpt-4o',
  },

  'observational-memory-shortcut': {
    type: 'observational-memory-shortcut',
    memoryOptions: {
      lastMessages: 5,
      semanticRecall: false,
      workingMemory: { enabled: false },
    },
    needsRealModel: true,
    usesSemanticRecall: false,
    usesWorkingMemory: false,
    usesTailored: false,
    usesObservationalMemory: true,
    usesShortcutOM: true,
    usesGlmModel: false,
    omModel: null,
    omMaxInputTokens: null,
    requiresSequential: true,
    agentModel: 'gpt-4o',
  },

  'observational-memory-shortcut-glm': {
    type: 'observational-memory-shortcut-glm',
    memoryOptions: {
      lastMessages: 5,
      semanticRecall: false,
      workingMemory: { enabled: false },
    },
    needsRealModel: true,
    usesSemanticRecall: false,
    usesWorkingMemory: false,
    usesTailored: false,
    usesObservationalMemory: true,
    usesShortcutOM: true,
    usesGlmModel: true,
    omModel: CEREBRAS_GLM_MODEL,
    omMaxInputTokens: CEREBRAS_GLM_MAX_TOKENS,
    requiresSequential: true,
    agentModel: 'gpt-4o',
  },
};

// ============================================================================
// Public API
// ============================================================================

/**
 * Get the full config definition for a memory config type.
 */
export function getMemoryConfig(memoryConfig: MemoryConfigType): MemoryConfigDefinition {
  const config = MEMORY_CONFIGS[memoryConfig];
  if (!config) {
    throw new Error(`Unknown memory config: ${memoryConfig}`);
  }
  return config;
}

/**
 * Get memory options in the legacy format (for backwards compatibility).
 */
export function getMemoryOptions(memoryConfig: string): MemoryConfigOptions {
  const config = getMemoryConfig(memoryConfig as MemoryConfigType);
  return {
    type: config.type,
    options: config.memoryOptions,
  };
}

/**
 * Check if a string is a valid memory config type.
 */
export function isValidMemoryConfig(memoryConfig: string): memoryConfig is MemoryConfigType {
  return memoryConfig in MEMORY_CONFIGS;
}

/**
 * Get all available memory config types.
 */
export function getAvailableConfigs(): MemoryConfigType[] {
  return Object.keys(MEMORY_CONFIGS) as MemoryConfigType[];
}
