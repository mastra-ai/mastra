/**
 * COR-1519: long Redis outage under several concurrent plain-agent runs.
 *
 * Plain agents publish a copy of every chunk through an uncapped per-run queue,
 * so while Redis is down the caller keeps streaming and frames wait in memory.
 * This drives that through the public `agent.stream()` / `agent.observe()` API
 * with paced AIMock model streams and a local Redis container frozen with
 * `docker pause` for each requested outage length, and records:
 * - sampled process memory (rss, heapUsed, external, arrayBuffers, after a
 *   forced GC) against a quiet run of the same shape with no outage;
 * - per-run frames produced (seen by the caller) and run-stream publishes
 *   started / acknowledged / failed at the bus boundary;
 * - how long the backlog takes to drain after recovery;
 * - whether live observers, replay and the Redis stream itself hold every frame;
 * - a DurableAgent run alongside, whose caller reads back from the bus.
 *
 * Opt-in and slow: set COR1519_OUTAGE_SECONDS (e.g. "60,120,300"). Needs Docker
 * and a Redis container (COR1519_REDIS_CONTAINER, default `cor1519-redis`)
 * published at REDIS_URL. COR1519_OUTAGE_OUT names a directory for the JSON
 * timelines.
 */
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import v8 from 'node:v8';
import vm from 'node:vm';

import { createOpenAI } from '@ai-sdk/openai-v5';
import { LLMock } from '@copilotkit/aimock';
import { Agent } from '@mastra/core/agent';
import { createDurableAgent } from '@mastra/core/agent/durable';
import { Mastra } from '@mastra/core/mastra';
import { createClient } from 'redis';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { flushRedis, REDIS_URL } from '../test-fixtures/harness';
import { RedisStreamsPubSub } from './index';

const OUTAGES_S = (process.env.COR1519_OUTAGE_SECONDS ?? '')
  .split(',')
  .map(s => Number(s.trim()))
  .filter(n => n > 0);
const CONTAINER = process.env.COR1519_REDIS_CONTAINER ?? 'cor1519-redis';
const OUT_DIR = process.env.COR1519_OUTAGE_OUT;

const PLAIN_RUNS = 5;
const CHUNK_CHARS = 16;
const CHUNK_INTERVAL_MS = 50; // 20 chunks/s/run, roughly 80 tokens/s
const LEAD_MS = 5_000; // runs stream this long before Redis goes down
const TAIL_MS = 10_000; // and keep streaming this long after it comes back
const SAMPLE_MS = 2_000;
const DRAIN_LIMIT_MS = 180_000;
const READ_SLACK_MS = 240_000;
const CALLER_SLACK_MS = 15_000;

v8.setFlagsFromString('--expose_gc');
const gc = vm.runInNewContext('gc') as () => void;

/** Deterministic, run-specific reply of `chunks` x CHUNK_CHARS characters. */
function replyFor(label: string, chunks: number): string {
  const word = (i: number) => `${label}-${String(i).padStart(6, '0')} `.padEnd(CHUNK_CHARS, '.');
  return Array.from({ length: chunks }, (_, i) => word(i)).join('');
}

type Read = { types: string[]; text: string; ms: number; error?: string };

async function read(stream: AsyncIterable<any>, startedAt: number, timeoutMs: number): Promise<Read> {
  const out: Read = { types: [], text: '', ms: 0 };
  const drain = (async () => {
    for await (const chunk of stream) {
      out.types.push(chunk.type);
      if (chunk.type === 'text-delta') out.text += chunk.payload?.text ?? '';
    }
  })();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      drain,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`stream did not close within ${timeoutMs}ms`)), timeoutMs);
      }),
    ]);
  } catch (error) {
    out.error = String((error as Error)?.message ?? error);
  } finally {
    clearTimeout(timer);
  }
  out.ms = Date.now() - startedAt;
  return out;
}

type RunCounts = { started: number; acked: number; failed: number };

function mb(n: number) {
  return Math.round((n / 1024 / 1024) * 10) / 10;
}

describe.skipIf(OUTAGES_S.length === 0)('plain agents through a long Redis outage (COR-1519)', () => {
  let llm: LLMock;

  beforeAll(async () => {
    llm = new LLMock({ port: 0 });
    await llm.start();
    if (OUT_DIR) mkdirSync(OUT_DIR, { recursive: true });
  });

  afterAll(async () => {
    try {
      execFileSync('docker', ['unpause', CONTAINER], { stdio: 'ignore' });
    } catch {}
    await llm.stop();
  });

  async function phase(outageMs: number, pause: boolean, label: string) {
    await flushRedis();
    llm.clearFixtures();
    const streamMs = LEAD_MS + outageMs + TAIL_MS;
    const chunks = Math.ceil(streamMs / CHUNK_INTERVAL_MS);
    const labels = [...Array.from({ length: PLAIN_RUNS }, (_, i) => `p${i}`), 'd0'];
    const replies = new Map(labels.map(l => [l, replyFor(l, chunks)]));
    for (const l of labels) {
      llm.on(
        {
          endpoint: 'chat',
          predicate: (req: any) => {
            const last = [...(req.messages ?? [])].reverse().find((m: any) => m.role === 'user');
            const content = typeof last?.content === 'string' ? last.content : JSON.stringify(last?.content);
            return content?.includes(`[${l}]`) ?? false;
          },
        },
        { content: replies.get(l)! },
        { latency: CHUNK_INTERVAL_MS, chunkSize: CHUNK_CHARS },
      );
    }

    const keyPrefix = `bus-outage-${randomUUID()}`;
    const perRun = new Map<string, RunCounts>();
    const totals = { started: 0, acked: 0, failed: 0, inFlight: 0, peakInFlight: 0 };
    const failures: string[] = [];
    const pubsub = new (class extends RedisStreamsPubSub {
      override async publish(...args: Parameters<RedisStreamsPubSub['publish']>) {
        const topic = args[0];
        if (!topic.startsWith('agent.stream.')) return super.publish(...args);
        const runId = topic.slice('agent.stream.'.length);
        const c = perRun.get(runId) ?? { started: 0, acked: 0, failed: 0 };
        perRun.set(runId, c);
        c.started++;
        totals.started++;
        totals.inFlight++;
        totals.peakInFlight = Math.max(totals.peakInFlight, totals.inFlight);
        try {
          await super.publish(...args);
          c.acked++;
          totals.acked++;
        } catch (error) {
          c.failed++;
          totals.failed++;
          if (failures.length < 20) failures.push(String((error as Error)?.message ?? error));
          throw error;
        } finally {
          totals.inFlight--;
        }
      }
    })({ url: REDIS_URL, keyPrefix, blockMs: 200 });

    const openai = createOpenAI({ apiKey: 'aimock-test-key', baseURL: `${llm.url.replace(/\/+$/, '')}/v1` });
    const makeAgent = (id: string) =>
      new Agent({
        id,
        name: id,
        instructions: 'You are a test agent driven by scripted AIMock responses.',
        model: openai('gpt-4o-mini'),
      });
    const mastra = new Mastra({
      logger: false,
      pubsub,
      agents: {
        'outage-plain': makeAgent('outage-plain'),
        'outage-durable': createDurableAgent({ agent: makeAgent('outage-durable') }),
      },
    });
    const plain = mastra.getAgent('outage-plain' as any) as any;
    const durable = mastra.getAgent('outage-durable' as any) as any;
    const admin = createClient({ url: REDIS_URL });
    await admin.connect();

    try {
      // Warm both paths so the outage measures queuing, not connection setup.
      llm.on(
        { endpoint: 'chat', predicate: (req: any) => JSON.stringify(req.messages).includes('[warm]') },
        { content: 'warm' },
      );
      await read((await plain.stream('[warm]')).fullStream, Date.now(), 15_000);
      await read((await durable.stream('[warm]')).fullStream, Date.now(), 15_000);
      while (totals.inFlight > 0) await new Promise(r => setTimeout(r, 20));
      perRun.clear();
      Object.assign(totals, { started: 0, acked: 0, failed: 0, peakInFlight: 0 });

      gc();
      const mem0 = process.memoryUsage();
      const t0 = Date.now();
      const produced = new Map<string, number>();
      const samples: any[] = [];
      const sample = (event?: string) => {
        gc();
        const m = process.memoryUsage();
        const prod = [...produced.values()].reduce((a, b) => a + b, 0);
        samples.push({
          t: Date.now() - t0,
          event,
          rssMB: mb(m.rss),
          heapUsedMB: mb(m.heapUsed),
          externalMB: mb(m.external),
          arrayBuffersMB: mb(m.arrayBuffers),
          produced: prod,
          busStarted: totals.started,
          busAcked: totals.acked,
          busFailed: totals.failed,
          inFlight: totals.inFlight,
          pendingInferred: prod - totals.acked - totals.failed,
          producedByRun: Object.fromEntries(produced),
        });
      };
      const sampler = setInterval(() => sample(), SAMPLE_MS);

      const runs = await Promise.all(
        labels.map(async l => {
          const agent = l.startsWith('d') ? durable : plain;
          const res = await agent.stream(`Stream your reply [${l}]`);
          return { label: l, agent, res, runId: res.runId as string };
        }),
      );
      // Count frames as each caller receives them, without consuming twice.
      const callers = runs.map(r =>
        read(
          (async function* () {
            for await (const chunk of r.res.fullStream) {
              produced.set(r.label, (produced.get(r.label) ?? 0) + 1);
              yield chunk;
            }
          })(),
          t0,
          streamMs + outageMs + READ_SLACK_MS,
        ),
      );
      // One live observer per plain run, attached before the outage.
      await new Promise(r => setTimeout(r, 1_000));
      const observers = runs
        .filter(r => r.label.startsWith('p'))
        .map(async r => read((await r.agent.observe(r.runId)).fullStream, t0, streamMs + outageMs + READ_SLACK_MS));

      let downAt: number | undefined;
      let upAt: number | undefined;
      let backlogFlushedMs: number | undefined;
      if (pause) {
        await new Promise(r => setTimeout(r, LEAD_MS - 1_000));
        sample('outage-start');
        execFileSync('docker', ['pause', CONTAINER]);
        downAt = Date.now() - t0;
        await new Promise(r => setTimeout(r, outageMs));
        sample('outage-end');
        execFileSync('docker', ['unpause', CONTAINER]);
        upAt = Date.now() - t0;
        // Time until everything produced before recovery has reached the bus.
        const owed = [...produced.values()].reduce((a, b) => a + b, 0);
        while (totals.acked + totals.failed < owed && Date.now() - t0 - upAt < DRAIN_LIMIT_MS) {
          await new Promise(r => setTimeout(r, 50));
        }
        backlogFlushedMs = Date.now() - t0 - upAt;
        sample('backlog-flushed');
      }

      const callerReads = await Promise.all(callers);
      sample('callers-done');
      const plainRunIds = runs.filter(r => r.label.startsWith('p')).map(r => r.runId);
      const plainProduced = runs
        .filter(r => r.label.startsWith('p'))
        .reduce((n, r) => n + (produced.get(r.label) ?? 0), 0);
      const plainSettled = () =>
        plainRunIds.reduce((n, id) => n + (perRun.get(id)?.acked ?? 0) + (perRun.get(id)?.failed ?? 0), 0);
      const drainFrom = Date.now();
      while (totals.inFlight > 0 || plainSettled() < plainProduced) {
        if (Date.now() - drainFrom > DRAIN_LIMIT_MS) break;
        await new Promise(r => setTimeout(r, 100));
      }
      const drainedAt = Date.now() - t0;
      sample('drained');
      clearInterval(sampler);
      const observerReads = await Promise.all(observers);

      const replays = await Promise.all(
        runs.map(async r => read((await r.agent.observe(r.runId)).fullStream, Date.now(), 60_000)),
      );
      const redisEntries = await Promise.all(
        runs.map(async r => {
          const entries = await admin.xRange(`${keyPrefix}:agent.stream.${r.runId}`, '-', '+');
          let text = '';
          for (const e of entries) {
            const ev = JSON.parse(e.message.event);
            const data = ev?.type === 'chunk' ? ev.data : undefined;
            if (data?.type === 'text-delta') text += data.payload?.text ?? '';
          }
          return { count: entries.length, text };
        }),
      );

      const peak = (k: string) => Math.max(...samples.map(s => s[k]));
      const memKeys = ['rssMB', 'heapUsedMB', 'externalMB', 'arrayBuffersMB'] as const;
      const memStart = {
        rssMB: mb(mem0.rss),
        heapUsedMB: mb(mem0.heapUsed),
        externalMB: mb(mem0.external),
        arrayBuffersMB: mb(mem0.arrayBuffers),
      };
      const summary = {
        label,
        outageMs: pause ? outageMs : 0,
        plainRuns: PLAIN_RUNS,
        durableRuns: 1,
        pacing: { chunkChars: CHUNK_CHARS, intervalMs: CHUNK_INTERVAL_MS, chunksPerRun: chunks, streamMs },
        downAt,
        upAt,
        drainedAt,
        backlogFlushedAfterRecoveryMs: backlogFlushedMs,
        allSettledAfterRecoveryMs: upAt === undefined ? 0 : drainedAt - upAt,
        busTotals: { ...totals },
        publishFailures: failures,
        memStart,
        memPeakDelta: Object.fromEntries(memKeys.map(k => [k, Math.round((peak(k) - memStart[k]) * 10) / 10])),
        peakPendingInferred: peak('pendingInferred'),
        runs: runs.map((r, i) => ({
          label: r.label,
          runId: r.runId,
          caller: {
            frames: callerReads[i]!.types.length,
            ms: callerReads[i]!.ms,
            textOk: callerReads[i]!.text === replies.get(r.label),
            textLen: callerReads[i]!.text.length,
            tail: callerReads[i]!.types.slice(-2).join(','),
            error: callerReads[i]!.error,
          },
          bus: perRun.get(r.runId) ?? { started: 0, acked: 0, failed: 0 },
          replay: {
            frames: replays[i]!.types.length,
            textOk: replays[i]!.text === replies.get(r.label),
            textLen: replays[i]!.text.length,
            error: replays[i]!.error,
          },
          redis: {
            entries: redisEntries[i]!.count,
            textOk: redisEntries[i]!.text === replies.get(r.label),
            textLen: redisEntries[i]!.text.length,
          },
        })),
        observers: observerReads.map((o, i) => ({
          label: `p${i}`,
          frames: o.types.length,
          textOk: o.text === replies.get(`p${i}`),
          textLen: o.text.length,
          error: o.error,
        })),
      };
      console.info(`[COR-1519 outage] ${JSON.stringify({ ...summary, runs: undefined })}`);
      for (const r of summary.runs) console.info(`[COR-1519 outage run] ${label} ${JSON.stringify(r)}`);
      if (OUT_DIR) writeFileSync(path.join(OUT_DIR, `${label}.json`), JSON.stringify({ summary, samples }, null, 2));
      return { summary, replies };
    } finally {
      try {
        execFileSync('docker', ['unpause', CONTAINER], { stdio: 'ignore' });
      } catch {}
      await admin.quit().catch(() => {});
      await pubsub.close?.();
    }
  }

  function expectComplete(summary: Awaited<ReturnType<typeof phase>>['summary'], replies: Map<string, string>) {
    for (const r of summary.runs) {
      expect.soft(r.caller.error, `${r.label} caller error`).toBeUndefined();
      expect.soft(r.caller.textOk, `${r.label} caller text`).toBe(true);
      expect.soft(r.caller.tail, `${r.label} caller tail`).toBe('step-finish,finish');
      expect.soft(r.replay.error, `${r.label} replay error`).toBeUndefined();
      expect.soft(r.replay.textOk, `${r.label} replay text`).toBe(true);
      expect.soft(r.replay.frames, `${r.label} replay frames`).toBe(r.caller.frames);
      expect.soft(r.redis.textOk, `${r.label} redis text`).toBe(true);
      if (r.label.startsWith('p')) {
        expect.soft(r.bus.failed, `${r.label} failed publishes`).toBe(0);
        expect.soft(r.bus.acked, `${r.label} acked = caller frames`).toBe(r.caller.frames);
      }
    }
    for (const o of summary.observers) {
      expect.soft(o.error, `${o.label} observer error`).toBeUndefined();
      expect.soft(o.textOk, `${o.label} observer text`).toBe(true);
    }
    expect.soft(replies.size).toBe(PLAIN_RUNS + 1);
  }

  for (const seconds of OUTAGES_S) {
    const outageMs = seconds * 1_000;
    const budget = 2 * (LEAD_MS + outageMs + TAIL_MS) + outageMs + DRAIN_LIMIT_MS + READ_SLACK_MS;

    it(
      `${seconds}s quiet baseline: same runs and stream length, no outage`,
      async () => {
        const { summary, replies } = await phase(outageMs, false, `quiet-${seconds}s`);
        expectComplete(summary, replies);
      },
      budget,
    );

    it(
      `${seconds}s docker pause: callers keep streaming, backlog drains, every frame survives`,
      async () => {
        const { summary, replies } = await phase(outageMs, true, `outage-${seconds}s`);
        expectComplete(summary, replies);
        for (const r of summary.runs.filter(x => x.label.startsWith('p'))) {
          expect
            .soft(r.caller.ms, `${r.label} caller paced by the model, not by the outage`)
            .toBeLessThan(summary.pacing.streamMs + CALLER_SLACK_MS);
        }
        expect.soft(summary.backlogFlushedAfterRecoveryMs).toBeLessThan(DRAIN_LIMIT_MS);
      },
      budget,
    );
  }
});
