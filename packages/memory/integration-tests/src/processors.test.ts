import {
  MockLanguageModelV2 as MockLanguageModelV5,
  convertArrayToReadableStream as convertArrayToReadableStreamV5,
} from '@internal/ai-sdk-v5/test';
import {
  MockLanguageModelV3 as MockLanguageModelV6,
  convertArrayToReadableStream as convertArrayToReadableStreamV6,
} from '@internal/ai-v6/test';
import { describe } from 'vitest';

import { getInputProcessorsTests } from './shared/input-processors';
import { getOutputProcessorMemoryTests } from './shared/output-processor-memory';
import { getProcessorsTests } from './shared/processors';

// V5 Processor Tests
describe('V5 Processor Tests', { sequential: true }, () => {
  const v5Config = {
    version: 'v5' as const,
    MockLanguageModel: MockLanguageModelV5,
    convertArrayToReadableStream: convertArrayToReadableStreamV5,
  };

  getProcessorsTests(v5Config);
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

  getProcessorsTests(v6Config);
  getInputProcessorsTests(v6Config);
  getOutputProcessorMemoryTests(v6Config);
});
