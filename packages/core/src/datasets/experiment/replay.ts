import deepEqual from 'fast-deep-equal';
import { SpanType } from '../../observability';
import type { SpanRecord } from '../../storage/domains/observability/tracing';
import type { ToolHooks } from '../../tools/types';

/**
 * Tool replay for dataset experiments.
 *
 * Replays tool outputs recorded in a prior traced run instead of executing
 * live tools: tool spans from the source trace are turned into per-tool FIFO
 * queues, and a `beforeToolCall` hook short-circuits each matching call with
 * the recorded output (or re-throws the recorded error). The agent's own
 * behavior stays free to diverge — divergence is reported, not prevented.
 */

/** One recorded tool invocation derived from a trace tool span. */
export interface ToolReplayEvent {
  /** Tool name as exposed to the model (span entityName/entityId). */
  toolName: string;
  /** Recorded tool args — used for divergence diagnostics only, never for matching. */
  input: unknown;
  /** Recorded tool output (undefined when the recorded call errored). */
  output: unknown;
  /** Recorded tool error, normalized. Replay re-throws it so the agent sees the same failure. */
  error: { name?: string; message: string } | null;
  /** Source span ID in the recorded trace. */
  spanId: string;
  /** Position of this event in the recorded trace (0-based, across all tools). */
  sequence: number;
  startedAt: Date;
}

/** Behavior when a tool call has no remaining recorded event. */
export type ToolReplayOnMiss = 'error' | 'passthrough';

export interface ToolReplayMiss {
  toolName: string;
  /** What happened: 'passthrough' = live execution proceeded, 'error' = the run was aborted. */
  action: ToolReplayOnMiss;
  /** Args of the unmatched call, for diagnostics. */
  input?: unknown;
}

export interface ToolReplayArgMismatch {
  toolName: string;
  /** Sequence of the recorded event that was replayed despite differing args. */
  sequence: number;
  spanId: string;
}

/**
 * Divergence summary for one item attempt. Divergence is signal: it shows how
 * the agent's trajectory differed from the recorded run even though every
 * matched call returned identical observations.
 */
export interface ToolReplayReport {
  /** Trace the events were derived from (null when no recording was found for the item). */
  sourceTraceId: string | null;
  /** Total recorded events available for replay. */
  totalRecorded: number;
  /** Events consumed by the agent (including replayed errors). */
  replayedCount: number;
  /** Live calls that had no recorded event remaining. */
  misses: ToolReplayMiss[];
  /** Recorded events the agent never requested. */
  unconsumed: { toolName: string; count: number }[];
  /** Calls replayed in order but with args differing from the recording (diagnostic only). */
  argMismatches: ToolReplayArgMismatch[];
}

/** Mutable per-attempt replay state. Create a fresh one for every execution attempt. */
export interface ToolReplayState {
  /** Remaining (unconsumed) events per tool, in recorded order. */
  queues: Map<string, ToolReplayEvent[]>;
  sourceTraceId: string | null;
  totalRecorded: number;
  replayedCount: number;
  misses: ToolReplayMiss[];
  argMismatches: ToolReplayArgMismatch[];
}

const TOOL_SPAN_TYPES: ReadonlySet<SpanType> = new Set([SpanType.TOOL_CALL, SpanType.MCP_TOOL_CALL]);

function isToolSpan(span: SpanRecord): boolean {
  return TOOL_SPAN_TYPES.has(span.spanType) && !span.isEvent;
}

/**
 * True when the span has another tool span anywhere in its ancestor chain.
 * Such spans belong to nested executions (sub-agents via agent-as-tool,
 * workflow-as-tool internals) that the top-level replay hooks never intercept —
 * including them would poison the FIFO queues.
 */
function hasToolSpanAncestor(span: SpanRecord, spansById: Map<string, SpanRecord>): boolean {
  const visited = new Set<string>([span.spanId]);
  let parentId = span.parentSpanId;
  while (parentId) {
    if (visited.has(parentId)) return false; // cycle guard — treat as top-level
    visited.add(parentId);
    const parent = spansById.get(parentId);
    if (!parent) return false;
    if (isToolSpan(parent)) return true;
    parentId = parent.parentSpanId;
  }
  return false;
}

function normalizeSpanError(error: unknown): { name?: string; message: string } | null {
  if (error == null) return null;
  if (typeof error === 'string') return { message: error };
  if (typeof error === 'object') {
    const err = error as Record<string, unknown>;
    let message: string;
    if (typeof err.message === 'string') {
      message = err.message;
    } else if (typeof err.text === 'string') {
      message = err.text;
    } else {
      // JSON.stringify throws on circular references and BigInt values —
      // degrade to a generic message instead of failing extraction.
      try {
        message = JSON.stringify(error) ?? 'Unknown tool error';
      } catch {
        message = 'Unknown tool error';
      }
    }
    return {
      ...(typeof err.name === 'string' ? { name: err.name } : {}),
      message,
    };
  }
  return { message: String(error) };
}

/**
 * Extract the ordered, top-level tool invocations from a recorded trace.
 *
 * Walks the raw span records directly (rather than reusing
 * `extractTrajectoryFromTrace`) so recorded errors and payloads are preserved
 * verbatim. Nested tool spans (sub-agent / workflow-as-tool internals) are
 * excluded — only calls the top-level agent made are replayable.
 */
export function extractToolReplayEvents(spans: SpanRecord[]): ToolReplayEvent[] {
  const spansById = new Map<string, SpanRecord>();
  for (const span of spans) {
    spansById.set(span.spanId, span);
  }

  const toolSpans = spans.filter(span => isToolSpan(span) && !hasToolSpanAncestor(span, spansById));

  // Adapter sort order is not contractual — order by startedAt defensively.
  toolSpans.sort((a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime());

  const events: ToolReplayEvent[] = [];
  for (const span of toolSpans) {
    const toolName = span.entityName ?? span.entityId;
    if (!toolName) continue;
    events.push({
      toolName,
      input: span.input,
      output: span.output,
      error: normalizeSpanError(span.error),
      spanId: span.spanId,
      sequence: events.length,
      startedAt: new Date(span.startedAt),
    });
  }
  return events;
}

/** Fresh per-attempt state: per-tool FIFO queues plus report accumulators. */
export function createReplayState(events: ToolReplayEvent[], sourceTraceId: string | null): ToolReplayState {
  const queues = new Map<string, ToolReplayEvent[]>();
  for (const event of events) {
    const queue = queues.get(event.toolName);
    if (queue) {
      queue.push(event);
    } else {
      queues.set(event.toolName, [event]);
    }
  }
  return {
    queues,
    sourceTraceId,
    totalRecorded: events.length,
    replayedCount: 0,
    misses: [],
    argMismatches: [],
  };
}

/**
 * Build per-execution ToolHooks that replay recorded events.
 *
 * Matching is per-tool FIFO: the next unconsumed event for the called tool is
 * returned regardless of args, which tolerates cross-tool reordering and
 * repeated same-tool calls. Args that differ from the recording are flagged in
 * the report but still replayed.
 *
 * A thrown error from `beforeToolCall` surfaces to the model as a tool-error
 * result (the agent keeps running), so `onMiss: 'error'` alone cannot fail the
 * item — `onFatalMiss` lets the caller abort the run (e.g. via AbortController).
 */
export function buildReplayHooks(
  state: ToolReplayState,
  options: { onMiss: ToolReplayOnMiss; onFatalMiss?: (error: Error) => void },
): ToolHooks {
  return {
    beforeToolCall: ({ toolName, input }) => {
      const event = state.queues.get(toolName)?.shift();

      if (!event) {
        state.misses.push({ toolName, action: options.onMiss, input });
        if (options.onMiss === 'passthrough') {
          return; // proceed with live execution
        }
        // "aborted" in the message also suppresses the experiment retry loop —
        // a replay miss is deterministic, retrying cannot fix it.
        const error = new Error(
          `Tool replay miss for '${toolName}': no recorded call remaining — execution aborted (onMiss: 'error')`,
        );
        options.onFatalMiss?.(error);
        throw error;
      }

      state.replayedCount++;
      if (!deepEqual(input, event.input)) {
        state.argMismatches.push({ toolName, sequence: event.sequence, spanId: event.spanId });
      }

      if (event.error) {
        const error = new Error(event.error.message);
        // Never reuse 'FGADeniedError' — the tool-call step re-throws that name
        // instead of converting it to a tool-error result.
        if (event.error.name && event.error.name !== 'FGADeniedError') {
          error.name = event.error.name;
        }
        throw error;
      }

      return { proceed: false, output: event.output };
    },
  };
}

/** Snapshot the divergence report, including events that were never consumed. */
export function finalizeReplayReport(state: ToolReplayState): ToolReplayReport {
  const unconsumed: { toolName: string; count: number }[] = [];
  for (const [toolName, queue] of state.queues) {
    if (queue.length > 0) {
      unconsumed.push({ toolName, count: queue.length });
    }
  }
  return {
    sourceTraceId: state.sourceTraceId,
    totalRecorded: state.totalRecorded,
    replayedCount: state.replayedCount,
    misses: [...state.misses],
    unconsumed,
    argMismatches: [...state.argMismatches],
  };
}
