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
export const TABLE_STORED_SCORERS = 'mastra_stored_scorers';
export const TABLE_STORED_SCORER_VERSIONS = 'mastra_stored_scorer_versions';
export const TABLE_INTEGRATIONS = 'mastra_integrations';
export const TABLE_CACHED_TOOLS = 'mastra_cached_tools';
export const TABLE_WORKFLOW_DEFINITIONS = 'mastra_workflow_definitions';
export const TABLE_WORKFLOW_DEFINITION_VERSIONS = 'mastra_workflow_definition_versions';
export const TABLE_AUDIT = 'mastra_audit';

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
  | typeof TABLE_STORED_SCORERS
  | typeof TABLE_STORED_SCORER_VERSIONS
  | typeof TABLE_INTEGRATIONS
  | typeof TABLE_CACHED_TOOLS
  | typeof TABLE_WORKFLOW_DEFINITIONS
  | typeof TABLE_WORKFLOW_DEFINITION_VERSIONS
  | typeof TABLE_AUDIT;

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
  integrations: { type: 'jsonb', nullable: true }, // Integration IDs (backward compatibility)
  integrationTools: { type: 'jsonb', nullable: true }, // Specific integration tool IDs (provider_toolkit_tool format)
  inputProcessors: { type: 'jsonb', nullable: true }, // Input processor configurations
  outputProcessors: { type: 'jsonb', nullable: true }, // Output processor configurations
  memory: { type: 'jsonb', nullable: true }, // Memory configuration
  scorers: { type: 'jsonb', nullable: true }, // Scorer configurations
  metadata: { type: 'jsonb', nullable: true }, // Additional metadata for the agent
  ownerId: { type: 'text', nullable: true }, // Owner identifier for multi-tenant filtering
  activeVersionId: { type: 'text', nullable: true }, // FK to agent_versions.id
  createdAt: { type: 'timestamp', nullable: false },
  updatedAt: { type: 'timestamp', nullable: false },
};

export const AGENT_VERSIONS_SCHEMA: Record<string, StorageColumn> = {
  id: { type: 'text', nullable: false, primaryKey: true }, // UUID
  agentId: { type: 'text', nullable: false },
  versionNumber: { type: 'integer', nullable: false },
  name: { type: 'text', nullable: true }, // Vanity name
  snapshot: { type: 'jsonb', nullable: false }, // Full agent config
  changedFields: { type: 'jsonb', nullable: true }, // Array of field names
  changeMessage: { type: 'text', nullable: true },
  createdAt: { type: 'timestamp', nullable: false },
};

export const STORED_SCORERS_SCHEMA: Record<string, StorageColumn> = {
  id: { type: 'text', nullable: false, primaryKey: true },
  name: { type: 'text', nullable: false },
  description: { type: 'text', nullable: true },
  model: { type: 'jsonb', nullable: false }, // Model configuration (provider, name, toolChoice, reasoningEffort)
  prompt: { type: 'text', nullable: false }, // Judge prompt/instructions
  scoreRange: { type: 'jsonb', nullable: false }, // { min: number, max: number }
  metadata: { type: 'jsonb', nullable: true }, // Additional metadata
  ownerId: { type: 'text', nullable: true }, // Owner identifier for multi-tenant filtering
  activeVersionId: { type: 'text', nullable: true }, // FK to stored_scorer_versions.id
  createdAt: { type: 'timestamp', nullable: false },
  updatedAt: { type: 'timestamp', nullable: false },
};

export const STORED_SCORER_VERSIONS_SCHEMA: Record<string, StorageColumn> = {
  id: { type: 'text', nullable: false, primaryKey: true }, // UUID
  scorerId: { type: 'text', nullable: false }, // FK to stored_scorers.id
  versionNumber: { type: 'integer', nullable: false },
  name: { type: 'text', nullable: true }, // Vanity name
  snapshot: { type: 'jsonb', nullable: false }, // Full scorer config
  changedFields: { type: 'jsonb', nullable: true }, // Array of field names
  changeMessage: { type: 'text', nullable: true },
  createdAt: { type: 'timestamp', nullable: false },
};

export const INTEGRATIONS_SCHEMA: Record<string, StorageColumn> = {
  id: { type: 'text', nullable: false, primaryKey: true }, // UUID
  provider: { type: 'text', nullable: false }, // 'composio' | 'arcade'
  name: { type: 'text', nullable: false }, // Display name for the integration
  enabled: { type: 'boolean', nullable: false }, // Whether integration is active
  selectedToolkits: { type: 'jsonb', nullable: false }, // Array of toolkit slugs
  metadata: { type: 'jsonb', nullable: true }, // Provider-specific settings
  ownerId: { type: 'text', nullable: true }, // Multi-tenant support
  createdAt: { type: 'timestamp', nullable: false },
  updatedAt: { type: 'timestamp', nullable: false },
};

export const WORKFLOW_DEFINITIONS_SCHEMA: Record<string, StorageColumn> = {
  id: { type: 'text', nullable: false, primaryKey: true },
  name: { type: 'text', nullable: false },
  description: { type: 'text', nullable: true },
  inputSchema: { type: 'jsonb', nullable: false },
  outputSchema: { type: 'jsonb', nullable: false },
  stateSchema: { type: 'jsonb', nullable: true },
  stepGraph: { type: 'jsonb', nullable: false },
  steps: { type: 'jsonb', nullable: false },
  retryConfig: { type: 'jsonb', nullable: true },
  ownerId: { type: 'text', nullable: true },
  activeVersionId: { type: 'text', nullable: true },
  metadata: { type: 'jsonb', nullable: true },
  createdAt: { type: 'timestamp', nullable: false },
  updatedAt: { type: 'timestamp', nullable: false },
};

export const CACHED_TOOLS_SCHEMA: Record<string, StorageColumn> = {
  id: { type: 'text', nullable: false, primaryKey: true }, // UUID
  integrationId: { type: 'text', nullable: false }, // FK to integrations.id
  provider: { type: 'text', nullable: false }, // 'composio' | 'arcade'
  toolkitSlug: { type: 'text', nullable: false }, // Toolkit identifier
  toolSlug: { type: 'text', nullable: false }, // Tool identifier
  name: { type: 'text', nullable: false }, // Display name for the tool
  description: { type: 'text', nullable: true }, // Tool description
  inputSchema: { type: 'jsonb', nullable: false }, // JSON schema for input
  outputSchema: { type: 'jsonb', nullable: true }, // JSON schema for output
  rawDefinition: { type: 'jsonb', nullable: false }, // Full tool definition from provider
  createdAt: { type: 'timestamp', nullable: false }, // When tool was first cached (same as cachedAt for compatibility)
  cachedAt: { type: 'timestamp', nullable: false }, // When tool was cached
  updatedAt: { type: 'timestamp', nullable: false }, // When tool cache was last updated
};

export const WORKFLOW_DEFINITION_VERSIONS_SCHEMA: Record<string, StorageColumn> = {
  id: { type: 'text', nullable: false, primaryKey: true },
  workflowDefinitionId: { type: 'text', nullable: false },
  versionNumber: { type: 'integer', nullable: false },
  name: { type: 'text', nullable: true },
  snapshot: { type: 'jsonb', nullable: false },
  changedFields: { type: 'jsonb', nullable: true },
  changeMessage: { type: 'text', nullable: true },
  createdAt: { type: 'timestamp', nullable: false },
};

export const AUDIT_SCHEMA: Record<string, StorageColumn> = {
  id: { type: 'text', nullable: false, primaryKey: true },
  actorType: { type: 'text', nullable: false }, // 'user' | 'system' | 'apikey'
  actorId: { type: 'text', nullable: false },
  actorEmail: { type: 'text', nullable: true },
  actorIp: { type: 'text', nullable: true },
  actorUserAgent: { type: 'text', nullable: true },
  action: { type: 'text', nullable: false }, // e.g., 'auth.login', 'agent.execute'
  resourceType: { type: 'text', nullable: true },
  resourceId: { type: 'text', nullable: true },
  resourceName: { type: 'text', nullable: true },
  outcome: { type: 'text', nullable: false }, // 'success' | 'failure' | 'denied'
  metadata: { type: 'jsonb', nullable: true },
  duration: { type: 'integer', nullable: true }, // Duration in milliseconds
  createdAt: { type: 'timestamp', nullable: false },
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
  [TABLE_STORED_SCORERS]: STORED_SCORERS_SCHEMA,
  [TABLE_STORED_SCORER_VERSIONS]: STORED_SCORER_VERSIONS_SCHEMA,
  [TABLE_INTEGRATIONS]: INTEGRATIONS_SCHEMA,
  [TABLE_CACHED_TOOLS]: CACHED_TOOLS_SCHEMA,
  [TABLE_WORKFLOW_DEFINITIONS]: WORKFLOW_DEFINITIONS_SCHEMA,
  [TABLE_WORKFLOW_DEFINITION_VERSIONS]: WORKFLOW_DEFINITION_VERSIONS_SCHEMA,
  [TABLE_AUDIT]: AUDIT_SCHEMA,
};
