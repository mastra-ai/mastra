import type { ObservationalMemoryRecord } from '@mastra/core/storage';
import { describe, expect, it } from 'vitest';

import { reconstructCycles } from './reconstruct';

function boundary(date: string): string {
  return `\n\n--- message boundary (${date}) ---\n\n`;
}

function record(
  overrides: Partial<ObservationalMemoryRecord> & { activeObservations: string },
): ObservationalMemoryRecord {
  return {
    id: `rec-${overrides.generationCount ?? 0}`,
    scope: 'thread',
    threadId: 'thread-1',
    resourceId: 'resource-1',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    originType: overrides.generationCount ? 'reflection' : 'initial',
    generationCount: 0,
    ...overrides,
  } as ObservationalMemoryRecord;
}

describe('reconstructCycles', () => {
  it('splits a single generation into ordered, timestamped cycles', () => {
    const { cycles, excluded, warnings } = reconstructCycles([
      record({
        activeObservations: [
          '* User asked about weather',
          boundary('2026-01-01T01:00:00.000Z'),
          '* Assistant provided forecast',
          boundary('2026-01-01T02:00:00.000Z'),
          '* User asked a follow-up',
        ].join(''),
      }),
    ]);

    expect(warnings).toEqual([]);
    expect(excluded).toEqual([]);
    expect(cycles.map(c => c.source)).toEqual(['generation-head', 'boundary', 'boundary']);
    expect(cycles.map(c => c.observations)).toEqual([
      '* User asked about weather',
      '* Assistant provided forecast',
      '* User asked a follow-up',
    ]);
    expect(cycles[1]!.observedAt?.toISOString()).toBe('2026-01-01T01:00:00.000Z');
    expect(cycles[2]!.observedAt?.toISOString()).toBe('2026-01-01T02:00:00.000Z');
    expect(cycles[0]!.observedAt).toBeNull();
  });

  it('excludes reflection heads of later generations and never double-counts', () => {
    // Storage returns generations newest-first (createReflectionGeneration prepends).
    const records = [
      record({
        id: 'rec-2',
        generationCount: 2,
        activeObservations: ['* REFLECTION TWO', boundary('2026-01-03T01:00:00.000Z'), '* cycle g2'].join(''),
      }),
      record({
        id: 'rec-1',
        generationCount: 1,
        activeObservations: ['* REFLECTION ONE', boundary('2026-01-02T01:00:00.000Z'), '* cycle g1'].join(''),
      }),
      record({
        id: 'rec-0',
        generationCount: 0,
        activeObservations: ['* cycle g0 head', boundary('2026-01-01T01:00:00.000Z'), '* cycle g0 second'].join(''),
      }),
    ];

    const { cycles, excluded, warnings } = reconstructCycles(records);

    expect(warnings).toEqual([]);
    expect(cycles.map(c => c.generationCount)).toEqual([0, 0, 1, 2]);
    expect(cycles.map(c => c.observations)).toEqual([
      '* cycle g0 head',
      '* cycle g0 second',
      '* cycle g1',
      '* cycle g2',
    ]);

    expect(excluded.map(c => c.source)).toEqual(['reflection-head', 'reflection-head']);
    expect(excluded.map(c => c.observations)).toEqual(['* REFLECTION ONE', '* REFLECTION TWO']);

    // No reflection text leaked into the replayable set, and nothing appears twice.
    const texts = cycles.map(c => c.observations);
    expect(new Set(texts).size).toBe(texts.length);
    expect(texts.some(t => t.includes('REFLECTION'))).toBe(false);
  });

  it('keeps generation 0 leading chunk as a real cycle', () => {
    const { cycles, excluded } = reconstructCycles([record({ activeObservations: '* only chunk' })]);

    expect(excluded).toEqual([]);
    expect(cycles).toHaveLength(1);
    expect(cycles[0]!.source).toBe('generation-head');
  });

  it('uses buffered chunk metadata directly and orders it after parsed chunks', () => {
    const { cycles, warnings } = reconstructCycles([
      record({
        activeObservations: ['* activated head', boundary('2026-01-01T01:00:00.000Z'), '* activated second'].join(''),
        bufferedObservationChunks: [
          {
            id: 'chunk-1',
            cycleId: 'cycle-abc',
            observations: '* not yet activated',
            tokenCount: 12,
            messageIds: ['m1', 'm2'],
            messageTokens: 30,
            lastObservedAt: new Date('2026-01-01T03:00:00.000Z'),
            createdAt: new Date('2026-01-01T03:00:00.000Z'),
          },
        ],
      }),
    ]);

    expect(warnings).toEqual([]);
    expect(cycles.map(c => c.source)).toEqual(['generation-head', 'boundary', 'buffered-chunk']);

    const buffered = cycles.at(-1)!;
    expect(buffered.cycleId).toBe('cycle-abc');
    expect(buffered.messageIds).toEqual(['m1', 'm2']);
    expect(buffered.observedAt?.toISOString()).toBe('2026-01-01T03:00:00.000Z');
    expect(buffered.observations).toBe('* not yet activated');
  });

  it('warns on unparsable boundary dates without dropping the surrounding cycles', () => {
    const { cycles, warnings } = reconstructCycles([
      record({
        activeObservations: ['* first', '\n\n--- message boundary (2026-13-45T99:99:99.000Z) ---\n\n', '* second'].join(
          '',
        ),
      }),
    ]);

    expect(warnings).toHaveLength(1);
    expect(warnings[0]!.kind).toBe('unparsable-date');
    expect(cycles.map(c => c.observations)).toEqual(['* first', '* second']);
    expect(cycles[1]!.observedAt).toBeNull();
  });

  it('warns on empty chunks rather than dropping them silently', () => {
    const { cycles, warnings } = reconstructCycles([
      record({
        activeObservations: ['* first', boundary('2026-01-01T01:00:00.000Z'), '   '].join(''),
      }),
    ]);

    expect(cycles).toHaveLength(1);
    expect(warnings.map(w => w.kind)).toEqual(['empty-chunk']);
  });

  it('warns when a generation is missing from the record set', () => {
    const { warnings } = reconstructCycles([
      record({ id: 'rec-0', generationCount: 0, activeObservations: '* g0' }),
      record({ id: 'rec-2', generationCount: 2, activeObservations: '* reflection' }),
    ]);

    expect(warnings.map(w => w.kind)).toEqual(['missing-generation']);
    expect(warnings[0]!.generationCount).toBe(1);
  });

  it('refuses duplicate generations rather than replaying them twice', () => {
    expect(() =>
      reconstructCycles([
        record({ id: 'rec-0', generationCount: 0, activeObservations: '* g0' }),
        record({ id: 'rec-0b', generationCount: 0, activeObservations: '* g0 again' }),
      ]),
    ).toThrow(/generationCount 0.*double-count/);
  });

  it('refuses resource-scoped records', () => {
    expect(() =>
      reconstructCycles([
        record({ id: 'rec-r', scope: 'resource', threadId: null, activeObservations: '<thread id="a">* x</thread>' }),
      ]),
    ).toThrow(/scope 'resource'/);
  });
});
