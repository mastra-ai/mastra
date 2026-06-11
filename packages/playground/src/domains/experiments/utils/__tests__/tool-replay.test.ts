import { describe, expect, it } from 'vitest';
import {
  cleanReport,
  divergentReport,
  failedReplayResult,
  junkMarkerExperiment,
  liveExperiment,
  liveResultWithJunkToolReplay,
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

  it('ignores an object marker without onMiss (not the stamped shape)', () => {
    expect(getReplayMarker(noOnMissMarkerExperiment)).toBeNull();
  });

  it('normalizes unknown onMiss values to error for display', () => {
    expect(getReplayMarker({ metadata: { toolReplay: { onMiss: 'weird' } } })).toEqual({ onMiss: 'error' });
  });
});

describe('getToolReplayReport', () => {
  it('extracts a shape-valid report from output.toolReplay', () => {
    expect(getToolReplayReport(replayResult)).toEqual(divergentReport);
    expect(getToolReplayReport(failedReplayResult)).toEqual(divergentReport);
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
    expect(stripToolReplayFromOutput(replayResult.output)).toEqual({ text: 'Please send a photo first.' });
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
  it('labels the three replay error codes', () => {
    expect(getToolReplayErrorLabel('TOOL_REPLAY_MISS')).toMatch(/no remaining recorded event/);
    expect(getToolReplayErrorLabel('TOOL_REPLAY_NO_RECORDING')).toMatch(/No recording/);
    expect(getToolReplayErrorLabel('TOOL_REPLAY_LOAD_FAILED')).toMatch(/could not be loaded/);
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
});

describe('classifyReplayDivergence', () => {
  it('prioritizes misses, then arg mismatches, then unconsumed', () => {
    expect(classifyReplayDivergence(divergentReport)).toBe('misses');
    expect(classifyReplayDivergence({ ...divergentReport, misses: [] })).toBe('arg-mismatches');
    expect(classifyReplayDivergence({ ...divergentReport, misses: [], argMismatches: [] })).toBe('unconsumed-only');
    expect(classifyReplayDivergence(cleanReport)).toBe('clean');
  });
});
