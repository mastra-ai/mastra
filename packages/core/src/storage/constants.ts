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
/** Table for stored scorer definitions (not score results) */
export const TABLE_STORED_SCORERS = 'mastra_stored_scorers';
/** Table for dynamic agent-scorer assignments */
export const TABLE_AGENT_SCORER_ASSIGNMENTS = 'mastra_agent_scorer_assignments';

export type TABLE_NAMES =
  | typeof TABLE_WORKFLOW_SNAPSHOT
  | typeof TABLE_MESSAGES
  | typeof TABLE_THREADS
  | typeof TABLE_TRACES
  | typeof TABLE_RESOURCES
  | typeof TABLE_SCORERS
  | typeof TABLE_SPANS
  | typeof TABLE_AGENTS
  | typeof TABLE_STORED_SCORERS
  | typeof TABLE_AGENT_SCORER_ASSIGNMENTS;

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
  name: { type: 'text', nullable: false },
  description: { type: 'text', nullable: true },
  instructions: { type: 'text', nullable: false }, // System instructions for the agent
  model: { type: 'jsonb', nullable: false }, // Model configuration (provider, name, etc.)
  tools: { type: 'jsonb', nullable: true }, // Serialized tool references/configurations
  defaultOptions: { type: 'jsonb', nullable: true }, // Default options for generate/stream calls
  workflows: { type: 'jsonb', nullable: true }, // Workflow references (IDs or configurations)
  agents: { type: 'jsonb', nullable: true }, // Sub-agent references (IDs or configurations)
  inputProcessors: { type: 'jsonb', nullable: true }, // Input processor configurations
  outputProcessors: { type: 'jsonb', nullable: true }, // Output processor configurations
  memory: { type: 'jsonb', nullable: true }, // Memory configuration
  scorers: { type: 'jsonb', nullable: true }, // Scorer configurations
  metadata: { type: 'jsonb', nullable: true }, // Additional metadata for the agent
  createdAt: { type: 'timestamp', nullable: false },
  updatedAt: { type: 'timestamp', nullable: false },
};

/**
 * Schema for stored scorer definitions.
 * These are scorer configurations that can be created via API and instantiated at runtime.
 */
export const STORED_SCORERS_SCHEMA: Record<string, StorageColumn> = {
  id: { type: 'text', nullable: false, primaryKey: true },
  name: { type: 'text', nullable: false },
  description: { type: 'text', nullable: false },
  type: { type: 'jsonb', nullable: true }, // 'agent' string or { inputSchema, outputSchema } object
  judge: { type: 'jsonb', nullable: true }, // { model: string, instructions: string }
  steps: { type: 'jsonb', nullable: false }, // Array of step configurations
  sampling: { type: 'jsonb', nullable: true }, // { type: 'ratio'|'count', rate?, count? }
  metadata: { type: 'jsonb', nullable: true },
  createdAt: { type: 'timestamp', nullable: false },
  updatedAt: { type: 'timestamp', nullable: false },
};

/**
 * Schema for dynamic agent-scorer assignments.
 * Links agents to stored scorers for UI-based scorer management.
 */
export const AGENT_SCORER_ASSIGNMENTS_SCHEMA: Record<string, StorageColumn> = {
  id: { type: 'text', nullable: false, primaryKey: true },
  agentId: { type: 'text', nullable: false },
  scorerId: { type: 'text', nullable: false }, // References TABLE_STORED_SCORERS
  sampling: { type: 'jsonb', nullable: true }, // Override sampling config for this assignment
  enabled: { type: 'boolean', nullable: false },
  priority: { type: 'integer', nullable: true }, // Lower = higher priority
  metadata: { type: 'jsonb', nullable: true },
  createdAt: { type: 'timestamp', nullable: false },
  updatedAt: { type: 'timestamp', nullable: false },
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
  [TABLE_STORED_SCORERS]: STORED_SCORERS_SCHEMA,
  [TABLE_AGENT_SCORER_ASSIGNMENTS]: AGENT_SCORER_ASSIGNMENTS_SCHEMA,
};
