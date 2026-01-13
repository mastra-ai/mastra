import { MemoryConfig } from '@mastra/core/memory';
import { DatasetType, MemoryConfigOptions, MemoryConfigType } from './data/types';

// ============================================================================
// Run Variants - Define operational parameters
// ============================================================================

/**
 * A run variant defines operational parameters like concurrency and subset size.
 * These are separate from memory configs to allow mixing and matching.
 */
export interface RunVariant {
  /** Variant name */
  name: string;
  /** Description for help text */
  description: string;
  /** Dataset to use */
  dataset: DatasetType;
  /** Number of questions to process (undefined = all) */
  subset?: number;
  /** Number of questions per type for stratified sampling (overrides subset) */
  perTypeCount?: number;
  /** Comb sampling: number of questions to select per type */
  combSampleSize?: number;
  /** Comb sampling: stride between selected questions */
  combOffset?: number;
  /** Comb sampling: starting index (default 0) */
  combStartOffset?: number;
  /** Concurrency for prepare command */
  prepareConcurrency: number;
  /** Concurrency for bench command */
  benchConcurrency: number;
}

/**
 * All available run variants.
 */
export const RUN_VARIANTS: Record<string, RunVariant> = {
  quick: {
    name: 'quick',
    description: 'Quick test run with 10 questions',
    dataset: 'longmemeval_s',
    subset: 10,
    prepareConcurrency: 1,
    benchConcurrency: 5,
  },
  full: {
    name: 'full',
    description: 'Full benchmark run with all questions',
    dataset: 'longmemeval_s',
    subset: undefined,
    prepareConcurrency: 1,
    benchConcurrency: 10,
  },
  rip: {
    name: 'rip',
    description: 'Full benchmark run with all questions, high concurrency',
    dataset: 'longmemeval_s',
    subset: undefined,
    prepareConcurrency: 10,
    benchConcurrency: 10,
  },
  sample: {
    name: 'sample',
    description: 'Stratified sample: 10 questions per type (60 total)',
    dataset: 'longmemeval_s',
    perTypeCount: 10,
    prepareConcurrency: 2,
    benchConcurrency: 10,
  },
  'sample-comb': {
    name: 'sample-comb',
    description: 'Comb sample: 10 questions per type, spaced throughout (use --comb-offset, --start-offset)',
    dataset: 'longmemeval_s',
    combSampleSize: 10,
    combOffset: 10,
    combStartOffset: 0,
    prepareConcurrency: 2,
    benchConcurrency: 10,
  },
};

/**
 * Get a run variant by name.
 */
export function getRunVariant(name: string): RunVariant {
  const variant = RUN_VARIANTS[name];
  if (!variant) {
    throw new Error(`Unknown run variant: ${name}. Available: ${Object.keys(RUN_VARIANTS).join(', ')}`);
  }
  return variant;
}

/**
 * Get all available run variant names.
 */
export function getAvailableVariants(): string[] {
  return Object.keys(RUN_VARIANTS);
}

/**
 * Apply stratified sampling to a list of questions.
 * Sorts questions by ID (deterministic) and takes the first N of each type.
 */
export function applyStratifiedSampling<T extends { question_id: string; question_type: string }>(
  questions: T[],
  perTypeCount: number,
): T[] {
  // Sort by question_id for deterministic ordering
  const sorted = [...questions].sort((a, b) => a.question_id.localeCompare(b.question_id));

  // Group by question type
  const byType = new Map<string, T[]>();
  for (const q of sorted) {
    const existing = byType.get(q.question_type) || [];
    existing.push(q);
    byType.set(q.question_type, existing);
  }

  // Take first N of each type
  const result: T[] = [];
  for (const [type, typeQuestions] of byType) {
    const selected = typeQuestions.slice(0, perTypeCount);
    result.push(...selected);
    console.log(`  ${type}: ${selected.length}/${typeQuestions.length} questions`);
  }

  // Sort final result by question_id for consistent ordering
  return result.sort((a, b) => a.question_id.localeCompare(b.question_id));
}

/**
 * Apply comb sampling to a list of questions.
 * Selects questions at regular intervals (combOffset) starting from startOffset,
 * wrapping around to the beginning if needed.
 */
export function applyCombSampling<T extends { question_id: string; question_type: string }>(
  questions: T[],
  sampleSize: number,
  combOffset: number,
  startOffset: number = 0,
): T[] {
  // Sort by question_id for deterministic ordering
  const sorted = [...questions].sort((a, b) => a.question_id.localeCompare(b.question_id));

  // Group by question type
  const byType = new Map<string, T[]>();
  for (const q of sorted) {
    const existing = byType.get(q.question_type) || [];
    existing.push(q);
    byType.set(q.question_type, existing);
  }

  // Comb through each type
  const result: T[] = [];
  for (const [type, typeQuestions] of byType) {
    const total = typeQuestions.length;
    const selected: T[] = [];
    const selectedIndices: number[] = [];

    let currentIndex = startOffset % total;
    for (let i = 0; i < sampleSize && i < total; i++) {
      selected.push(typeQuestions[currentIndex]);
      selectedIndices.push(currentIndex);
      currentIndex = (currentIndex + combOffset) % total;
    }

    result.push(...selected);
    console.log(`  ${type}: ${selected.length}/${total} questions (indices: ${selectedIndices.join(', ')})`);
  }

  // Sort final result by question_id for consistent ordering
  return result.sort((a, b) => a.question_id.localeCompare(b.question_id));
}

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

  /** Base config to inherit prepared data from (for derived configs) */
  baseConfig?: MemoryConfigType;

  /** If true, read directly from baseConfig's data at runtime (no copy/modification) */
  readOnlyConfig?: boolean;

  /** Enable the recall tool at runtime */
  recallToolEnabled?: boolean;

  /** Enable pattern recognition during observation */
  recognizePatterns?: boolean;

  /** Enable observation RAG filtering at runtime */
  usesObservationRag?: boolean;

  /** TopK for RAG retrieval (default: 50) */
  ragTopK?: number;

  /** Enable preference boost queries for RAG (default: false) */
  ragPreferenceBoost?: boolean;
}

// --- Shared config values ---

const semanticRecall = {
  topK: 10,
  messageRange: 2,
  scope: 'resource',
} as const;

const lastMessages = 10;

// Cerebras GLM model config
export const CEREBRAS_GLM_MODEL = 'cerebras/zai-glm-4.6';
export const CEREBRAS_GLM_MAX_TOKENS = 200000;

// ============================================================================
// Config Aliases - Short names for memory configs
// ============================================================================

/**
 * Short aliases for memory config types.
 * Allows using 'om' instead of 'observational-memory', etc.
 */
export const CONFIG_ALIASES: Record<string, MemoryConfigType> = {
  // Short aliases
  semantic: 'semantic-recall',
  working: 'working-memory',
  'working-tailored': 'working-memory-tailored',
  combined: 'combined',
  'combined-tailored': 'combined-tailored',
  om: 'observational-memory',
  'om-shortcut': 'observational-memory-shortcut',
  'om-shortcut-glm': 'observational-memory-shortcut-glm',
  'om-patterns-observed': 'om-patterns-observed',
  'om-patterns-tool': 'om-patterns-tool',
  'om-glm': 'om-glm',
  'om-glm-patterns-observed': 'om-glm-patterns-observed',
  'om-glm-patterns-tool': 'om-glm-patterns-tool',
  'om-rag': 'om-rag',
  'om-glm-rag': 'om-glm-rag',
  'om-glm-rag-topk100': 'om-glm-rag-topk100',
  'om-glm-rag-prefboost': 'om-glm-rag-prefboost',

  // Full names (for completeness)
  'semantic-recall': 'semantic-recall',
  'working-memory': 'working-memory',
  'working-memory-tailored': 'working-memory-tailored',
  'observational-memory': 'observational-memory',
  'observational-memory-shortcut': 'observational-memory-shortcut',
  'observational-memory-shortcut-glm': 'observational-memory-shortcut-glm',
};

/**
 * Resolve a config name (alias or full) to the canonical MemoryConfigType.
 */
export function resolveConfigAlias(nameOrAlias: string): MemoryConfigType {
  const resolved = CONFIG_ALIASES[nameOrAlias];
  if (!resolved) {
    throw new Error(`Unknown memory config: ${nameOrAlias}. Available: ${Object.keys(CONFIG_ALIASES).join(', ')}`);
  }
  return resolved;
}

/**
 * Get all available config aliases (short names only).
 */
export function getConfigAliases(): string[] {
  return [
    'semantic',
    'working',
    'working-tailored',
    'combined',
    'combined-tailored',
    'om',
    'om-shortcut',
    'om-shortcut-glm',
    'om-patterns-observed',
    'om-patterns-tool',
    'om-glm',
    'om-glm-patterns-observed',
    'om-glm-patterns-tool',
    'om-rag',
    'om-glm-rag',
    'om-glm-rag-topk100',
    'om-glm-rag-prefboost',
  ];
}

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

  'om-patterns-observed': {
    type: 'om-patterns-observed',
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
    usesShortcutOM: false,
    usesGlmModel: false,
    omModel: null,
    omMaxInputTokens: null,
    requiresSequential: true,
    agentModel: 'openai/gpt-4o',
    evalModel: 'openai/gpt-4o',
    baseConfig: 'observational-memory',
    recognizePatterns: true,
  },

  'om-patterns-tool': {
    type: 'om-patterns-tool',
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
    usesShortcutOM: false,
    usesGlmModel: false,
    omModel: null,
    omMaxInputTokens: null,
    requiresSequential: true,
    agentModel: 'openai/gpt-4o',
    evalModel: 'openai/gpt-4o',
    baseConfig: 'observational-memory',
    readOnlyConfig: true, // Just enables recall tool, doesn't modify data
    recallToolEnabled: true,
  },

  // GLM-4.7 variants - use Cerebras GLM for the main agent
  'om-glm': {
    type: 'om-glm',
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
    usesShortcutOM: false,
    usesGlmModel: false, // This is for Observer/Reflector, not the main agent
    omModel: null,
    omMaxInputTokens: null,
    requiresSequential: true,
    agentModel: CEREBRAS_GLM_MODEL, // Main agent uses GLM-4.7
    evalModel: 'openai/gpt-4o', // Eval stays on GPT-4o
    baseConfig: 'observational-memory',
    readOnlyConfig: true, // Uses same prepared data as observational-memory
  },

  'om-glm-patterns-observed': {
    type: 'om-glm-patterns-observed',
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
    usesShortcutOM: false,
    usesGlmModel: false,
    omModel: null,
    omMaxInputTokens: null,
    requiresSequential: true,
    agentModel: CEREBRAS_GLM_MODEL,
    evalModel: 'openai/gpt-4o',
    baseConfig: 'om-patterns-observed', // Inherits from patterns-observed
    readOnlyConfig: true,
    recognizePatterns: true,
  },

  'om-glm-patterns-tool': {
    type: 'om-glm-patterns-tool',
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
    usesShortcutOM: false,
    usesGlmModel: false,
    omModel: null,
    omMaxInputTokens: null,
    requiresSequential: true,
    agentModel: CEREBRAS_GLM_MODEL,
    evalModel: 'openai/gpt-4o',
    baseConfig: 'observational-memory', // Uses base OM data
    readOnlyConfig: true,
    recallToolEnabled: true,
  },

  // RAG variants - use semantic filtering on observations
  'om-rag': {
    type: 'om-rag',
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
    usesShortcutOM: false,
    usesGlmModel: false,
    omModel: null,
    omMaxInputTokens: null,
    requiresSequential: true,
    agentModel: 'openai/gpt-4o',
    evalModel: 'openai/gpt-4o',
    baseConfig: 'observational-memory',
    readOnlyConfig: true, // Uses same prepared data, just filters at runtime
    usesObservationRag: true, // Enable the ObservationSemanticFilter processor
  },

  'om-glm-rag': {
    type: 'om-glm-rag',
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
    usesShortcutOM: false,
    usesGlmModel: false,
    omModel: null,
    omMaxInputTokens: null,
    requiresSequential: true,
    agentModel: CEREBRAS_GLM_MODEL,
    // evalModel: CEREBRAS_GLM_MODEL,
    baseConfig: 'observational-memory',
    readOnlyConfig: true,
    usesObservationRag: true,
  },

  'om-glm-rag-topk100': {
    type: 'om-glm-rag-topk100',
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
    usesShortcutOM: false,
    usesGlmModel: false,
    omModel: null,
    omMaxInputTokens: null,
    requiresSequential: true,
    agentModel: CEREBRAS_GLM_MODEL,
    evalModel: CEREBRAS_GLM_MODEL,
    baseConfig: 'observational-memory',
    readOnlyConfig: true,
    usesObservationRag: true,
    ragTopK: 100, // Override default topK of 50
  },
  'om-glm-rag-prefboost': {
    type: 'om-glm-rag-prefboost',
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
    usesShortcutOM: false,
    usesGlmModel: false,
    omModel: null,
    omMaxInputTokens: null,
    requiresSequential: true,
    agentModel: CEREBRAS_GLM_MODEL,
    evalModel: CEREBRAS_GLM_MODEL,
    baseConfig: 'observational-memory',
    readOnlyConfig: true,
    usesObservationRag: true,
    ragPreferenceBoost: true, // Enable preference boost queries
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
