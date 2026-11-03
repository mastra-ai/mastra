/**
 * Which AGENT_RUN + MODEL_GENERATION pair a durable execution reports under.
 *
 * A *segment* is one execution of the durable loop: start → suspend or terminal, or resume/recover →
 * suspend or terminal. Its spans are that execution's AGENT_RUN and MODEL_GENERATION.
 *
 * - The process that starts a segment opens its spans (`stream()`, `resume()`, `recover()`).
 * - Segment #1 travels in the workflow input and the loop state. A later segment travels in the
 *   execution's request context under a reserved key, which every engine already forwards to every
 *   step and persists with every snapshot.
 * - Every step resolves the current segment through `currentSegment()`. Nothing else reads span
 *   identity.
 * - The worker that finishes a segment ends its spans. When the handoff produces no execution
 *   (dispatch failed, lost race), the process that opened them ends them.
 */
import type { IMastraLogger } from '../../logger';
import type { Mastra } from '../../mastra';
import { EntityType, SpanType, getOrCreateSpan, getResumeTracingContext } from '../../observability';
import type {
  AIModelGenerationSpan,
  AnyExportedSpan,
  AnySpan,
  ExportedSpan,
  Span,
  TraceState,
  TracingPolicy,
} from '../../observability';
import { RequestContext } from '../../request-context';
import type { WorkflowRunState } from '../../workflows/types';
import { modelSpanAttributes } from '../model-span-attributes';
import { MAP_FINAL_OUTPUT_STEP_ID } from './constants';
import { getRunRegistryEntry } from './run-registry';

/**
 * Reserved request-context key holding `Record<runId, CarriedSegment>`. The `mastra__` prefix keeps
 * it out of span serialization and eval snapshots; keyed by runId so a delegated durable sub-agent
 * sharing the parent's RequestContext cannot read or overwrite the parent's segment.
 */
const MASTRA_DURABLE_SEGMENTS_KEY = 'mastra__durableSegments';

/**
 * Wire form. `agent: null` marks a segment that opened no spans (tracing off, or the previous
 * segment unsampled): the worker must then end nothing, not fall back to the previous pair.
 */
interface CarriedSegment {
  v: 1;
  agent: ExportedSpan<SpanType.AGENT_RUN> | null;
  model: ExportedSpan<SpanType.MODEL_GENERATION> | null;
  /** Recovered segment: the MODEL_GENERATION whose open MODEL_STEP it took over. */
  adoptsStepsOf?: string;
}

/** Snapshot pair of one segment. Both absent when the segment is untraced. */
export interface SegmentSpanData {
  agentSpanData?: ExportedSpan<SpanType.AGENT_RUN>;
  modelSpanData?: ExportedSpan<SpanType.MODEL_GENERATION>;
  /**
   * The MODEL_GENERATION of the segment that crashed mid-step, whose step this recovered segment
   * ends. Absent when the crashed segment had already ended, or for a resumed segment.
   */
  adoptsStepsOf?: string;
}

/**
 * The span-related fields of a durable step's state: the loop state, the llm-execution input, or a
 * tool-call input.
 */
export interface SegmentState {
  /** Segment #1's spans (workflow input → loop state). Never rewritten. */
  agentSpanData?: unknown;
  modelSpanData?: unknown;
  completionStartTime?: Date | string;
  timeToFirstTokenMs?: number;
  /**
   * MODEL_GENERATION the clocks above were measured under. Absent on older state, whose clocks
   * belong to the loop-state segment (#1).
   */
  clockSpanId?: string;
}

export interface SpanClockAttributes {
  completionStartTime?: Date;
  timeToFirstTokenMs?: number;
}

/** The current segment, as seen by one step of one execution. */
export interface DurableSegment extends SegmentSpanData {
  /**
   * Handle for ending the AGENT_RUN: the live span when this process opened it, otherwise one
   * rebuilt from the snapshot. A live span is used only when its id matches, so a warm registry
   * holding an older segment's span is never ended by mistake.
   */
  agentSpan(): Span<SpanType.AGENT_RUN> | undefined;
  modelSpan(): AIModelGenerationSpan | undefined;
  /**
   * Whether this segment may end a MODEL_STEP: one opened under this segment's MODEL_GENERATION, or
   * the one the segment it recovered from left open mid-step (`adoptsStepsOf`). A step opened under
   * a segment that suspended was already ended then, and an untraced segment owns nothing.
   */
  ownsStep(stepSpanData: unknown): boolean;
  /** First-chunk clocks measured under this segment, from the first candidate that carries them. */
  clocks(...candidates: Array<SegmentState | undefined>): SpanClockAttributes | undefined;
}

function isSpanRecord(value: unknown): value is { id: string; traceId: string } {
  const span = value as { id?: unknown; traceId?: unknown } | null | undefined;
  return !!span && typeof span === 'object' && typeof span.id === 'string' && typeof span.traceId === 'string';
}

function readRaw(source: RequestContext | Record<string, unknown> | undefined, key: string): unknown {
  if (!source) return undefined;
  return source instanceof RequestContext ? source.getRaw(key) : source[key];
}

/**
 * The carrier for `runId`, parsed at the boundary. Malformed data reads as absent (one log line), so
 * the step falls back to the loop state. Never throws.
 */
function readCarriedSegment(
  source: RequestContext | Record<string, unknown> | undefined,
  runId: string,
  logger?: IMastraLogger,
): SegmentSpanData | undefined {
  const all = readRaw(source, MASTRA_DURABLE_SEGMENTS_KEY);
  if (!all || typeof all !== 'object') return undefined;
  const entry = (all as Record<string, unknown>)[runId];
  if (entry === undefined) return undefined;
  const carried = entry as Partial<CarriedSegment> | null;
  const wellFormed =
    !!carried &&
    typeof carried === 'object' &&
    carried.v === 1 &&
    (carried.agent === null || isSpanRecord(carried.agent)) &&
    (carried.model === null || carried.model === undefined || isSpanRecord(carried.model)) &&
    (!carried.agent || !carried.model || carried.agent.traceId === carried.model.traceId) &&
    (carried.adoptsStepsOf === undefined || typeof carried.adoptsStepsOf === 'string');
  if (!wellFormed) {
    logger?.warn?.(`[DurableAgent] Ignoring malformed segment spans carried for run ${runId}`);
    return undefined;
  }
  if (!carried.agent) return {};
  return {
    agentSpanData: carried.agent,
    ...(carried.model ? { modelSpanData: carried.model } : {}),
    ...(carried.adoptsStepsOf ? { adoptsStepsOf: carried.adoptsStepsOf } : {}),
  };
}

function writeCarriedSegment(
  target: RequestContext | Record<string, unknown>,
  runId: string,
  carried: CarriedSegment,
): void {
  const current = readRaw(target, MASTRA_DURABLE_SEGMENTS_KEY);
  const next = { ...(current && typeof current === 'object' ? (current as object) : {}), [runId]: carried };
  if (target instanceof RequestContext) target.setRaw(MASTRA_DURABLE_SEGMENTS_KEY, next);
  else target[MASTRA_DURABLE_SEGMENTS_KEY] = next;
}

function toClockAttributes(state: SegmentState): SpanClockAttributes | undefined {
  const attributes: SpanClockAttributes = {
    ...(state.completionStartTime ? { completionStartTime: new Date(state.completionStartTime) } : {}),
    ...(state.timeToFirstTokenMs !== undefined ? { timeToFirstTokenMs: state.timeToFirstTokenMs } : {}),
  };
  return Object.keys(attributes).length ? attributes : undefined;
}

/** The MODEL_GENERATION a state's clocks were measured under; undefined when the state cannot say. */
function clockOwner(state: SegmentState): string | undefined {
  return state.clockSpanId ?? (state.modelSpanData as { id?: string } | undefined)?.id;
}

/**
 * The segment the current execution reports under: the request-context carrier for `runId`, else
 * the given state's span data. The carrier is constant for a whole execution, so every step of one
 * execution resolves the same segment.
 */
export function currentSegment(args: {
  mastra: Mastra | undefined;
  requestContext: RequestContext | undefined;
  runId: string;
  state: SegmentState;
}): DurableSegment {
  const { mastra, requestContext, runId, state } = args;
  const carried = readCarriedSegment(requestContext, runId, mastra?.getLogger?.());
  const data: SegmentSpanData = carried ?? {
    agentSpanData: state.agentSpanData as ExportedSpan<SpanType.AGENT_RUN> | undefined,
    modelSpanData: state.modelSpanData as ExportedSpan<SpanType.MODEL_GENERATION> | undefined,
  };
  // Carried as untraced: this segment opened no spans, so it owns nothing of an earlier one.
  const untraced = !!carried && !carried.agentSpanData;
  const observability = () => mastra?.observability?.getSelectedInstance({ requestContext });
  const live = <S extends AnySpan>(span: S | undefined, snapshot: AnyExportedSpan | undefined): S | undefined =>
    span && snapshot && span.id === snapshot.id ? span : undefined;
  let agentSpan: Span<SpanType.AGENT_RUN> | undefined | null = null;
  let modelSpan: AIModelGenerationSpan | undefined | null = null;
  return {
    ...data,
    agentSpan() {
      if (agentSpan === null) {
        const registry = getRunRegistryEntry(runId, mastra);
        agentSpan =
          live(registry?.agentSpan, data.agentSpanData) ??
          (data.agentSpanData ? observability()?.rebuildSpan(data.agentSpanData) : undefined);
      }
      return agentSpan;
    },
    modelSpan() {
      if (modelSpan === null) {
        const registry = getRunRegistryEntry(runId, mastra);
        modelSpan =
          live(registry?.modelSpan, data.modelSpanData) ??
          (data.modelSpanData
            ? (observability()?.rebuildSpan(data.modelSpanData) as AIModelGenerationSpan | undefined)
            : undefined);
      }
      return modelSpan;
    },
    ownsStep(stepSpanData) {
      if (untraced) return false;
      if (!data.modelSpanData) return true;
      const parent = (stepSpanData as { parentSpanId?: string } | undefined)?.parentSpanId;
      return parent === data.modelSpanData.id || (data.adoptsStepsOf !== undefined && parent === data.adoptsStepsOf);
    },
    clocks(...candidates) {
      const owner = data.modelSpanData?.id;
      // State that cannot say where it measured predates `clockSpanId`: it was measured under
      // the loop-state segment, so only that segment may use it.
      const legacyOwner = (state.modelSpanData as { id?: string } | undefined)?.id;
      const hit = candidates.find(
        candidate => !!candidate?.completionStartTime && (clockOwner(candidate) ?? legacyOwner) === owner,
      );
      return hit && toClockAttributes(hit);
    },
  };
}

/**
 * Clocks for the next loop state. The first inference wins within a segment; a new segment's first
 * inference replaces the previous segment's clocks. An output without `clockSpanId` (memoized
 * before this field existed) was measured under the loop-state segment: it is stamped as that
 * segment's, and ignored once the state carries a later segment's clocks.
 */
export function nextSegmentClocks<TClock extends Date | string | undefined>(
  current: SegmentState & { completionStartTime?: TClock },
  output: { completionStartTime?: TClock; timeToFirstTokenMs?: number; clockSpanId?: string },
): { completionStartTime?: TClock; timeToFirstTokenMs?: number; clockSpanId?: string } {
  const owner = clockOwner(current);
  const sameSegment = output.clockSpanId === undefined || output.clockSpanId === owner;
  if (current.completionStartTime && sameSegment) {
    return {
      completionStartTime: current.completionStartTime,
      timeToFirstTokenMs: current.timeToFirstTokenMs,
      ...(current.clockSpanId ? { clockSpanId: current.clockSpanId } : {}),
    };
  }
  const clockSpanId = output.clockSpanId ?? owner;
  return {
    completionStartTime: output.completionStartTime,
    timeToFirstTokenMs: output.timeToFirstTokenMs,
    ...(clockSpanId ? { clockSpanId } : {}),
  };
}

export interface OpenedSegment {
  agentSpan: Span<SpanType.AGENT_RUN>;
  modelSpan?: AIModelGenerationSpan;
}

/** The agent an opened segment is attributed to; `Agent` satisfies this. */
export interface SegmentAgent {
  id: string;
  name?: string;
  getTracingPolicy?(): TracingPolicy | undefined;
  toRawConfig?(): { resolvedVersionId?: unknown } | undefined;
}

/**
 * Open the spans of a new segment (resume or recovery) and carry them to the workers. Creating and
 * carrying are one call, so a caller cannot open spans the worker never learns about.
 *
 * The new AGENT_RUN nests under `previous` in the same trace, with the chain's first segment as
 * `resumedFromSpanId`, and inherits its sampling decision and trace state. Returns undefined, and
 * carries "untraced", when tracing is off, `previous` is unsampled, or creation fails (logged).
 * Never throws.
 */
export function openSegment(args: {
  mastra: Mastra | undefined;
  kind: 'resumed' | 'recovered';
  runId: string;
  agent: SegmentAgent;
  /** Model (or persisted config) whose attributes the AGENT_RUN and MODEL_GENERATION carry. */
  model: { modelId?: unknown; provider?: unknown } | undefined;
  /** The segment this one continues: a live span (warm) or its snapshot (cold, other process). */
  previous: AnySpan | AnyExportedSpan | undefined;
  /**
   * Recovery only: the MODEL_GENERATION of `previous` when it crashed mid-step, so the recovered
   * segment ends the step it left open. Omit when that segment had already ended.
   */
  adoptsStepsOf?: string;
  requestContext: RequestContext | undefined;
  /** The request context the handoff serializes for the workers. */
  carryInto: RequestContext | Record<string, unknown>;
}): OpenedSegment | undefined {
  const { mastra, kind, runId, agent, model, previous, adoptsStepsOf, requestContext, carryInto } = args;
  const untraced: CarriedSegment = { v: 1, agent: null, model: null };
  if (!previous || !mastra?.observability) {
    writeCarriedSegment(carryInto, runId, untraced);
    return undefined;
  }
  try {
    const live = 'exportSpan' in previous;
    const sampled = live ? previous.isValid : previous.id !== 'no-op';
    const resumeFrom = getResumeTracingContext(previous);
    if (!sampled || !resumeFrom) {
      writeCarriedSegment(carryInto, runId, untraced);
      return undefined;
    }
    const resolvedVersionId = agent.toRawConfig?.()?.resolvedVersionId;
    // A snapshot carries the trace state it was saved with; a bare export carries none.
    const traceState = (previous as { traceState?: TraceState }).traceState;
    const agentSpan = getOrCreateSpan({
      type: SpanType.AGENT_RUN,
      outcome: null,
      name: `agent run: '${agent.id}' (${kind})`,
      entityType: EntityType.AGENT,
      entityId: agent.id,
      entityName: agent.name,
      attributes: modelSpanAttributes(model),
      metadata: {
        runId,
        [kind]: true,
        ...(kind === 'resumed'
          ? { resumedFromSpanId: resumeFrom.resumedFromSpanId ?? resumeFrom.spanId }
          : { recoveredFromSpanId: resumeFrom.spanId }),
        ...(typeof resolvedVersionId === 'string' ? { entityVersionId: resolvedVersionId } : {}),
      },
      resumeFrom,
      tracingPolicy: agent.getTracingPolicy?.(),
      tracingOptions: { traceId: previous.traceId, ...traceState },
      traceState,
      samplingDecision: sampled,
      requestContext,
      mastra,
    });
    const modelSpan = agentSpan?.createChildSpan({
      type: SpanType.MODEL_GENERATION,
      outcome: null,
      name: `llm: '${typeof model?.modelId === 'string' ? model.modelId : ''}'`,
      attributes: { ...modelSpanAttributes(model), streaming: true },
      metadata: { runId, [kind]: true },
      requestContext,
    });
    if (!agentSpan) {
      writeCarriedSegment(carryInto, runId, untraced);
      return undefined;
    }
    writeCarriedSegment(carryInto, runId, {
      v: 1,
      agent: agentSpan.snapshot?.() ?? agentSpan.exportSpan() ?? null,
      model: modelSpan?.snapshot?.() ?? modelSpan?.exportSpan() ?? null,
      ...(kind === 'recovered' && adoptsStepsOf ? { adoptsStepsOf } : {}),
    });
    return { agentSpan, modelSpan };
  } catch (error) {
    mastra.getLogger?.()?.warn?.(`[DurableAgent] Failed to open ${kind} spans for run ${runId}: ${error}`);
    writeCarriedSegment(carryInto, runId, untraced);
    return undefined;
  }
}

/**
 * The segment a persisted snapshot was last executing or suspended in: the carrier in its request
 * context (written by the execution that persisted it), else the workflow input's spans (segment #1,
 * and every snapshot written before the carrier existed).
 */
export function segmentFromSnapshot(snapshot: WorkflowRunState | undefined, runId: string): SegmentSpanData {
  const input = snapshot?.context?.input as SegmentState | undefined;
  return (
    readCarriedSegment(snapshot?.requestContext, runId) ?? {
      agentSpanData: input?.agentSpanData as ExportedSpan<SpanType.AGENT_RUN> | undefined,
      modelSpanData: input?.modelSpanData as ExportedSpan<SpanType.MODEL_GENERATION> | undefined,
    }
  );
}

/**
 * Whether the segment a crashed run was executing had already ended before the crash:
 * map-final-output saved its success, or a step is still suspended (the segment ended `suspend`
 * and a resume claimed the run but no worker re-entered it). A snapshot without a carrier applies
 * the older rule: a recorded `resumedAt` means the originals ended `suspend`.
 */
export function segmentEndedBeforeCrash(snapshot: WorkflowRunState, runId: string): boolean {
  const context = snapshot.context as Record<string, { status?: string; resumedAt?: number } | undefined>;
  if (context?.[MAP_FINAL_OUTPUT_STEP_ID]?.status === 'success') return true;
  const results = Object.entries(context ?? {}).flatMap(([key, result]) => (key === 'input' ? [] : [result]));
  if (results.some(result => result?.status === 'suspended')) return true;
  if (readCarriedSegment(snapshot.requestContext, runId)) return false;
  return results.some(result => result?.resumedAt != null);
}
