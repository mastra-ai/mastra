import { describe, expect, it, vi } from 'vitest';
import { EmbeddingModel, FlagEmbedding, SparseTextEmbedding } from './fastembed.js';

// Tokenizer/session fixtures stand in for a downloaded model so batching can be exercised without inference.
function createTokenizer() {
  return {
    encode: vi.fn(async (text: string) => ({
      getIds: () => [text.length],
      getAttentionMask: () => [1],
      getTypeIds: () => [0],
      getOverflowing: () => (text.startsWith('long') ? [{}] : []),
      getLength: () => 4,
    })),
  };
}

function createDenseSession() {
  return {
    run: vi.fn(async (inputs: Record<string, { dims: readonly number[] }>) => {
      const batch = inputs.input_ids!.dims[0]!;
      return { last_hidden_state: { data: Array.from({ length: batch * 2 }, () => 1), dims: [batch, 1, 2] } };
    }),
  };
}

function createSparseSession() {
  return {
    run: vi.fn(async (inputs: Record<string, { dims: readonly number[] }>) => {
      const batch = inputs.input_ids!.dims[0]!;
      return { output: { cpuData: new Float32Array(batch * 2).fill(1), dims: [batch, 1, 2] } };
    }),
  };
}

function createDense() {
  const tokenizer = createTokenizer();
  const session = createDenseSession();
  const model = Reflect.construct(FlagEmbedding, [tokenizer, session, EmbeddingModel.BGESmallENV15]) as FlagEmbedding;
  return { model, tokenizer, session };
}

function createSparse() {
  const tokenizer = createTokenizer();
  const session = createSparseSession();
  const model = Reflect.construct(SparseTextEmbedding, [tokenizer, session]) as SparseTextEmbedding;
  return { model, tokenizer, session };
}

async function collect<T>(generator: AsyncGenerator<T[], void, unknown>): Promise<T[][]> {
  const batches: T[][] = [];
  for await (const batch of generator) batches.push(batch);
  return batches;
}

const invalidBatchSizes = [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1];
const inputs = [['hello'], []];

describe('FastEmbed batchSize validation', () => {
  describe.each([
    ['FlagEmbedding', createDense],
    ['SparseTextEmbedding', createSparse],
  ] as const)('%s', (_name, create) => {
    describe.each(['embed', 'passageEmbed'] as const)('%s', method => {
      it.each(invalidBatchSizes.flatMap(size => inputs.map(texts => [size, texts] as const)))(
        'rejects batchSize %s for input %j before tokenization',
        async (batchSize, texts) => {
          const { model, tokenizer, session } = create();
          await expect(model[method]([...texts], batchSize).next()).rejects.toThrow(
            new RangeError(`batchSize must be a positive safe integer, received ${String(batchSize)}`),
          );
          expect(tokenizer.encode).not.toHaveBeenCalled();
          expect(session.run).not.toHaveBeenCalled();
        },
      );
    });

    it('keeps valid batching, including the final partial batch', async () => {
      const { model, session } = create();
      const batches = await collect<unknown>(model.embed(['a', 'b', 'c', 'd', 'e'], 2));
      expect(batches.map(batch => batch.length)).toEqual([2, 2, 1]);
      expect(session.run).toHaveBeenCalledTimes(3);
    });

    it('uses the default batch size when none is given', async () => {
      const { model, session } = create();
      const batches = await collect<unknown>(model.embed(Array.from({ length: 300 }, (_, i) => `t${i}`)));
      expect(batches.map(batch => batch.length)).toEqual([256, 44]);
      expect(session.run).toHaveBeenCalledTimes(2);
    });
  });

  describe('FlagEmbedding.countTruncated', () => {
    it.each(invalidBatchSizes.flatMap(size => inputs.map(texts => [size, texts] as const)))(
      'rejects batchSize %s for input %j before tokenization',
      async (batchSize, texts) => {
        const { model, tokenizer } = createDense();
        // Without validation a zero step never advances; the proxy bounds that loop so the test cannot hang.
        let lengthReads = 0;
        const bounded = new Proxy([...texts], {
          get(target, property, receiver) {
            if (property === 'length' && ++lengthReads > 5) {
              throw new Error('countTruncated did not advance through its input');
            }
            return Reflect.get(target, property, receiver);
          },
        });
        await expect(model.countTruncated(bounded, batchSize)).rejects.toThrow(
          new RangeError(`batchSize must be a positive safe integer, received ${String(batchSize)}`),
        );
        expect(tokenizer.encode).not.toHaveBeenCalled();
      },
    );

    it('counts truncated texts across batches', async () => {
      const { model, tokenizer } = createDense();
      await expect(model.countTruncated(['long a', 'b', 'long c', 'd', 'long e'], 2)).resolves.toEqual({
        count: 3,
        maxLength: 4,
      });
      expect(tokenizer.encode).toHaveBeenCalledTimes(5);
    });
  });
});
