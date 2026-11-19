import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as ort from 'onnxruntime-node';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EmbeddingModel, FlagEmbedding, SparseEmbeddingModel, SparseTextEmbedding } from './fastembed';

// Minimal real ONNX graphs, so ONNX Runtime validates the session options each test passes.
const models = {
  dense: Buffer.from(
    'CAkSDmZhc3RlbWJlZC10ZXN0Op4DCiEKCWlucHV0X2lkcxIDaWRzIgRDYXN0KgkKAnRvGAGgAQIKFwoDaWRzCgR6ZXJvEgV6ZXJvcyIDTXVsChcKBXplcm9zCgNvbmUSBG9uZXMiA0FkZAocCgNpZHMKBGF4ZXMSBGlkczMiCVVuc3F1ZWV6ZQoeCgRvbmVzCgRheGVzEgVvbmVzMyIJVW5zcXVlZXplCjUKBGlkczMKBW9uZXMzEhFsYXN0X2hpZGRlbl9zdGF0ZSIGQ29uY2F0KgsKBGF4aXMYAqABAhIOdG9rZW4tZmVhdHVyZXMqDhABQgR6ZXJvSgQAAAAAKg0QAUIDb25lSgQAAIA/KhQIARAHQgRheGVzSggCAAAAAAAAAFooCglpbnB1dF9pZHMSGwoZCAcSFQoHEgViYXRjaAoKEghzZXF1ZW5jZVotCg5hdHRlbnRpb25fbWFzaxIbChkIBxIVCgcSBWJhdGNoCgoSCHNlcXVlbmNlYjQKEWxhc3RfaGlkZGVuX3N0YXRlEh8KHQgBEhkKBxIFYmF0Y2gKChIIc2VxdWVuY2UKAggCQgIQDQ==',
    'base64',
  ),
  sparse: Buffer.from(
    'CAkSDmZhc3RlbWJlZC10ZXN0OoQDCiEKCWlucHV0X2lkcxIDaWRzIgRDYXN0KgkKAnRvGAGgAQIKFwoDaWRzCgR6ZXJvEgV6ZXJvcyIDTXVsChcKBXplcm9zCgNvbmUSBG9uZXMiA0FkZAocCgNpZHMKBGF4ZXMSBGlkczMiCVVuc3F1ZWV6ZQoeCgRvbmVzCgRheGVzEgVvbmVzMyIJVW5zcXVlZXplCioKBGlkczMKBW9uZXMzEgZvdXRwdXQiBkNvbmNhdCoLCgRheGlzGAKgAQISDnRva2VuLWZlYXR1cmVzKg4QAUIEemVyb0oEAAAAACoNEAFCA29uZUoEAACAPyoUCAEQB0IEYXhlc0oIAgAAAAAAAABaKAoJaW5wdXRfaWRzEhsKGQgHEhUKBxIFYmF0Y2gKChIIc2VxdWVuY2VaKQoKaW5wdXRfbWFzaxIbChkIBxIVCgcSBWJhdGNoCgoSCHNlcXVlbmNlYikKBm91dHB1dBIfCh0IARIZCgcSBWJhdGNoCgoSCHNlcXVlbmNlCgIIAkICEA0=',
    'base64',
  ),
};

let modelDir: string;
beforeEach(() => {
  // Automatic sizing must not pick up a count from the shell running the tests.
  vi.stubEnv('MASTRA_FASTEMBED_THREADS', undefined);
  modelDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fastembed-session-options-'));
  fs.mkdirSync(path.join(modelDir, 'onnx'));
  fs.writeFileSync(path.join(modelDir, 'model.onnx'), models.dense);
  fs.writeFileSync(path.join(modelDir, 'onnx/model.onnx'), models.sparse);
  for (const [file, content] of Object.entries({
    'tokenizer.json': {
      version: '1.0',
      truncation: null,
      padding: null,
      added_tokens: [],
      normalizer: null,
      pre_tokenizer: { type: 'WhitespaceSplit' },
      post_processor: null,
      decoder: null,
      model: { type: 'WordLevel', vocab: { '[PAD]': 0, one: 1, '[UNK]': 2 }, unk_token: '[UNK]' },
    },
    'config.json': { pad_token_id: 0 },
    'special_tokens_map.json': { pad_token: '[PAD]', unk_token: '[UNK]' },
    'tokenizer_config.json': { model_max_length: 4, pad_token: '[PAD]' },
  }))
    fs.writeFileSync(path.join(modelDir, file), JSON.stringify(content));
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  fs.rmSync(modelDir, { recursive: true, force: true });
});

// ONNX Runtime sizes its pool from host cores and busy-waits idle threads. In a container limited to a few CPUs on a
// big host that spends the whole CPU quota and the kernel pauses the process, the embedding caller included (#30736).
describe.each(['dense', 'sparse'] as const)('%s model ONNX Runtime threads', kind => {
  async function initialize(threads?: number) {
    const options = { modelAbsoluteDirPath: modelDir, modelName: 'model.onnx', maxLength: 4, threads };
    return kind === 'dense'
      ? FlagEmbedding.init({ ...options, model: EmbeddingModel.CUSTOM })
      : SparseTextEmbedding.init({ ...options, model: SparseEmbeddingModel.CUSTOM });
  }
  function hostWith({ usable, cores }: { usable: number; cores: number }) {
    vi.spyOn(os, 'availableParallelism').mockReturnValue(usable);
    vi.spyOn(os, 'cpus').mockReturnValue(Array(cores));
    return vi.spyOn(ort.InferenceSession, 'create');
  }

  it('keeps ONNX Runtime inside a 1-CPU limit on an 18-core host', async () => {
    // How Node reports that container: the quota in availableParallelism, the host in cpus.
    const createSession = hostWith({ usable: 1, cores: 18 });
    await initialize();
    expect(createSession.mock.lastCall?.[1]).toMatchObject({
      intraOpNumThreads: 1,
      extra: { session: { intra_op: { allow_spinning: '0' } } },
    });
  });

  it('leaves the thread pool to ONNX Runtime when every core is usable', async () => {
    const createSession = hostWith({ usable: 18, cores: 18 });
    await initialize();
    expect(createSession.mock.lastCall?.[1]).not.toHaveProperty('intraOpNumThreads');
  });

  // Operators reserve CPU for the rest of the process, or set a limit the process can't see.
  it('uses the thread count the caller sets over the detected limit and the environment', async () => {
    const createSession = hostWith({ usable: 8, cores: 18 });
    vi.stubEnv('MASTRA_FASTEMBED_THREADS', '4');
    await initialize(2);
    expect(createSession.mock.lastCall?.[1]).toMatchObject({ intraOpNumThreads: 2 });
  });

  it('takes the thread count from MASTRA_FASTEMBED_THREADS when the caller sets none', async () => {
    // Every core looks usable, as with a Kubernetes CPU request and no limit.
    const createSession = hostWith({ usable: 18, cores: 18 });
    vi.stubEnv('MASTRA_FASTEMBED_THREADS', ' 2 ');
    await initialize();
    expect(createSession.mock.lastCall?.[1]).toMatchObject({ intraOpNumThreads: 2 });
  });

  it.each([0, -1, 1.5])('refuses threads: %s', async threads => {
    await expect(initialize(threads)).rejects.toThrow(`threads must be a positive integer, received ${threads}`);
  });

  it.each(['0', '-1', '1.5', 'two'])('refuses MASTRA_FASTEMBED_THREADS=%s', async value => {
    vi.stubEnv('MASTRA_FASTEMBED_THREADS', value);
    await expect(initialize()).rejects.toThrow(
      `MASTRA_FASTEMBED_THREADS must be a positive integer, received ${value}`,
    );
  });
});
