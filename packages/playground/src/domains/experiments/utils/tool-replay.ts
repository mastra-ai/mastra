import { getToolReplayMarker } from '@mastra/client-js';
import type {
  DatasetExperiment,
  DatasetExperimentResult,
  ToolReplayExperimentMarker,
  ToolReplayMatching,
  ToolReplayReport,
  TriggerDatasetExperimentParams,
} from '@mastra/client-js';

/** How recorded answers are matched to calls: FIFO per tool, or exact-args only. */
export type { ToolReplayMatching };

/** Kind of mock answer configured for a tool (sourced from the client report type). */
export type ToolReplayMockKind = NonNullable<ToolReplayReport['mocks']>[number]['kind'];

/** One actual tool call of the run, in hook-arrival order (sourced from the client report type). */
export type ToolReplayCall = NonNullable<ToolReplayReport['calls']>[number];

/**
 * Alias kept for compatibility: @mastra/client-js now carries `calls`,
 * `mocks` and `expectations` on `ToolReplayReport` directly, so the former
 * local extension is just the client type.
 */
export type ToolReplayReportExtended = ToolReplayReport;

/** One-line verdict model over the run's call flow — every call lands in exactly one bucket. */
export interface ToolReplayCallsSummary {
  total: number;
  /** Calls answered from the recording (`replayed` and `replayed-error`). */
  replayed: number;
  /** Replayed calls that asked with different args than the consumed event (FIFO drift). */
  replayedWithDrift: number;
  /** Calls answered by configured mocks (`mocked` and `mock-error`). */
  mocked: number;
  /** Calls that stopped the item: no recorded event left (`miss-error`) or no matching case (`case-miss-error`). */
  missed: number;
  /** Calls that executed the live tool (`miss-passthrough`, `case-miss-passthrough`, and `live`). */
  live: number;
}

/**
 * Derives the one-line verdict counts from the run's call flow. Returns null
 * when the report carries no `calls` — older rows predate the field.
 */
export function summarizeReplayCalls(report: ToolReplayReportExtended): ToolReplayCallsSummary | null {
  if (!Array.isArray(report.calls)) return null;
  const summary: ToolReplayCallsSummary = {
    total: report.calls.length,
    replayed: 0,
    replayedWithDrift: 0,
    mocked: 0,
    missed: 0,
    live: 0,
  };
  for (const call of report.calls) {
    switch (call.outcome) {
      case 'replayed':
      case 'replayed-error':
        summary.replayed += 1;
        if (call.argsDiffered) summary.replayedWithDrift += 1;
        break;
      case 'mocked':
      case 'mock-error':
        summary.mocked += 1;
        break;
      case 'miss-error':
      case 'case-miss-error':
        summary.missed += 1;
        break;
      case 'miss-passthrough':
      case 'case-miss-passthrough':
      case 'live':
        summary.live += 1;
        break;
    }
  }
  return summary;
}

/**
 * Studio's marker type IS the canonical client marker: `fromExperimentId`,
 * `onMiss` (absent on mock-only runs — mocks always answer, so there is no
 * miss policy), `matching`, `mockedTools` (tools answered by mocks), and
 * `mockConfigs` (the persisted mock configuration, when stamped).
 */
export type ToolReplayMarker = ToolReplayExperimentMarker;

/**
 * Reads the marker an experiment run with `toolReplay`/`toolMocks` is stamped
 * with, through the canonical `getToolReplayMarker` parser re-exported by
 * @mastra/client-js — the exact shape-check the backend's source-experiment
 * guard runs, so Studio can never classify a run differently than the runner.
 * Metadata is user-writable: junk under the `toolReplay` key (non-objects,
 * arrays, objects without `onMiss` or `mockedTools`) reads as null, unknown
 * `onMiss`/`matching` values and non-string tool names are dropped, and only
 * plain-object `mockConfigs` entries survive.
 */
export function getReplayMarker(experiment: Pick<DatasetExperiment, 'metadata'>): ToolReplayMarker | null {
  return getToolReplayMarker(experiment.metadata);
}

export interface ExperimentFailureReason {
  id: string;
  message: string;
}

/**
 * Reads the `failureReason` an async-failed experiment is stamped with. The
 * trigger route answers `pending` before setup runs, so a setup failure
 * (unknown replay source, no eligible items, …) never crosses HTTP as an
 * error — `metadata.failureReason` (`{ id, message }`) is the only place the
 * reason surfaces. Metadata is user-writable, so this matches the exact
 * stamped shape (plain object with string `id` and `message`), mirroring
 * getReplayMarker; junk under the key never reads as a failure reason.
 */
export function getExperimentFailureReason(
  experiment: Pick<DatasetExperiment, 'metadata'>,
): ExperimentFailureReason | null {
  const candidate = experiment.metadata?.failureReason;
  if (typeof candidate !== 'object' || candidate === null || Array.isArray(candidate)) return null;
  const { id, message } = candidate as Record<string, unknown>;
  if (typeof id !== 'string' || typeof message !== 'string') return null;
  return { id, message };
}

/**
 * Builds the trigger params for re-running one item of a replay experiment
 * under the same conditions: same dataset version, same agent version, same
 * replay policy — only `itemIds` narrows the run to the one item.
 *
 * Returns null when the run is not faithfully re-runnable from its marker:
 * markers without `onMiss` carry no replay policy, and mock-marked runs
 * (`mockedTools`) can't be reconstructed — mock values aren't stored on the
 * run, so a re-run would silently drop the mocks.
 */
export function buildReplayItemReRunParams({
  datasetId,
  experiment,
  marker,
  itemId,
}: {
  datasetId: string;
  experiment: Pick<DatasetExperiment, 'targetType' | 'targetId' | 'datasetVersion' | 'agentVersion'>;
  marker: ToolReplayMarker;
  itemId: string;
}): TriggerDatasetExperimentParams | null {
  if (!marker.onMiss || marker.mockedTools?.length) return null;
  // Tool replay is agent-only — a marker on any other target is junk.
  if (experiment.targetType !== 'agent') return null;
  return {
    datasetId,
    targetType: 'agent',
    targetId: experiment.targetId,
    itemIds: [itemId],
    toolReplay: {
      ...(marker.fromExperimentId ? { fromExperimentId: marker.fromExperimentId } : {}),
      onMiss: marker.onMiss,
      // fifo is the backend default — only the explicit strict policy is re-sent.
      ...(marker.matching === 'strict' ? { matching: 'strict' as const } : {}),
    },
    ...(experiment.datasetVersion != null ? { version: experiment.datasetVersion } : {}),
    ...(experiment.agentVersion ? { agentVersion: experiment.agentVersion } : {}),
  };
}

/** "a, b, c +2" — joined mocked-tool names capped for compact UI surfaces. */
export function formatMockedToolNames(names: string[], max = 3): string {
  const shown = names.slice(0, max).join(', ');
  return names.length > max ? `${shown} +${names.length - max}` : shown;
}

export function isReplayExperiment(experiment: Pick<DatasetExperiment, 'metadata'>): boolean {
  return getReplayMarker(experiment) !== null;
}

/** Shape check shared by both report locations — a user-owned `toolReplay` value is never mistaken for a report. */
function parseReportShape(candidate: unknown): ToolReplayReportExtended | null {
  if (typeof candidate !== 'object' || candidate === null || Array.isArray(candidate)) return null;
  const report = candidate as Partial<ToolReplayReport>;
  if (
    typeof report.totalRecorded !== 'number' ||
    typeof report.replayedCount !== 'number' ||
    !Array.isArray(report.misses)
  ) {
    return null;
  }
  return candidate as ToolReplayReportExtended;
}

/**
 * Extracts the divergence report of a replay/mock run. New rows carry it in
 * the dedicated top-level `toolReplay` column; older rows merged it into the
 * output. Top-level wins when both are present. Both locations stay
 * shape-checked — a user-owned `toolReplay` value is never read as a report.
 */
export function getToolReplayReport(
  result: Pick<DatasetExperimentResult, 'output'> & { toolReplay?: unknown },
): ToolReplayReportExtended | null {
  const topLevel = parseReportShape(result.toolReplay);
  if (topLevel) return topLevel;
  const output = result.output;
  if (typeof output !== 'object' || output === null || Array.isArray(output)) return null;
  return parseReportShape((output as Record<string, unknown>).toolReplay);
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
  TOOL_REPLAY_UNCONSUMED: 'Strict replay: recorded calls were never consumed — the item failed instead of passing.',
  TOOL_MOCK_EXPECTATION_FAILED:
    'A tool mock expectation was not satisfied — the agent did not call the tool as asserted.',
  TOOL_MOCK_NAME_COLLISION: 'Tool mock names collide after formatting — rename the mocks so each maps to one tool.',
};

export function getToolReplayErrorLabel(code: string | undefined): string | null {
  if (!code) return null;
  return TOOL_REPLAY_ERROR_LABELS[code] ?? null;
}

export type ReplayDivergence = 'clean' | 'failed-expectations' | 'misses' | 'arg-mismatches' | 'unconsumed-only';

/** Worst-signal-first classification used by row chips and summaries. */
export function classifyReplayDivergence(report: ToolReplayReportExtended): ReplayDivergence {
  // A failed expectation is an explicit assertion broken — it outranks every
  // passive divergence signal.
  if (report.expectations?.some(expectation => !expectation.satisfied)) return 'failed-expectations';
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
 *
 * Consumption is derived from the report's call flow when present: each
 * replayed call carries the `sequence` of the event it consumed, which is
 * exact for both FIFO and strict matching (strict consumes by exact args
 * anywhere in the queue, not at the head). Legacy rows without `calls` fall
 * back to the FIFO tail heuristic — whatever was never requested is whatever
 * was left at the end of each queue.
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

  // Exact consumption: replayed calls carry the sequence of the event they
  // consumed — valid for FIFO and strict alike. Arg-mismatch stays on
  // consumed events (a FIFO mismatch IS a consumption with differing args).
  const consumedSequences = Array.isArray(report.calls)
    ? new Set(
        report.calls
          .filter(
            call =>
              (call.outcome === 'replayed' || call.outcome === 'replayed-error') && typeof call.sequence === 'number',
          )
          .map(call => call.sequence!),
      )
    : null;

  if (consumedSequences) {
    for (const tool of tools.values()) {
      for (const event of tool.events) {
        if (!consumedSequences.has(event.sequence)) event.status = 'unconsumed';
      }
    }
  } else {
    // Legacy rows without a call flow — FIFO only: the unconsumed entries are
    // the tail of each tool's queue.
    for (const tool of tools.values()) {
      const unconsumedCount = unconsumedByTool.get(tool.toolName) ?? 0;
      for (let i = 0; i < unconsumedCount && i < tool.events.length; i++) {
        tool.events[tool.events.length - 1 - i].status = 'unconsumed';
      }
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

/** How one run-flow outcome renders anywhere in the UI: glyph + label, plus a fixed note. */
export type ReplayCallOutcomeView = {
  glyph: string;
  glyphClassName: string;
  label: string;
  /** Fixed explanation shown next to the outcome where there is room. */
  note?: string;
};

/** Single source of truth for outcome glyphs — result panel, summary card, and tests all read this. */
export const CALL_OUTCOME_VIEWS: Record<ToolReplayCall['outcome'], ReplayCallOutcomeView> = {
  replayed: { glyph: '✓', glyphClassName: 'text-green-400', label: 'replayed' },
  'replayed-error': {
    glyph: '✓',
    glyphClassName: 'text-green-400',
    label: 'replayed',
    note: 'recorded error re-thrown',
  },
  mocked: { glyph: 'Ⓜ', glyphClassName: 'text-purple-400', label: 'mocked' },
  'mock-error': { glyph: 'Ⓜ', glyphClassName: 'text-purple-400', label: 'mocked', note: 'error injected' },
  'miss-error': { glyph: '✗', glyphClassName: 'text-red-400', label: 'miss', note: 'no recorded call left' },
  'miss-passthrough': {
    glyph: '⚡',
    glyphClassName: 'text-amber-400',
    label: 'miss',
    note: 'ran live (passthrough)',
  },
  'case-miss-error': {
    glyph: '✗',
    glyphClassName: 'text-red-400',
    label: 'miss',
    note: 'no mock case matched (onNoMatch: error)',
  },
  'case-miss-passthrough': {
    glyph: '⚡',
    glyphClassName: 'text-amber-400',
    label: 'miss',
    note: 'no mock case matched — ran live',
  },
  live: { glyph: '⚡', glyphClassName: 'text-blue-400', label: 'live', note: 'ran live (not mocked)' },
};

/** Future-proof fallback — reports come from storage, so an unknown outcome must not crash the UI. */
export const UNKNOWN_CALL_OUTCOME_VIEW: ReplayCallOutcomeView = {
  glyph: '•',
  glyphClassName: 'text-neutral3',
  label: '',
};

export function getCallOutcomeView(outcome: ToolReplayCall['outcome']): ReplayCallOutcomeView {
  return CALL_OUTCOME_VIEWS[outcome] ?? UNKNOWN_CALL_OUTCOME_VIEW;
}
