import {
  MockLanguageModelV4 as MockLanguageModelV5,
  convertArrayToReadableStream as convertArrayToReadableStreamV5,
  MockLanguageModelV4 as MockLanguageModelV6,
  convertArrayToReadableStream as convertArrayToReadableStreamV6,
} from '@mastra/core/ai/test';
import { describe } from 'vitest';

import { getInputProcessorsTests } from './shared/input-processors';
import { getOutputProcessorMemoryTests } from './shared/output-processor-memory';

// V5 Processor Tests
describe('V5 Processor Tests', { sequential: true }, () => {
  const v5Config = {
    version: 'v5' as const,
    MockLanguageModel: MockLanguageModelV5,
    convertArrayToReadableStream: convertArrayToReadableStreamV5,
  };

  getInputProcessorsTests(v5Config);
  getOutputProcessorMemoryTests(v5Config);
});

// V6 Processor Tests
describe('V6 Processor Tests', { sequential: true }, () => {
  const v6Config = {
    version: 'v6' as const,
    MockLanguageModel: MockLanguageModelV6,
    convertArrayToReadableStream: convertArrayToReadableStreamV6,
  };

  getInputProcessorsTests(v6Config);
  getOutputProcessorMemoryTests(v6Config);
});
