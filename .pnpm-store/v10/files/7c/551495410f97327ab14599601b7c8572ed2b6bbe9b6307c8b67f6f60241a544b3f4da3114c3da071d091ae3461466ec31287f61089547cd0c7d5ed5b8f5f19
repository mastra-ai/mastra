// test/index.ts
import {
  convertArrayToReadableStream,
  mockId
} from "@ai-sdk/provider-utils/test";

// core/test/not-implemented.ts
function notImplemented() {
  throw new Error("Not implemented");
}

// core/test/mock-embedding-model-v1.ts
var MockEmbeddingModelV1 = class {
  constructor({
    provider = "mock-provider",
    modelId = "mock-model-id",
    maxEmbeddingsPerCall = 1,
    supportsParallelCalls = false,
    doEmbed = notImplemented
  } = {}) {
    this.specificationVersion = "v1";
    this.provider = provider;
    this.modelId = modelId;
    this.maxEmbeddingsPerCall = maxEmbeddingsPerCall != null ? maxEmbeddingsPerCall : void 0;
    this.supportsParallelCalls = supportsParallelCalls;
    this.doEmbed = doEmbed;
  }
};

// core/test/mock-language-model-v1.ts
var MockLanguageModelV1 = class {
  constructor({
    provider = "mock-provider",
    modelId = "mock-model-id",
    supportsUrl = void 0,
    doGenerate = notImplemented,
    doStream = notImplemented,
    defaultObjectGenerationMode = void 0,
    supportsStructuredOutputs = void 0
  } = {}) {
    this.specificationVersion = "v1";
    this.provider = provider;
    this.modelId = modelId;
    this.doGenerate = doGenerate;
    this.doStream = doStream;
    this.supportsUrl = supportsUrl;
    this.defaultObjectGenerationMode = defaultObjectGenerationMode;
    this.supportsStructuredOutputs = supportsStructuredOutputs;
  }
};

// core/test/mock-values.ts
function mockValues(...values) {
  let counter = 0;
  return () => {
    var _a;
    return (_a = values[counter++]) != null ? _a : values[values.length - 1];
  };
}

// core/util/simulate-readable-stream.ts
import { delay as delayFunction } from "@ai-sdk/provider-utils";
function simulateReadableStream({
  chunks,
  initialDelayInMs = 0,
  chunkDelayInMs = 0,
  _internal
}) {
  var _a;
  const delay = (_a = _internal == null ? void 0 : _internal.delay) != null ? _a : delayFunction;
  let index = 0;
  return new ReadableStream({
    async pull(controller) {
      if (index < chunks.length) {
        await delay(index === 0 ? initialDelayInMs : chunkDelayInMs);
        controller.enqueue(chunks[index++]);
      } else {
        controller.close();
      }
    }
  });
}

// test/index.ts
var simulateReadableStream2 = simulateReadableStream;
export {
  MockEmbeddingModelV1,
  MockLanguageModelV1,
  convertArrayToReadableStream,
  mockId,
  mockValues,
  simulateReadableStream2 as simulateReadableStream
};
//# sourceMappingURL=index.mjs.map