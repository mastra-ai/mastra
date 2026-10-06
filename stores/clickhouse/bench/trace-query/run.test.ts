import { describe, expect, it } from 'vitest';

import type { Bucket, SelectedProject } from '../shared/profile';
import { caseById, CASES, WINDOWS } from './cases';
import { bootstrapCi, inFlightCorrelation, renderReport } from './report';
import {
  compareSentinels,
  decide,
  evaluateProbe,
  needsGateB,
  phaseOrder,
  planUnits,
  recordKey,
  unavailableRelations,
} from './run';
import type { TqRecord } from './run';

const project = (bucket: Bucket, i: number): SelectedProject =>
  ({
    bucket,
    hash: `${bucket}-${i}`,
    representative: i === 0,
    organizationId: 'o',
    projectId: `p-${bucket}-${i}`,
    stats: { traces30d: 10 ** (BUCKET_INDEX[bucket] + 1) },
    literals: { environment: 'e', tool: 't', metadataKey: 'k', entityType: 'agent' },
    literalSource: { metadataKey: 'discovered' },
  }) as unknown as SelectedProject;
const BUCKET_INDEX: Record<Bucket, number> = { small: 0, mid: 1, p90: 2, p99: 3, largest: 4 };
const SELECTION = {
  projects: (['small', 'mid', 'p90', 'p99', 'largest'] as Bucket[]).flatMap(b => [0, 1, 2].map(i => project(b, i))),
};
const ALL = { buckets: ['small', 'mid', 'p90', 'p99', 'largest'] as Bucket[], windows: ['1d', '7d', '30d'] as const };

describe('planning', () => {
  it('orders phases smallest-first: bucket, then window', () => {
    expect(phaseOrder({ buckets: ['mid', 'small'], windows: ['30d', '1d'] })).toEqual([
      'small:1d',
      'small:30d',
      'mid:1d',
      'mid:30d',
    ]);
  });

  it('runs core cases on every project and the rest on the representative', () => {
    const planned = planUnits(SELECTION, {
      buckets: ['small'],
      windows: ['1d'],
      gateBApproved: false,
      deltaAvailable: true,
    });
    const t0 = planned.filter(p => p.def.id === 'T0' && p.variant === 'base');
    const t3 = planned.filter(p => p.def.id === 'T3');
    expect(t0.map(p => p.project.hash)).toEqual(['small-0', 'small-1', 'small-2']);
    expect(t3.map(p => p.project.hash)).toEqual(['small-0']);
    expect(planned.every(p => p.phase === 'small:1d')).toBe(true);
    // Cheapest first within the phase.
    const costs = planned.map(p => p.def.cost);
    expect([...costs].sort((a, b) => a - b)).toEqual(costs);
  });

  it('drops delta cases when the replica has no delta table', () => {
    const planned = planUnits(SELECTION, {
      buckets: ['small'],
      windows: ['1d'],
      gateBApproved: false,
      deltaAvailable: false,
    });
    expect(planned.some(p => p.def.delta)).toBe(false);
  });

  it('gates p99 30d, largest beyond 1d and HC cases on p99/largest', () => {
    const t0 = caseById('T0');
    const k1 = caseById('K1');
    expect(needsGateB(t0, WINDOWS['30d'], 'p90')).toBe(false);
    expect(needsGateB(t0, WINDOWS['7d'], 'p99')).toBe(false);
    expect(needsGateB(t0, WINDOWS['30d'], 'p99')).toBe(true);
    expect(needsGateB(t0, WINDOWS['1d'], 'largest')).toBe(false);
    expect(needsGateB(t0, WINDOWS['7d'], 'largest')).toBe(true);
    expect(needsGateB(k1, WINDOWS['1d'], 'p90')).toBe(false);
    expect(needsGateB(k1, WINDOWS['1d'], 'p99')).toBe(true);

    const pre = planUnits(SELECTION, { ...ALL, windows: [...ALL.windows], gateBApproved: false, deltaAvailable: true });
    expect(pre.some(p => needsGateB(p.def, p.window, p.project.bucket))).toBe(false);
    const post = planUnits(SELECTION, { ...ALL, windows: [...ALL.windows], gateBApproved: true, deltaAvailable: true });
    expect(post.length).toBeGreaterThan(pre.length);
  });

  it('keys records by mode, so probe and sentinel runs never satisfy counted runs', () => {
    expect(recordKey('run', 'T0', 'base', 'main', '1d', 'h')).not.toBe(
      recordKey('probe', 'T0', 'base', 'main', '1d', 'h'),
    );
    expect(recordKey('run', 'T0', 'base', 'main', '1d', 'h')).toBe('run|T0|base|main|1d|h');
  });

  it('every case belongs to exactly one window set and has a positive cost', () => {
    for (const def of CASES) {
      expect(def.windows.length).toBeGreaterThan(0);
      expect(def.cost).toBeGreaterThan(0);
      expect(def.stages[0]).toBe('main');
    }
  });
});

let seq = 0;
function rec(over: Partial<TqRecord> & { ms: number; mem: number }): TqRecord {
  const { ms, mem, ...rest } = over;
  return {
    runId: 'r',
    key: `k${seq++}`,
    mode: 'run',
    phaseRun: 'r:small:1d:1',
    caseId: 'T0',
    api: 'traces',
    kind: 'none',
    variant: 'base',
    stage: 'main',
    window: '1d',
    windowMs: 86_400_000,
    bucket: 'small',
    hash: 'h',
    traces30d: 100,
    rep: 1,
    cold: false,
    tier: 1,
    anchorTo: '2026-10-05T17:00:00.000Z',
    ts: '',
    ok: true,
    wallMs: ms,
    streamedRows: 1,
    metrics: {
      source: 'summary',
      durationMs: ms,
      readRows: 1000,
      readBytes: 1e6,
      memoryBytes: mem,
      resultRows: 1,
      resultBytes: 1,
      selectedMarks: null,
      selectedParts: null,
      exceptionCode: 0,
    },
    concurrency: 4,
    inFlight: 1,
    exclusive: false,
    sentinel: false,
    calibration: false,
    retried: false,
    ...rest,
  };
}

function probeRecords(
  level: number,
  b: { ms: number; mem: number; cold?: number },
  cells = ['T0', 'T7', 'S0'],
): TqRecord[] {
  return cells.flatMap(caseId =>
    (['A', 'B'] as const).flatMap(arm =>
      [0, 1, 2, 3, 4, 5].map(rep =>
        rec({
          mode: 'probe',
          caseId,
          arm,
          probeLevel: level,
          rep,
          cold: rep === 0,
          ms: arm === 'A' ? (rep === 0 ? 1000 : 100 + rep) : rep === 0 ? (b.cold ?? 1000) : b.ms + rep,
          mem: arm === 'A' ? 1e8 : b.mem,
        }),
      ),
    ),
  );
}

describe('concurrency proof', () => {
  it('passes when memory, bytes and latency match', () => {
    const v = evaluateProbe(probeRecords(4, { ms: 105, mem: 1.02e8 }), 4);
    expect(v.cells).toHaveLength(3);
    expect(v.pass).toBe(true);
    expect(decide([v])).toMatchObject({ level: 4, coldAlone: false });
  });

  it('fails on memory drift and on warm latency inflation', () => {
    expect(evaluateProbe(probeRecords(4, { ms: 100, mem: 1.2e8 }), 4).checks.memoryEvery).toBe(false);
    const slow = evaluateProbe(probeRecords(4, { ms: 130, mem: 1e8 }), 4);
    expect(slow.checks.warmMedian).toBe(false);
    expect(slow.pass).toBe(false);
  });

  it('falls back to 2, then to cold-alone, then to sequential', () => {
    const fail4 = evaluateProbe(probeRecords(4, { ms: 150, mem: 1e8 }), 4);
    const pass2 = evaluateProbe(probeRecords(2, { ms: 102, mem: 1e8 }), 2);
    expect(decide([fail4, pass2])).toMatchObject({ level: 2, coldAlone: false });
    const coldOnly = evaluateProbe(probeRecords(4, { ms: 102, mem: 1e8, cold: 2000 }), 4);
    expect(coldOnly.pass).toBe(false);
    expect(coldOnly.passWithColdAlone).toBe(true);
    expect(decide([coldOnly])).toMatchObject({ level: 4, coldAlone: true });
    expect(decide([fail4])).toMatchObject({ level: 1, coldAlone: false });
    expect(decide([])).toMatchObject({ level: 1 });
  });

  it('counts overloads and retries as failures', () => {
    const records = probeRecords(4, { ms: 101, mem: 1e8 });
    records.find(r => r.arm === 'B')!.retried = true;
    expect(evaluateProbe(records, 4).checks.overload).toBe(false);
  });
  it('does not compare reads of the querySpans() select, whose read set follows wall-clock time', () => {
    const records = probeRecords(4, { ms: 101, mem: 1e8 });
    for (const r of records)
      if (r.caseId === 'S0' && r.arm === 'B') {
        r.api = 'spans';
        r.metrics.readRows = 1400;
        r.metrics.memoryBytes = 1.3e8;
      } else if (r.caseId === 'S0') r.api = 'spans';
    expect(evaluateProbe(records, 4).checks).toMatchObject({ rowsBytes: true, memoryEvery: true });
    for (const r of records) if (r.caseId === 'T0' && r.arm === 'B') r.metrics.readRows = 1400;
    expect(evaluateProbe(records, 4).checks.rowsBytes).toBe(false);
  });

  it('fails the cold check when a cold rep hits a limit only under concurrency', () => {
    const records = probeRecords(4, { ms: 101, mem: 1e8 });
    const coldB = records.find(r => r.caseId === 'T7' && r.arm === 'B' && r.cold)!;
    Object.assign(coldB, { ok: false, errorCategory: 'timeout' });
    const v = evaluateProbe(records, 4);
    expect(v.checks.cold).toBe(false);
    expect(v.passWithColdAlone).toBe(true);
    expect(decide([v])).toMatchObject({ level: 4, coldAlone: true });
  });
});

describe('sentinels', () => {
  it('does not count memory drift on the live-read-set querySpans() select', () => {
    const seqR = [1, 2, 3].map(rep => rec({ rep, ms: 100, mem: 1e8, mode: 'sentinel', caseId: 'S0', api: 'spans' }));
    const conR = [1, 2, 3].map(rep => rec({ rep, ms: 100, mem: 1.3e8, caseId: 'S0', api: 'spans' }));
    expect(compareSentinels(conR, seqR).memoryDrift).toBe(false);
    const seqT = seqR.map(r => ({ ...r, caseId: 'T0', api: 'traces' as const }));
    const conT = conR.map(r => ({ ...r, caseId: 'T0', api: 'traces' as const }));
    expect(compareSentinels(conT, seqT).memoryDrift).toBe(true);
  });

  it('flags memory drift above 10% and reports the warm latency ratio', () => {
    const seqR = [1, 2, 3].map(rep => rec({ rep, ms: 100, mem: 1e8, mode: 'sentinel' }));
    const ok = compareSentinels(
      [1, 2, 3].map(rep => rec({ rep, ms: 110, mem: 1.05e8 })),
      seqR,
    );
    expect(ok.memoryDrift).toBe(false);
    expect(ok.latencyRatio).toBeCloseTo(1.1);
    expect(
      compareSentinels(
        [1, 2, 3].map(rep => rec({ rep, ms: 100, mem: 1.2e8 })),
        seqR,
      ).memoryDrift,
    ).toBe(true);
  });
});

describe('report', () => {
  it('renders every section and excludes superseded phase runs', () => {
    const runs = [
      ...[0, 1, 2].map(rep => rec({ rep, cold: rep === 0, ms: 100, mem: 5e8 })),
      ...[1, 2].map(rep => rec({ rep, ms: 9e9, mem: 9e9, phaseRun: 'old' })),
      ...[1, 2].map(rep => rec({ rep, ms: 50, mem: 1e8, variant: 'w1' })),
      ...[1, 2].map(rep => rec({ rep, caseId: 'V1', api: 'values', ms: 6000, mem: 3e8 })),
    ];
    const md = renderReport(runs, probeRecords(4, { ms: 101, mem: 1e8 }), [], new Set(['old']));
    expect(md).toContain('### Peak memory per API');
    expect(md).toContain('| T0-w1 | 1d |');
    expect(md).toContain('#### Concurrency 4 vs sequential: PASS');
    expect(md).toContain('V1 1d @ small**: memory 286 MiB > store limit 256 MiB');
    expect(md).not.toContain('9.0 s');
  });

  it('computes a bootstrap CI and an inFlight rank correlation', () => {
    const ci = bootstrapCi([1, 1.02, 0.98, 1.01, 0.99]);
    expect(ci![0]).toBeLessThanOrEqual(1);
    expect(ci![1]).toBeGreaterThanOrEqual(1);
    const rs = Array.from({ length: 20 }, (_, i) =>
      rec({ rep: i, inFlight: (i % 4) + 1, ms: 100 + (i % 4) * 10, mem: 1 }),
    );
    expect(inFlightCorrelation(rs)!.rho).toBeGreaterThan(0.9);
  });
});

describe('replica schema gaps', () => {
  it('excludes cases on a relation whose table is missing or lacks store columns, and nothing else', () => {
    const pre = {
      missingTables: ['mastra_score_events_current'],
      missingColumns: { mastra_feedback_events: ['writeVersion'] },
    };
    const unavailable = unavailableRelations(pre);
    expect(unavailable.sort()).toEqual(['feedback', 'scores']);
    const ids = new Set(
      planUnits(SELECTION, {
        ...ALL,
        windows: [...ALL.windows],
        gateBApproved: true,
        deltaAvailable: true,
        unavailable,
      }).map(u => u.def.id),
    );
    expect(ids.has('T11')).toBe(false);
    expect(ids.has('V9')).toBe(false);
    expect(ids.has('T7')).toBe(true);
  });

  it('still aborts on missing columns outside relation tables', () => {
    expect(() => unavailableRelations({ missingTables: [], missingColumns: { mastra_trace_roots: ['tags'] } })).toThrow(
      /mastra_trace_roots/,
    );
  });
});
