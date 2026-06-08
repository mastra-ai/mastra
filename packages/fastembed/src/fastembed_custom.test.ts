import fs from 'node:fs';
import path from 'node:path';
import { beforeAll, describe, expect, test } from 'vitest';
import { EmbeddingModel, FlagEmbedding } from './fastembed.js';

async function downloadFile(url: string, dest: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}`);
  const buffer = await res.arrayBuffer();
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, Buffer.from(buffer));
}

describe('FastEmbed Custom Model Tests', () => {
  const modelsDir = path.resolve(import.meta.dirname, '..', 'local_cache', 'customs');

  beforeAll(async () => {
    const files = [
      {
        repoUrl:
          'https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2/resolve/main/onnx/model_quint8_avx2.onnx',
        outputPath: path.join(modelsDir, 'mymodel.onnx'),
      },
      {
        repoUrl: 'https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2/resolve/main/config.json',
        outputPath: path.join(modelsDir, 'config.json'),
      },
      {
        repoUrl: 'https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2/resolve/main/special_tokens_map.json',
        outputPath: path.join(modelsDir, 'special_tokens_map.json'),
      },
      {
        repoUrl: 'https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2/resolve/main/tokenizer.json',
        outputPath: path.join(modelsDir, 'tokenizer.json'),
      },
      {
        repoUrl: 'https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2/resolve/main/tokenizer_config.json',
        outputPath: path.join(modelsDir, 'tokenizer_config.json'),
      },
    ];
    for (const element of files) {
      await downloadFile(element.repoUrl, element.outputPath);
    }
  }, 120_000);

  test('Custom: init', async () => {
    const model = await FlagEmbedding.init({
      model: EmbeddingModel.CUSTOM,
      modelAbsoluteDirPath: modelsDir,
      modelName: 'mymodel.onnx',
    });
    expect(model).toBeDefined();
  }, 60_000);

  test('Custom: embed single', async () => {
    const flagEmbedding = await FlagEmbedding.init({
      model: EmbeddingModel.CUSTOM,
      modelAbsoluteDirPath: modelsDir,
      modelName: 'mymodel.onnx',
      maxLength: 512,
    });
    const embeddings = (await flagEmbedding.embed(['This is a test']).next()).value!;
    expect(embeddings).toBeDefined();
    expect(embeddings.length).toBe(1);
  }, 60_000);

  test('Custom: embed batch', async () => {
    const flagEmbedding = await FlagEmbedding.init({
      model: EmbeddingModel.CUSTOM,
      modelAbsoluteDirPath: modelsDir,
      modelName: 'mymodel.onnx',
      maxLength: 512,
    });
    const embeddingsBatch = flagEmbedding.embed([
      'This is a test',
      'Some text',
      'Some more test',
      'This is a test',
      'Some text',
      'Some more test',
    ]);
    for await (const embeddings of embeddingsBatch) {
      expect(embeddings).toBeDefined();
      expect(embeddings.length).toBe(6);
      expect(embeddings[0].length).toBe(384);
    }
  }, 60_000);

  test('Custom: embed small batch', async () => {
    const flagEmbedding = await FlagEmbedding.init({
      model: EmbeddingModel.CUSTOM,
      modelAbsoluteDirPath: modelsDir,
      modelName: 'mymodel.onnx',
      maxLength: 512,
    });
    const embeddingsBatch = flagEmbedding.embed(['This is a test', 'Some text'], 1);
    for await (const embeddings of embeddingsBatch) {
      expect(embeddings).toBeDefined();
      expect(embeddings.length).toBe(1);
      expect(embeddings[0].length).toBe(384);
    }
  }, 60_000);

  test('Custom: queryEmbed', async () => {
    const flagEmbedding = await FlagEmbedding.init({
      model: EmbeddingModel.CUSTOM,
      modelAbsoluteDirPath: modelsDir,
      modelName: 'mymodel.onnx',
      maxLength: 512,
    });
    const embeddings = await flagEmbedding.queryEmbed('This is a test');
    expect(embeddings).toBeDefined();
    expect(embeddings.length).toBe(384);
  }, 60_000);

  test('Custom: passageEmbed', async () => {
    const flagEmbedding = await FlagEmbedding.init({
      model: EmbeddingModel.CUSTOM,
      modelAbsoluteDirPath: modelsDir,
      modelName: 'mymodel.onnx',
      maxLength: 512,
    });
    const embeddings = (await flagEmbedding.passageEmbed(['This is a test']).next()).value!;
    expect(embeddings).toBeDefined();
    expect(embeddings.length).toBe(1);
  }, 60_000);

  test('Custom: canonical values', async () => {
    const flagEmbedding = await FlagEmbedding.init({
      model: EmbeddingModel.CUSTOM,
      modelAbsoluteDirPath: modelsDir,
      modelName: 'mymodel.onnx',
      maxLength: 512,
    });
    const expected = [
      0.025276897475123405, 0.013033483177423477, 0.005586996208876371, 0.04152565822005272, -0.018848471343517303,
      -0.05523142218589783, 0.018086062744259834, -0.000535094877704978, -0.013765564188361168, -0.016923097893595695,
    ];

    const embeddings = (await flagEmbedding.embed(['hello world']).next()).value!;
    expect(embeddings).toBeDefined();
    for (let i = 0; i < expected.length; i++) {
      expect(embeddings[0][i]).toBeCloseTo(expected[i], 3);
    }
  }, 60_000);
});
