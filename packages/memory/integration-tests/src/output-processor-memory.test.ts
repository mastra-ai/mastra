import {
  MockLanguageModelV2 as MockLanguageModelV5,
  convertArrayToReadableStream as convertArrayToReadableStreamV5,
} from '@internal/ai-sdk-v5/test';
import {
  MockLanguageModelV3 as MockLanguageModelV6,
  convertArrayToReadableStream as convertArrayToReadableStreamV6,
} from '@internal/ai-v6/test';

import { getOutputProcessorMemoryTests } from './shared/output-processor-memory';

// Test with AI SDK v5 mocks
getOutputProcessorMemoryTests({
  version: 'v5',
  MockLanguageModel: MockLanguageModelV5,
  convertArrayToReadableStream: convertArrayToReadableStreamV5,
});

// Test with AI SDK v6 mocks
getOutputProcessorMemoryTests({
  version: 'v6',
  MockLanguageModel: MockLanguageModelV6,
  convertArrayToReadableStream: convertArrayToReadableStreamV6,
});
