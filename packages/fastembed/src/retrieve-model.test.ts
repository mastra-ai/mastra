import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const downloadFileToCacheDir = vi.fn();
vi.mock('@huggingface/hub', () => ({ downloadFileToCacheDir }));

const { EmbeddingModel, FlagEmbedding } = await import('./fastembed');

describe('FlagEmbedding.retrieveModel', () => {
  let cacheDir: string;

  beforeEach(() => {
    cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fastembed-cache-'));
    downloadFileToCacheDir.mockReset();
    // Mimic the HF hub cache layout: a blob plus a snapshot symlink pointing at it.
    downloadFileToCacheDir.mockImplementation(
      async ({ path: file, cacheDir: hubDir }: { path: string; cacheDir: string }) => {
        const blobs = path.join(hubDir, 'blobs');
        const snapshot = path.join(hubDir, 'snapshots', 'main');
        fs.mkdirSync(blobs, { recursive: true });
        fs.mkdirSync(snapshot, { recursive: true });
        const blob = path.join(blobs, `blob-${file}`);
        fs.writeFileSync(blob, file);
        const link = path.join(snapshot, file);
        fs.symlinkSync(blob, link);
        return link;
      },
    );
  });

  afterEach(() => {
    fs.rmSync(cacheDir, { recursive: true, force: true });
  });

  it('downloads built-in model files from the Qdrant Hugging Face repo', async () => {
    const dir = await FlagEmbedding.retrieveModel(EmbeddingModel.MLE5Large, cacheDir, false);

    expect(dir).toBe(path.join(cacheDir, EmbeddingModel.MLE5Large));
    const repos = new Set(downloadFileToCacheDir.mock.calls.map(([arg]) => arg.repo));
    expect([...repos]).toEqual(['Qdrant/multilingual-e5-large-onnx']);
    for (const [arg] of downloadFileToCacheDir.mock.calls) {
      expect(arg.cacheDir.startsWith(cacheDir)).toBe(true);
    }
    expect(fs.readdirSync(cacheDir)).toEqual([EmbeddingModel.MLE5Large]);
    expect(fs.lstatSync(path.join(dir, 'model.onnx')).isFile()).toBe(true);
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

  it('lets concurrent cold-cache downloads of the same model both succeed', async () => {
    const [a, b] = await Promise.all([
      FlagEmbedding.retrieveModel(EmbeddingModel.BGESmallENV15, cacheDir, false),
      FlagEmbedding.retrieveModel(EmbeddingModel.BGESmallENV15, cacheDir, false),
    ]);
    expect(a).toBe(b);
    expect(fs.readdirSync(cacheDir)).toEqual([EmbeddingModel.BGESmallENV15]);
  });

  it('cleans up partial downloads on failure', async () => {
    downloadFileToCacheDir.mockRejectedValueOnce(new Error('network down'));
    await expect(FlagEmbedding.retrieveModel(EmbeddingModel.BGEBaseENV15, cacheDir, false)).rejects.toThrow(
      'network down',
    );
    expect(fs.readdirSync(cacheDir)).toEqual([]);
  });
});
