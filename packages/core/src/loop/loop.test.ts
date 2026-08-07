import { beforeEach, afterEach, describe, vi } from 'vitest';
import type { Mastra } from '../mastra';
import { loop } from './loop';
import { fullStreamTests } from './test-utils/fullStream';
import { generateTextTestsV5 } from './test-utils/generateText';
import { optionsTests } from './test-utils/options';
import { resultObjectTests } from './test-utils/resultObject';
import { streamObjectTests } from './test-utils/streamObject';
import { textStreamTests } from './test-utils/textStream';
import { toolMediaTests } from './test-utils/tool-media';
import { toolsTests } from './test-utils/tools';
import { createTestMastra, mockDate } from './test-utils/utils';

// The agentic loop now runs on the evented engine, which requires a Mastra
// instance with a pubsub adapter (and workers started) to dispatch events.
// We hold the current per-test instance in a ref and inject it into every
// `loop()` call via this wrapper.
let mastraRef: { current?: Mastra } = {};
const loopFn: typeof loop = opts => loop({ ...opts, mastra: mastraRef.current as any });

const setupEventedMastra = () => {
  let dispose: (() => Promise<void>) | undefined;
  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(mockDate);
    const created = await createTestMastra();
    mastraRef.current = created.mastra;
    dispose = created.dispose;
  });

  afterEach(async () => {
    vi.useRealTimers();
    await dispose?.();
    mastraRef.current = undefined;
    dispose = undefined;
  });
};

describe('Loop Tests', () => {
  describe('AISDK v5', () => {
    setupEventedMastra();

    textStreamTests({ loopFn, runId: 'test-run-id' });
    fullStreamTests({ loopFn, runId: 'test-run-id', modelVersion: 'v2' });
    resultObjectTests({ loopFn, runId: 'test-run-id', modelVersion: 'v2' });
    optionsTests({ loopFn, runId: 'test-run-id' });
    generateTextTestsV5({ loopFn, runId: 'test-run-id' });
    toolsTests({ loopFn, runId: 'test-run-id' });
    toolMediaTests({ loopFn, runId: 'test-run-id', modelVersion: 'v2' });

    streamObjectTests({ loopFn, runId: 'test-run-id' });
  });

  describe('AISDK v6 (V3 models)', () => {
    setupEventedMastra();

    fullStreamTests({ loopFn, runId: 'test-run-id', modelVersion: 'v3' });
    resultObjectTests({ loopFn, runId: 'test-run-id', modelVersion: 'v3' });
    toolMediaTests({ loopFn, runId: 'test-run-id', modelVersion: 'v3' });
  });

  // toolsTestsV5({ executeFn: execute, runId });

  // optionsTestsV5({ executeFn: execute, runId });

  // resultObjectTestsV5({ executeFn: execute, runId });

  // textStreamTestsV5({ executeFn: execute, runId });

  // fullStreamTestsV5({ executeFn: execute, runId });

  // toUIMessageStreamTests({ executeFn: execute, runId });

  // generateTextTestsV5({ executeFn: execute, runId });
});
