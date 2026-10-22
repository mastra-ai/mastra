import fs from 'node:fs';
import { createServer } from 'node:http';
import type { Server } from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SparseEmbeddingModel, SparseTextEmbedding } from './fastembed';

// Tiny real ONNX graph: per-token logits [input_id, 1], with input_mask supplied by embed().
const modelBytes = Buffer.from(
  'CAkSDmZhc3RlbWJlZC10ZXN0OoQDCiEKCWlucHV0X2lkcxIDaWRzIgRDYXN0KgkKAnRvGAGgAQIKFwoDaWRzCgR6ZXJvEgV6ZXJvcyIDTXVsChcKBXplcm9zCgNvbmUSBG9uZXMiA0FkZAocCgNpZHMKBGF4ZXMSBGlkczMiCVVuc3F1ZWV6ZQoeCgRvbmVzCgRheGVzEgVvbmVzMyIJVW5zcXVlZXplCioKBGlkczMKBW9uZXMzEgZvdXRwdXQiBkNvbmNhdCoLCgRheGlzGAKgAQISDnRva2VuLWZlYXR1cmVzKg4QAUIEemVyb0oEAAAAACoNEAFCA29uZUoEAACAPyoUCAEQB0IEYXhlc0oIAgAAAAAAAABaKAoJaW5wdXRfaWRzEhsKGQgHEhUKBxIFYmF0Y2gKChIIc2VxdWVuY2VaKQoKaW5wdXRfbWFzaxIbChkIBxIVCgcSBWJhdGNoCgoSCHNlcXVlbmNlYikKBm91dHB1dBIfCh0IARIZCgcSBWJhdGNoCgoSCHNlcXVlbmNlCgIIAkICEA0=',
  'base64',
);
const files: Record<string, Buffer> = {
  'onnx/model.onnx': modelBytes,
  'tokenizer.json': Buffer.from(
    JSON.stringify({
      version: '1.0',
      truncation: null,
      padding: null,
      added_tokens: [],
      normalizer: null,
      pre_tokenizer: { type: 'WhitespaceSplit' },
      post_processor: null,
      decoder: null,
      model: { type: 'WordLevel', vocab: { '[PAD]': 0, one: 1, two: 2, three: 3, '[UNK]': 4 }, unk_token: '[UNK]' },
    }),
  ),
  'tokenizer_config.json': Buffer.from(JSON.stringify({ model_max_length: 4, pad_token: '[PAD]' })),
  'config.json': Buffer.from(JSON.stringify({ pad_token_id: 0 })),
  'special_tokens_map.json': Buffer.from(JSON.stringify({ pad_token: '[PAD]', unk_token: '[UNK]' })),
};

type Failure = 'missing' | 'server error' | 'interrupted body';
let cacheDir: string;
let server: Server;
let failure: Failure | undefined;
let requests: string[];

beforeEach(async () => {
  cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fastembed-sparse-cache-'));
  failure = undefined;
  requests = [];
  server = createServer((req, res) => {
    const file = req.url!.split('/resolve/main/')[1]!;
    requests.push(file);
    if (
      file === 'tokenizer.json' &&
      failure &&
      !(failure === 'interrupted body' && req.headers.range === 'bytes=0-0')
    ) {
      if (failure === 'interrupted body') {
        res.writeHead(200, { 'content-length': '1000', 'content-range': 'bytes 0-999/1000', etag: file });
        res.write('{');
        setImmediate(() => res.destroy());
      } else {
        res.writeHead(
          failure === 'missing' ? 404 : 503,
          failure === 'missing' ? { 'X-Error-Code': 'EntryNotFound' } : {},
        );
        res.end('temporary download failure');
      }
      return;
    }
    const body = files[file];
    if (!body) {
      res.writeHead(404);
      res.end();
      return;
    }
    res.writeHead(200, {
      'content-length': body.length,
      'content-range': `bytes 0-${body.length - 1}/${body.length}`,
      etag: file,
    });
    res.end(body);
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('HTTP fixture did not start');
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const fetchHttp = globalThis.fetch;
  vi.stubGlobal('fetch', (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.hostname !== 'huggingface.co') throw new Error(`Unexpected request: ${url}`);
    return fetchHttp(`${baseUrl}${url.pathname}`, init);
  });
});

afterEach(async () => {
  vi.unstubAllGlobals();
  await new Promise<void>((resolve, reject) => server.close(error => (error ? reject(error) : resolve())));
  fs.rmSync(cacheDir, { recursive: true, force: true });
});

function initialize() {
  return SparseTextEmbedding.init({
    model: SparseEmbeddingModel.SpladePPEnV1,
    cacheDir,
    maxLength: 4,
    showDownloadProgress: false,
  });
}

describe.each<Failure>(['missing', 'server error', 'interrupted body'])('after a %s download', errorKind => {
  it('leaves no incomplete model in the cache', async () => {
    failure = errorKind;
    await expect(initialize()).rejects.toThrow();
    expect(requests).toContain('onnx/model.onnx');
    expect(fs.readdirSync(cacheDir)).toEqual([]);
  });

  it('can retry initialization and embed without manually deleting the cache', async () => {
    failure = errorKind;
    await expect(initialize()).rejects.toThrow();
    failure = undefined;
    const embedding = await initialize();
    const result = await embedding.embed(['one three']).next();
    expect(result.value![0]!.indices).toEqual([0, 1]);
    expect(result.value![0]!.values[0]).toBeCloseTo(Math.log(4));
    expect(result.value![0]!.values[1]).toBeCloseTo(Math.log(2));
    const modelDir = path.join(cacheDir, 'prithivida_Splade_PP_en_v1');
    for (const [file, body] of Object.entries(files)) expect(fs.readFileSync(path.join(modelDir, file))).toEqual(body);
    expect(fs.readdirSync(cacheDir)).toEqual(['prithivida_Splade_PP_en_v1']);
  });
});

it('reuses a complete cached model without another HTTP request', async () => {
  const embedding = await initialize();
  const expected = await embedding.embed(['one three']).next();
  const requestCount = requests.length;
  const cached = await initialize();
  expect(await cached.embed(['one three']).next()).toEqual(expected);
  expect(requests).toHaveLength(requestCount);
});

it('allows concurrent cold-cache initializations without exposing partial downloads', async () => {
  const embeddings = await Promise.all([initialize(), initialize(), initialize()]);
  for (const embedding of embeddings) {
    const result = await embedding.embed(['one three']).next();
    expect(result.value![0]!.indices).toEqual([0, 1]);
  }
  const modelDir = path.join(cacheDir, 'prithivida_Splade_PP_en_v1');
  for (const [file, body] of Object.entries(files)) expect(fs.readFileSync(path.join(modelDir, file))).toEqual(body);
  expect(fs.readdirSync(cacheDir)).toEqual(['prithivida_Splade_PP_en_v1']);
});
