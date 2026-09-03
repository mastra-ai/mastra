import { describe, expect, it } from 'vitest';
import type { LangfuseObservation } from './providers/langfuse/schema.js';
import { assembleTraces } from './trace-assembler.js';

const window = {
  cutoffAt: '2026-08-04T00:00:00.000Z',
  snapshotAt: '2026-09-03T00:00:00.000Z',
};

function observation(overrides: Partial<LangfuseObservation> = {}): LangfuseObservation {
  return {
    id: 'root',
    traceId: 'trace-1',
    projectId: 'project-1',
    parentObservationId: null,
    type: 'SPAN',
    startTime: '2026-08-20T10:00:00.000Z',
    endTime: '2026-08-20T10:00:02.000Z',
    ...overrides,
  };
}

describe('assembleTraces', () => {
  it('orders a valid physical tree root-first', () => {
    const child = observation({
      id: 'child',
      parentObservationId: 'root',
      startTime: '2026-08-20T10:00:01.000Z',
      isRootObservation: true,
    });
    const result = assembleTraces([child, observation()], window);
    expect(result.skipped).toEqual([]);
    expect(result.traces[0]?.observations.map(item => item.id)).toEqual(['root', 'child']);
  });

  it.each([
    ['missing_trace_id', [observation({ traceId: null })]],
    ['missing_root', [observation({ parentObservationId: 'absent' })]],
    ['multiple_roots', [observation(), observation({ id: 'root-2' })]],
    ['missing_parent', [observation(), observation({ id: 'child', parentObservationId: 'absent' })]],
    ['duplicate_observation_id', [observation(), observation()]],
    ['incomplete_duration', [observation({ endTime: null })]],
    ['invalid_timestamp', [observation({ endTime: 'not-a-date' })]],
    ['invalid_timestamp', [observation({ startTime: 'August 20, 2026', endTime: '2026-08-20T10:00:00.000Z' })]],
    ['root_outside_window', [observation({ startTime: window.cutoffAt, endTime: window.cutoffAt })]],
  ] as const)('skips an invalid trace: %s', (reason, observations) => {
    if (reason === 'root_outside_window') {
      observations[0]!.startTime = window.snapshotAt;
      observations[0]!.endTime = window.snapshotAt;
    }
    const result = assembleTraces([...observations], window);
    expect(result.traces).toEqual([]);
    expect(result.skipped[0]?.reason).toBe(reason);
  });

  it('skips a disconnected cycle instead of uploading a partial tree', () => {
    const result = assembleTraces(
      [
        observation(),
        observation({ id: 'a', parentObservationId: 'b' }),
        observation({ id: 'b', parentObservationId: 'a' }),
      ],
      window,
    );
    expect(result.skipped[0]?.reason).toBe('cycle');
  });

  it('allows events without an end time', () => {
    const result = assembleTraces([observation({ type: 'EVENT', endTime: null })], window);
    expect(result.traces).toHaveLength(1);
  });

  it.each(['SPAN', 'GENERATION', 'AGENT', 'TOOL', 'CHAIN', 'RETRIEVER', 'EVALUATOR', 'EMBEDDING', 'GUARDRAIL'])(
    'treats an unfinished %s observation as an incomplete trace',
    type => {
      const result = assembleTraces([observation({ type, endTime: null })], window);
      expect(result.traces).toEqual([]);
      expect(result.skipped).toMatchObject([{ reason: 'incomplete_duration', observationCount: 1 }]);
    },
  );

  it('imports a completed error or cancellation instead of dropping its history', () => {
    const result = assembleTraces([observation({ level: 'ERROR', statusMessage: 'Request aborted by user' })], window);
    expect(result.traces).toHaveLength(1);
    expect(result.skipped).toEqual([]);
  });

  it('accepts zero-duration spans and asynchronous child timing', () => {
    const root = observation({ endTime: '2026-08-20T10:00:00.000Z' });
    const lateChild = observation({
      id: 'late-child',
      parentObservationId: 'root',
      startTime: '2026-08-20T10:00:03.000Z',
      endTime: '2026-08-20T10:00:04.000Z',
    });
    const result = assembleTraces([lateChild, root], window);
    expect(result.traces[0]?.observations.map(item => item.id)).toEqual(['root', 'late-child']);
    expect(result.skipped).toEqual([]);
  });

  it('does not fabricate a physical root for an app root whose external parent is absent', () => {
    const result = assembleTraces(
      [observation({ parentObservationId: 'external-parent', isRootObservation: true })],
      window,
    );
    expect(result.traces).toEqual([]);
    expect(result.skipped).toMatchObject([{ reason: 'missing_root' }]);
  });

  it('treats a blank trace ID as missing', () => {
    const result = assembleTraces([observation({ traceId: '   ' })], window);
    expect(result.traces).toEqual([]);
    expect(result.skipped).toMatchObject([{ reason: 'missing_trace_id' }]);
  });

  it('includes the cutoff boundary and excludes the snapshot boundary', () => {
    expect(
      assembleTraces([observation({ startTime: window.cutoffAt, endTime: window.cutoffAt })], window).traces,
    ).toHaveLength(1);
    expect(
      assembleTraces([observation({ startTime: window.snapshotAt, endTime: window.snapshotAt })], window).traces,
    ).toHaveLength(0);
  });
});
