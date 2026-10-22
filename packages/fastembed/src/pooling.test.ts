import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { EmbeddingModel, FlagEmbedding } from './fastembed';

// ONNX graph emits [token_id, 1] for each token so the pooling result is calculable.
const modelBytes = Buffer.from(
  'CAkSDmZhc3RlbWJlZC10ZXN0Op4DCiEKCWlucHV0X2lkcxIDaWRzIgRDYXN0KgkKAnRvGAGgAQIKFwoDaWRzCgR6ZXJvEgV6ZXJvcyIDTXVsChcKBXplcm9zCgNvbmUSBG9uZXMiA0FkZAocCgNpZHMKBGF4ZXMSBGlkczMiCVVuc3F1ZWV6ZQoeCgRvbmVzCgRheGVzEgVvbmVzMyIJVW5zcXVlZXplCjUKBGlkczMKBW9uZXMzEhFsYXN0X2hpZGRlbl9zdGF0ZSIGQ29uY2F0KgsKBGF4aXMYAqABAhIOdG9rZW4tZmVhdHVyZXMqDhABQgR6ZXJvSgQAAAAAKg0QAUIDb25lSgQAAIA/KhQIARAHQgRheGVzSggCAAAAAAAAAFooCglpbnB1dF9pZHMSGwoZCAcSFQoHEgViYXRjaAoKEghzZXF1ZW5jZVotCg5hdHRlbnRpb25fbWFzaxIbChkIBxIVCgcSBWJhdGNoCgoSCHNlcXVlbmNlYjQKEWxhc3RfaGlkZGVuX3N0YXRlEh8KHQgBEhkKBxIFYmF0Y2gKChIIc2VxdWVuY2UKAggCQgIQDQ==',
  'base64',
);
const tokenizer = {
  version: '1.0',
  truncation: null,
  padding: null,
  added_tokens: [],
  normalizer: null,
  pre_tokenizer: { type: 'WhitespaceSplit' },
  post_processor: null,
  decoder: null,
  model: {
    type: 'WordLevel',
    vocab: { '[PAD]': 0, one: 1, two: 2, three: 3, four: 4, five: 5, '[UNK]': 6 },
    unk_token: '[UNK]',
  },
};

function writeModel(cacheDir: string, model: EmbeddingModel) {
  const modelDir = path.join(cacheDir, model);
  fs.mkdirSync(modelDir);
  for (const [file, content] of Object.entries({
    'tokenizer.json': tokenizer,
    'tokenizer_config.json': { model_max_length: 4, pad_token: '[PAD]' },
    'config.json': { pad_token_id: 0 },
    'special_tokens_map.json': { pad_token: '[PAD]', unk_token: '[UNK]' },
  })) {
    fs.writeFileSync(path.join(modelDir, file), JSON.stringify(content));
  }
  fs.writeFileSync(
    path.join(modelDir, model === EmbeddingModel.BGESmallENV15 ? 'model_optimized.onnx' : 'model.onnx'),
    modelBytes,
  );
}

const meanModels = [EmbeddingModel.AllMiniLML6V2, EmbeddingModel.MLE5Large] as const;

describe.each(meanModels)('%s sentence pooling', model => {
  let cacheDir: string;
  let embedding: FlagEmbedding;

  beforeAll(async () => {
    cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fastembed-pooling-'));
    writeModel(cacheDir, model);
    embedding = await FlagEmbedding.init({ model, cacheDir, maxLength: 4, showDownloadProgress: false });
  });
  afterAll(() => fs.rmSync(cacheDir, { recursive: true, force: true }));

  it('averages attended tokens before normalizing each sentence (#27949)', async () => {
    const result = await embedding.embed(['one three', 'two four']).next();
    expect(result.value![0]![0]).toBeCloseTo(2 / Math.sqrt(5));
    expect(result.value![0]![1]).toBeCloseTo(1 / Math.sqrt(5));
    expect(result.value![1]![0]).toBeCloseTo(3 / Math.sqrt(10));
    expect(result.value![1]![1]).toBeCloseTo(1 / Math.sqrt(10));
  });

  it('excludes padding from the sentence mean (#27949)', async () => {
    const result = await embedding.embed(['one five']).next();
    expect(result.value![0]![0]).toBeCloseTo(3 / Math.sqrt(10));
    expect(result.value![0]![1]).toBeCloseTo(1 / Math.sqrt(10));
  });

  it.each(['passageEmbed', 'queryEmbed'] as const)('uses mean pooling through %s (#27949)', async method => {
    const result =
      method === 'queryEmbed'
        ? await embedding.queryEmbed('one three')
        : (await embedding.passageEmbed(['one three']).next()).value![0]!;
    // Prefix token [UNK]=6, followed by ids 1 and 3: mean [10/3, 1].
    expect(result[0]).toBeCloseTo(10 / Math.sqrt(109));
    expect(result[1]).toBeCloseTo(3 / Math.sqrt(109));
  });
});

it('preserves first-token pooling for BGE models', async () => {
  const cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fastembed-cls-'));
  try {
    writeModel(cacheDir, EmbeddingModel.BGESmallENV15);
    const embedding = await FlagEmbedding.init({
      model: EmbeddingModel.BGESmallENV15,
      cacheDir,
      maxLength: 4,
      showDownloadProgress: false,
    });
    const result = await embedding.embed(['one three']).next();
    expect(result.value![0]![0]).toBeCloseTo(1 / Math.sqrt(2));
    expect(result.value![0]![1]).toBeCloseTo(1 / Math.sqrt(2));
  } finally {
    fs.rmSync(cacheDir, { recursive: true, force: true });
  }
});
