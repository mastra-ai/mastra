import type { StorageColumn } from './types';

export const TABLE_WORKFLOW_SNAPSHOT = 'mastra_workflow_snapshot';
export const TABLE_EVALS = 'mastra_evals';
export const TABLE_MESSAGES = 'mastra_messages';
export const TABLE_THREADS = 'mastra_threads';
export const TABLE_TRACES = 'mastra_traces';
export const TABLE_RESOURCES = 'mastra_resources';
export const TABLE_SCORERS = 'mastra_scorers';
export const TABLE_AI_SPANS = 'mastra_ai_spans';
export const TABLE_DATASETS = 'mastra_datasets';
export const TABLE_DATASET_VERSIONS = 'mastra_dataset_versions';
export const TABLE_DATASET_ROWS = 'mastra_dataset_rows';
export const TABLE_EXPERIMENTS = 'mastra_experiments';
export const TABLE_EXPERIMENT_ROW_RESULTS = 'mastra_experiment_row_results';

export type TABLE_NAMES =
  | typeof TABLE_WORKFLOW_SNAPSHOT
  | typeof TABLE_EVALS
  | typeof TABLE_MESSAGES
  | typeof TABLE_THREADS
  | typeof TABLE_TRACES
  | typeof TABLE_RESOURCES
  | typeof TABLE_SCORERS
  | typeof TABLE_AI_SPANS
  | typeof TABLE_DATASETS
  | typeof TABLE_DATASET_VERSIONS
  | typeof TABLE_DATASET_ROWS
  | typeof TABLE_EXPERIMENTS
  | typeof TABLE_EXPERIMENT_ROW_RESULTS;

export const SCORERS_SCHEMA: Record<string, StorageColumn> = {
  id: { type: 'text', nullable: false, primaryKey: true },
  scorerId: { type: 'text' },
  traceId: { type: 'text', nullable: true },
  spanId: { type: 'text', nullable: true },
  runId: { type: 'text' },
  scorer: { type: 'jsonb' },
  preprocessStepResult: { type: 'jsonb', nullable: true },
  extractStepResult: { type: 'jsonb', nullable: true }, // Deprecated
  analyzeStepResult: { type: 'jsonb', nullable: true },
  score: { type: 'float' },
  reason: { type: 'text', nullable: true },
  metadata: { type: 'jsonb', nullable: true },
  preprocessPrompt: { type: 'text', nullable: true },
  extractPrompt: { type: 'text', nullable: true }, // Deprecated
  generateScorePrompt: { type: 'text', nullable: true },
  generateReasonPrompt: { type: 'text', nullable: true },
  analyzePrompt: { type: 'text', nullable: true },

  reasonPrompt: { type: 'text', nullable: true }, // Deprecated
  input: { type: 'jsonb' },
  output: { type: 'jsonb' }, // MESSAGE OUTPUT
  additionalContext: { type: 'jsonb', nullable: true }, // DATA FROM THE CONTEXT PARAM ON AN AGENT
  runtimeContext: { type: 'jsonb', nullable: true }, // THE EVALUATE RUNTIME CONTEXT FOR THE RUN
  /**
   * Things you can evaluate
   */
  entityType: { type: 'text', nullable: true }, // WORKFLOW, AGENT, TOOL, STEP, NETWORK
  entity: { type: 'jsonb', nullable: true }, // MINIMAL JSON DATA ABOUT WORKFLOW, AGENT, TOOL, STEP, NETWORK
  entityId: { type: 'text', nullable: true },
  source: { type: 'text' },
  experimentResultId: { type: 'text', nullable: true },
  resourceId: { type: 'text', nullable: true },
  threadId: { type: 'text', nullable: true },
  createdAt: { type: 'timestamp' },
  updatedAt: { type: 'timestamp' },
};

export const AI_SPAN_SCHEMA: Record<string, StorageColumn> = {
  // Composite primary key of traceId and spanId
  traceId: { type: 'text', nullable: false },
  spanId: { type: 'text', nullable: false },
  parentSpanId: { type: 'text', nullable: true },
  name: { type: 'text', nullable: false },
  scope: { type: 'jsonb', nullable: true }, // Mastra package info {"core-version": "0.1.0"}
  spanType: { type: 'text', nullable: false }, // WORKFLOW_RUN, WORKFLOW_STEP, AGENT_RUN, AGENT_STEP, TOOL_RUN, TOOL_STEP, etc.
  attributes: { type: 'jsonb', nullable: true },
  metadata: { type: 'jsonb', nullable: true },
  links: { type: 'jsonb', nullable: true },
  input: { type: 'jsonb', nullable: true },
  output: { type: 'jsonb', nullable: true },
  error: { type: 'jsonb', nullable: true },
  startedAt: { type: 'timestamp', nullable: false }, // When the span started
  endedAt: { type: 'timestamp', nullable: true }, // When the span ended
  createdAt: { type: 'timestamp', nullable: false }, // The time the database record was created
  updatedAt: { type: 'timestamp', nullable: true }, // The time the database record was last updated
  isEvent: { type: 'boolean', nullable: false },
};

export const DATASET_SCHEMA: Record<string, StorageColumn> = {
  id: { type: 'text', nullable: false, primaryKey: true },
  name: { type: 'text', nullable: false, unique: true }, // Unique name for the dataset
  description: { type: 'text', nullable: true }, // Optional description of what this dataset contains
  metadata: { type: 'jsonb', nullable: true },
  createdAt: { type: 'timestamp', nullable: false },
  updatedAt: { type: 'timestamp', nullable: true },
};

export const DATASET_VERSION_SCHEMA: Record<string, StorageColumn> = {
  id: { type: 'text', nullable: false, primaryKey: true }, // Primary identifier - ULID (time-based sortable)
  datasetId: { type: 'text', nullable: false },
  createdAt: { type: 'timestamp', nullable: false },
  updatedAt: { type: 'timestamp', nullable: true },
};

export const DATASET_ROW_SCHEMA: Record<string, StorageColumn> = {
  // Composite primary key of rowId and versionId
  rowId: { type: 'text', nullable: false }, // Logical row identifier - stays the same across versions
  datasetId: { type: 'text', nullable: false }, // Foreign key to datasets.id
  versionId: { type: 'text', nullable: false }, // Foreign key to dataset_versions.id
  input: { type: 'jsonb', nullable: false }, // The input data for this dataset row
  groundTruth: { type: 'jsonb', nullable: true }, // The expected/correct output (ground truth) for evaluation
  runtimeContext: { type: 'jsonb', nullable: true }, // Runtime context to pass to agents/workflows when using this item

  deleted: { type: 'boolean', nullable: false },

  // Links to traces (optional) for the row
  traceId: { type: 'text', nullable: true },
  spanId: { type: 'text', nullable: true },

  createdAt: { type: 'timestamp', nullable: false },
  updatedAt: { type: 'timestamp', nullable: true },
};

export const EXPERIMENT_SCHEMA: Record<string, StorageColumn> = {
  id: { type: 'text', nullable: false, primaryKey: true },

  // Dataset linkage
  datasetId: { type: 'text', nullable: false },
  datasetVersionId: { type: 'text', nullable: false }, // Immutable snapshot

  // Target configuration
  targetType: { type: 'text', nullable: false }, // 'agent' | 'workflow'
  targetId: { type: 'text', nullable: false }, // ID of the agent/workflow
  // targetConfig: { type: 'jsonb', nullable: true }, // Serialized config used

  // Execution configuration
  concurrency: { type: 'integer', nullable: true },
  scorers: { type: 'jsonb', nullable: true }, // Array of scorers

  // Status tracking
  status: { type: 'text', nullable: false }, // 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'

  // Summary statistics (computed and cached)
  totalItems: { type: 'integer', nullable: true },
  // successfulItems: { type: 'integer', nullable: true },
  // failedItems: { type: 'integer', nullable: true },
  averageScores: { type: 'jsonb', nullable: true }, // { scorerName: avgScore }

  // Arbitrary metadata
  // metadata: { type: 'jsonb', nullable: true },

  // Timestamps
  createdAt: { type: 'timestamp', nullable: false },
  startedAt: { type: 'timestamp', nullable: true },
  completedAt: { type: 'timestamp', nullable: true },
  updatedAt: { type: 'timestamp', nullable: true },
};

export const EXPERIMENT_ROW_RESULT_SCHEMA: Record<string, StorageColumn> = {
  id: { type: 'text', nullable: false, primaryKey: true },

  // Foreign keys
  experimentId: { type: 'text', nullable: false },
  datasetRowId: { type: 'text', nullable: false }, // Links to specific dataset row

  // Snapshot of dataset row data (preserves data even if row is deleted)
  input: { type: 'jsonb', nullable: false },
  groundTruth: { type: 'jsonb', nullable: true },
  runtimeContext: { type: 'jsonb', nullable: true },

  // Execution result
  output: { type: 'jsonb', nullable: true }, // Null if execution failed

  // Status
  // status: { type: 'text', nullable: false }, // 'pending' | 'success' | 'error'
  error: { type: 'jsonb', nullable: true }, // Error details if failed

  // Tracing linkage
  traceId: { type: 'text', nullable: true },
  spanId: { type: 'text', nullable: true },

  // Performance metrics
  // duration: { type: 'integer', nullable: true }, // Milliseconds
  // tokensUsed: { type: 'integer', nullable: true },
  // cost: { type: 'float', nullable: true },

  // Comments (integrated into result)
  comments: { type: 'jsonb', nullable: true }, // Array of comment objects

  // Timestamps
  createdAt: { type: 'timestamp', nullable: false },
  updatedAt: { type: 'timestamp', nullable: true },
};

export const TABLE_SCHEMAS: Record<TABLE_NAMES, Record<string, StorageColumn>> = {
  [TABLE_WORKFLOW_SNAPSHOT]: {
    workflow_name: {
      type: 'text',
    },
    run_id: {
      type: 'text',
    },
    resourceId: { type: 'text', nullable: true },
    snapshot: {
      type: 'text',
    },
    createdAt: {
      type: 'timestamp',
    },
    updatedAt: {
      type: 'timestamp',
    },
  },
  [TABLE_SCORERS]: SCORERS_SCHEMA,
  [TABLE_DATASETS]: DATASET_SCHEMA,
  [TABLE_DATASET_ROWS]: DATASET_ROW_SCHEMA,
  [TABLE_DATASET_VERSIONS]: DATASET_VERSION_SCHEMA,
  [TABLE_EXPERIMENTS]: EXPERIMENT_SCHEMA,
  [TABLE_EXPERIMENT_ROW_RESULTS]: EXPERIMENT_ROW_RESULT_SCHEMA,
  [TABLE_EVALS]: {
    input: {
      type: 'text',
    },
    output: {
      type: 'text',
    },
    result: {
      type: 'jsonb',
    },
    agent_name: {
      type: 'text',
    },
    metric_name: {
      type: 'text',
    },
    instructions: {
      type: 'text',
    },
    test_info: {
      type: 'jsonb',
      nullable: true,
    },
    global_run_id: {
      type: 'text',
    },
    run_id: {
      type: 'text',
    },
    created_at: {
      type: 'timestamp',
    },
    createdAt: {
      type: 'timestamp',
      nullable: true,
    },
  },
  [TABLE_THREADS]: {
    id: { type: 'text', nullable: false, primaryKey: true },
    resourceId: { type: 'text', nullable: false },
    title: { type: 'text', nullable: false },
    metadata: { type: 'text', nullable: true },
    createdAt: { type: 'timestamp', nullable: false },
    updatedAt: { type: 'timestamp', nullable: false },
  },
  [TABLE_MESSAGES]: {
    id: { type: 'text', nullable: false, primaryKey: true },
    thread_id: { type: 'text', nullable: false },
    content: { type: 'text', nullable: false },
    role: { type: 'text', nullable: false },
    type: { type: 'text', nullable: false },
    createdAt: { type: 'timestamp', nullable: false },
    resourceId: { type: 'text', nullable: true },
  },
  [TABLE_AI_SPANS]: AI_SPAN_SCHEMA,
  [TABLE_TRACES]: {
    id: { type: 'text', nullable: false, primaryKey: true },
    parentSpanId: { type: 'text', nullable: true },
    name: { type: 'text', nullable: false },
    traceId: { type: 'text', nullable: false },
    scope: { type: 'text', nullable: false },
    kind: { type: 'integer', nullable: false },
    attributes: { type: 'jsonb', nullable: true },
    status: { type: 'jsonb', nullable: true },
    events: { type: 'jsonb', nullable: true },
    links: { type: 'jsonb', nullable: true },
    other: { type: 'text', nullable: true },
    startTime: { type: 'bigint', nullable: false },
    endTime: { type: 'bigint', nullable: false },
    createdAt: { type: 'timestamp', nullable: false },
  },
  [TABLE_RESOURCES]: {
    id: { type: 'text', nullable: false, primaryKey: true },
    workingMemory: { type: 'text', nullable: true },
    metadata: { type: 'jsonb', nullable: true },
    createdAt: { type: 'timestamp', nullable: false },
    updatedAt: { type: 'timestamp', nullable: false },
  },
};
