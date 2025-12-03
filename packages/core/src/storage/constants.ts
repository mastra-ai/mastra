import type { StorageColumn } from './types';

export const TABLE_WORKFLOW_SNAPSHOT = 'mastra_workflow_snapshot';
export const TABLE_MESSAGES = 'mastra_messages';
export const TABLE_THREADS = 'mastra_threads';
export const TABLE_TRACES = 'mastra_traces';
export const TABLE_RESOURCES = 'mastra_resources';
export const TABLE_SCORERS = 'mastra_scorers';
export const TABLE_SPANS = 'mastra_ai_spans';

export type TABLE_NAMES =
  | typeof TABLE_WORKFLOW_SNAPSHOT
  | typeof TABLE_MESSAGES
  | typeof TABLE_THREADS
  | typeof TABLE_TRACES
  | typeof TABLE_RESOURCES
  | typeof TABLE_SCORERS
  | typeof TABLE_SPANS;

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

export const SPAN_SCHEMA: Record<string, StorageColumn> = {
  // Composite primary key of traceId and spanId
  traceId: { type: 'text', nullable: false }, // Unique trace identifier
  spanId: { type: 'text', nullable: false }, // Unique span identifier within the trace
  parentSpanId: { type: 'text', nullable: true }, // Parent span reference (null = root span)
  name: { type: 'text', nullable: false }, // Human-readable span name
  scope: { type: 'jsonb', nullable: true }, // Mastra package versions {"core": "1.0.0", "memory": "1.0.0"}
  spanType: { type: 'text', nullable: false }, // WORKFLOW_RUN, WORKFLOW_STEP, AGENT_RUN, AGENT_STEP, TOOL_RUN, TOOL_STEP, etc.

  // Entity identification - first-class fields for filtering
  entityType: { type: 'text', nullable: true }, // 'agent' | 'workflow' | 'tool' | 'network' | 'step'
  entityId: { type: 'text', nullable: true }, // ID/name of the entity (e.g., 'weatherAgent', 'orderWorkflow')
  entityName: { type: 'text', nullable: true }, // Human-readable display name

  // Identity & Tenancy
  userId: { type: 'text', nullable: true }, // Human end-user who triggered the trace
  organizationId: { type: 'text', nullable: true }, // Multi-tenant organization/account
  resourceId: { type: 'text', nullable: true }, // Broader resource context (Mastra memory compatibility)

  // Correlation IDs
  runId: { type: 'text', nullable: true }, // Unique execution run identifier
  sessionId: { type: 'text', nullable: true }, // Session identifier for grouping traces
  threadId: { type: 'text', nullable: true }, // Conversation thread identifier
  requestId: { type: 'text', nullable: true }, // HTTP request ID for log correlation

  // Deployment context
  environment: { type: 'text', nullable: true }, // 'production' | 'staging' | 'development'
  source: { type: 'text', nullable: true }, // 'local' | 'cloud' | 'ci'
  serviceName: { type: 'text', nullable: true }, // Name of the service
  deploymentId: { type: 'text', nullable: true }, // Specific deployment/release identifier
  versionInfo: { type: 'jsonb', nullable: true }, // App version info {"app": "1.0.0", "gitSha": "abc123"}

  // Span data
  attributes: { type: 'jsonb', nullable: true }, // Span-type specific attributes (e.g., model, tokens, tools)
  metadata: { type: 'jsonb', nullable: true }, // User-defined metadata for custom filtering
  tags: { type: 'jsonb', nullable: true }, // string[] - labels for filtering traces
  links: { type: 'jsonb', nullable: true }, // References to related spans in other traces
  input: { type: 'jsonb', nullable: true }, // Input data passed to the span
  output: { type: 'jsonb', nullable: true }, // Output data returned from the span
  error: { type: 'jsonb', nullable: true }, // Error info - presence indicates failure

  // Timestamps
  startedAt: { type: 'timestamp', nullable: false }, // When the span started
  endedAt: { type: 'timestamp', nullable: true }, // When the span ended (null = running)
  createdAt: { type: 'timestamp', nullable: false }, // Database record creation time
  updatedAt: { type: 'timestamp', nullable: true }, // Database record last update time

  isEvent: { type: 'boolean', nullable: false }, // Whether this is an event (point-in-time) vs a span (duration)
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
};
