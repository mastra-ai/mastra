import { beforeEach, afterEach, describe, vi } from 'vitest';
import type { ToolSet } from 'ai-v5';
import { loop } from './loop';
import { createAgenticLoopWorkflow } from './workflows/agentic-loop';
import type { LoopOptions } from './types';
import type { OutputSchema } from '../stream/base/schema';
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
      vi.useFakeTimers();
      vi.setSystemTime(mockDate);
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    // Create a test workflow instance that will be reused across all test calls
    const testWorkflow = createAgenticLoopWorkflow({
      models: [],
      telemetry_settings: undefined,
      logger: undefined,
      mastra: undefined,
    });

    // Wrapper function that matches the old loop signature for backward compatibility with tests
    const loopWrapper = <Tools extends ToolSet = ToolSet, OUTPUT extends OutputSchema | undefined = undefined>(
      options: LoopOptions<Tools, OUTPUT>,
    ) => loop(testWorkflow, options);

    textStreamTests({ loopFn: loopWrapper, runId: 'test-run-id' });
    fullStreamTests({ loopFn: loopWrapper, runId: 'test-run-id' });
    toUIMessageStreamTests({ loopFn: loopWrapper, runId: 'test-run-id' });
    resultObjectTests({ loopFn: loopWrapper, runId: 'test-run-id' });
    optionsTests({ loopFn: loopWrapper, runId: 'test-run-id' });
    generateTextTestsV5({ loopFn: loopWrapper, runId: 'test-run-id' });
    toolsTests({ loopFn: loopWrapper, runId: 'test-run-id' });

    streamObjectTests({ loopFn: loopWrapper, runId: 'test-run-id' });
  });

  // toolsTestsV5({ executeFn: execute, runId });

  // optionsTestsV5({ executeFn: execute, runId });

  // resultObjectTestsV5({ executeFn: execute, runId });

  // textStreamTestsV5({ executeFn: execute, runId });

  // fullStreamTestsV5({ executeFn: execute, runId });

  // toUIMessageStreamTests({ executeFn: execute, runId });

  // generateTextTestsV5({ executeFn: execute, runId });
});
