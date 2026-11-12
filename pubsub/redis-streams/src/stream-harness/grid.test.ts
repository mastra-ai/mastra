import { randomUUID } from 'node:crypto';

import { LLMock } from '@copilotkit/aimock';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { makeStorageDir } from '../../test-fixtures/harness';
import { compareRun, formatVerdict, judgeCell } from './compare';
import { KNOWN_DIFFERENCES } from './known-differences';
import { HarnessNode } from './node';
import { SCENARIOS } from './scenarios';
import { ENGINES } from './types';
import type { Backend, Cell, RunCapture } from './types';

const BACKENDS: Backend[] = ['memory', 'redis'];
const SCENARIO_NAMES = ['structured-output'];
const skipRedis = process.env.SKIP_REDIS_TESTS === '1';

/**
 * Runs each scenario on every engine and backend, captures every reader and
 * fails on any difference not listed in `known-differences.ts`, or on any
 * listed difference that no longer reproduces.
 */
describe.skipIf(skipRedis)('stream harness grid (single process)', () => {
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

  it('lists only differences for cells the grid runs, each with ticket, cause and evidence', () => {
    for (const entry of KNOWN_DIFFERENCES) {
      expect(SCENARIO_NAMES, `${entry.ticket}: scenario not in grid`).toContain(entry.scenario);
      if (entry.backend) expect(BACKENDS, `${entry.ticket}: backend not in grid`).toContain(entry.backend);
      expect(entry.ticket).toMatch(/^[A-Z]+-\d+$/);
      expect(['durable-stream', 'engine', 'plain-layer']).toContain(entry.cause);
      expect(entry.evidence.length).toBeGreaterThan(10);
    }
  });

  describe.each(BACKENDS)('backend %s', backend => {
    describe.each(SCENARIO_NAMES)('%s', scenarioName => {
      let plain: RunCapture | undefined;

      it.each(ENGINES)('%s', async engine => {
        const cell: Cell = { scenario: scenarioName, engine, backend, topology: 'single' };
        const storage = await makeStorageDir('stream-harness-');
        const node = await HarnessNode.start({
          engine,
          backend,
          llmUrl,
          keyPrefix: `stream-harness-${randomUUID()}`,
          storageUrl: storage.storageUrl,
        });
        try {
          const runId = randomUUID();
          const capture: RunCapture = {};
          capture.live = await node.frames({ cmd: 'stream', scenario: scenarioName, runId }, 'live');
          capture.topic = await node.frames({ cmd: 'tapTopic', runId }, 'topic');
          capture['observe-0'] = await node.frames({ cmd: 'observe', runId }, 'observe-0');
          if (engine === 'plain') plain = capture;

          const verdict = judgeCell(cell, compareRun(cell, capture, plain), KNOWN_DIFFERENCES);
          const report = formatVerdict(cell, verdict);
          if (process.env.STREAM_HARNESS_VERBOSE) console.log(`${report}\n${JSON.stringify(capture, null, 1)}`);
          expect(verdict.unlisted.length + verdict.stale.length, report).toBe(0);
        } finally {
          await node.stop();
          await storage.cleanup();
        }
      });
    });
  });
});
