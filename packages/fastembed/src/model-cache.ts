import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { FlagEmbedding, EmbeddingModel } from './fastembed.js';

export type FastEmbedModelType = 'BGESmallENV15' | 'BGEBaseENV15';

let modelCachePathPromise: Promise<string> | undefined;

async function getModelCachePath() {
  modelCachePathPromise ??= (async () => {
    const cachePath = path.join(os.homedir(), '.cache', 'mastra', 'fastembed-models');
    await fsp.mkdir(cachePath, { recursive: true });
    return cachePath;
  })().catch(error => {
    modelCachePathPromise = undefined;
    throw error;
  });
  return modelCachePathPromise;
}

const modelCache = new Map<FastEmbedModelType, Promise<FlagEmbedding>>();

export function getCachedModel(modelType: FastEmbedModelType) {
  let modelPromise = modelCache.get(modelType);
  if (!modelPromise) {
    modelPromise = (async () =>
      FlagEmbedding.init({
        model: EmbeddingModel[modelType],
        cacheDir: await getModelCachePath(),
      }))();
    void modelPromise.catch(() => {
      modelCache.delete(modelType);
    });
    modelCache.set(modelType, modelPromise);
  }
  return modelPromise;
}

export async function warmupFastEmbedModels() {
  const cacheDir = await getModelCachePath();
  await FlagEmbedding.retrieveModel(EmbeddingModel.BGESmallENV15, cacheDir, false);
  await FlagEmbedding.retrieveModel(EmbeddingModel.BGEBaseENV15, cacheDir, false);
}
