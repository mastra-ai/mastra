import { describe, expect, it } from 'vitest';
import {
  callFlowReport,
  cleanReport,
  divergentReport,
  errorOutcomesCallFlowReport,
  expectationFailedReport,
  expectationFailedResult,
  failedReplayResult,
  junkMarkerExperiment,
  liveExperiment,
  liveResultWithJunkToolReplay,
  mockOnlyCallFlowReport,
  mockOnlyExperiment,
  noOnMissMarkerExperiment,
  replayExperiment,
  replayResult,
} from '../../__tests__/fixtures/tool-replay';
import type { ReplayTapeSpan } from '../tool-replay';
import {
  buildReplayTape,
  classifyReplayDivergence,
  getReplayMarker,
  getToolReplayErrorLabel,
  getToolReplayReport,
  isReplayExperiment,
  stripToolReplayFromOutput,
  summarizeReplayCalls,
} from '../tool-replay';

describe('getReplayMarker / isReplayExperiment', () => {
  it('reads the exact backend marker shape', () => {
    expect(getReplayMarker(replayExperiment)).toEqual({ fromExperimentId: 'exp-live-1', onMiss: 'error' });
    expect(isReplayExperiment(replayExperiment)).toBe(true);
  });

  it('ignores experiments without metadata', () => {
    expect(getReplayMarker(liveExperiment)).toBeNull();
    expect(isReplayExperiment(liveExperiment)).toBe(false);
  });

  it('ignores a user-owned non-object toolReplay key', () => {
    expect(getReplayMarker(junkMarkerExperiment)).toBeNull();
  });

  it('ignores an object marker without onMiss or mockedTools (not a stamped shape)', () => {
    expect(getReplayMarker(noOnMissMarkerExperiment)).toBeNull();
  });

  it('normalizes unknown onMiss values to error for display', () => {
    expect(getReplayMarker({ metadata: { toolReplay: { onMiss: 'weird' } } })).toEqual({ onMiss: 'error' });
  });

  it('reads a mock-only marker (mockedTools without onMiss)', () => {
    expect(getReplayMarker(mockOnlyExperiment)).toEqual({ mockedTools: ['weatherInfo'] });
    expect(isReplayExperiment(mockOnlyExperiment)).toBe(true);
  });

  it('never invents an onMiss for mock-only markers', () => {
    expect(getReplayMarker(mockOnlyExperiment)?.onMiss).toBeUndefined();
  });

  it('reads matching and keeps unknown matching values out', () => {
    expect(
      getReplayMarker({
        metadata: { toolReplay: { fromExperimentId: 'exp-live-1', onMiss: 'error', matching: 'strict' } },
      }),
    ).toEqual({ fromExperimentId: 'exp-live-1', onMiss: 'error', matching: 'strict' });
    expect(getReplayMarker({ metadata: { toolReplay: { onMiss: 'error', matching: 'weird' } } })).toEqual({
      onMiss: 'error',
    });
  });

  it('reads a combined replay+mocks marker and drops non-string tool names', () => {
    expect(
      getReplayMarker({
        metadata: { toolReplay: { onMiss: 'error', mockedTools: ['weatherInfo', 42, 'sendEmail'] } },
      }),
    ).toEqual({ onMiss: 'error', mockedTools: ['weatherInfo', 'sendEmail'] });
  });
});

describe('getToolReplayReport', () => {
  it('reads the dedicated top-level toolReplay column first', () => {
    expect(getToolReplayReport(replayResult)).toEqual(divergentReport);
    expect(getToolReplayReport(expectationFailedResult)).toEqual(expectationFailedReport);
    // Top-level wins when both locations carry a valid report.
    expect(getToolReplayReport({ toolReplay: cleanReport, output: { toolReplay: divergentReport } })).toEqual(
      cleanReport,
    );
  });

  it('falls back to output.toolReplay for older rows', () => {
    expect(getToolReplayReport(failedReplayResult)).toEqual(divergentReport);
    // A shape-invalid top-level value never shadows a valid output report.
    expect(
      getToolReplayReport({ toolReplay: { totalRecorded: 'three' }, output: { toolReplay: cleanReport } }),
    ).toEqual(cleanReport);
  });

  it('rejects user-owned toolReplay values that are not reports', () => {
    expect(getToolReplayReport(liveResultWithJunkToolReplay)).toBeNull();
    expect(getToolReplayReport({ output: { toolReplay: { totalRecorded: 'three' } } })).toBeNull();
  });

  it('rejects non-object outputs', () => {
    expect(getToolReplayReport({ output: 'a plain string answer' })).toBeNull();
    expect(getToolReplayReport({ output: null })).toBeNull();
    expect(getToolReplayReport({ output: [1, 2] })).toBeNull();
  });
});

describe('stripToolReplayFromOutput', () => {
  it('removes the toolReplay key and keeps the rest', () => {
    expect(stripToolReplayFromOutput({ text: 'Please send a photo first.', toolReplay: divergentReport })).toEqual({
      text: 'Please send a photo first.',
    });
  });

  it('returns null for a report-only output (failed item)', () => {
    expect(stripToolReplayFromOutput(failedReplayResult.output)).toBeNull();
  });

  it('passes through outputs without the key', () => {
    expect(stripToolReplayFromOutput({ text: 'hi' })).toEqual({ text: 'hi' });
    expect(stripToolReplayFromOutput('plain')).toBe('plain');
    expect(stripToolReplayFromOutput(null)).toBeNull();
  });
});

describe('getToolReplayErrorLabel', () => {
  it('labels the replay and mock error codes', () => {
    expect(getToolReplayErrorLabel('TOOL_REPLAY_MISS')).toMatch(/no remaining recorded event/);
    expect(getToolReplayErrorLabel('TOOL_REPLAY_NO_RECORDING')).toMatch(/No recording/);
    expect(getToolReplayErrorLabel('TOOL_REPLAY_LOAD_FAILED')).toMatch(/could not be loaded/);
    expect(getToolReplayErrorLabel('TOOL_REPLAY_UNCONSUMED')).toMatch(
      /Strict replay: recorded calls were never consumed/,
    );
    expect(getToolReplayErrorLabel('TOOL_MOCK_EXPECTATION_FAILED')).toMatch(
      /mock expectation was not satisfied — the agent did not call the tool as asserted/,
    );
    expect(getToolReplayErrorLabel('TOOL_MOCK_NAME_COLLISION')).toMatch(/Tool mock names collide after formatting/);
  });

  it('returns null for other codes', () => {
    expect(getToolReplayErrorLabel('SOMETHING_ELSE')).toBeNull();
    expect(getToolReplayErrorLabel(undefined)).toBeNull();
  });
});

describe('buildReplayTape', () => {
  const span = (overrides: Partial<ReplayTapeSpan> & { spanId: string }): ReplayTapeSpan => ({
    spanType: 'tool_call',
    startedAt: '2026-06-01T10:00:00.000Z',
    endedAt: '2026-06-01T10:00:01.000Z',
    entityName: 'get-weather',
    ...overrides,
  });

  it('rebuilds per-tool FIFO with mismatch, unconsumed tail, and misses overlaid', () => {
    const spans: ReplayTapeSpan[] = [
      span({ spanId: 's0', startedAt: '2026-06-01T10:00:00.000Z' }),
      span({ spanId: 's1', startedAt: '2026-06-01T10:00:01.000Z', entityName: 'create-ticket' }),
      span({ spanId: 's2', startedAt: '2026-06-01T10:00:02.000Z' }),
      // Non-tool and nested spans are not part of the tape:
      span({ spanId: 'llm', spanType: 'llm_generation' }),
      span({ spanId: 'nested', parentSpanId: 's2' }),
      // Unfinished recorded call (crashed source run) — skipped like the runner does:
      span({ spanId: 'open', endedAt: null, startedAt: '2026-06-01T10:00:03.000Z' }),
    ];
    const tape = buildReplayTape(spans, {
      sourceTraceId: 'trace-src-1',
      totalRecorded: 3,
      replayedCount: 2,
      misses: [{ toolName: 'get-photos', action: 'error', input: {} }],
      unconsumed: [{ toolName: 'create-ticket', count: 1 }],
      argMismatches: [{ toolName: 'get-weather', sequence: 0, spanId: 's0' }],
    });

    expect(tape).toEqual([
      {
        toolName: 'get-weather',
        events: [
          { sequence: 0, spanId: 's0', status: 'arg-mismatch' },
          { sequence: 2, spanId: 's2', status: 'replayed' },
        ],
        misses: [],
      },
      {
        toolName: 'create-ticket',
        events: [{ sequence: 1, spanId: 's1', status: 'unconsumed' }],
        misses: [],
      },
      { toolName: 'get-photos', events: [], misses: [{ action: 'error' }] },
    ]);
  });

  it('breaks startedAt ties by spanId like the runner', () => {
    const spans: ReplayTapeSpan[] = [span({ spanId: 'b' }), span({ spanId: 'a' })];
    const tape = buildReplayTape(spans, {
      sourceTraceId: 't',
      totalRecorded: 2,
      replayedCount: 2,
      misses: [],
      unconsumed: [],
      argMismatches: [],
    });
    expect(tape[0].events.map(e => e.spanId)).toEqual(['a', 'b']);
  });

  it('derives consumption from the call flow — strict can consume a LATER event and leave an earlier one', () => {
    // Two recorded get-weather events. Strict matching consumed event #1 (the
    // exact-args match) and left event #0 — the FIFO tail heuristic would mark
    // exactly the wrong one unconsumed.
    const spans: ReplayTapeSpan[] = [
      span({ spanId: 's0', startedAt: '2026-06-01T10:00:00.000Z' }),
      span({ spanId: 's1', startedAt: '2026-06-01T10:00:01.000Z' }),
    ];
    const tape = buildReplayTape(spans, {
      sourceTraceId: 'trace-src-strict',
      totalRecorded: 2,
      replayedCount: 1,
      misses: [],
      unconsumed: [{ toolName: 'get-weather', count: 1 }],
      argMismatches: [],
      calls: [{ order: 0, toolName: 'get-weather', outcome: 'replayed', sequence: 1 }],
    });

    expect(tape).toEqual([
      {
        toolName: 'get-weather',
        events: [
          { sequence: 0, spanId: 's0', status: 'unconsumed' },
          { sequence: 1, spanId: 's1', status: 'replayed' },
        ],
        misses: [],
      },
    ]);
  });

  it('counts replayed-error calls as consumed and keeps arg-mismatch on consumed events', () => {
    const spans: ReplayTapeSpan[] = [
      span({ spanId: 's0', startedAt: '2026-06-01T10:00:00.000Z' }),
      span({ spanId: 's1', startedAt: '2026-06-01T10:00:01.000Z', entityName: 'create-ticket' }),
      span({ spanId: 's2', startedAt: '2026-06-01T10:00:02.000Z' }),
    ];
    const tape = buildReplayTape(spans, {
      sourceTraceId: 'trace-src-flow',
      totalRecorded: 3,
      replayedCount: 2,
      misses: [],
      unconsumed: [{ toolName: 'create-ticket', count: 1 }],
      argMismatches: [{ toolName: 'get-weather', sequence: 0, spanId: 's0' }],
      calls: [
        // FIFO drift: event #0 consumed with differing args; recorded error #2 re-thrown.
        { order: 0, toolName: 'get-weather', outcome: 'replayed', sequence: 0, argsDiffered: true },
        { order: 1, toolName: 'get-weather', outcome: 'replayed-error', sequence: 2 },
      ],
    });

    expect(tape).toEqual([
      {
        toolName: 'get-weather',
        events: [
          { sequence: 0, spanId: 's0', status: 'arg-mismatch' },
          { sequence: 2, spanId: 's2', status: 'replayed' },
        ],
        misses: [],
      },
      {
        toolName: 'create-ticket',
        events: [{ sequence: 1, spanId: 's1', status: 'unconsumed' }],
        misses: [],
      },
    ]);
  });

  it('marks every event unconsumed when the call flow shows the run never called a tool', () => {
    const spans: ReplayTapeSpan[] = [span({ spanId: 's0' })];
    const tape = buildReplayTape(spans, {
      sourceTraceId: 'trace-src-none',
      totalRecorded: 1,
      replayedCount: 0,
      misses: [],
      unconsumed: [{ toolName: 'get-weather', count: 1 }],
      argMismatches: [],
      calls: [],
    });
    expect(tape[0].events).toEqual([{ sequence: 0, spanId: 's0', status: 'unconsumed' }]);
  });
});

describe('summarizeReplayCalls', () => {
  it('buckets every call of the flow into exactly one verdict count', () => {
    expect(summarizeReplayCalls(callFlowReport)).toEqual({
      total: 4,
      replayed: 2,
      replayedWithDrift: 1,
      mocked: 1,
      missed: 0,
      live: 1,
    });
    // replayed-error counts as replayed, mock-error as mocked, miss-error as missed.
    expect(summarizeReplayCalls(errorOutcomesCallFlowReport)).toEqual({
      total: 3,
      replayed: 1,
      replayedWithDrift: 0,
      mocked: 1,
      missed: 1,
      live: 0,
    });
    // Mock-only runs: unmocked tools that executed live count as live.
    expect(summarizeReplayCalls(mockOnlyCallFlowReport)).toEqual({
      total: 2,
      replayed: 0,
      replayedWithDrift: 0,
      mocked: 1,
      missed: 0,
      live: 1,
    });
  });

  it('returns null for reports that predate the calls field', () => {
    expect(summarizeReplayCalls(divergentReport)).toBeNull();
    expect(summarizeReplayCalls(cleanReport)).toBeNull();
  });

  it('returns zero counts for a run that never called a tool', () => {
    expect(summarizeReplayCalls({ ...cleanReport, calls: [] })).toEqual({
      total: 0,
      replayed: 0,
      replayedWithDrift: 0,
      mocked: 0,
      missed: 0,
      live: 0,
    });
  });
});

describe('classifyReplayDivergence', () => {
  it('prioritizes misses, then arg mismatches, then unconsumed', () => {
    expect(classifyReplayDivergence(divergentReport)).toBe('misses');
    expect(classifyReplayDivergence({ ...divergentReport, misses: [] })).toBe('arg-mismatches');
    expect(classifyReplayDivergence({ ...divergentReport, misses: [], argMismatches: [] })).toBe('unconsumed-only');
    expect(classifyReplayDivergence(cleanReport)).toBe('clean');
  });

  it('ranks a failed expectation above every other divergence signal', () => {
    expect(classifyReplayDivergence(expectationFailedReport)).toBe('failed-expectations');
    // Even with misses present, the broken assertion wins.
    expect(classifyReplayDivergence({ ...divergentReport, expectations: expectationFailedReport.expectations })).toBe(
      'failed-expectations',
    );
    // All-satisfied expectations never count as divergence.
    expect(
      classifyReplayDivergence({
        ...cleanReport,
        expectations: [{ toolName: 'weatherInfo', satisfied: true, calledTimes: 2 }],
      }),
    ).toBe('clean');
  });
});
