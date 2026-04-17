/**
 * Browser-safe exports for @mastra/core
 *
 * This module provides types, enums, and lightweight runtime values
 * that can be safely imported in browser/Vite environments without
 * pulling in Node.js builtins (node:fs, node:path, node:child_process,
 * node:async_hooks) or heavy server-side dependencies.
 *
 * Use `@mastra/core/client` instead of `@mastra/core/storage` or
 * `@mastra/core/observability` in frontend code.
 */

// ── Enums (runtime values, but no Node.js deps) ──
export { TraceStatus } from '../storage/domains/observability/tracing';
export { EntityType } from '../observability/types/tracing';

// ── Features (runtime const, no deps) ──
export { coreFeatures } from '../features';

// ── RequestContext (runtime class, no Node.js deps) ──
export { RequestContext, MASTRA_RESOURCE_ID_KEY, MASTRA_THREAD_ID_KEY } from '../request-context';

// ── Storage types (type-only, no runtime deps) ──
export type {
  SpanRecord,
  CreateSpanRecord,
  ListTracesResponse,
  ListTracesArgs,
} from '../storage/domains/observability/tracing';

export type { ListLogsArgs, ListLogsResponse } from '../storage/domains/observability/logs';
export type { ScoreRecord } from '../storage/domains/observability/scores';

export type {
  ExperimentStatus,
  StorageConditionalVariant,
  AgentInstructionBlock,
  WorkflowRuns,
  RuleGroup,
  RuleGroupDepth1,
  RuleGroupDepth2,
  Rule,
  ConditionOperator,
} from '../storage/types';

// ── Observability types (type-only) ──
export type { InputTokenDetails, OutputTokenDetails, TracingOptions } from '../observability/types/tracing';

// ── Memory types (type-only) ──
export type { StorageThreadType, SemanticRecall, AiMessageType } from '../memory/types';

// ── Eval types (type-only) ──
export type { ListScoresResponse, ScoreRowData } from '../evals/types';

// ── Agent types (type-only) ──
export type { AgentInstructions } from '../agent/types';
export type { LLMStepResult } from '../stream/types';
export type { MastraDBMessage } from '../agent/message-list/state/types';

// ── MCP types (type-only) ──
export type { MCPToolType } from '../tools/types';
export type { ServerInfo } from '../mcp/types';
