import { describe, expect, it } from 'vitest';

import { Mastra } from '../../mastra';
import type { ExportedSpan, SpanType } from '../../observability';
import { NoOpObservability } from '../../observability/no-op';
import { RequestContext } from '../../request-context';
import type { WorkflowRunState } from '../../workflows/types';
import { Agent } from '../agent';
import { MAP_FINAL_OUTPUT_STEP_ID } from './constants';
import { globalRunRegistry } from './run-registry';
import {
  currentSegment,
  nextSegmentClocks,
  openSegment,
  segmentEndedBeforeCrash,
  segmentFromSnapshot,
} from './segment-spans';

const SEGMENTS_KEY = 'mastra__durableSegments';
const RUN_ID = 'run-1';

function span<T extends SpanType>(type: T, id: string, parentSpanId?: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    traceId: 'trace-1',
    type,
    name: id,
    startTime: new Date(0),
    isEvent: false,
    isRootSpan: !parentSpanId,
    parentSpanId,
    ...extra,
  } as unknown as ExportedSpan<T>;
}

const first = {
  agentSpanData: span('agent_run' as SpanType.AGENT_RUN, 'agent-1'),
  modelSpanData: span('model_generation' as SpanType.MODEL_GENERATION, 'model-1', 'agent-1'),
};
const second = {
  agentSpanData: span('agent_run' as SpanType.AGENT_RUN, 'agent-2', 'agent-1', { metadata: { resumed: true } }),
  modelSpanData: span('model_generation' as SpanType.MODEL_GENERATION, 'model-2', 'agent-2'),
};

function carrying(entry: unknown, runId = RUN_ID) {
  const requestContext = new RequestContext();
  requestContext.setRaw(SEGMENTS_KEY, { [runId]: entry });
  return requestContext;
}

const carriedSecond = { v: 1, agent: second.agentSpanData, model: second.modelSpanData };

describe('currentSegment', () => {
  it('reports under the pair carried in the request context before the loop state', () => {
    const segment = currentSegment({
      mastra: undefined,
      requestContext: carrying(carriedSecond),
      runId: RUN_ID,
      state: first,
    });
    expect(segment.agentSpanData?.id).toBe('agent-2');
    expect(segment.modelSpanData?.id).toBe('model-2');
  });

  it('reports under the loop state when nothing is carried, or when the carrier belongs to another run', () => {
    expect(
      currentSegment({ mastra: undefined, requestContext: undefined, runId: RUN_ID, state: first }).agentSpanData?.id,
    ).toBe('agent-1');
    const other = currentSegment({
      mastra: undefined,
      requestContext: carrying(carriedSecond, 'run-2'),
      runId: RUN_ID,
      state: first,
    });
    expect(other.agentSpanData?.id).toBe('agent-1');
  });

  it.each([
    ['a wrong version', { ...carriedSecond, v: 2 }],
    ['an agent without ids', { v: 1, agent: { name: 'x' }, model: null }],
    [
      'a model from another trace',
      { v: 1, agent: second.agentSpanData, model: { ...second.modelSpanData, traceId: 'trace-2' } },
    ],
    ['a non-object', 'garbage'],
  ])('falls back to the loop state for a malformed carrier: %s', (_label, entry) => {
    const segment = currentSegment({ mastra: undefined, requestContext: carrying(entry), runId: RUN_ID, state: first });
    expect(segment.agentSpanData?.id).toBe('agent-1');
  });

  it('ends nothing for a segment carried as untraced instead of falling back to the previous pair', () => {
    const segment = currentSegment({
      mastra: undefined,
      requestContext: carrying({ v: 1, agent: null, model: null }),
      runId: RUN_ID,
      state: first,
    });
    expect(segment.agentSpanData).toBeUndefined();
    expect(segment.modelSpanData).toBeUndefined();
    expect(segment.agentSpan()).toBeUndefined();
    expect(segment.modelSpan()).toBeUndefined();
  });

  it('uses the registry span only when its id matches the resolved segment', () => {
    const mastra = new Mastra({ logger: false });
    const live = { id: 'agent-1', traceId: 'trace-1' } as never;
    const stale = { id: 'agent-0', traceId: 'trace-1' } as never;
    try {
      globalRunRegistry.set(RUN_ID, { mastra, agentSpan: live, tools: {}, model: undefined as never } as never);
      expect(currentSegment({ mastra, requestContext: undefined, runId: RUN_ID, state: first }).agentSpan()).toBe(live);
      globalRunRegistry.set(RUN_ID, { mastra, agentSpan: stale, tools: {}, model: undefined as never } as never);
      // No observability on this Mastra, so a non-matching live span yields no handle at all.
      expect(
        currentSegment({ mastra, requestContext: undefined, runId: RUN_ID, state: first }).agentSpan(),
      ).toBeUndefined();
    } finally {
      globalRunRegistry.delete(RUN_ID);
    }
  });

  it('owns a MODEL_STEP opened under its own MODEL_GENERATION, not one from the segment that suspended', () => {
    const resumed = currentSegment({
      mastra: undefined,
      requestContext: carrying(carriedSecond),
      runId: RUN_ID,
      state: first,
    });
    expect(resumed.ownsStep({ parentSpanId: 'model-1' })).toBe(false);
    expect(resumed.ownsStep({ parentSpanId: 'model-2' })).toBe(true);
    const unknown = currentSegment({ mastra: undefined, requestContext: undefined, runId: RUN_ID, state: {} });
    expect(unknown.ownsStep({ parentSpanId: 'model-1' })).toBe(true);
  });

  it('adopts the step a crashed segment left open when it is a recovered segment', () => {
    const recovered = currentSegment({
      mastra: undefined,
      requestContext: carrying({
        v: 1,
        agent: span('agent_run' as SpanType.AGENT_RUN, 'agent-r', 'agent-1', { metadata: { recovered: true } }),
        model: span('model_generation' as SpanType.MODEL_GENERATION, 'model-r', 'agent-r'),
      }),
      runId: RUN_ID,
      state: first,
    });
    expect(recovered.ownsStep({ parentSpanId: 'model-1' })).toBe(true);
  });

  it('takes clocks only from a state measured under its own MODEL_GENERATION', () => {
    const at = new Date('2026-01-01T00:00:00Z');
    const resumed = currentSegment({
      mastra: undefined,
      requestContext: carrying(carriedSecond),
      runId: RUN_ID,
      state: first,
    });
    // The loop state's clocks belong to the first segment (no clockSpanId: legacy meaning).
    expect(resumed.clocks({ ...first, completionStartTime: at, timeToFirstTokenMs: 5 })).toBeUndefined();
    expect(resumed.clocks({ ...first, completionStartTime: at, clockSpanId: 'model-2' })).toEqual({
      completionStartTime: at,
    });
    // A step input that cannot say where it measured (persisted before `clockSpanId` existed) was
    // measured under the first segment: a later segment never borrows it.
    expect(resumed.clocks(undefined, { completionStartTime: at.toISOString(), timeToFirstTokenMs: 7 })).toBeUndefined();
    expect(
      resumed.clocks({ ...first, completionStartTime: at, timeToFirstTokenMs: 5 }, { completionStartTime: at }),
    ).toBeUndefined();
    const original = currentSegment({ mastra: undefined, requestContext: undefined, runId: RUN_ID, state: first });
    expect(original.clocks({ ...first, completionStartTime: at, timeToFirstTokenMs: 5 })).toEqual({
      completionStartTime: at,
      timeToFirstTokenMs: 5,
    });
    expect(original.clocks(undefined, { completionStartTime: at.toISOString(), timeToFirstTokenMs: 7 })).toEqual({
      completionStartTime: at,
      timeToFirstTokenMs: 7,
    });
  });

  it('gives an untraced run its ownerless clocks, since it has no segment to attribute them to', () => {
    const at = new Date('2026-01-01T00:00:00Z');
    const untraced = currentSegment({ mastra: undefined, requestContext: undefined, runId: RUN_ID, state: {} });
    expect(untraced.clocks({ completionStartTime: at, timeToFirstTokenMs: 5 })).toEqual({
      completionStartTime: at,
      timeToFirstTokenMs: 5,
    });
  });
});

describe('nextSegmentClocks', () => {
  const early = new Date('2026-01-01T00:00:00Z');
  const late = new Date('2026-01-01T00:00:01Z');

  it('keeps the first inference of a segment', () => {
    expect(
      nextSegmentClocks(
        { ...first, completionStartTime: early, timeToFirstTokenMs: 1 },
        { completionStartTime: late, clockSpanId: 'model-1' },
      ),
    ).toEqual({ completionStartTime: early, timeToFirstTokenMs: 1 });
  });

  it('replaces the previous segment clocks with the new segment first inference', () => {
    expect(
      nextSegmentClocks(
        { ...first, completionStartTime: early, timeToFirstTokenMs: 1 },
        { completionStartTime: late, timeToFirstTokenMs: 2, clockSpanId: 'model-2' },
      ),
    ).toEqual({ completionStartTime: late, timeToFirstTokenMs: 2, clockSpanId: 'model-2' });
  });

  it('counts an output without clockSpanId as the first segment and stamps that owner', () => {
    expect(nextSegmentClocks(first, { completionStartTime: late, timeToFirstTokenMs: 2 })).toEqual({
      completionStartTime: late,
      timeToFirstTokenMs: 2,
      clockSpanId: 'model-1',
    });
    expect(nextSegmentClocks({ ...first, completionStartTime: early }, { completionStartTime: late })).toEqual({
      completionStartTime: early,
      timeToFirstTokenMs: undefined,
    });
  });

  it('ignores an output without clockSpanId once the state carries a later segment clocks', () => {
    expect(
      nextSegmentClocks(
        { ...first, completionStartTime: early, timeToFirstTokenMs: 1, clockSpanId: 'model-2' },
        { completionStartTime: late, timeToFirstTokenMs: 2 },
      ),
    ).toEqual({ completionStartTime: early, timeToFirstTokenMs: 1, clockSpanId: 'model-2' });
  });
});

function snapshot(partial: Partial<WorkflowRunState>): WorkflowRunState {
  return { runId: RUN_ID, status: 'running', value: {}, context: {}, ...partial } as WorkflowRunState;
}

describe('segmentFromSnapshot', () => {
  it('reads the carried pair from the persisted request context, else the workflow input pair', () => {
    const carried = snapshot({
      requestContext: { [SEGMENTS_KEY]: { [RUN_ID]: carriedSecond } },
      context: { input: first } as never,
    });
    expect(segmentFromSnapshot(carried, RUN_ID).agentSpanData?.id).toBe('agent-2');
    expect(segmentFromSnapshot(snapshot({ context: { input: first } as never }), RUN_ID).agentSpanData?.id).toBe(
      'agent-1',
    );
    expect(segmentFromSnapshot(undefined, RUN_ID)).toEqual({ agentSpanData: undefined, modelSpanData: undefined });
  });
});

describe('segmentEndedBeforeCrash', () => {
  it('is true once the final step saved its success', () => {
    expect(
      segmentEndedBeforeCrash(
        snapshot({ context: { [MAP_FINAL_OUTPUT_STEP_ID]: { status: 'success' } } as never }),
        RUN_ID,
      ),
    ).toBe(true);
  });

  it('is true while a step is still suspended: the segment ended `suspend` and nothing re-entered it', () => {
    expect(segmentEndedBeforeCrash(snapshot({ context: { tool: { status: 'suspended' } } as never }), RUN_ID)).toBe(
      true,
    );
  });

  it('applies the older resumedAt rule only to snapshots without a carrier', () => {
    const resumed = { tool: { status: 'running', resumedAt: 1 } } as never;
    expect(segmentEndedBeforeCrash(snapshot({ context: resumed }), RUN_ID)).toBe(true);
    expect(
      segmentEndedBeforeCrash(
        snapshot({ context: resumed, requestContext: { [SEGMENTS_KEY]: { [RUN_ID]: carriedSecond } } }),
        RUN_ID,
      ),
    ).toBe(false);
    expect(segmentEndedBeforeCrash(snapshot({ context: { tool: { status: 'running' } } as never }), RUN_ID)).toBe(
      false,
    );
  });
});

describe('openSegment', () => {
  const agent = new Agent({ id: 'a', name: 'a', instructions: 'x', model: 'openai/gpt-4o-mini' });

  it('carries "untraced" and opens nothing when tracing is off', () => {
    const carryInto: Record<string, unknown> = {};
    const opened = openSegment({
      mastra: new Mastra({ logger: false }),
      kind: 'resumed',
      runId: RUN_ID,
      agent,
      model: undefined,
      previous: first.agentSpanData,
      requestContext: undefined,
      carryInto,
    });
    expect(opened).toBeUndefined();
    expect(carryInto).toEqual({ [SEGMENTS_KEY]: { [RUN_ID]: { v: 1, agent: null, model: null } } });
  });

  it('carries "untraced" when the previous segment was unsampled, so the worker ends nothing', () => {
    const carryInto = new RequestContext();
    carryInto.setRaw(SEGMENTS_KEY, { 'run-2': carriedSecond });
    const opened = openSegment({
      mastra: new Mastra({ logger: false, observability: new NoOpObservability() }),
      kind: 'resumed',
      runId: RUN_ID,
      agent,
      model: undefined,
      previous: { ...first.agentSpanData, id: 'no-op', traceId: 'no-op-trace' },
      requestContext: undefined,
      carryInto,
    });
    expect(opened).toBeUndefined();
    expect(carryInto.getRaw(SEGMENTS_KEY)).toEqual({
      'run-2': carriedSecond,
      [RUN_ID]: { v: 1, agent: null, model: null },
    });
  });
});
