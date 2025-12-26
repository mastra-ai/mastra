import { z } from 'zod';

// ============================================================================
// Core Training Data Types
// ============================================================================

/**
 * A single training case representing an input scenario for an agent.
 * This is the atomic unit of training data.
 */
export interface AgentCase {
  /** Unique identifier for this case */
  id: string;
  /** The input messages that form the conversation context */
  messages: AgentMessage[];
  /** Optional metadata for filtering, balancing, or categorization */
  metadata?: Record<string, unknown>;
  /** Optional ground truth or expected output */
  groundTruth?: string;
}

/**
 * A message in the agent conversation.
 */
export interface AgentMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  /** Tool call information if role is 'assistant' with tool calls */
  toolCalls?: ToolCall[];
  /** Tool result if role is 'tool' */
  toolCallId?: string;
  name?: string;
}

/**
 * Tool call information.
 */
export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

/**
 * A single run record representing an agent execution.
 */
export interface AgentRunRecord {
  /** Reference to the case this run is for */
  caseId: string;
  /** The input case */
  input: AgentCase;
  /** The final assistant response text */
  outputText: string;
  /** Full output messages including tool calls */
  outputMessages: AgentMessage[];
  /** Tool calls made during this run */
  toolCalls?: ToolCall[];
  /** Trace ID for linking to observability */
  traceId?: string;
  /** Span ID for the specific agent run */
  spanId?: string;
  /** The model used for this run */
  model?: string;
  /** Token usage information */
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
  /** Timestamp of the run */
  timestamp?: Date;
}

// ============================================================================
// Scoring Types
// ============================================================================

/**
 * Result from a single scorer.
 */
export interface ScorerResult {
  scorerId: string;
  scorerName?: string;
  score: number;
  reason?: string;
  artifacts?: unknown;
}

/**
 * A scorecard for a single run, containing all scorer results.
 */
export interface Scorecard {
  run: AgentRunRecord;
  results: ScorerResult[];
  compositeScore: number;
  passedGates: boolean;
  gateResults?: GateResult[];
}

/**
 * Result of a gate check.
 */
export interface GateResult {
  gate: Gate;
  passed: boolean;
  actualValue: number;
}

/**
 * A gate that must be passed for an example to be included.
 */
export interface Gate {
  scorerId: string;
  operator: 'gte' | 'gt' | 'lte' | 'lt' | 'eq';
  threshold: number;
}

/**
 * Configuration for composite scoring.
 */
export interface CompositeConfig {
  /** Weights for each scorer (scorerId -> weight) */
  weights: Record<string, number>;
}

/**
 * Configuration for scoring in training.
 */
export interface ScoringConfig {
  /** Composite score weights */
  composite: Record<string, number>;
  /** Gates that must pass for inclusion */
  gates?: Gate[];
}

// ============================================================================
// Dataset Source Types
// ============================================================================

/**
 * Configuration for dataset source.
 */
export type DatasetConfig = TracesDatasetConfig | ArrayDatasetConfig | FileDatasetConfig;

export interface TracesDatasetConfig {
  source: 'traces';
  filter?: {
    agentName?: string;
    since?: Date;
    until?: Date;
    limit?: number;
    tags?: string[];
    metadata?: Record<string, unknown>;
  };
  /**
   * Use original outputs from traces instead of regenerating.
   * When true, the trainer will use the actual responses from the traces
   * rather than running the agent again. This is faster and doesn't create
   * new traces. Default: true for SFT, false for DPO.
   */
  useOriginalOutputs?: boolean;
  /**
   * Use existing scorer results from the database instead of re-running scorers.
   * When true, the trainer will look up scorer results already stored for each trace.
   * This is MUCH faster when traces have already been scored.
   * Default: true (uses existing scores if available, falls back to re-running)
   */
  useExistingScores?: boolean;
  /** For DPO: number of candidate responses to generate per case */
  candidatesPerCase?: number;
  /** For DPO: variation configuration */
  variationConfig?: {
    temperatures?: number[];
    seeds?: number[];
  };
}

export interface ArrayDatasetConfig {
  source: 'dataset';
  cases: AgentCase[];
  /** For DPO: number of candidate responses to generate per case */
  candidatesPerCase?: number;
  variationConfig?: {
    temperatures?: number[];
    seeds?: number[];
  };
}

export interface FileDatasetConfig {
  source: 'file';
  path: string;
  format: 'jsonl' | 'json';
}

// ============================================================================
// Selection Types
// ============================================================================

/**
 * Configuration for example selection.
 */
export interface SelectionConfig {
  /** Minimum composite score for inclusion */
  minScore?: number;
  /** Maximum number of examples to include */
  maxExamples?: number;
  /** Deduplicate examples based on input hash */
  dedupe?: boolean;
  /** Balance examples across categories */
  balance?: {
    field: string;
    maxPerCategory?: number;
  };
  /** Holdout percentage for evaluation (0-1) */
  holdoutRatio?: number;
}

// ============================================================================
// Evaluation Types
// ============================================================================

/**
 * Configuration for post-training evaluation.
 */
export interface EvaluationConfig {
  /** Holdout ratio for evaluation set (0-1) */
  holdoutRatio?: number;
  /** Scorers to use for evaluation (uses training scorers if not specified) */
  scorerIds?: string[];
  /** Promotion criteria */
  promoteIf?: PromotionCriteria;
}

/**
 * Criteria for automatic model promotion.
 */
export interface PromotionCriteria {
  /** Minimum improvement in composite score over baseline */
  minImprovement?: number;
  /** No regression on any gate */
  noGateRegression?: boolean;
  /** Custom promotion function */
  custom?: (baseline: EvalResult, tuned: EvalResult) => boolean;
}

/**
 * Result of evaluation on a model.
 */
export interface EvalResult {
  modelId: string;
  compositeScore: number;
  scorerResults: Record<string, number>;
  gatesPassed: number;
  gatesFailed: number;
  totalExamples: number;
}

// ============================================================================
// Provider Types
// ============================================================================

/**
 * Training method.
 */
export type TrainingMethod = 'sft' | 'dpo';

/**
 * Provider configuration.
 */
export type ProviderConfig = OpenAIProviderConfig;

export interface OpenAIProviderConfig {
  kind: 'openai';
  /** Base model to fine-tune */
  baseModel: string;
  /** Hyperparameters for training */
  hyperparams?: {
    n_epochs?: number;
    batch_size?: number;
    learning_rate_multiplier?: number;
  };
  /** Validation file configuration */
  validationSplit?: number;
  /** Job suffix for identification */
  suffix?: string;
}

// ============================================================================
// Training Job Types
// ============================================================================

/**
 * Status of a training job.
 */
export type TrainingJobStatus = 'pending' | 'preparing' | 'running' | 'succeeded' | 'failed' | 'cancelled';

/**
 * A training job record.
 */
export interface TrainingJob {
  id: string;
  agentId: string;
  agentName: string;
  method: TrainingMethod;
  status: TrainingJobStatus;
  /** Raw status from the provider (e.g., "validating_files", "queued") */
  providerStatus?: string;
  /** Provider-specific job ID */
  providerJobId?: string;
  /** The fine-tuned model ID (available after success) */
  fineTunedModelId?: string;
  /** Base model used */
  baseModel: string;
  /** Number of training examples */
  trainingExamples: number;
  /** Number of validation examples */
  validationExamples?: number;
  /** Training metrics */
  metrics?: TrainingMetrics;
  /** Error message if failed */
  error?: string;
  /** Configuration used */
  config: FitAgentOptions;
  /** Timestamps */
  createdAt: Date;
  updatedAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}

/**
 * Training metrics from the provider.
 */
export interface TrainingMetrics {
  trainingLoss?: number;
  validationLoss?: number;
  trainedTokens?: number;
  epochs?: number;
  steps?: number;
}

// ============================================================================
// Main API Types
// ============================================================================

/**
 * Progress information for training.
 */
export interface TrainingProgress {
  stage: 'loading' | 'generating' | 'scoring' | 'selecting' | 'rendering' | 'uploading' | 'submitting' | 'training';
  stageLabel: string;
  current: number;
  total: number;
  percentage: number;
}

/**
 * Callback for reporting training progress.
 */
export type ProgressCallback = (progress: TrainingProgress) => void | Promise<void>;

/**
 * Options for fitAgent().
 */
export interface FitAgentOptions {
  /** Training method: SFT, DPO, or RFT */
  method: TrainingMethod;
  /** Dataset configuration */
  data: DatasetConfig;
  /** Scoring configuration */
  scoring: ScoringConfig;
  /** Example selection configuration */
  selection?: SelectionConfig;
  /** Evaluation configuration */
  evaluation?: EvaluationConfig;
  /** Provider configuration */
  provider: ProviderConfig;
  /** Progress callback for reporting training progress */
  onProgress?: ProgressCallback;
}

/**
 * Result of fitAgent().
 */
export interface FitAgentResult {
  /** Training job ID */
  jobId: string;
  /** Current job status */
  status: TrainingJobStatus;
  /** The fine-tuned model ID (available after success) */
  fineTunedModelId?: string;
  /** Training metrics */
  metrics?: TrainingMetrics;
  /** Evaluation results (if evaluation was run) */
  evaluation?: {
    baseline: EvalResult;
    tuned: EvalResult;
    promoted: boolean;
  };
  /** Artifacts generated */
  artifacts?: {
    trainingFile?: string;
    validationFile?: string;
  };
  /** Number of training examples */
  trainingExamples?: number;
  /** Number of validation examples */
  validationExamples?: number;
}

// ============================================================================
// Trainer Provider Interface
// ============================================================================

/**
 * Interface for training providers (OpenAI, etc.).
 */
export interface TrainerProvider {
  name: string;

  /** Upload a file for training */
  uploadFile(content: Uint8Array, filename: string, purpose: 'fine-tune' | 'batch'): Promise<{ fileId: string }>;

  /** Start a training job */
  startJob(args: StartJobArgs): Promise<{ jobId: string }>;

  /** Get job status */
  getJob(jobId: string): Promise<TrainingJob>;

  /** Cancel a job */
  cancelJob(jobId: string): Promise<void>;

  /** List jobs for an agent */
  listJobs(agentId?: string): Promise<TrainingJob[]>;
}

export interface StartJobArgs {
  method: TrainingMethod;
  baseModel: string;
  trainingFileId: string;
  validationFileId?: string;
  hyperparams?: Record<string, unknown>;
  suffix?: string;
  metadata?: Record<string, string>;
}

// ============================================================================
// Zod Schemas for Validation
// ============================================================================

export const agentMessageSchema = z.object({
  role: z.enum(['system', 'user', 'assistant', 'tool']),
  content: z.string(),
  toolCalls: z
    .array(
      z.object({
        id: z.string(),
        type: z.literal('function'),
        function: z.object({
          name: z.string(),
          arguments: z.string(),
        }),
      }),
    )
    .optional(),
  toolCallId: z.string().optional(),
  name: z.string().optional(),
});

export const agentCaseSchema = z.object({
  id: z.string(),
  messages: z.array(agentMessageSchema),
  metadata: z.record(z.unknown()).optional(),
  groundTruth: z.string().optional(),
});

export const gateSchema = z.object({
  scorerId: z.string(),
  operator: z.enum(['gte', 'gt', 'lte', 'lt', 'eq']),
  threshold: z.number(),
});

export const scoringConfigSchema = z.object({
  composite: z.record(z.number()),
  gates: z.array(gateSchema).optional(),
});

export const trainingJobStatusSchema = z.enum(['pending', 'preparing', 'running', 'succeeded', 'failed', 'cancelled']);

export const trainingMethodSchema = z.enum(['sft', 'dpo']);
