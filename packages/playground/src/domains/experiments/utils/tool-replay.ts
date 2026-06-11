import type { DatasetExperiment, DatasetExperimentResult, ToolReplayOnMiss, ToolReplayReport } from '@mastra/client-js';

export interface ToolReplayMarker {
  fromExperimentId?: string;
  onMiss: ToolReplayOnMiss;
}

/**
 * Reads the replay marker an experiment run with `toolReplay` is stamped with
 * (`metadata.toolReplay = { fromExperimentId, onMiss }`). Metadata is
 * user-writable, so this matches the exact shape the backend stamps — an
 * object carrying `onMiss` — mirroring the core source-experiment guard;
 * arbitrary user `toolReplay` keys never read as replay runs.
 */
export function getReplayMarker(experiment: Pick<DatasetExperiment, 'metadata'>): ToolReplayMarker | null {
  const marker = experiment.metadata?.toolReplay;
  if (typeof marker !== 'object' || marker === null || !('onMiss' in marker)) return null;
  const { fromExperimentId, onMiss } = marker as Record<string, unknown>;
  return {
    ...(typeof fromExperimentId === 'string' ? { fromExperimentId } : {}),
    onMiss: onMiss === 'passthrough' ? 'passthrough' : 'error',
  };
}

export function isReplayExperiment(experiment: Pick<DatasetExperiment, 'metadata'>): boolean {
  return getReplayMarker(experiment) !== null;
}

/**
 * Extracts the divergence report a replay run merges into the stored result
 * output (`output.toolReplay`). Shape-checked so a user-owned `toolReplay`
 * key in an arbitrary agent output is never mistaken for a report.
 */
export function getToolReplayReport(result: Pick<DatasetExperimentResult, 'output'>): ToolReplayReport | null {
  const output = result.output;
  if (typeof output !== 'object' || output === null || Array.isArray(output)) return null;
  const report = (output as Record<string, unknown>).toolReplay;
  if (typeof report !== 'object' || report === null || Array.isArray(report)) return null;
  const candidate = report as Partial<ToolReplayReport>;
  if (
    typeof candidate.totalRecorded !== 'number' ||
    typeof candidate.replayedCount !== 'number' ||
    !Array.isArray(candidate.misses)
  ) {
    return null;
  }
  return report as ToolReplayReport;
}

/**
 * Returns the output without the injected `toolReplay` key for display — the
 * report renders in its own section. A failure-only output (`{ toolReplay }`
 * and nothing else) becomes null so the panel renders its empty placeholder.
 */
export function stripToolReplayFromOutput(output: unknown): unknown {
  if (typeof output !== 'object' || output === null || Array.isArray(output)) return output;
  if (!('toolReplay' in output)) return output;
  const { toolReplay: _toolReplay, ...rest } = output as Record<string, unknown>;
  return Object.keys(rest).length > 0 ? rest : null;
}

const TOOL_REPLAY_ERROR_LABELS: Record<string, string> = {
  TOOL_REPLAY_MISS: 'A tool call had no remaining recorded event — the item stopped instead of running live.',
  TOOL_REPLAY_NO_RECORDING: 'No recording was found for this item — it never ran (live execution is never silent).',
  TOOL_REPLAY_LOAD_FAILED: 'The recording could not be loaded from storage for this item.',
};

export function getToolReplayErrorLabel(code: string | undefined): string | null {
  if (!code) return null;
  return TOOL_REPLAY_ERROR_LABELS[code] ?? null;
}

export type ReplayDivergence = 'clean' | 'misses' | 'arg-mismatches' | 'unconsumed-only';

/** Worst-signal-first classification used by row chips and summaries. */
export function classifyReplayDivergence(report: ToolReplayReport): ReplayDivergence {
  if (report.misses.length > 0) return 'misses';
  if (report.argMismatches.length > 0) return 'arg-mismatches';
  if (report.unconsumed.length > 0) return 'unconsumed-only';
  return 'clean';
}

export interface ReplayTapeEvent {
  /** Global position on the tape (matches the report's argMismatch sequences). */
  sequence: number;
  spanId: string;
  status: 'replayed' | 'arg-mismatch' | 'unconsumed';
}

export interface ReplayTapeTool {
  toolName: string;
  /** Recorded events for this tool, in FIFO order. */
  events: ReplayTapeEvent[];
  /** Calls the new run made beyond the recording (no event left in the queue). */
  misses: { action: 'error' | 'passthrough' }[];
}

/** Minimal span shape the tape needs (subset of LightSpanRecord). */
export interface ReplayTapeSpan {
  spanId: string;
  parentSpanId?: string | null;
  spanType: string;
  isEvent?: boolean;
  name?: string | null;
  entityName?: string | null;
  entityId?: string | null;
  startedAt: string | Date;
  endedAt?: string | Date | null;
}

const TAPE_TOOL_SPAN_TYPES = new Set(['tool_call', 'mcp_tool_call']);

/**
 * Rebuilds the per-tool FIFO tape from the source trace's spans and overlays
 * the divergence report on it — mirroring the runner's extraction exactly
 * (top-level completed tool spans, startedAt order with spanId tie-break).
 * Unconsumed events are the tail of each tool's queue: FIFO consumption means
 * whatever was never requested is whatever was left at the end.
 */
export function buildReplayTape(spans: ReplayTapeSpan[], report: ToolReplayReport): ReplayTapeTool[] {
  const spansById = new Map(spans.map(span => [span.spanId, span]));
  const isToolSpan = (span: ReplayTapeSpan) => TAPE_TOOL_SPAN_TYPES.has(span.spanType) && !span.isEvent;
  const hasToolAncestor = (span: ReplayTapeSpan): boolean => {
    const visited = new Set<string>([span.spanId]);
    let parentId = span.parentSpanId ?? null;
    while (parentId) {
      if (visited.has(parentId)) return false;
      visited.add(parentId);
      const parent = spansById.get(parentId);
      if (!parent) return false;
      if (isToolSpan(parent)) return true;
      parentId = parent.parentSpanId ?? null;
    }
    return false;
  };

  const toolSpans = spans
    .filter(span => isToolSpan(span) && span.endedAt != null && !hasToolAncestor(span))
    .sort((a, b) => {
      const diff = new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime();
      if (diff !== 0) return diff;
      return a.spanId < b.spanId ? -1 : a.spanId > b.spanId ? 1 : 0;
    });

  const mismatchSequences = new Set(report.argMismatches.map(mismatch => mismatch.sequence));
  const unconsumedByTool = new Map(report.unconsumed.map(entry => [entry.toolName, entry.count]));

  const tools = new Map<string, ReplayTapeTool>();
  toolSpans.forEach((span, sequence) => {
    const toolName = span.entityName || span.entityId || span.name || 'unknown tool';
    let tool = tools.get(toolName);
    if (!tool) {
      tool = { toolName, events: [], misses: [] };
      tools.set(toolName, tool);
    }
    tool.events.push({
      sequence,
      spanId: span.spanId,
      status: mismatchSequences.has(sequence) ? 'arg-mismatch' : 'replayed',
    });
  });

  // FIFO: the unconsumed entries are the tail of each tool's queue.
  for (const tool of tools.values()) {
    const unconsumedCount = unconsumedByTool.get(tool.toolName) ?? 0;
    for (let i = 0; i < unconsumedCount && i < tool.events.length; i++) {
      tool.events[tool.events.length - 1 - i].status = 'unconsumed';
    }
  }

  for (const miss of report.misses) {
    let tool = tools.get(miss.toolName);
    if (!tool) {
      tool = { toolName: miss.toolName, events: [], misses: [] };
      tools.set(miss.toolName, tool);
    }
    tool.misses.push({ action: miss.action });
  }

  return [...tools.values()];
}
