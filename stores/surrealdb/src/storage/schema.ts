import {
  TABLE_MESSAGES,
  TABLE_RESOURCES,
  TABLE_SCORERS,
  TABLE_SPANS,
  TABLE_THREADS,
  TABLE_WORKFLOW_SNAPSHOT,
} from '@mastra/core/storage';

/** Defined locally: older supported `@mastra/core` versions do not export it. */
export const TABLE_OBSERVATIONAL_MEMORY = 'mastra_observational_memory';
export const TABLE_OBSERVATIONAL_MEMORY_KEYS = 'mastra_observational_memory_keys';

/**
 * Record ids carry the natural keys (`mastra_threads:⟨threadId⟩`,
 * `mastra_workflow_snapshot:[workflowName, runId]`, `mastra_ai_spans:[traceId, spanId]`, ...),
 * so point lookups and upserts never go through a secondary index.
 *
 * Every statement is idempotent, so the schema can be applied on every start.
 */
export const MEMORY_SCHEMA = `
DEFINE TABLE IF NOT EXISTS ${TABLE_THREADS} SCHEMAFULL;
DEFINE FIELD IF NOT EXISTS resourceId ON ${TABLE_THREADS} TYPE string;
DEFINE FIELD IF NOT EXISTS title      ON ${TABLE_THREADS} TYPE option<string>;
DEFINE FIELD IF NOT EXISTS metadata   ON ${TABLE_THREADS} TYPE option<object> FLEXIBLE;
DEFINE FIELD IF NOT EXISTS createdAt  ON ${TABLE_THREADS} TYPE datetime;
DEFINE FIELD IF NOT EXISTS updatedAt  ON ${TABLE_THREADS} TYPE datetime;
DEFINE INDEX IF NOT EXISTS ${TABLE_THREADS}_resource_created ON ${TABLE_THREADS} FIELDS resourceId, createdAt;
DEFINE INDEX IF NOT EXISTS ${TABLE_THREADS}_created ON ${TABLE_THREADS} FIELDS createdAt;

DEFINE TABLE IF NOT EXISTS ${TABLE_MESSAGES} SCHEMAFULL;
DEFINE FIELD IF NOT EXISTS threadId   ON ${TABLE_MESSAGES} TYPE string;
DEFINE FIELD IF NOT EXISTS resourceId ON ${TABLE_MESSAGES} TYPE option<string>;
DEFINE FIELD IF NOT EXISTS role       ON ${TABLE_MESSAGES} TYPE string;
DEFINE FIELD IF NOT EXISTS type       ON ${TABLE_MESSAGES} TYPE option<string>;
DEFINE FIELD IF NOT EXISTS content    ON ${TABLE_MESSAGES} TYPE any;
DEFINE FIELD IF NOT EXISTS createdAt  ON ${TABLE_MESSAGES} TYPE datetime;
DEFINE INDEX IF NOT EXISTS ${TABLE_MESSAGES}_thread_created ON ${TABLE_MESSAGES} FIELDS threadId, createdAt;
DEFINE INDEX IF NOT EXISTS ${TABLE_MESSAGES}_resource_created ON ${TABLE_MESSAGES} FIELDS resourceId, createdAt;

DEFINE TABLE IF NOT EXISTS ${TABLE_RESOURCES} SCHEMAFULL;
DEFINE FIELD IF NOT EXISTS workingMemory ON ${TABLE_RESOURCES} TYPE option<string>;
DEFINE FIELD IF NOT EXISTS metadata      ON ${TABLE_RESOURCES} TYPE option<object> FLEXIBLE;
DEFINE FIELD IF NOT EXISTS createdAt     ON ${TABLE_RESOURCES} TYPE datetime;
DEFINE FIELD IF NOT EXISTS updatedAt     ON ${TABLE_RESOURCES} TYPE datetime;

DEFINE TABLE IF NOT EXISTS ${TABLE_OBSERVATIONAL_MEMORY} SCHEMALESS;
DEFINE INDEX IF NOT EXISTS ${TABLE_OBSERVATIONAL_MEMORY}_lookup ON ${TABLE_OBSERVATIONAL_MEMORY} FIELDS lookupKey, generationCount;
-- One guard record per thread/resource (keyed by lookupKey) serializes concurrent initializations.
DEFINE TABLE IF NOT EXISTS ${TABLE_OBSERVATIONAL_MEMORY_KEYS} SCHEMALESS;
`;

export const WORKFLOWS_SCHEMA = `
DEFINE TABLE IF NOT EXISTS ${TABLE_WORKFLOW_SNAPSHOT} SCHEMAFULL;
DEFINE FIELD IF NOT EXISTS workflowName ON ${TABLE_WORKFLOW_SNAPSHOT} TYPE string;
DEFINE FIELD IF NOT EXISTS runId        ON ${TABLE_WORKFLOW_SNAPSHOT} TYPE string;
DEFINE FIELD IF NOT EXISTS resourceId   ON ${TABLE_WORKFLOW_SNAPSHOT} TYPE option<string>;
DEFINE FIELD IF NOT EXISTS snapshot     ON ${TABLE_WORKFLOW_SNAPSHOT} TYPE any;
DEFINE FIELD IF NOT EXISTS status       ON ${TABLE_WORKFLOW_SNAPSHOT} TYPE option<string>;
DEFINE FIELD IF NOT EXISTS version      ON ${TABLE_WORKFLOW_SNAPSHOT} TYPE option<int>;
DEFINE FIELD IF NOT EXISTS createdAt    ON ${TABLE_WORKFLOW_SNAPSHOT} TYPE datetime;
DEFINE FIELD IF NOT EXISTS updatedAt    ON ${TABLE_WORKFLOW_SNAPSHOT} TYPE datetime;
DEFINE INDEX IF NOT EXISTS ${TABLE_WORKFLOW_SNAPSHOT}_run ON ${TABLE_WORKFLOW_SNAPSHOT} FIELDS runId;
DEFINE INDEX IF NOT EXISTS ${TABLE_WORKFLOW_SNAPSHOT}_resource ON ${TABLE_WORKFLOW_SNAPSHOT} FIELDS resourceId;
DEFINE INDEX IF NOT EXISTS ${TABLE_WORKFLOW_SNAPSHOT}_name_created ON ${TABLE_WORKFLOW_SNAPSHOT} FIELDS workflowName, createdAt;
DEFINE INDEX IF NOT EXISTS ${TABLE_WORKFLOW_SNAPSHOT}_created ON ${TABLE_WORKFLOW_SNAPSHOT} FIELDS createdAt;
`;

export const SCORES_SCHEMA = `
DEFINE TABLE IF NOT EXISTS ${TABLE_SCORERS} SCHEMALESS;
DEFINE INDEX IF NOT EXISTS ${TABLE_SCORERS}_scorer_created ON ${TABLE_SCORERS} FIELDS scorerId, createdAt;
DEFINE INDEX IF NOT EXISTS ${TABLE_SCORERS}_run_created ON ${TABLE_SCORERS} FIELDS runId, createdAt;
DEFINE INDEX IF NOT EXISTS ${TABLE_SCORERS}_entity_created ON ${TABLE_SCORERS} FIELDS entityId, entityType, createdAt;
DEFINE INDEX IF NOT EXISTS ${TABLE_SCORERS}_span_created ON ${TABLE_SCORERS} FIELDS traceId, spanId, createdAt;
`;

export const OBSERVABILITY_SCHEMA = `
DEFINE TABLE IF NOT EXISTS ${TABLE_SPANS} SCHEMALESS;
DEFINE INDEX IF NOT EXISTS ${TABLE_SPANS}_trace_started ON ${TABLE_SPANS} FIELDS traceId, startedAt;
DEFINE INDEX IF NOT EXISTS ${TABLE_SPANS}_parent_started ON ${TABLE_SPANS} FIELDS parentSpanId, startedAt;
DEFINE INDEX IF NOT EXISTS ${TABLE_SPANS}_started ON ${TABLE_SPANS} FIELDS startedAt;
`;

/** Every schema statement this package manages, keyed by storage domain. */
export function exportSchemas(): Record<'memory' | 'workflows' | 'scores' | 'observability', string> {
  return {
    memory: MEMORY_SCHEMA,
    workflows: WORKFLOWS_SCHEMA,
    scores: SCORES_SCHEMA,
    observability: OBSERVABILITY_SCHEMA,
  };
}
