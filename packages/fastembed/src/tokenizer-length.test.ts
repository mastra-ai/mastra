import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { EmbeddingModel, FlagEmbedding, SparseEmbeddingModel, SparseTextEmbedding } from './fastembed';

// Real ONNX graphs emit [token_id, 1] for every token.
const denseModelBytes = Buffer.from(
  'CAkSDmZhc3RlbWJlZC10ZXN0Op4DCiEKCWlucHV0X2lkcxIDaWRzIgRDYXN0KgkKAnRvGAGgAQIKFwoDaWRzCgR6ZXJvEgV6ZXJvcyIDTXVsChcKBXplcm9zCgNvbmUSBG9uZXMiA0FkZAocCgNpZHMKBGF4ZXMSBGlkczMiCVVuc3F1ZWV6ZQoeCgRvbmVzCgRheGVzEgVvbmVzMyIJVW5zcXVlZXplCjUKBGlkczMKBW9uZXMzEhFsYXN0X2hpZGRlbl9zdGF0ZSIGQ29uY2F0KgsKBGF4aXMYAqABAhIOdG9rZW4tZmVhdHVyZXMqDhABQgR6ZXJvSgQAAAAAKg0QAUIDb25lSgQAAIA/KhQIARAHQgRheGVzSggCAAAAAAAAAFooCglpbnB1dF9pZHMSGwoZCAcSFQoHEgViYXRjaAoKEghzZXF1ZW5jZVotCg5hdHRlbnRpb25fbWFzaxIbChkIBxIVCgcSBWJhdGNoCgoSCHNlcXVlbmNlYjQKEWxhc3RfaGlkZGVuX3N0YXRlEh8KHQgBEhkKBxIFYmF0Y2gKChIIc2VxdWVuY2UKAggCQgIQDQ==',
  'base64',
);
const sparseModelBytes = Buffer.from(
  'CAkSDmZhc3RlbWJlZC10ZXN0OoQDCiEKCWlucHV0X2lkcxIDaWRzIgRDYXN0KgkKAnRvGAGgAQIKFwoDaWRzCgR6ZXJvEgV6ZXJvcyIDTXVsChcKBXplcm9zCgNvbmUSBG9uZXMiA0FkZAocCgNpZHMKBGF4ZXMSBGlkczMiCVVuc3F1ZWV6ZQoeCgRvbmVzCgRheGVzEgVvbmVzMyIJVW5zcXVlZXplCioKBGlkczMKBW9uZXMzEgZvdXRwdXQiBkNvbmNhdCoLCgRheGlzGAKgAQISDnRva2VuLWZlYXR1cmVzKg4QAUIEemVyb0oEAAAAACoNEAFCA29uZUoEAACAPyoUCAEQB0IEYXhlc0oIAgAAAAAAAABaKAoJaW5wdXRfaWRzEhsKGQgHEhUKBxIFYmF0Y2gKChIIc2VxdWVuY2VaKQoKaW5wdXRfbWFzaxIbChkIBxIVCgcSBWJhdGNoCgoSCHNlcXVlbmNlYikKBm91dHB1dBIfCh0IARIZCgcSBWJhdGNoCgoSCHNlcXVlbmNlCgIIAkICEA0=',
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

let modelDir: string;
beforeEach(() => {
  modelDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fastembed-tokenizer-length-'));
  fs.mkdirSync(path.join(modelDir, 'onnx'));
  fs.writeFileSync(path.join(modelDir, 'model.onnx'), denseModelBytes);
  fs.writeFileSync(path.join(modelDir, 'onnx/model.onnx'), sparseModelBytes);
  for (const [file, content] of Object.entries({
    'tokenizer.json': tokenizer,
    'config.json': { pad_token_id: 0 },
    'special_tokens_map.json': { pad_token: '[PAD]', unk_token: '[UNK]' },
  }))
    fs.writeFileSync(path.join(modelDir, file), JSON.stringify(content));
});
afterEach(() => fs.rmSync(modelDir, { recursive: true, force: true }));

const cases = [
  { name: 'missing metadata with an explicit limit', modelLimit: undefined, maxLength: 4, expected: 4 },
  { name: 'missing metadata with the default limit', modelLimit: undefined, maxLength: undefined, expected: 512 },
  { name: 'null metadata with an explicit limit', modelLimit: null, maxLength: 4, expected: 4 },
  { name: 'a smaller model limit', modelLimit: 2, maxLength: 4, expected: 2 },
  { name: 'a smaller requested limit', modelLimit: 4, maxLength: 2, expected: 2 },
];

describe.each(cases)('$name', ({ modelLimit, maxLength, expected }) => {
  beforeEach(() => {
    fs.writeFileSync(
      path.join(modelDir, 'tokenizer_config.json'),
      JSON.stringify({ model_max_length: modelLimit, pad_token: '[PAD]' }),
    );
  });

  it('keeps dense embeddings and truncation within the effective window', async () => {
    const embedding = await FlagEmbedding.init({
      model: EmbeddingModel.CUSTOM,
      modelAbsoluteDirPath: modelDir,
      modelName: 'model.onnx',
      maxLength,
    });
    const text = [...Array<string>(expected).fill('one'), 'five'].join(' ');
    expect.soft(await embedding.countTruncated([text])).toEqual({ count: 1, maxLength: expected });
    const result = await embedding.embed([text]).next();
    expect(result.value![0]![0]).toBeCloseTo(1 / Math.sqrt(2));
    expect(result.value![0]![1]).toBeCloseTo(1 / Math.sqrt(2));
  });

  it('keeps sparse embeddings within the effective window', async () => {
    const embedding = await SparseTextEmbedding.init({
      model: SparseEmbeddingModel.CUSTOM,
      modelAbsoluteDirPath: modelDir,
      modelName: 'model.onnx',
      maxLength,
    });
    const text = [...Array<string>(expected).fill('one'), 'five'].join(' ');
    const result = await embedding.embed([text]).next();
    expect(result.value![0]!.indices).toEqual([0, 1]);
    expect(result.value![0]!.values[0]).toBeCloseTo(Math.log(2));
    expect(result.value![0]!.values[1]).toBeCloseTo(Math.log(2));
  });
});
