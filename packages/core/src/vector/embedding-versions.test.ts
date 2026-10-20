import { createOpenAI as createOpenAIV1 } from '@ai-sdk/openai';
import { createOpenAI as createOpenAIV2 } from '@ai-sdk/openai-v5';
import { createOpenAI as createOpenAIV3 } from '@ai-sdk/openai-v6';
import { createOpenAI as createOpenAIV4 } from '@ai-sdk/openai-v7';
import { LLMock } from '@copilotkit/aimock';
import { afterAll, afterEach, beforeAll, describe, expect, expectTypeOf, it } from 'vitest';
import type { MastraEmbeddingModel, MastraSupportedEmbeddingModel } from './index';
import { embedV1, embedV2, embedV3, embedV4, isSupportedEmbeddingModel } from './index';

let mock: LLMock;
const text = 'The meeting starts at nine.';
const embedding = [0.6, 0.8, 0];

beforeAll(async () => {
  mock = new LLMock({ port: 0 });
  await mock.start();
});
afterEach(() => mock.reset());
afterAll(async () => mock.stop());

describe.each([
  { version: 'v1', createOpenAI: createOpenAIV1 },
  { version: 'v2', createOpenAI: createOpenAIV2 },
  { version: 'v3', createOpenAI: createOpenAIV3 },
  { version: 'v4', createOpenAI: createOpenAIV4 },
])('Public embedding API for specification $version', ({ version, createOpenAI }) => {
  // #26884: v4 models must be accepted by the public types and recognized by the version guard.
  it('embeds text through the matching SDK without rejecting supported provider models', async () => {
    mock.onEmbedding(text, { embedding });
    const model: MastraEmbeddingModel<string> = createOpenAI({
      apiKey: 'test-key',
      baseURL: mock.url,
    }).embedding('text-embedding-3-small');
    expect(model.specificationVersion).toBe(version);
    expect(isSupportedEmbeddingModel(model)).toBe(version !== 'v1');
    const options = { value: text, maxRetries: 0 };
    let result;
    switch (model.specificationVersion) {
      case 'v4':
        expectTypeOf(model).toExtend<MastraSupportedEmbeddingModel<string>>();
        result = await embedV4({ ...options, model });
        break;
      case 'v3':
        result = await embedV3({ ...options, model });
        break;
      case 'v2':
        result = await embedV2({ ...options, model });
        break;
      default:
        result = await embedV1({ ...options, model });
    }
    expect(result.embedding).toEqual(embedding);
    expect(mock.getRequests().map(request => request.body)).toEqual([
      expect.objectContaining({ model: 'text-embedding-3-small', embeddingInput: text }),
    ]);
    expect(mock.getRequests().map(request => request.response?.status)).toEqual([200]);
  });
});
