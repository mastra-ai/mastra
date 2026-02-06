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

export type TABLE_NAMES =
  | typeof TABLE_WORKFLOW_SNAPSHOT
  | typeof TABLE_MESSAGES
  | typeof TABLE_THREADS
  | typeof TABLE_TRACES
  | typeof TABLE_RESOURCES
  | typeof TABLE_SCORERS
  | typeof TABLE_SPANS
  | typeof TABLE_AGENTS
  | typeof TABLE_AGENT_VERSIONS;

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
  bufferedReflectionTokens: { type: 'integer', nullable: true }, // Token count of buffered reflection
  reflectedObservationLineCount: { type: 'integer', nullable: true }, // Number of observation lines that were reflected on during async buffering
  bufferedObservationChunks: { type: 'jsonb', nullable: true }, // JSON array of BufferedObservationChunk objects
  isBufferingObservation: { type: 'boolean', nullable: false },
  isBufferingReflection: { type: 'boolean', nullable: false },
  lastBufferedAtTokens: { type: 'integer', nullable: false },
  createdAt: { type: 'timestamp', nullable: false },
  updatedAt: { type: 'timestamp', nullable: false },
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
};

/**
 * Schema for the observational memory table.
 * Exported separately as OM is optional and not part of TABLE_NAMES.
 */
export const OBSERVATIONAL_MEMORY_TABLE_SCHEMA = {
  [TABLE_OBSERVATIONAL_MEMORY]: OBSERVATIONAL_MEMORY_SCHEMA,
};
