import { spanRecordSchema } from './domains/observability';
import { buildStorageSchema } from './types';
import type { StorageColumn, StorageTableConfig } from './types';

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
export const TABLE_SCORER_DEFINITIONS = 'mastra_scorer_definitions';
export const TABLE_SCORER_DEFINITION_VERSIONS = 'mastra_scorer_definition_versions';
export const TABLE_MCP_CLIENTS = 'mastra_mcp_clients';
export const TABLE_MCP_CLIENT_VERSIONS = 'mastra_mcp_client_versions';
export const TABLE_MCP_SERVERS = 'mastra_mcp_servers';
export const TABLE_MCP_SERVER_VERSIONS = 'mastra_mcp_server_versions';
export const TABLE_WORKSPACES = 'mastra_workspaces';
export const TABLE_WORKSPACE_VERSIONS = 'mastra_workspace_versions';
export const TABLE_SKILLS = 'mastra_skills';
export const TABLE_SKILL_VERSIONS = 'mastra_skill_versions';
export const TABLE_SKILL_BLOBS = 'mastra_skill_blobs';
export const TABLE_STARS = 'mastra_stars';

// Dataset tables
export const TABLE_DATASETS = 'mastra_datasets';
export const TABLE_DATASET_ITEMS = 'mastra_dataset_items';
export const TABLE_DATASET_VERSIONS = 'mastra_dataset_versions';

// Experiment tables
export const TABLE_EXPERIMENTS = 'mastra_experiments';
export const TABLE_EXPERIMENT_RESULTS = 'mastra_experiment_results';
export const TABLE_BACKGROUND_TASKS = 'mastra_background_tasks';

// Schedules tables
export const TABLE_SCHEDULES = 'mastra_schedules';
export const TABLE_SCHEDULE_TRIGGERS = 'mastra_schedule_triggers';

// Channel tables
export const TABLE_CHANNEL_INSTALLATIONS = 'mastra_channel_installations';
export const TABLE_CHANNEL_CONFIG = 'mastra_channel_config';

/** Union of all core table name constants. */
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
  | typeof TABLE_PROMPT_BLOCKS
  | typeof TABLE_PROMPT_BLOCK_VERSIONS
  | typeof TABLE_SCORER_DEFINITIONS
  | typeof TABLE_SCORER_DEFINITION_VERSIONS
  | typeof TABLE_MCP_CLIENTS
  | typeof TABLE_MCP_CLIENT_VERSIONS
  | typeof TABLE_MCP_SERVERS
  | typeof TABLE_MCP_SERVER_VERSIONS
  | typeof TABLE_WORKSPACES
  | typeof TABLE_WORKSPACE_VERSIONS
  | typeof TABLE_SKILLS
  | typeof TABLE_SKILL_VERSIONS
  | typeof TABLE_SKILL_BLOBS
  | typeof TABLE_DATASETS
  | typeof TABLE_DATASET_ITEMS
  | typeof TABLE_DATASET_VERSIONS
  | typeof TABLE_EXPERIMENTS
  | typeof TABLE_EXPERIMENT_RESULTS
  | typeof TABLE_BACKGROUND_TASKS
  | typeof TABLE_STARS
  | typeof TABLE_SCHEDULES
  | typeof TABLE_SCHEDULE_TRIGGERS
  | typeof TABLE_CHANNEL_INSTALLATIONS
  | typeof TABLE_CHANNEL_CONFIG;

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
  visibility: { type: 'text', nullable: true }, // 'private' | 'public' | null (legacy)
  metadata: { type: 'jsonb', nullable: true }, // Additional metadata for the agent
  starCount: { type: 'integer', nullable: true }, // Denormalised count of stars for this agent
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
  mcpClients: { type: 'jsonb', nullable: true },
  requestContextSchema: { type: 'jsonb', nullable: true },
  workspace: { type: 'jsonb', nullable: true },
  skills: { type: 'jsonb', nullable: true },
  skillsFormat: { type: 'text', nullable: true },
  browser: { type: 'jsonb', nullable: true },
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
  requestContextSchema: { type: 'jsonb', nullable: true },
  changedFields: { type: 'jsonb', nullable: true },
  changeMessage: { type: 'text', nullable: true },
  createdAt: { type: 'timestamp', nullable: false },
};

export const SCORER_DEFINITIONS_SCHEMA: Record<string, StorageColumn> = {
  id: { type: 'text', nullable: false, primaryKey: true },
  status: { type: 'text', nullable: false }, // 'draft', 'published', or 'archived'
  activeVersionId: { type: 'text', nullable: true }, // FK to scorer_definition_versions.id
  authorId: { type: 'text', nullable: true },
  metadata: { type: 'jsonb', nullable: true },
  createdAt: { type: 'timestamp', nullable: false },
  updatedAt: { type: 'timestamp', nullable: false },
};

export const SCORER_DEFINITION_VERSIONS_SCHEMA: Record<string, StorageColumn> = {
  id: { type: 'text', nullable: false, primaryKey: true },
  scorerDefinitionId: { type: 'text', nullable: false },
  versionNumber: { type: 'integer', nullable: false },
  name: { type: 'text', nullable: false },
  description: { type: 'text', nullable: true },
  type: { type: 'text', nullable: false }, // 'llm-judge', 'bias', 'toxicity', etc.
  model: { type: 'jsonb', nullable: true },
  instructions: { type: 'text', nullable: true },
  scoreRange: { type: 'jsonb', nullable: true },
  presetConfig: { type: 'jsonb', nullable: true },
  defaultSampling: { type: 'jsonb', nullable: true },
  changedFields: { type: 'jsonb', nullable: true },
  changeMessage: { type: 'text', nullable: true },
  createdAt: { type: 'timestamp', nullable: false },
};

export const MCP_CLIENTS_SCHEMA: Record<string, StorageColumn> = {
  id: { type: 'text', nullable: false, primaryKey: true },
  status: { type: 'text', nullable: false }, // 'draft', 'published', or 'archived'
  activeVersionId: { type: 'text', nullable: true }, // FK to mcp_client_versions.id
  authorId: { type: 'text', nullable: true },
  metadata: { type: 'jsonb', nullable: true },
  createdAt: { type: 'timestamp', nullable: false },
  updatedAt: { type: 'timestamp', nullable: false },
};

export const MCP_CLIENT_VERSIONS_SCHEMA: Record<string, StorageColumn> = {
  id: { type: 'text', nullable: false, primaryKey: true },
  mcpClientId: { type: 'text', nullable: false },
  versionNumber: { type: 'integer', nullable: false },
  name: { type: 'text', nullable: false },
  description: { type: 'text', nullable: true },
  servers: { type: 'jsonb', nullable: false },
  changedFields: { type: 'jsonb', nullable: true },
  changeMessage: { type: 'text', nullable: true },
  createdAt: { type: 'timestamp', nullable: false },
};

export const MCP_SERVERS_SCHEMA: Record<string, StorageColumn> = {
  id: { type: 'text', nullable: false, primaryKey: true },
  status: { type: 'text', nullable: false }, // 'draft', 'published', or 'archived'
  activeVersionId: { type: 'text', nullable: true }, // FK to mcp_server_versions.id
  authorId: { type: 'text', nullable: true },
  metadata: { type: 'jsonb', nullable: true },
  createdAt: { type: 'timestamp', nullable: false },
  updatedAt: { type: 'timestamp', nullable: false },
};

export const MCP_SERVER_VERSIONS_SCHEMA: Record<string, StorageColumn> = {
  id: { type: 'text', nullable: false, primaryKey: true },
  mcpServerId: { type: 'text', nullable: false },
  versionNumber: { type: 'integer', nullable: false },
  name: { type: 'text', nullable: false },
  version: { type: 'text', nullable: false },
  description: { type: 'text', nullable: true },
  instructions: { type: 'text', nullable: true },
  repository: { type: 'jsonb', nullable: true },
  releaseDate: { type: 'text', nullable: true },
  isLatest: { type: 'boolean', nullable: true },
  packageCanonical: { type: 'text', nullable: true },
  tools: { type: 'jsonb', nullable: true },
  agents: { type: 'jsonb', nullable: true },
  workflows: { type: 'jsonb', nullable: true },
  changedFields: { type: 'jsonb', nullable: true },
  changeMessage: { type: 'text', nullable: true },
  createdAt: { type: 'timestamp', nullable: false },
};

export const WORKSPACES_SCHEMA: Record<string, StorageColumn> = {
  id: { type: 'text', nullable: false, primaryKey: true },
  status: { type: 'text', nullable: false }, // 'draft', 'published', or 'archived'
  activeVersionId: { type: 'text', nullable: true }, // FK to workspace_versions.id
  authorId: { type: 'text', nullable: true },
  metadata: { type: 'jsonb', nullable: true },
  createdAt: { type: 'timestamp', nullable: false },
  updatedAt: { type: 'timestamp', nullable: false },
};

export const WORKSPACE_VERSIONS_SCHEMA: Record<string, StorageColumn> = {
  id: { type: 'text', nullable: false, primaryKey: true },
  workspaceId: { type: 'text', nullable: false },
  versionNumber: { type: 'integer', nullable: false },
  name: { type: 'text', nullable: false },
  description: { type: 'text', nullable: true },
  filesystem: { type: 'jsonb', nullable: true },
  sandbox: { type: 'jsonb', nullable: true },
  mounts: { type: 'jsonb', nullable: true },
  search: { type: 'jsonb', nullable: true },
  skills: { type: 'jsonb', nullable: true },
  tools: { type: 'jsonb', nullable: true },
  autoSync: { type: 'boolean', nullable: true },
  operationTimeout: { type: 'integer', nullable: true },
  changedFields: { type: 'jsonb', nullable: true },
  changeMessage: { type: 'text', nullable: true },
  createdAt: { type: 'timestamp', nullable: false },
};

export const SKILLS_SCHEMA: Record<string, StorageColumn> = {
  id: { type: 'text', nullable: false, primaryKey: true },
  status: { type: 'text', nullable: false }, // 'draft', 'published', or 'archived'
  activeVersionId: { type: 'text', nullable: true }, // FK to skill_versions.id
  authorId: { type: 'text', nullable: true },
  visibility: { type: 'text', nullable: true }, // 'private' | 'public' | null (legacy)
  starCount: { type: 'integer', nullable: true }, // Denormalised count of stars for this skill
  createdAt: { type: 'timestamp', nullable: false },
  updatedAt: { type: 'timestamp', nullable: false },
};

export const STARS_SCHEMA: Record<string, StorageColumn> = {
  userId: { type: 'text', nullable: false },
  entityType: { type: 'text', nullable: false }, // 'agent' | 'skill'
  entityId: { type: 'text', nullable: false },
  createdAt: { type: 'timestamp', nullable: false },
};

export const SKILL_VERSIONS_SCHEMA: Record<string, StorageColumn> = {
  id: { type: 'text', nullable: false, primaryKey: true },
  skillId: { type: 'text', nullable: false },
  versionNumber: { type: 'integer', nullable: false },
  name: { type: 'text', nullable: false },
  description: { type: 'text', nullable: false },
  instructions: { type: 'text', nullable: false },
  license: { type: 'text', nullable: true },
  compatibility: { type: 'jsonb', nullable: true },
  source: { type: 'jsonb', nullable: true },
  references: { type: 'jsonb', nullable: true },
  scripts: { type: 'jsonb', nullable: true },
  assets: { type: 'jsonb', nullable: true },
  files: { type: 'jsonb', nullable: true },
  metadata: { type: 'jsonb', nullable: true },
  tree: { type: 'jsonb', nullable: true },
  changedFields: { type: 'jsonb', nullable: true },
  changeMessage: { type: 'text', nullable: true },
  createdAt: { type: 'timestamp', nullable: false },
};

export const SKILL_BLOBS_SCHEMA: Record<string, StorageColumn> = {
  hash: { type: 'text', nullable: false, primaryKey: true },
  content: { type: 'text', nullable: false },
  size: { type: 'integer', nullable: false },
  mimeType: { type: 'text', nullable: true },
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
  // Async buffering columns
  bufferedObservations: { type: 'text', nullable: true }, // JSON string of buffered observation content
  bufferedObservationTokens: { type: 'integer', nullable: true }, // Token count of buffered observations
  bufferedMessageIds: { type: 'jsonb', nullable: true }, // JSON array of message IDs in the buffer
  bufferedReflection: { type: 'text', nullable: true }, // JSON string of buffered reflection content
  bufferedReflectionTokens: { type: 'integer', nullable: true }, // Token count of buffered reflection (post-compression)
  bufferedReflectionInputTokens: { type: 'integer', nullable: true }, // Token count of observations fed to reflector (pre-compression)
  reflectedObservationLineCount: { type: 'integer', nullable: true }, // Number of observation lines that were reflected on during async buffering
  bufferedObservationChunks: { type: 'jsonb', nullable: true }, // JSON array of BufferedObservationChunk objects
  isBufferingObservation: { type: 'boolean', nullable: false },
  isBufferingReflection: { type: 'boolean', nullable: false },
  lastBufferedAtTokens: { type: 'integer', nullable: false },
  lastBufferedAtTime: { type: 'timestamp', nullable: true },
  metadata: { type: 'jsonb', nullable: true },
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
  groundTruthSchema: { type: 'jsonb', nullable: true },
  requestContextSchema: { type: 'jsonb', nullable: true },
  tags: { type: 'jsonb', nullable: true },
  targetType: { type: 'text', nullable: true },
  targetIds: { type: 'jsonb', nullable: true },
  scorerIds: { type: 'jsonb', nullable: true },
  version: { type: 'integer', nullable: false },
  createdAt: { type: 'timestamp', nullable: false },
  updatedAt: { type: 'timestamp', nullable: false },
};

export const DATASET_ITEMS_SCHEMA: Record<string, StorageColumn> = {
  id: { type: 'text', nullable: false },
  datasetId: { type: 'text', nullable: false, references: { table: 'mastra_datasets', column: 'id' } },
  datasetVersion: { type: 'integer', nullable: false },
  validTo: { type: 'integer', nullable: true },
  isDeleted: { type: 'boolean', nullable: false },
  input: { type: 'jsonb', nullable: false },
  groundTruth: { type: 'jsonb', nullable: true },
  requestContext: { type: 'jsonb', nullable: true },
  metadata: { type: 'jsonb', nullable: true },
  source: { type: 'jsonb', nullable: true },
  expectedTrajectory: { type: 'jsonb', nullable: true },
  createdAt: { type: 'timestamp', nullable: false },
  updatedAt: { type: 'timestamp', nullable: false },
};

export const DATASET_VERSIONS_SCHEMA: Record<string, StorageColumn> = {
  id: { type: 'text', nullable: false, primaryKey: true },
  datasetId: { type: 'text', nullable: false, references: { table: 'mastra_datasets', column: 'id' } },
  version: { type: 'integer', nullable: false },
  createdAt: { type: 'timestamp', nullable: false },
};

// Experiment schemas
export const EXPERIMENTS_SCHEMA: Record<string, StorageColumn> = {
  id: { type: 'text', nullable: false, primaryKey: true },
  name: { type: 'text', nullable: true },
  description: { type: 'text', nullable: true },
  metadata: { type: 'jsonb', nullable: true },
  datasetId: { type: 'text', nullable: true, references: { table: 'mastra_datasets', column: 'id' } },
  datasetVersion: { type: 'integer', nullable: true },
  targetType: { type: 'text', nullable: false },
  targetId: { type: 'text', nullable: false },
  status: { type: 'text', nullable: false },
  totalItems: { type: 'integer', nullable: false },
  succeededCount: { type: 'integer', nullable: false },
  failedCount: { type: 'integer', nullable: false },
  skippedCount: { type: 'integer', nullable: false },
  startedAt: { type: 'timestamp', nullable: true },
  completedAt: { type: 'timestamp', nullable: true },
  agentVersion: { type: 'text', nullable: true },
  createdAt: { type: 'timestamp', nullable: false },
  updatedAt: { type: 'timestamp', nullable: false },
};

export const EXPERIMENT_RESULTS_SCHEMA: Record<string, StorageColumn> = {
  id: { type: 'text', nullable: false, primaryKey: true },
  experimentId: { type: 'text', nullable: false, references: { table: 'mastra_experiments', column: 'id' } },
  itemId: { type: 'text', nullable: false, references: { table: 'mastra_dataset_items', column: 'id' } },
  itemDatasetVersion: { type: 'integer', nullable: true },
  input: { type: 'jsonb', nullable: false },
  output: { type: 'jsonb', nullable: true },
  groundTruth: { type: 'jsonb', nullable: true },
  error: { type: 'jsonb', nullable: true },
  startedAt: { type: 'timestamp', nullable: false },
  completedAt: { type: 'timestamp', nullable: false },
  retryCount: { type: 'integer', nullable: false },
  traceId: { type: 'text', nullable: true },
  status: { type: 'text', nullable: true },
  tags: { type: 'jsonb', nullable: true },
  createdAt: { type: 'timestamp', nullable: false },
};

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
  [TABLE_PROMPT_BLOCKS]: PROMPT_BLOCKS_SCHEMA,
  [TABLE_PROMPT_BLOCK_VERSIONS]: PROMPT_BLOCK_VERSIONS_SCHEMA,
  [TABLE_SCORER_DEFINITIONS]: SCORER_DEFINITIONS_SCHEMA,
  [TABLE_SCORER_DEFINITION_VERSIONS]: SCORER_DEFINITION_VERSIONS_SCHEMA,
  [TABLE_MCP_CLIENTS]: MCP_CLIENTS_SCHEMA,
  [TABLE_MCP_CLIENT_VERSIONS]: MCP_CLIENT_VERSIONS_SCHEMA,
  [TABLE_MCP_SERVERS]: MCP_SERVERS_SCHEMA,
  [TABLE_MCP_SERVER_VERSIONS]: MCP_SERVER_VERSIONS_SCHEMA,
  [TABLE_WORKSPACES]: WORKSPACES_SCHEMA,
  [TABLE_WORKSPACE_VERSIONS]: WORKSPACE_VERSIONS_SCHEMA,
  [TABLE_SKILLS]: SKILLS_SCHEMA,
  [TABLE_SKILL_VERSIONS]: SKILL_VERSIONS_SCHEMA,
  [TABLE_SKILL_BLOBS]: SKILL_BLOBS_SCHEMA,
  [TABLE_DATASETS]: DATASETS_SCHEMA,
  [TABLE_DATASET_ITEMS]: DATASET_ITEMS_SCHEMA,
  [TABLE_DATASET_VERSIONS]: DATASET_VERSIONS_SCHEMA,
  [TABLE_EXPERIMENTS]: EXPERIMENTS_SCHEMA,
  [TABLE_EXPERIMENT_RESULTS]: EXPERIMENT_RESULTS_SCHEMA,
  [TABLE_STARS]: STARS_SCHEMA,
  [TABLE_BACKGROUND_TASKS]: {
    id: { type: 'text', nullable: false, primaryKey: true },
    tool_call_id: { type: 'text', nullable: false },
    tool_name: { type: 'text', nullable: false },
    agent_id: { type: 'text', nullable: false },
    run_id: { type: 'text', nullable: false },
    thread_id: { type: 'text', nullable: true },
    resource_id: { type: 'text', nullable: true },
    status: { type: 'text', nullable: false },
    args: { type: 'jsonb', nullable: false },
    result: { type: 'jsonb', nullable: true },
    error: { type: 'jsonb', nullable: true },
    retry_count: { type: 'integer', nullable: false },
    max_retries: { type: 'integer', nullable: false },
    timeout_ms: { type: 'integer', nullable: false },
    createdAt: { type: 'timestamp', nullable: false },
    startedAt: { type: 'timestamp', nullable: true },
    completedAt: { type: 'timestamp', nullable: true },
  },
  [TABLE_SCHEDULES]: {
    id: { type: 'text', nullable: false, primaryKey: true },
    target: { type: 'jsonb', nullable: false },
    cron: { type: 'text', nullable: false },
    timezone: { type: 'text', nullable: true },
    status: { type: 'text', nullable: false },
    next_fire_at: { type: 'bigint', nullable: false },
    last_fire_at: { type: 'bigint', nullable: true },
    last_run_id: { type: 'text', nullable: true },
    created_at: { type: 'bigint', nullable: false },
    updated_at: { type: 'bigint', nullable: false },
    metadata: { type: 'jsonb', nullable: true },
    owner_type: { type: 'text', nullable: true },
    owner_id: { type: 'text', nullable: true },
  },
  [TABLE_SCHEDULE_TRIGGERS]: {
    id: { type: 'text', nullable: false, primaryKey: true },
    schedule_id: { type: 'text', nullable: false },
    run_id: { type: 'text', nullable: true },
    scheduled_fire_at: { type: 'bigint', nullable: false },
    actual_fire_at: { type: 'bigint', nullable: false },
    outcome: { type: 'text', nullable: false },
    error: { type: 'text', nullable: true },
    trigger_kind: { type: 'text', nullable: false },
    parent_trigger_id: { type: 'text', nullable: true },
    metadata: { type: 'jsonb', nullable: true },
  },
  [TABLE_CHANNEL_INSTALLATIONS]: {
    id: { type: 'text', nullable: false, primaryKey: true },
    platform: { type: 'text', nullable: false },
    agentId: { type: 'text', nullable: false },
    status: { type: 'text', nullable: false },
    webhookId: { type: 'text', nullable: true },
    data: { type: 'jsonb', nullable: false },
    configHash: { type: 'text', nullable: true },
    error: { type: 'text', nullable: true },
    createdAt: { type: 'timestamp', nullable: false },
    updatedAt: { type: 'timestamp', nullable: false },
  },
  [TABLE_CHANNEL_CONFIG]: {
    platform: { type: 'text', nullable: false, primaryKey: true },
    data: { type: 'jsonb', nullable: false },
    updatedAt: { type: 'timestamp', nullable: false },
  },
};

/**
 * Table-level config for tables that need composite primary keys or other table-level settings.
 * Keyed by table name. Tables not listed here use single-column PKs from their schema.
 */
export const TABLE_CONFIGS: Partial<Record<TABLE_NAMES, StorageTableConfig>> = {
  [TABLE_DATASET_ITEMS]: { columns: DATASET_ITEMS_SCHEMA, compositePrimaryKey: ['id', 'datasetVersion'] },
  [TABLE_STARS]: { columns: STARS_SCHEMA, compositePrimaryKey: ['userId', 'entityType', 'entityId'] },
};

/**
 * Schema for the observational memory table.
 * Exported separately as OM is optional and not part of TABLE_NAMES.
 */
export const OBSERVATIONAL_MEMORY_TABLE_SCHEMA = {
  [TABLE_OBSERVATIONAL_MEMORY]: OBSERVATIONAL_MEMORY_SCHEMA,
};
