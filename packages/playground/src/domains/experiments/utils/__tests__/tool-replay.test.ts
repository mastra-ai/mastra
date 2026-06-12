import { describe, expect, it } from 'vitest';
import {
  callFlowReport,
  cleanReport,
  divergentReport,
  errorOutcomesCallFlowReport,
  expectationFailedReport,
  expectationFailedResult,
  failedAtSetupExperiment,
  failedReplayResult,
  functionMockExperiment,
  junkMarkerExperiment,
  liveExperiment,
  liveResultWithJunkToolReplay,
  mockOnlyCallFlowReport,
  mockOnlyExperiment,
  mockOnlyWithConfigsExperiment,
  noOnMissMarkerExperiment,
  replayExperiment,
  replayResult,
  strictVersionedReplayExperiment,
} from '../../__tests__/fixtures/tool-replay';
import type { ReplayTapeSpan } from '../tool-replay';
import {
  buildReplayItemReRunParams,
  buildReplayTape,
  classifyReplayDivergence,
  getExperimentFailureReason,
  getReplayMarker,
  getReplayReRunDisabledReason,
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

  it('drops unknown onMiss values instead of inventing a policy (canonical parser semantics)', () => {
    // The backend rejects unknown onMiss at the boundary, so this only arises
    // from metadata tampering — the marker reads as stamped (the key gates the
    // shape) but carries no policy, exactly like the core source-guard sees it.
    expect(getReplayMarker({ metadata: { toolReplay: { onMiss: 'weird' } } })).toEqual({});
  });

  it('passes the persisted mockConfigs through and drops non-object entries', () => {
    expect(
      getReplayMarker({
        metadata: {
          toolReplay: {
            mockedTools: ['weatherInfo'],
            mockConfigs: { weatherInfo: { output: 'sunny' }, sendEmail: { function: true }, junk: 42 },
          },
        },
      }),
    ).toEqual({
      mockedTools: ['weatherInfo'],
      mockConfigs: { weatherInfo: { output: 'sunny' }, sendEmail: { function: true } },
    });
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

describe('getExperimentFailureReason', () => {
  it('reads the exact stamped shape', () => {
    expect(getExperimentFailureReason(failedAtSetupExperiment)).toEqual({
      id: 'EXPERIMENT_TOOL_REPLAY_SOURCE_NOT_FOUND',
      message: "Tool replay source experiment 'exp-gone' was not found.",
    });
  });

  it('ignores experiments without metadata or without the key', () => {
    expect(getExperimentFailureReason(liveExperiment)).toBeNull();
    expect(getExperimentFailureReason(replayExperiment)).toBeNull();
  });

  it('ignores user-owned junk under the key', () => {
    expect(getExperimentFailureReason({ metadata: { failureReason: 'it broke' } })).toBeNull();
    expect(getExperimentFailureReason({ metadata: { failureReason: 42 } })).toBeNull();
    expect(getExperimentFailureReason({ metadata: { failureReason: ['EXPERIMENT_NO_ITEMS'] } })).toBeNull();
    expect(getExperimentFailureReason({ metadata: { failureReason: null } })).toBeNull();
  });

  it('requires both id and message to be strings', () => {
    expect(getExperimentFailureReason({ metadata: { failureReason: { id: 'EXPERIMENT_NO_ITEMS' } } })).toBeNull();
    expect(getExperimentFailureReason({ metadata: { failureReason: { message: 'no items' } } })).toBeNull();
    expect(getExperimentFailureReason({ metadata: { failureReason: { id: 1, message: 'no items' } } })).toBeNull();
    expect(
      getExperimentFailureReason({ metadata: { failureReason: { id: 'EXPERIMENT_NO_ITEMS', message: 7 } } }),
    ).toBeNull();
  });
});

describe('buildReplayItemReRunParams', () => {
  it('reproduces the full run for one item — policy, dataset version, and agent version', () => {
    expect(
      buildReplayItemReRunParams({
        datasetId: 'dataset-1',
        experiment: strictVersionedReplayExperiment,
        marker: { fromExperimentId: 'exp-live-1', onMiss: 'error', matching: 'strict' },
        itemId: 'item-5',
      }),
    ).toEqual({
      datasetId: 'dataset-1',
      targetType: 'agent',
      targetId: 'support-agent',
      itemIds: ['item-5'],
      toolReplay: { fromExperimentId: 'exp-live-1', onMiss: 'error', matching: 'strict' },
      version: 1,
      agentVersion: 'agent-v2',
    });
  });

  it('omits the fifo default, an absent source, and null versions', () => {
    expect(
      buildReplayItemReRunParams({
        datasetId: 'dataset-1',
        experiment: { ...replayExperiment, datasetVersion: null, agentVersion: null },
        // Per-item replayTraceId mode: no fromExperimentId on the marker.
        marker: { onMiss: 'passthrough', matching: 'fifo' },
        itemId: 'item-2',
      }),
    ).toEqual({
      datasetId: 'dataset-1',
      targetType: 'agent',
      targetId: 'support-agent',
      itemIds: ['item-2'],
      toolReplay: { onMiss: 'passthrough' },
    });
  });

  it('refuses legacy mock-marked runs — names alone cannot rebuild the mock values', () => {
    expect(
      buildReplayItemReRunParams({
        datasetId: 'dataset-1',
        experiment: mockOnlyExperiment,
        marker: { mockedTools: ['weatherInfo'] },
        itemId: 'item-1',
      }),
    ).toBeNull();
    // Replay+mock combined legacy runs are just as unreconstructable.
    expect(
      buildReplayItemReRunParams({
        datasetId: 'dataset-1',
        experiment: replayExperiment,
        marker: { fromExperimentId: 'exp-live-1', onMiss: 'error', mockedTools: ['weatherInfo'] },
        itemId: 'item-1',
      }),
    ).toBeNull();
  });

  it('rebuilds a mock-only run verbatim from the persisted mockConfigs — no invented replay policy', () => {
    expect(
      buildReplayItemReRunParams({
        datasetId: 'dataset-1',
        experiment: mockOnlyWithConfigsExperiment,
        marker: getReplayMarker(mockOnlyWithConfigsExperiment)!,
        itemId: 'item-4',
      }),
    ).toEqual({
      datasetId: 'dataset-1',
      targetType: 'agent',
      targetId: 'support-agent',
      itemIds: ['item-4'],
      // Data mocks round-trip exactly, the expect-only entry included.
      toolMocks: {
        weatherInfo: { output: { temp: 20, unit: 'C' } },
        sendEmail: { error: { name: 'MailError', message: 'mail service down' } },
        chargeCard: { expect: { calledTimes: 0 } },
      },
      version: 1,
    });
  });

  it('re-runs a replay+mock run with BOTH the replay policy and the rebuilt mocks (cases round-trip)', () => {
    expect(
      buildReplayItemReRunParams({
        datasetId: 'dataset-1',
        experiment: replayExperiment,
        marker: {
          fromExperimentId: 'exp-live-1',
          onMiss: 'error',
          mockedTools: ['weatherInfo'],
          mockConfigs: {
            weatherInfo: { cases: [{ args: { city: 'Paris' }, output: 'sunny' }], onNoMatch: 'passthrough' },
          },
        },
        itemId: 'item-1',
      }),
    ).toEqual({
      datasetId: 'dataset-1',
      targetType: 'agent',
      targetId: 'support-agent',
      itemIds: ['item-1'],
      toolReplay: { fromExperimentId: 'exp-live-1', onMiss: 'error' },
      toolMocks: {
        weatherInfo: { cases: [{ args: { city: 'Paris' }, output: 'sunny' }], onNoMatch: 'passthrough' },
      },
      version: 1,
    });
  });

  it('refuses function-mock records — code never persists', () => {
    expect(
      buildReplayItemReRunParams({
        datasetId: 'dataset-1',
        experiment: functionMockExperiment,
        marker: getReplayMarker(functionMockExperiment)!,
        itemId: 'item-1',
      }),
    ).toBeNull();
  });

  it('refuses configs that do not cover every mocked tool — a re-run would silently drop mocks', () => {
    expect(
      buildReplayItemReRunParams({
        datasetId: 'dataset-1',
        experiment: mockOnlyExperiment,
        marker: { mockedTools: ['weatherInfo', 'sendEmail'], mockConfigs: { weatherInfo: { output: 'sunny' } } },
        itemId: 'item-1',
      }),
    ).toBeNull();
  });

  it('refuses markers without a replay policy and non-agent targets', () => {
    expect(
      buildReplayItemReRunParams({
        datasetId: 'dataset-1',
        experiment: replayExperiment,
        marker: {},
        itemId: 'item-1',
      }),
    ).toBeNull();
    expect(
      buildReplayItemReRunParams({
        datasetId: 'dataset-1',
        experiment: { ...replayExperiment, targetType: 'workflow' },
        marker: { fromExperimentId: 'exp-live-1', onMiss: 'error' },
        itemId: 'item-1',
      }),
    ).toBeNull();
  });
});

describe('getReplayReRunDisabledReason', () => {
  it('explains function-mock records with the code-only copy', () => {
    expect(getReplayReRunDisabledReason(getReplayMarker(functionMockExperiment)!)).toBe(
      "Function mocks can't be re-run from Studio — re-create the experiment in code.",
    );
  });

  it('keeps the legacy copy for mock records without persisted configs', () => {
    expect(getReplayReRunDisabledReason(getReplayMarker(mockOnlyExperiment)!)).toBe(
      "Mock values aren't stored on the run yet — re-create the experiment from the trigger dialog.",
    );
    // Partial coverage reads as values-not-stored too — some of them are missing.
    expect(
      getReplayReRunDisabledReason({
        mockedTools: ['weatherInfo', 'sendEmail'],
        mockConfigs: { weatherInfo: { output: 'sunny' } },
      }),
    ).toBe("Mock values aren't stored on the run yet — re-create the experiment from the trigger dialog.");
  });

  it('returns null when a re-run is possible or the run is not mock-marked', () => {
    expect(getReplayReRunDisabledReason(getReplayMarker(mockOnlyWithConfigsExperiment)!)).toBeNull();
    expect(getReplayReRunDisabledReason({ fromExperimentId: 'exp-live-1', onMiss: 'error' })).toBeNull();
    expect(getReplayReRunDisabledReason({})).toBeNull();
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

  it('buckets cases-mock misses like recording misses: error stops, passthrough runs live', () => {
    expect(
      summarizeReplayCalls({
        ...cleanReport,
        calls: [
          { order: 0, toolName: 'weatherInfo', outcome: 'mocked', caseIndex: 1 },
          { order: 1, toolName: 'weatherInfo', outcome: 'case-miss-passthrough' },
          { order: 2, toolName: 'weatherInfo', outcome: 'case-miss-error' },
        ],
      }),
    ).toEqual({
      total: 3,
      replayed: 0,
      replayedWithDrift: 0,
      mocked: 1,
      missed: 1,
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
