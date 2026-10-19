import { Console } from 'node:console';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fetchMock = vi.fn<typeof fetch>();

const { EmbeddingModel, FlagEmbedding, SparseEmbeddingModel, SparseTextEmbedding } = await import('./fastembed');

describe('model downloads', () => {
  let cacheDir: string;

  beforeEach(() => {
    cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fastembed-cache-'));
    vi.stubEnv('HF_HUB_CACHE', path.join(cacheDir, '.hf-hub'));
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
    fetchMock.mockImplementation(async (input, init) => {
      const url = String(input);
      // Support the cache helper too, so reverting to it exposes its stdout writes.
      if (url.includes('/paths-info/')) {
        const { paths } = JSON.parse(init!.body as string);
        return Response.json(paths.map((file: string) => ({ path: file, type: 'file', oid: file, size: file.length })));
      }
      const file = url.split('/resolve/main/')[1];
      if (!file) throw new Error(`Unexpected download URL: ${url}`);
      return new Response(file, {
        headers: { 'content-range': `bytes 0-${file.length - 1}/${file.length}`, etag: file },
      });
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    fs.rmSync(cacheDir, { recursive: true, force: true });
  });

  it('downloads built-in model files from the Qdrant Hugging Face repo', async () => {
    const dir = await FlagEmbedding.retrieveModel(EmbeddingModel.MLE5Large, cacheDir, false);

    expect(dir).toBe(path.join(cacheDir, EmbeddingModel.MLE5Large));
    expect(fetchMock.mock.calls.every(([url]) => String(url).includes('Qdrant/multilingual-e5-large-onnx'))).toBe(true);
    expect(fs.readFileSync(path.join(dir.toString(), 'model.onnx_data'), 'utf8')).toBe('model.onnx_data');
    expect(fs.readdirSync(cacheDir)).toEqual([EmbeddingModel.MLE5Large]);
    expect(fs.lstatSync(path.join(dir.toString(), 'model.onnx')).isFile()).toBe(true);
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

  it('writes download notices to stderr without contaminating stdout', async () => {
    vi.stubGlobal('console', new Console(process.stdout, process.stderr));
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    await FlagEmbedding.retrieveModel(EmbeddingModel.BGESmallENV15, cacheDir);

    expect(stdout.mock.calls.map(([chunk]) => String(chunk)).join('')).toBe('');
    expect(stderr.mock.calls.map(([chunk]) => String(chunk)).join('')).toContain(
      `Downloading ${EmbeddingModel.BGESmallENV15}`,
    );
  });

  it.each(['dense', 'sparse'])('keeps both streams quiet for %s downloads with progress disabled', async kind => {
    vi.stubGlobal('console', new Console(process.stdout, process.stderr));
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    if (kind === 'dense') {
      await FlagEmbedding.retrieveModel(EmbeddingModel.BGESmallENV15, cacheDir, false);
    } else {
      const dir = await SparseTextEmbedding['retrieveModel'](SparseEmbeddingModel.SpladePPEnV1, cacheDir, false);
      expect(fs.readFileSync(path.join(dir.toString(), 'onnx/model.onnx'), 'utf8')).toBe('onnx/model.onnx');
    }

    expect(stdout).not.toHaveBeenCalled();
    expect(stderr).not.toHaveBeenCalled();
  });

  it('reuses an existing cache directory without downloading', async () => {
    fs.mkdirSync(path.join(cacheDir, EmbeddingModel.BGESmallENV15));
    await FlagEmbedding.retrieveModel(EmbeddingModel.BGESmallENV15, cacheDir, false);
    expect(fetchMock).not.toHaveBeenCalled();
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
    fetchMock.mockRejectedValueOnce(new Error('network down'));
    await expect(FlagEmbedding.retrieveModel(EmbeddingModel.BGEBaseENV15, cacheDir, false)).rejects.toThrow(
      'network down',
    );
    expect(fs.readdirSync(cacheDir)).toEqual([]);
  });
});
