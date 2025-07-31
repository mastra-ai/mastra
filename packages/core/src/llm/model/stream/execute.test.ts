import { describe } from 'vitest';
import { fullStreamTests as fullStreamTestsV4 } from './ai-sdk/v4/test-utils/fullStream';
import { generateTextTests } from './ai-sdk/v4/test-utils/generateText';
import { mergeIntoDataStreamTests } from './ai-sdk/v4/test-utils/mergeIntoDataStream';
import { optionsTests as optionsTestsV4 } from './ai-sdk/v4/test-utils/options';
import { resultObjectTests as resultObjectTestsV4 } from './ai-sdk/v4/test-utils/result-object';
import { textStreamTests as textStreamTestsV4 } from './ai-sdk/v4/test-utils/textStream';
import { toDataStreamResponseTests } from './ai-sdk/v4/test-utils/toDataStreamResponse';
import { fullStreamTests as fullStreamTestsV5 } from './ai-sdk/v5/test-utils/fullStream';
import { optionsTests as optionsTestsV5 } from './ai-sdk/v5/test-utils/options';
import { resultObjectTests as resultObjectTestsV5 } from './ai-sdk/v5/test-utils/result-object';
import { telemetryTests as telemetryTestsV5 } from './ai-sdk/v5/test-utils/telemetry';
import { textStreamTests as textStreamTestsV5 } from './ai-sdk/v5/test-utils/textStream';
import { toUIMessageStreamTests } from './ai-sdk/v5/test-utils/toUIMessageStream';
import { execute } from './execute';

const runId = '12345';

describe('V4 tests', () => {
  optionsTestsV4({ executeFn: execute, runId });

  resultObjectTestsV4({ executeFn: execute, runId });

  textStreamTestsV4({
    executeFn: execute,
    runId,
  });

  fullStreamTestsV4({ executeFn: execute, runId });

  toDataStreamResponseTests({
    executeFn: execute,
    runId,
  });

  mergeIntoDataStreamTests({
    executeFn: execute,
    runId,
  });

  generateTextTests({ executeFn: execute, runId });
});

describe('V5 tests', () => {
  telemetryTestsV5({ executeFn: execute, runId });

  optionsTestsV5({ executeFn: execute, runId });

  resultObjectTestsV5({ executeFn: execute, runId });

  textStreamTestsV5({ executeFn: execute, runId });

  fullStreamTestsV5({ executeFn: execute, runId });

  toUIMessageStreamTests({ executeFn: execute, runId });
});
