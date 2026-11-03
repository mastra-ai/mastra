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
  toolRequestContext,
  segmentEndedBeforeCrash,
  segmentFromSnapshot,
  withCarriedSegments,
  withoutDurableEngineKeys,
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
    ['an adoptsStepsOf that is not a span id', { ...carriedSecond, adoptsStepsOf: 5 }],
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

  it('owns no step when carried as untraced: the suspended step was ended by the segment that opened it', () => {
    const untraced = currentSegment({
      mastra: undefined,
      requestContext: carrying({ v: 1, agent: null, model: null }),
      runId: RUN_ID,
      state: first,
    });
    expect(untraced.ownsStep({ parentSpanId: 'model-1' })).toBe(false);
  });

  it('adopts only the steps of the segment that crashed when it is a recovered segment', () => {
    const recoveredSegment = (adoptsStepsOf?: string) =>
      currentSegment({
        mastra: undefined,
        requestContext: carrying({
          v: 1,
          agent: span('agent_run' as SpanType.AGENT_RUN, 'agent-r', 'agent-2', { metadata: { recovered: true } }),
          model: span('model_generation' as SpanType.MODEL_GENERATION, 'model-r', 'agent-r'),
          ...(adoptsStepsOf ? { adoptsStepsOf } : {}),
        }),
        runId: RUN_ID,
        state: first,
      });
    // The resumed segment (model-2) crashed mid-step; the first segment (model-1) had suspended.
    const recovered = recoveredSegment('model-2');
    expect(recovered.ownsStep({ parentSpanId: 'model-r' })).toBe(true);
    expect(recovered.ownsStep({ parentSpanId: 'model-2' })).toBe(true);
    expect(recovered.ownsStep({ parentSpanId: 'model-1' })).toBe(false);
    // The crashed segment had already ended (a step was suspended): nothing to adopt.
    expect(recoveredSegment().ownsStep({ parentSpanId: 'model-2' })).toBe(false);
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

describe('engine-private request context keys', () => {
  it('hands the engine the caller instance read through, with the opened segment on top and never on the caller', () => {
    const caller = new RequestContext();
    caller.set('tenant', 'acme');
    caller.setRaw(SEGMENTS_KEY, { 'run-2': carriedSecond });
    const carrier: Record<string, unknown> = {};
    openSegment({
      mastra: new Mastra({ logger: false }),
      kind: 'resumed',
      runId: RUN_ID,
      agent: new Agent({ id: 'a', name: 'a', instructions: 'x', model: 'openai/gpt-4o-mini' }),
      model: undefined,
      previous: first.agentSpanData,
      requestContext: caller,
      carryInto: carrier,
    });
    const forwarded = withCarriedSegments(caller, carrier);
    const carried = { 'run-2': carriedSecond, [RUN_ID]: { v: 1, agent: null, model: null } };
    expect(forwarded).toBeInstanceOf(RequestContext);
    expect(forwarded.get('tenant')).toBe('acme');
    expect(forwarded.getRaw(SEGMENTS_KEY)).toEqual(carried);
    expect(forwarded.toJSON()).toEqual({ tenant: 'acme', [SEGMENTS_KEY]: carried });
    expect([...forwarded.entries()]).toEqual([
      ['tenant', 'acme'],
      [SEGMENTS_KEY, carried],
    ]);
    expect(caller.getRaw(SEGMENTS_KEY)).toEqual({ 'run-2': carriedSecond });

    // The engine and the caller share one instance: a write on either side is read on the other.
    forwarded.set('fromEngine', 1);
    caller.set('fromCaller', 2);
    expect(caller.get('fromEngine')).toBe(1);
    expect(forwarded.get('fromCaller')).toBe(2);
    expect(forwarded.size()).toBe(4);
  });

  it('gives user code a live view of the run values without the claim and the segment carrier', () => {
    const step = new RequestContext();
    step.set('tenant', 'acme');
    step.setRaw('mastra__authToken', 'token');
    step.setRaw('mastra__durableExecutions', { [RUN_ID]: { executionId: 'exec-1' } });
    step.setRaw(SEGMENTS_KEY, { [RUN_ID]: carriedSecond });
    const forUser = withoutDurableEngineKeys(step);
    expect(forUser).toBeInstanceOf(RequestContext);
    expect([...forUser.keys()]).toEqual(['tenant', 'mastra__authToken']);
    expect(Object.keys(forUser.toJSON())).toEqual(['tenant', 'mastra__authToken']);
    expect(forUser.get(SEGMENTS_KEY)).toBeUndefined();
    expect(forUser.has('mastra__durableExecutions')).toBe(false);
    expect(step.hasRaw(SEGMENTS_KEY)).toBe(true);

    // A value user code writes lands on the step's context, where the next step reads it.
    forUser.set('fromTool', 'written');
    expect(step.get('fromTool')).toBe('written');
    forUser.setRaw(SEGMENTS_KEY, 'overwritten');
    expect(step.getRaw(SEGMENTS_KEY)).toEqual({ [RUN_ID]: carriedSecond });
  });

  it('hands a tool the instance it was built over when the engine context is or reads through to it', () => {
    const caller = new RequestContext();
    caller.set('tenant', 'acme');
    caller.setRaw('mastra__durableExecutions', { [RUN_ID]: { executionId: 'exec-1' } });
    const engine = withCarriedSegments(caller, { [SEGMENTS_KEY]: { [RUN_ID]: carriedSecond } });
    expect(toolRequestContext(caller, caller)).toBe(caller);
    expect(toolRequestContext(engine, caller)).toBe(caller);

    const rehydrated = new RequestContext(Object.entries(engine.toJSON()));
    const forTool = toolRequestContext(rehydrated, caller)!;
    expect(forTool).not.toBe(caller);
    expect([...forTool.keys()]).toEqual(['tenant']);
    expect(toolRequestContext(undefined, caller)).toBeUndefined();
  });
});

describe('clearing durable request context values', () => {
  for (const view of ['engine', 'processor', 'tool'] as const) {
    it.each(['context', 'callback map'] as const)(
      `${view}: %s clear keeps the segment and clears the claim like main`,
      surface => {
        const caller = new RequestContext();
        caller.set('tenant', 'acme');
        caller.setRaw('mastra__durableExecutions', { [RUN_ID]: { executionId: 'exec-1' } });
        const engine = withCarriedSegments(caller, { [SEGMENTS_KEY]: { [RUN_ID]: carriedSecond } });
        const context =
          view === 'engine'
            ? engine
            : view === 'processor'
              ? withoutDurableEngineKeys(engine)
              : toolRequestContext(engine, undefined)!;
        if (surface === 'context') context.clear();
        else context.forEach((_value, _key, map) => map.clear());

        expect(context.has('tenant')).toBe(false);
        expect(caller.has('tenant')).toBe(false);
        expect(engine.getRaw(SEGMENTS_KEY)).toEqual({ [RUN_ID]: carriedSecond });
        expect(engine.hasRaw('mastra__durableExecutions')).toBe(false);
        expect(
          currentSegment({ mastra: undefined, requestContext: engine, runId: RUN_ID, state: first }).agentSpanData?.id,
        ).toBe('agent-2');
        if (view !== 'engine') expect([...context.entries()]).toEqual([]);
      },
    );
  }
});

describe('a filtered request context keeps mutable values live', () => {
  it.each(['get', 'getRaw', 'entries', 'values', 'all', 'toJSON'] as const)('%s shares stored objects', method => {
    const caller = carrying(carriedSecond);
    caller.set('settings', { flag: 'before' });
    const context = withoutDurableEngineKeys(caller);
    const values = {
      get: () => context.get<string, { flag: string }>('settings'),
      getRaw: () => context.getRaw('settings'),
      entries: () => [...context.entries()].find(([key]) => key === 'settings')?.[1],
      values: () => [...context.values()][0],
      all: () => context.all.settings,
      toJSON: () => context.toJSON().settings,
    };
    const value = values[method]();
    if (!value || typeof value !== 'object' || !('flag' in value)) throw new Error('missing settings');
    value.flag = 'after';
    expect(caller.get('settings')).toEqual({ flag: 'after' });
    expect(context.has(SEGMENTS_KEY)).toBe(false);
  });

  it('forEach exposes a live filtered Map, including nested iteration and later writes', () => {
    const caller = carrying(carriedSecond);
    caller.set('flag', 'before');
    caller.set('remove', true);
    const context = withoutDurableEngineKeys(caller);
    let retained: Map<string, unknown> | undefined;
    const visited: string[] = [];
    context.forEach((_value, key, map) => {
      retained = map;
      visited.push(key);
      expect(map.size).toBe(context.size());
      expect([...map]).toEqual([...context.entries()]);
      expect([...map.values()]).toEqual([...context.values()]);
      expect(map.get(SEGMENTS_KEY)).toBeUndefined();
      if (key === 'flag') {
        expect(map.set(key, 'after')).toBe(map);
        expect(map.delete('remove')).toBe(true);
        map.set('added', true);
        map.set(SEGMENTS_KEY, 'hidden');
        map.forEach((_nested, nestedKey, nestedMap) => {
          expect(nestedMap).toBe(map);
          expect(nestedKey).not.toBe(SEGMENTS_KEY);
        });
      }
    });
    expect(visited).toEqual(['flag', 'added']);
    expect(caller.get('flag')).toBe('after');
    expect(caller.has('remove')).toBe(false);
    expect(caller.get('added')).toBe(true);
    expect(caller.get(SEGMENTS_KEY)).toEqual({ [RUN_ID]: carriedSecond });
    caller.set('later', 1);
    expect(retained?.get('later')).toBe(1);
    retained?.set('flag', 'retained');
    expect(caller.get('flag')).toBe('retained');
    retained?.clear();
    expect(caller.toJSON()).toEqual({ [SEGMENTS_KEY]: { [RUN_ID]: carriedSecond } });
  });
});
