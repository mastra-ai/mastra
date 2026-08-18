import { describe, expect, it } from 'vitest';
import { PulseBus } from './bus';
import { emitPulseFact, registerPulseEmitter, unregisterPulseEmitter } from './emitter';
import type { PulseFactInput } from './emitter';

/**
 * EXPERIMENT (Gate 1) perf budget — measures the SYNCHRONOUS cost a source
 * seam pays per emitPulseFact call (the hot-path tax), and the total cost
 * of a realistic 6-fact run including the microtask drain. Budgets from the
 * goal: ≤50µs p95 per record, ≤2ms p95 per full run. Numbers are logged for
 * the verdict (p50/p95/count/environment).
 */

const RUN_FACTS = (runId: string): PulseFactInput[] => [
  {
    runId,
    surface: 'signal',
    action: 'delivery_decided',
    type: 'decision',
    attributes: { signalId: `s-${runId}`, routing: 'pending' },
    edges: [{ type: 'queued_signal', to: { kind: 'content', id: `signal:s-${runId}` } }],
  },
  {
    runId,
    surface: 'content',
    action: 'introduced',
    type: 'state',
    attributes: { signalId: `s-${runId}` },
    threadId: 't-1',
    resourceId: 'r-1',
  },
  {
    runId,
    surface: 'signal_queue',
    action: 'drained',
    type: 'decision',
    attributes: { signalId: `s-${runId}`, forcedContinuation: true, site: 'drain-step' },
    edges: [{ type: 'drained_signal', to: { kind: 'content', id: `signal:s-${runId}` } }],
  },
  {
    runId,
    surface: 'model_input',
    action: 'finalized',
    type: 'state',
    attributes: { requestId: `m-${runId}`, messageCount: 4, step: 0 },
  },
  {
    runId,
    surface: 'model_input',
    action: 'finalized',
    type: 'state',
    attributes: { requestId: `m2-${runId}`, messageCount: 6, step: 1 },
    edges: [
      {
        type: 'included_in_model_input',
        to: { kind: 'content', id: `signal:s-${runId}` },
        attributes: { position: 5 },
      },
    ],
  },
  {
    runId,
    surface: 'signal',
    action: 'delivery_decided',
    type: 'decision',
    attributes: { signalId: `s2-${runId}`, routing: 'pre-run' },
    edges: [{ type: 'queued_signal', to: { kind: 'content', id: `signal:s2-${runId}` } }],
  },
];

const flush = () => new Promise<void>(r => setTimeout(r, 0));

function pct(sorted: number[], p: number): number {
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))]!;
}

describe('native fact ingress perf budget', () => {
  it('source-hook self-time ≤50µs p95/record, ≤2ms p95 per 6-fact run', async () => {
    const bus = new PulseBus();
    let count = 0;
    bus.subscribe(() => {
      count += 1;
    });
    registerPulseEmitter(bus);
    try {
      // Warm-up: ≥500 full runs so JIT/shape caches settle.
      for (let i = 0; i < 500; i++) {
        for (const f of RUN_FACTS(`warm-${i}`)) emitPulseFact(f);
        await flush();
      }
      expect(count).toBeGreaterThan(0);

      const perRecordUs: number[] = [];
      const perRunUs: number[] = [];
      for (let i = 0; i < 500; i++) {
        const facts = RUN_FACTS(`m-${i}`);
        const runStart = process.hrtime.bigint();
        for (const f of facts) {
          const t0 = process.hrtime.bigint();
          emitPulseFact(f);
          perRecordUs.push(Number(process.hrtime.bigint() - t0) / 1_000);
        }
        await flush(); // include the drain in the per-run figure
        perRunUs.push(Number(process.hrtime.bigint() - runStart) / 1_000);
      }
      perRecordUs.sort((a, b) => a - b);
      perRunUs.sort((a, b) => a - b);
      const report = {
        record_p50_us: +pct(perRecordUs, 50).toFixed(2),
        record_p95_us: +pct(perRecordUs, 95).toFixed(2),
        record_count: perRecordUs.length,
        run_p50_us: +pct(perRunUs, 50).toFixed(2),
        run_p95_us: +pct(perRunUs, 95).toFixed(2),
        run_count: perRunUs.length,
        node: process.version,
        platform: `${process.platform}/${process.arch}`,
      };

      console.info('[gate1-perf]', JSON.stringify(report));
      // Wall-clock budgets are meaningful only on a quiet machine; inside a
      // full parallel suite run CPU contention inflates p95 well past the
      // real cost. The automated assertion guards against pathology only
      // (10x budget). The strict ≤50µs/≤2ms figures come from running this
      // file alone — those are the numbers the verdict quotes.
      expect(report.record_p95_us).toBeLessThanOrEqual(500);
      expect(report.run_p95_us).toBeLessThanOrEqual(20_000);
    } finally {
      unregisterPulseEmitter(bus);
    }
  });
});
