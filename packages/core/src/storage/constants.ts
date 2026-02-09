import { spanRecordSchema } from './domains/observability/types';
import { buildStorageSchema } from './types';
import type { StorageColumn } from './types';

export const TABLE_WORKFLOW_SNAPSHOT = 'mastra_workflow_snapshot';
export const TABLE_MESSAGES = 'mastra_messages';
export const TABLE_THREADS = 'mastra_threads';
export const TABLE_TRACES = 'mastra_traces';
export const TABLE_RESOURCES = 'mastra_resources';
export const TABLE_SCORERS = 'mastra_scorers';
export const TABLE_SPANS = 'mastra_ai_spans';
export const TABLE_AGENTS = 'mastra_agents';
export const TABLE_AGENT_VERSIONS = 'mastra_agent_versions';
export const TABLE_OBSERVATIONAL_MEMORY = 'mastra_observational_memory';
export const TABLE_PROMPT_BLOCKS = 'mastra_prompt_blocks';
export const TABLE_PROMPT_BLOCK_VERSIONS = 'mastra_prompt_block_versions';

// Dataset tables
export const TABLE_DATASETS = 'mastra_datasets';
export const TABLE_DATASET_ITEMS = 'mastra_dataset_items';
export const TABLE_DATASET_ITEM_VERSIONS = 'mastra_dataset_item_versions';
export const TABLE_DATASET_VERSIONS = 'mastra_dataset_versions';

// Run tables
export const TABLE_RUNS = 'mastra_runs';
export const TABLE_RUN_RESULTS = 'mastra_run_results';
export const TABLE_DATASET_EXPERIMENTS = 'mastra_dataset_experiments';
export const TABLE_DATASET_EXPERIMENT_RESULTS = 'mastra_dataset_experiment_results';

export type TABLE_NAMES =
  | typeof TABLE_WORKFLOW_SNAPSHOT
  | typeof TABLE_MESSAGES
  | typeof TABLE_THREADS
  | typeof TABLE_TRACES
  | typeof TABLE_RESOURCES
  | typeof TABLE_SCORERS
  | typeof TABLE_SPANS
  | typeof TABLE_AGENTS
  | typeof TABLE_AGENT_VERSIONS
  | typeof TABLE_DATASETS
  | typeof TABLE_DATASET_ITEMS
  | typeof TABLE_DATASET_ITEM_VERSIONS
  | typeof TABLE_DATASET_VERSIONS
  | typeof TABLE_RUNS
  | typeof TABLE_RUN_RESULTS
  | typeof TABLE_DATASET_EXPERIMENTS
  | typeof TABLE_DATASET_EXPERIMENT_RESULTS
  | typeof TABLE_PROMPT_BLOCKS
  | typeof TABLE_PROMPT_BLOCK_VERSIONS;

export const SCORERS_SCHEMA: Record<string, StorageColumn> = {
  id: { type: 'text', nullable: false, primaryKey: true },
  scorerId: { type: 'text' },
  traceId: { type: 'text', nullable: true },
  spanId: { type: 'text', nullable: true },
  runId: { type: 'text' },
  scorer: { type: 'jsonb' },
  preprocessStepResult: { type: 'jsonb', nullable: true },
  extractStepResult: { type: 'jsonb', nullable: true },
  analyzeStepResult: { type: 'jsonb', nullable: true },
  score: { type: 'float' },
  reason: { type: 'text', nullable: true },
  metadata: { type: 'jsonb', nullable: true },
  preprocessPrompt: { type: 'text', nullable: true },
  extractPrompt: { type: 'text', nullable: true },
  generateScorePrompt: { type: 'text', nullable: true },
  generateReasonPrompt: { type: 'text', nullable: true },
  analyzePrompt: { type: 'text', nullable: true },

  // Deprecated
  reasonPrompt: { type: 'text', nullable: true },
  input: { type: 'jsonb' },
  output: { type: 'jsonb' }, // MESSAGE OUTPUT
  additionalContext: { type: 'jsonb', nullable: true }, // DATA FROM THE CONTEXT PARAM ON AN AGENT
  requestContext: { type: 'jsonb', nullable: true }, // THE EVALUATE Request Context FOR THE RUN
  /**
   * Things you can evaluate
   */
  entityType: { type: 'text', nullable: true }, // WORKFLOW, AGENT, TOOL, STEP, NETWORK
  entity: { type: 'jsonb', nullable: true }, // MINIMAL JSON DATA ABOUT WORKFLOW, AGENT, TOOL, STEP, NETWORK
  entityId: { type: 'text', nullable: true },
  source: { type: 'text' },
  resourceId: { type: 'text', nullable: true },
  threadId: { type: 'text', nullable: true },
  createdAt: { type: 'timestamp' },
  updatedAt: { type: 'timestamp' },
};

export const SPAN_SCHEMA = buildStorageSchema(spanRecordSchema);

/**
 * @deprecated Use SPAN_SCHEMA instead. This legacy schema is retained only for migration purposes.
 * @internal
 */
export const OLD_SPAN_SCHEMA: Record<string, StorageColumn> = {
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

export const AGENTS_SCHEMA: Record<string, StorageColumn> = {
  id: { type: 'text', nullable: false, primaryKey: true },
  status: { type: 'text', nullable: false }, // 'draft' or 'published'
  activeVersionId: { type: 'text', nullable: true }, // FK to agent_versions.id
  authorId: { type: 'text', nullable: true }, // Author identifier for multi-tenant filtering
  metadata: { type: 'jsonb', nullable: true }, // Additional metadata for the agent
  createdAt: { type: 'timestamp', nullable: false },
  updatedAt: { type: 'timestamp', nullable: false },
};

export const AGENT_VERSIONS_SCHEMA: Record<string, StorageColumn> = {
  id: { type: 'text', nullable: false, primaryKey: true }, // UUID
  agentId: { type: 'text', nullable: false },
  versionNumber: { type: 'integer', nullable: false },
  // Agent config fields
  name: { type: 'text', nullable: false }, // Agent display name
  description: { type: 'text', nullable: true },
  instructions: { type: 'text', nullable: false },
  model: { type: 'jsonb', nullable: false },
  tools: { type: 'jsonb', nullable: true },
  defaultOptions: { type: 'jsonb', nullable: true },
  workflows: { type: 'jsonb', nullable: true },
  agents: { type: 'jsonb', nullable: true },
  integrationTools: { type: 'jsonb', nullable: true },
  inputProcessors: { type: 'jsonb', nullable: true },
  outputProcessors: { type: 'jsonb', nullable: true },
  memory: { type: 'jsonb', nullable: true },
  scorers: { type: 'jsonb', nullable: true },
  // Version metadata
  changedFields: { type: 'jsonb', nullable: true }, // Array of field names
  changeMessage: { type: 'text', nullable: true },
  createdAt: { type: 'timestamp', nullable: false },
};

export const PROMPT_BLOCKS_SCHEMA: Record<string, StorageColumn> = {
  id: { type: 'text', nullable: false, primaryKey: true },
  status: { type: 'text', nullable: false }, // 'draft', 'published', or 'archived'
  activeVersionId: { type: 'text', nullable: true }, // FK to prompt_block_versions.id
  authorId: { type: 'text', nullable: true },
  metadata: { type: 'jsonb', nullable: true },
  createdAt: { type: 'timestamp', nullable: false },
  updatedAt: { type: 'timestamp', nullable: false },
};

export const PROMPT_BLOCK_VERSIONS_SCHEMA: Record<string, StorageColumn> = {
  id: { type: 'text', nullable: false, primaryKey: true },
  blockId: { type: 'text', nullable: false },
  versionNumber: { type: 'integer', nullable: false },
  name: { type: 'text', nullable: false },
  description: { type: 'text', nullable: true },
  content: { type: 'text', nullable: false },
  rules: { type: 'jsonb', nullable: true },
  changedFields: { type: 'jsonb', nullable: true },
  changeMessage: { type: 'text', nullable: true },
  createdAt: { type: 'timestamp', nullable: false },
};

export const OBSERVATIONAL_MEMORY_SCHEMA: Record<string, StorageColumn> = {
  id: { type: 'text', nullable: false, primaryKey: true },
  lookupKey: { type: 'text', nullable: false }, // 'resource:{resourceId}' or 'thread:{threadId}'
  scope: { type: 'text', nullable: false }, // 'resource' or 'thread'
  resourceId: { type: 'text', nullable: true },
  threadId: { type: 'text', nullable: true },
  activeObservations: { type: 'text', nullable: false }, // JSON array of observations
  activeObservationsPendingUpdate: { type: 'text', nullable: true }, // JSON array, used during updates
  originType: { type: 'text', nullable: false }, // 'initialization', 'observation', or 'reflection'
  config: { type: 'text', nullable: false }, // JSON object
  generationCount: { type: 'integer', nullable: false },
  lastObservedAt: { type: 'timestamp', nullable: true },
  lastReflectionAt: { type: 'timestamp', nullable: true },
  pendingMessageTokens: { type: 'integer', nullable: false }, // Token count
  totalTokensObserved: { type: 'integer', nullable: false }, // Running total of all observed tokens
  observationTokenCount: { type: 'integer', nullable: false }, // Current observation size in tokens
  isObserving: { type: 'boolean', nullable: false },
  isReflecting: { type: 'boolean', nullable: false },
  observedMessageIds: { type: 'jsonb', nullable: true }, // JSON array of message IDs already observed
  observedTimezone: { type: 'text', nullable: true }, // Timezone used for Observer date formatting (e.g., "America/Los_Angeles")
  createdAt: { type: 'timestamp', nullable: false },
  updatedAt: { type: 'timestamp', nullable: false },
};

// Dataset schemas
export const DATASETS_SCHEMA: Record<string, StorageColumn> = {
  id: { type: 'text', nullable: false, primaryKey: true },
  name: { type: 'text', nullable: false },
  description: { type: 'text', nullable: true },
  metadata: { type: 'jsonb', nullable: true },
  inputSchema: { type: 'jsonb', nullable: true },
  outputSchema: { type: 'jsonb', nullable: true },
  version: { type: 'timestamp', nullable: false },
  createdAt: { type: 'timestamp', nullable: false },
  updatedAt: { type: 'timestamp', nullable: false },
};

export const DATASET_ITEMS_SCHEMA: Record<string, StorageColumn> = {
  id: { type: 'text', nullable: false, primaryKey: true },
  datasetId: { type: 'text', nullable: false },
  version: { type: 'timestamp', nullable: false },
  input: { type: 'jsonb', nullable: false },
  expectedOutput: { type: 'jsonb', nullable: true },
  context: { type: 'jsonb', nullable: true },
  createdAt: { type: 'timestamp', nullable: false },
  updatedAt: { type: 'timestamp', nullable: false },
};

export const DATASET_ITEM_VERSIONS_SCHEMA: Record<string, StorageColumn> = {
  id: { type: 'text', nullable: false, primaryKey: true },
  itemId: { type: 'text', nullable: false },
  datasetId: { type: 'text', nullable: false },
  versionNumber: { type: 'integer', nullable: false },
  datasetVersion: { type: 'timestamp', nullable: false },
  snapshot: { type: 'jsonb', nullable: true },
  isDeleted: { type: 'boolean', nullable: false },
  createdAt: { type: 'timestamp', nullable: false },
};

export const DATASET_VERSIONS_SCHEMA: Record<string, StorageColumn> = {
  id: { type: 'text', nullable: false, primaryKey: true },
  datasetId: { type: 'text', nullable: false },
  version: { type: 'timestamp', nullable: false },
  createdAt: { type: 'timestamp', nullable: false },
};

// Run schemas
export const RUNS_SCHEMA: Record<string, StorageColumn> = {
  id: { type: 'text', nullable: false, primaryKey: true },
  datasetId: { type: 'text', nullable: false },
  datasetVersion: { type: 'timestamp', nullable: false },
  targetType: { type: 'text', nullable: false },
  targetId: { type: 'text', nullable: false },
  status: { type: 'text', nullable: false },
  totalItems: { type: 'integer', nullable: false },
  succeededCount: { type: 'integer', nullable: false },
  failedCount: { type: 'integer', nullable: false },
  startedAt: { type: 'timestamp', nullable: true },
  completedAt: { type: 'timestamp', nullable: true },
  createdAt: { type: 'timestamp', nullable: false },
  updatedAt: { type: 'timestamp', nullable: false },
};

export const RUN_RESULTS_SCHEMA: Record<string, StorageColumn> = {
  id: { type: 'text', nullable: false, primaryKey: true },
  runId: { type: 'text', nullable: false },
  itemId: { type: 'text', nullable: false },
  itemVersion: { type: 'timestamp', nullable: false },
  input: { type: 'jsonb', nullable: false },
  output: { type: 'jsonb', nullable: true },
  expectedOutput: { type: 'jsonb', nullable: true },
  latency: { type: 'integer', nullable: false },
  error: { type: 'text', nullable: true },
  startedAt: { type: 'timestamp', nullable: false },
  completedAt: { type: 'timestamp', nullable: false },
  retryCount: { type: 'integer', nullable: false },
  traceId: { type: 'text', nullable: true },
  scores: { type: 'jsonb', nullable: true },
  createdAt: { type: 'timestamp', nullable: false },
};

// Aliases for experiment schemas (used by LibSQL runs adapter)
export const DATASET_EXPERIMENTS_SCHEMA = RUNS_SCHEMA;
export const DATASET_EXPERIMENT_RESULTS_SCHEMA = RUN_RESULTS_SCHEMA;

/**
 * Schema definitions for all core tables.
 */
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
      type: 'jsonb',
    },
    createdAt: {
      type: 'timestamp',
    },
    updatedAt: {
      type: 'timestamp',
    },
  },
  [TABLE_SCORERS]: SCORERS_SCHEMA,
  [TABLE_THREADS]: {
    id: { type: 'text', nullable: false, primaryKey: true },
    resourceId: { type: 'text', nullable: false },
    title: { type: 'text', nullable: false },
    metadata: { type: 'jsonb', nullable: true },
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
  [TABLE_SPANS]: SPAN_SCHEMA,
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
  [TABLE_AGENTS]: AGENTS_SCHEMA,
  [TABLE_AGENT_VERSIONS]: AGENT_VERSIONS_SCHEMA,
  [TABLE_DATASETS]: DATASETS_SCHEMA,
  [TABLE_DATASET_ITEMS]: DATASET_ITEMS_SCHEMA,
  [TABLE_DATASET_ITEM_VERSIONS]: DATASET_ITEM_VERSIONS_SCHEMA,
  [TABLE_DATASET_VERSIONS]: DATASET_VERSIONS_SCHEMA,
  [TABLE_RUNS]: RUNS_SCHEMA,
  [TABLE_RUN_RESULTS]: RUN_RESULTS_SCHEMA,
  [TABLE_DATASET_EXPERIMENTS]: DATASET_EXPERIMENTS_SCHEMA,
  [TABLE_DATASET_EXPERIMENT_RESULTS]: DATASET_EXPERIMENT_RESULTS_SCHEMA,
  [TABLE_PROMPT_BLOCKS]: PROMPT_BLOCKS_SCHEMA,
  [TABLE_PROMPT_BLOCK_VERSIONS]: PROMPT_BLOCK_VERSIONS_SCHEMA,
};

/**
 * Schema for the observational memory table.
 * Exported separately as OM is optional and not part of TABLE_NAMES.
 */
export const OBSERVATIONAL_MEMORY_TABLE_SCHEMA = {
  [TABLE_OBSERVATIONAL_MEMORY]: OBSERVATIONAL_MEMORY_SCHEMA,
};
