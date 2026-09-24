import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const downloadFileToCacheDir = vi.fn();
vi.mock('@huggingface/hub', () => ({ downloadFileToCacheDir }));

const { EmbeddingModel, FlagEmbedding } = await import('./fastembed');

describe('FlagEmbedding.retrieveModel', () => {
  let cacheDir: string;
  let srcDir: string;

  beforeEach(() => {
    cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fastembed-cache-'));
    srcDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fastembed-src-'));
    downloadFileToCacheDir.mockReset();
    downloadFileToCacheDir.mockImplementation(async ({ path: file }: { path: string }) => {
      const p = path.join(srcDir, file);
      fs.writeFileSync(p, file);
      return p;
    });
  });

  afterEach(() => {
    fs.rmSync(cacheDir, { recursive: true, force: true });
    fs.rmSync(srcDir, { recursive: true, force: true });
  });

  it('downloads built-in model files from the Qdrant Hugging Face repo', async () => {
    const dir = await FlagEmbedding.retrieveModel(EmbeddingModel.MLE5Large, cacheDir, false);

    expect(dir).toBe(path.join(cacheDir, EmbeddingModel.MLE5Large));
    const repos = new Set(downloadFileToCacheDir.mock.calls.map(([arg]) => arg.repo));
    expect([...repos]).toEqual(['Qdrant/multilingual-e5-large-onnx']);
    expect(fs.readdirSync(dir).sort()).toEqual(
      [
        'config.json',
        'model.onnx',
        'model.onnx_data',
        'special_tokens_map.json',
        'tokenizer.json',
        'tokenizer_config.json',
      ].sort(),
    );
  });

  it('reuses an existing cache directory without downloading', async () => {
    fs.mkdirSync(path.join(cacheDir, EmbeddingModel.BGESmallENV15));
    await FlagEmbedding.retrieveModel(EmbeddingModel.BGESmallENV15, cacheDir, false);
    expect(downloadFileToCacheDir).not.toHaveBeenCalled();
  });

  it('cleans up partial downloads on failure', async () => {
    downloadFileToCacheDir.mockRejectedValueOnce(new Error('network down'));
    await expect(FlagEmbedding.retrieveModel(EmbeddingModel.BGEBaseENV15, cacheDir, false)).rejects.toThrow(
      'network down',
    );
    expect(fs.readdirSync(cacheDir)).toEqual([]);
  });
});
