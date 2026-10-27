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
  modelDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fastembed-output-rank-'));
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

const rankTwoModels = {
  dense: Buffer.from(
    'CAkSDmZhc3RlbWJlZC10ZXN0OsoBCi8KCWlucHV0X2lkcxIRbGFzdF9oaWRkZW5fc3RhdGUiBENhc3QqCQoCdG8YAaABAhIMdG9rZW4tdmFsdWVzWigKCWlucHV0X2lkcxIbChkIBxIVCgcSBWJhdGNoCgoSCHNlcXVlbmNlWi0KDmF0dGVudGlvbl9tYXNrEhsKGQgHEhUKBxIFYmF0Y2gKChIIc2VxdWVuY2ViMAoRbGFzdF9oaWRkZW5fc3RhdGUSGwoZCAESFQoHEgViYXRjaAoKEghzZXF1ZW5jZUICEA0=',
    'base64',
  ),
  sparse: Buffer.from(
    'CAkSDmZhc3RlbWJlZC10ZXN0OrABCiQKCWlucHV0X2lkcxIGb3V0cHV0IgRDYXN0KgkKAnRvGAGgAQISDHRva2VuLXZhbHVlc1ooCglpbnB1dF9pZHMSGwoZCAcSFQoHEgViYXRjaAoKEghzZXF1ZW5jZVopCgppbnB1dF9tYXNrEhsKGQgHEhUKBxIFYmF0Y2gKChIIc2VxdWVuY2ViJQoGb3V0cHV0EhsKGQgBEhUKBxIFYmF0Y2gKChIIc2VxdWVuY2VCAhAN',
    'base64',
  ),
};

beforeEach(() => {
  fs.writeFileSync(
    path.join(modelDir, 'tokenizer_config.json'),
    JSON.stringify({ model_max_length: 4, pad_token: '[PAD]' }),
  );
});

describe.each(['dense', 'sparse'] as const)('%s model output', kind => {
  async function initialize() {
    const options = { modelAbsoluteDirPath: modelDir, modelName: 'model.onnx', maxLength: 4 };
    return kind === 'dense'
      ? FlagEmbedding.init({ ...options, model: EmbeddingModel.CUSTOM })
      : SparseTextEmbedding.init({ ...options, model: SparseEmbeddingModel.CUSTOM });
  }

  it('rejects a two-dimensional output instead of yielding empty vectors', async () => {
    // Valid ONNX graph emits [batch, sequence]; FastEmbed requires token-level rank-three output.
    fs.writeFileSync(path.join(modelDir, kind === 'dense' ? 'model.onnx' : 'onnx/model.onnx'), rankTwoModels[kind]);
    const embedding = await initialize();
    const outputName = kind === 'dense' ? 'last_hidden_state' : 'output';
    await expect(embedding.embed(['one three', 'two four']).next()).rejects.toThrow(
      `Expected model output "${outputName}" to have 3 dimensions, received [2, 4]`,
    );
  });

  it('embeds a batch with a valid three-dimensional output', async () => {
    const embedding = await initialize();
    const result = (await embedding.embed(['one three', 'two four']).next()).value!;
    if (kind === 'dense') {
      const vectors = result as number[][];
      expect(vectors).toHaveLength(2);
      expect(vectors[0]![0]).toBeCloseTo(1 / Math.sqrt(2));
      expect(vectors[0]![1]).toBeCloseTo(1 / Math.sqrt(2));
      expect(vectors[1]![0]).toBeCloseTo(2 / Math.sqrt(5));
      expect(vectors[1]![1]).toBeCloseTo(1 / Math.sqrt(5));
    } else {
      const vectors = result as { indices: number[]; values: number[] }[];
      expect(vectors).toHaveLength(2);
      expect(vectors[0]!.indices).toEqual([0, 1]);
      expect(vectors[1]!.indices).toEqual([0, 1]);
      expect(vectors[0]!.values[0]).toBeCloseTo(Math.log(4));
      expect(vectors[1]!.values[0]).toBeCloseTo(Math.log(5));
      expect(vectors[0]!.values[1]).toBeCloseTo(Math.log(2));
      expect(vectors[1]!.values[1]).toBeCloseTo(Math.log(2));
    }
  });
});
