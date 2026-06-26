import { beforeEach, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const embed = vi.fn((values: string[]) =>
    (async function* () {
      yield values.map((_, index) => [index + 1, index + 2, index + 3]);
    })(),
  );
  const model = { embed };
  const retrieveModel = vi.fn(async () => '/tmp/fastembed-model');

  return {
    embed,
    init: vi.fn(async () => model),
    mkdir: vi.fn(async () => undefined),
    model,
    retrieveModel,
  };
});

vi.mock('node:fs/promises', () => ({
  default: {
    mkdir: mocks.mkdir,
  },
}));

vi.mock('./fastembed.js', () => ({
  EmbeddingModel: {
    BGESmallENV15: 'fast-bge-small-en-v1.5',
    BGEBaseENV15: 'fast-bge-base-en-v1.5',
  },
  FlagEmbedding: {
    init: mocks.init,
    retrieveModel: mocks.retrieveModel,
  },
}));

beforeEach(() => {
  vi.resetModules();
  mocks.embed.mockClear();
  mocks.init.mockReset();
  mocks.mkdir.mockClear();
  mocks.retrieveModel.mockClear();
  mocks.init.mockResolvedValue(mocks.model);
});

test('reuses the initialized small model across embedding calls', async () => {
  const { getCachedModel } = await import('./model-cache.js');

  await getCachedModel('BGESmallENV15');
  await getCachedModel('BGESmallENV15');

  expect(mocks.init).toHaveBeenCalledTimes(1);
  expect(mocks.init).toHaveBeenCalledWith({
    model: 'fast-bge-small-en-v1.5',
    cacheDir: expect.stringContaining('fastembed-models'),
  });
});

test('shares pending initialization across concurrent requests', async () => {
  let resolveInit!: (model: typeof mocks.model) => void;
  mocks.init.mockReturnValueOnce(
    new Promise(resolve => {
      resolveInit = resolve;
    }),
  );
  const { getCachedModel } = await import('./model-cache.js');

  const first = getCachedModel('BGESmallENV15');
  const second = getCachedModel('BGESmallENV15');
  await new Promise(resolve => setTimeout(resolve, 0));

  expect(mocks.init).toHaveBeenCalledTimes(1);
  resolveInit(mocks.model);
  expect(await Promise.all([first, second])).toEqual([mocks.model, mocks.model]);
});

test('keeps separate cached models for small and base embeddings', async () => {
  const { getCachedModel } = await import('./model-cache.js');

  await getCachedModel('BGESmallENV15');
  await getCachedModel('BGEBaseENV15');
  await getCachedModel('BGESmallENV15');

  expect(mocks.init).toHaveBeenCalledTimes(2);
  expect(mocks.init).toHaveBeenNthCalledWith(1, {
    model: 'fast-bge-small-en-v1.5',
    cacheDir: expect.stringContaining('fastembed-models'),
  });
  expect(mocks.init).toHaveBeenNthCalledWith(2, {
    model: 'fast-bge-base-en-v1.5',
    cacheDir: expect.stringContaining('fastembed-models'),
  });
});

test('warmup downloads models without initializing ONNX sessions', async () => {
  const { warmupFastEmbedModels } = await import('./model-cache.js');

  await warmupFastEmbedModels();

  expect(mocks.retrieveModel).toHaveBeenCalledTimes(2);
  expect(mocks.init).not.toHaveBeenCalled();
});
