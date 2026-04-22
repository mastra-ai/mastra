/**
 * Trace-to-Item Builder
 *
 * Converts DuckDB observability traces into MastraCodeExperimentItems.
 * Used to seed datasets from real agent sessions.
 *
 * Flow: DuckDB span_events → SpanRecord → MastraCodeExperimentItem
 */

import type { MastraDBMessage } from '@mastra/core/agent';
import type {
  MastraCodeExperimentItem,
  MastraCodeEnvironment,
  MastraCodeHarnessState,
  MastraCodeItemMetadata,
  MastraCodeMemory,
} from './types';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Types for trace data (subset of what DuckDB observability returns)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/** Minimal span record shape from observability storage. */
export interface TraceSpan {
  traceId: string;
  spanId: string;
  parentSpanId: string | null;
  name: string;
  spanType: string;
  startedAt: Date;
  endedAt: Date | null;
  input: Record<string, unknown> | string | null;
  output: Record<string, unknown> | string | null;
  error: Record<string, unknown> | string | null;
  attributes: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  requestContext: Record<string, unknown> | null;
  threadId: string | null;
  resourceId: string | null;
}

/** Feedback record from observability storage. */
export interface TraceFeedback {
  traceId: string;
  feedbackType: string;
  value: string | number;
  comment?: string;
}

/** Options for trace-to-item conversion. */
export interface TraceToItemOptions {
  /** Workspace snapshot to attach. Required for meaningful replay. */
  workspace?: MastraCodeExperimentItem['workspace'];
  /** Override category. */
  category?: string;
  /** Override difficulty. */
  difficulty?: 'easy' | 'medium' | 'hard';
  /** Tags to attach to the item. */
  tags?: string[];
  /** Description of what this item tests. */
  description?: string;
  /** Include conversation history as memory. Default true. */
  includeMemory?: boolean;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Core conversion function
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Convert a trace (set of spans) into a MastraCodeExperimentItem.
 *
 * Extracts the user message from the root AGENT_RUN span's input,
 * reconstructs the environment from requestContext/attributes,
 * and optionally includes prior conversation as memory.
 *
 * @param spans - All spans from a single trace
 * @param options - Additional options for the item
 * @param feedback - Optional feedback for this trace
 * @returns A MastraCodeExperimentItem ready for dataset insertion
 */
export function traceToItem(
  spans: TraceSpan[],
  options?: TraceToItemOptions,
  feedback?: TraceFeedback,
): MastraCodeExperimentItem | null {
  // Find the root agent_run span (SpanType.AGENT_RUN = 'agent_run')
  // parentSpanId can be null, empty string, or "null" string from DuckDB
  const isRootSpan = (s: TraceSpan) => !s.parentSpanId || s.parentSpanId === 'null';
  const rootSpan = spans.find(s => s.spanType === 'agent_run' && isRootSpan(s));
  if (!rootSpan) return null;

  // Extract the user message from the span input
  const userMessage = extractUserMessage(rootSpan);
  if (!userMessage) return null;

  // Extract environment from requestContext
  const environment = extractEnvironment(rootSpan);

  // Extract memory (prior messages from the thread)
  const memory = options?.includeMemory !== false ? extractMemory(rootSpan) : undefined;

  // Build metadata
  const metadata: MastraCodeItemMetadata = {
    sourceTraceId: rootSpan.traceId,
    sourceFeedback: feedback ? mapFeedbackSentiment(feedback) : undefined,
    category: options?.category ?? inferCategory(spans),
    difficulty: options?.difficulty,
    description: options?.description,
    tags: options?.tags,
    dateRecorded: rootSpan.startedAt.toISOString(),
  };

  return {
    input: { userMessage },
    environment,
    workspace: options?.workspace,
    memory,
    metadata,
  };
}

/**
 * Batch convert multiple traces into experiment items.
 *
 * @param traces - Array of trace data (each trace is an array of spans)
 * @param options - Shared options applied to all items
 * @param feedbackByTrace - Feedback indexed by traceId
 * @returns Array of valid experiment items (invalid traces are skipped)
 */
export function tracesToItems(
  traces: TraceSpan[][],
  options?: TraceToItemOptions,
  feedbackByTrace?: Map<string, TraceFeedback>,
): MastraCodeExperimentItem[] {
  const items: MastraCodeExperimentItem[] = [];

  for (const spans of traces) {
    const traceId = spans[0]?.traceId;
    const feedback = traceId ? feedbackByTrace?.get(traceId) : undefined;
    const item = traceToItem(spans, options, feedback);
    if (item) items.push(item);
  }

  return items;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Extraction helpers
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function extractUserMessage(span: TraceSpan): string | null {
  const input = span.input;
  if (!input) return null;

  // DuckDB may store the input as a plain string (the user message directly)
  if (typeof input === 'string') return input;

  // Agent input typically has `messages` array — find the last user message
  const messages = input.messages as Array<{ role?: string; content?: unknown }> | undefined;
  if (Array.isArray(messages)) {
    // Find the last user message (the one that triggered this run)
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i]?.role === 'user') {
        const content = messages[i]?.content;
        if (typeof content === 'string') return content;
        // Handle structured content (text parts)
        if (Array.isArray(content)) {
          const textParts = content
            .filter((p: unknown) => typeof p === 'object' && p !== null && (p as { type?: string }).type === 'text')
            .map((p: unknown) => (p as { text?: string }).text ?? '')
            .join('');
          if (textParts) return textParts;
        }
      }
    }
  }

  // Fallback: check for `content` directly
  if (typeof input.content === 'string') return input.content;

  return null;
}

function extractEnvironment(span: TraceSpan): MastraCodeEnvironment {
  const ctx = span.requestContext ?? {};
  const attrs = span.attributes ?? {};

  // Extract mode from requestContext or attributes
  const mode = (ctx.mode as string) ?? (attrs.mode as string) ?? 'build';
  const modelId = (ctx.modelId as string) ?? (attrs['ai.model.id'] as string) ?? 'unknown';

  // Extract harness state from requestContext
  const harnessState: MastraCodeHarnessState = {
    projectPath: (ctx.projectPath as string) ?? '.',
    projectName: (ctx.projectName as string) ?? 'unknown',
    gitBranch: ctx.gitBranch as string | undefined,
    platform: ctx.platform as string | undefined,
    yolo: ctx.yolo as boolean | undefined,
    thinkingLevel: ctx.thinkingLevel as MastraCodeHarnessState['thinkingLevel'],
    smartEditing: ctx.smartEditing as boolean | undefined,
    omScope: ctx.omScope as 'thread' | 'resource' | undefined,
  };

  return { mode: mode as 'build' | 'plan' | 'fast', modelId, harnessState };
}

function extractMemory(span: TraceSpan): MastraCodeMemory | undefined {
  const input = span.input;
  if (!input || typeof input === 'string') return undefined;

  // rememberedMessages contains the thread history that was passed to the agent
  const remembered = input.rememberedMessages as MastraDBMessage[] | undefined;
  if (!remembered || remembered.length === 0) return undefined;

  // Filter out the current user message (it's in `input`, not memory)
  // and strip internal bookkeeping messages
  const filtered = remembered.filter((msg: MastraDBMessage) => {
    if (!msg.role) return false;
    // Skip internal observational memory data-messages
    const content = msg.content as unknown;
    if (typeof content === 'string' && content.startsWith('data-om-')) return false;
    return true;
  });

  if (filtered.length === 0) return undefined;

  // Extract OM from tagged system messages if available
  const taggedSystem = input.taggedSystemMessages as Record<string, unknown> | undefined;
  const observationalMemory = taggedSystem?.observational_memory as string | undefined;

  return {
    messages: filtered,
    observationalMemory,
  };
}

function mapFeedbackSentiment(feedback: TraceFeedback): 'positive' | 'negative' | undefined {
  const val = feedback.value;
  if (typeof val === 'number') return val >= 0.5 ? 'positive' : 'negative';
  if (typeof val === 'string') {
    if (val === 'up' || val === '1' || val === 'positive') return 'positive';
    if (val === 'down' || val === '0' || val === 'negative') return 'negative';
  }
  return undefined;
}

function inferCategory(spans: TraceSpan[]): string {
  const toolSpans = spans.filter(s => s.spanType === 'tool_call');
  const toolNames = new Set(toolSpans.map(s => s.name));

  // Categorize based on tool usage patterns
  if (toolNames.has('execute_command')) {
    if (toolNames.has('string_replace_lsp') || toolNames.has('write_file')) return 'code-change';
    return 'command-execution';
  }
  if (toolNames.has('string_replace_lsp') || toolNames.has('write_file') || toolNames.has('ast_smart_edit')) {
    return 'code-change';
  }
  if (toolNames.has('search_content') || toolNames.has('find_files') || toolNames.has('view')) {
    if (!toolNames.has('string_replace_lsp') && !toolNames.has('write_file')) return 'exploration';
  }
  if (toolNames.has('submit_plan')) return 'planning';
  if (toolNames.has('web_search') || toolNames.has('web_extract')) return 'research';
  if (toolNames.has('ask_user')) return 'clarification';

  return 'general';
}
