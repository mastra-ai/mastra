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
import { v3UsageNormalizationTests } from './test-utils/v3-usage-normalization';

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
    fullStreamTests({ loopFn: loop, runId: 'test-run-id' });
    toUIMessageStreamTests({ loopFn: loop, runId: 'test-run-id' });
    resultObjectTests({ loopFn: loop, runId: 'test-run-id' });
    optionsTests({ loopFn: loop, runId: 'test-run-id' });
    generateTextTestsV5({ loopFn: loop, runId: 'test-run-id' });
    toolsTests({ loopFn: loop, runId: 'test-run-id' });

    streamObjectTests({ loopFn: loop, runId: 'test-run-id' });
  });

  describe('AISDK v6 (LanguageModelV3)', () => {
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(mockDate);
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    v3UsageNormalizationTests({ loopFn: loop, runId: 'test-run-id' });
  });

  // toolsTestsV5({ executeFn: execute, runId });

  // optionsTestsV5({ executeFn: execute, runId });

  // resultObjectTestsV5({ executeFn: execute, runId });

  // textStreamTestsV5({ executeFn: execute, runId });

  // fullStreamTestsV5({ executeFn: execute, runId });

  // toUIMessageStreamTests({ executeFn: execute, runId });

  // generateTextTestsV5({ executeFn: execute, runId });
});
