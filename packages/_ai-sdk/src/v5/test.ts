// V5 Test utilities from ai@5.x
export {
  MockLanguageModelV2,
  convertArrayToReadableStream,
  convertReadableStreamToArray,
  mockValues,
  mockId,
} from 'ai-v5/test';

// Re-export test utilities from provider-utils-v5/test
export {
  convertAsyncIterableToArray,
  convertArrayToReadableStream as convertArrayToReadableStreamProviderUtils,
} from '@ai-sdk/provider-utils-v5/test';
