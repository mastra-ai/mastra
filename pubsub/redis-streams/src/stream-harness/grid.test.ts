import { randomUUID } from 'node:crypto';

import { LLMock } from '@copilotkit/aimock';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { getFreePort, makeStorageDir } from '../../test-fixtures/harness';
import { compareRun, diffFrames, formatVerdict, judgeCell } from './compare';
import { baselineFrames, expectedCapture, knownDifferencesFor, observationApplies, parseFrames } from './expected';
import { httpObserve } from './http-observe';
import { BASELINES, OBSERVATIONS } from './known-differences';
import { HarnessNode } from './node';
import { SCENARIOS } from './scenarios';
import { ENGINES, LAYOUTS, READERS, layoutName } from './types';
import type { Cell, RunCapture } from './types';

const SCENARIO_NAMES = ['structured-output', 'structured-invalid', 'tool-throws', 'tool-undefined', 'input-tripwire'];
const CELLS: Cell[] = LAYOUTS.flatMap(layout =>
  ENGINES.flatMap(engine => SCENARIO_NAMES.map(scenario => ({ scenario, engine, ...layout }))),
);
const AGENT_ID = 'harness-agent';
const skipRedis = process.env.SKIP_REDIS_TESTS === '1';

/**
 * One turn, every reader. The publisher streams; the reader process (the same
 * process in the single topology) subscribes to the thread before the turn,
 * attaches `observe()` as soon as the run starts, and after the turn reads
 * the raw topic, `observe()` from 0 and the server `/observe` route.
 */
async function captureTurn(publisher: HarnessNode, reader: HarnessNode, port: number, scenario: string) {
  const runId = randomUUID();
  const threadId = `thread-${runId}`;
  const thread = randomUUID();
  reader.send({ cmd: 'subscribeThread', id: thread, threadId, resourceId: 'harness-user' });
  await reader.next(e => e.type === 'subscribed' && e.id === thread);

  const streamId = randomUUID();
  publisher.send({ cmd: 'stream', id: streamId, scenario, runId, threadId, resourceId: 'harness-user' });
  // Attach once the first step has started on the publisher, and (durable,
  // evented) once the run's snapshot is persisted, so the observer sees the
  // same run state on every run. The model's first token is 500ms out, so the
  // observer is attached before any text exists.
  await publisher.next(e => (e.type === 'step-started' || e.type === 'stream-done') && e.id === streamId);
  const mid = reader.frames(
    { cmd: 'observe', runId, reader: 'observe-mid', afterPersisted: true, timeoutMs: 8_000 },
    'observe-mid',
  );

  const capture: RunCapture = {};
  capture.live = (await publisher.next(e => e.type === 'frames' && e.id === streamId && e.reader === 'live')).frames;
  capture['observe-mid'] = await mid;
  capture.topic = await reader.frames({ cmd: 'tapTopic', runId }, 'topic');
  capture['observe-0'] = await reader.frames({ cmd: 'observe', runId }, 'observe-0');
  capture['http-observe'] = await httpObserve(port, AGENT_ID, runId);
  capture.thread = await reader.frames({ cmd: 'stopThread', id: thread }, 'thread');
  return capture;
}

/**
 * Runs each scenario on every engine, backend and topology, captures every
 * reader and fails on any difference not listed in `known-differences.ts`, or
 * on any listed difference that no longer reproduces.
 */
describe.skipIf(skipRedis)('stream harness grid', () => {
  let llm: LLMock;
  let llmUrl: string;

  beforeAll(async () => {
    llm = new LLMock({ port: 0 });
    await llm.start();
    llmUrl = llm.url.replace(/\/+$/, '');
    for (const scenario of Object.values(SCENARIOS)) scenario.script(llm);
  });

  afterAll(async () => {
    await llm?.stop();
  });

  describe('observations', () => {
    it('each names a ticket, a cause and evidence, and describes cells the grid runs', () => {
      for (const o of OBSERVATIONS) {
        const label = `${o.scenario} ${o.engines.join('/')} ${o.readers.join('/')}`;
        expect(SCENARIO_NAMES, label).toContain(o.scenario);
        for (const a of [o, o.againstLive, o.againstPlain].filter(x => x !== undefined)) {
          expect(a.ticket, label).toMatch(/^[A-Z]+-\d+$/);
          expect(['durable-stream', 'engine', 'plain-layer'], label).toContain(a.cause);
          expect(a.evidence, label).toMatch(/\.ts:\d+/);
        }
        for (const layout of o.layouts ?? []) expect(LAYOUTS.map(layoutName), label).toContain(layout);
        // An observation that matches the baseline everywhere it applies is stale.
        const changes = CELLS.some(cell =>
          READERS.some(
            reader =>
              observationApplies(o, cell, reader) &&
              diffFrames(baselineFrames(cell.scenario), parseFrames(o.frames, baselineFrames(cell.scenario))) !==
                undefined,
          ),
        );
        expect(changes, `${label}: matches the baseline, so it explains nothing`).toBe(true);
      }
    });

    it('describe each reader of each cell at most once and explain every derived difference', () => {
      for (const cell of CELLS) expect(() => knownDifferencesFor(cell)).not.toThrow();
    });

    it('have a baseline for every scenario', () => {
      expect(Object.keys(BASELINES).sort()).toEqual([...SCENARIO_NAMES].sort());
    });
  });

  describe.each(LAYOUTS)('$topology / $backend', ({ topology, backend }) => {
    const plain = new Map<string, RunCapture>();

    describe.each(ENGINES)('%s', engine => {
      let storage: Awaited<ReturnType<typeof makeStorageDir>>;
      let publisher: HarnessNode;
      let reader: HarnessNode;
      let port: number;

      beforeAll(async () => {
        storage = await makeStorageDir('stream-harness-');
        port = await getFreePort();
        const common = {
          engine,
          backend,
          llmUrl,
          keyPrefix: `stream-harness-${randomUUID()}`,
          storageUrl: storage.storageUrl,
        };
        if (topology === 'single') {
          publisher = reader = await HarnessNode.start({ ...common, port });
        } else {
          [publisher, reader] = await Promise.all([
            HarnessNode.start({ ...common, nodeId: 'publisher' }),
            HarnessNode.start({ ...common, nodeId: 'reader', port }),
          ]);
        }
      });

      afterAll(async () => {
        await Promise.all([publisher?.stop(), reader?.stop()]);
        await storage?.cleanup();
      });

      it.each(SCENARIO_NAMES)('%s', async scenario => {
        const cell: Cell = { scenario, engine, backend, topology };
        const capture = await captureTurn(publisher, reader, port, scenario);
        if (engine === 'plain') plain.set(scenario, capture);

        const verdict = judgeCell(cell, compareRun(cell, capture, plain.get(scenario)), knownDifferencesFor(cell));
        // Differences alone can't see a change every reader shares (all of
        // plain drifting together), so each reader is also held to exactly
        // what the observations say it delivers.
        const expected = expectedCapture(cell);
        const drift = READERS.flatMap(reader => {
          const diff = diffFrames(expected[reader]!, capture[reader] ?? []);
          return diff ? [`  DRIFT ${reader} [${diff.kind}] ${diff.detail}`] : [];
        });
        const report = [formatVerdict(cell, verdict), ...drift].join('\n');
        if (process.env.STREAM_HARNESS_VERBOSE) console.log(`${report}\n${JSON.stringify(capture)}`);
        expect(verdict.unlisted.length + verdict.stale.length + drift.length, report).toBe(0);
      });
    });
  });
});
