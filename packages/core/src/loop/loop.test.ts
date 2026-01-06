import { beforeEach, afterEach, describe, vi } from 'vitest';
import { loop } from './loop';
import { fullStreamTests } from './test-utils/fullStream';
import { generateTextTestsV5 } from './test-utils/generateText';
import { optionsTests } from './test-utils/options';
import { resultObjectTests } from './test-utils/resultObject';
import { streamObjectTests } from './test-utils/streamObject';
import { textStreamTests } from './test-utils/textStream';
import { toolsTests } from './test-utils/tools';
import { toUIMessageStreamTests } from './test-utils/toUIMessageStream';
import { mockDate } from './test-utils/utils';

describe('Loop Tests', () => {
  describe('AISDK v5', () => {
    beforeEach(() => {
      // Only fake Date to get deterministic timestamps, but allow async operations to proceed
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(mockDate);
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    textStreamTests({ loopFn: loop, runId: 'test-run-id' });
    fullStreamTests({ loopFn: loop, runId: 'test-run-id', modelVersion: 'v2' });
    toUIMessageStreamTests({ loopFn: loop, runId: 'test-run-id' });
    resultObjectTests({ loopFn: loop, runId: 'test-run-id', modelVersion: 'v2' });
    optionsTests({ loopFn: loop, runId: 'test-run-id' });
    generateTextTestsV5({ loopFn: loop, runId: 'test-run-id' });
    toolsTests({ loopFn: loop, runId: 'test-run-id' });

    streamObjectTests({ loopFn: loop, runId: 'test-run-id' });
  });

  describe('AISDK v6 (V3 models)', () => {
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(mockDate);
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    fullStreamTests({ loopFn: loop, runId: 'test-run-id', modelVersion: 'v3' });
    resultObjectTests({ loopFn: loop, runId: 'test-run-id', modelVersion: 'v3' });
  });

  // toolsTestsV5({ executeFn: execute, runId });

  // optionsTestsV5({ executeFn: execute, runId });

  // resultObjectTestsV5({ executeFn: execute, runId });

  // textStreamTestsV5({ executeFn: execute, runId });

  // fullStreamTestsV5({ executeFn: execute, runId });

  // toUIMessageStreamTests({ executeFn: execute, runId });

  // generateTextTestsV5({ executeFn: execute, runId });
});
