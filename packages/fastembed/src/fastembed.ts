/**
 * Forked from fastembed-js (https://github.com/Anush008/fastembed-js)
 * Original author: Anush008 <anushshetty90@gmail.com>
 * License: MIT (see LICENSE-fastembed in this package)
 *
 * The upstream project has been archived / abandoned. This fork is maintained
 * as part of the Mastra monorepo so that @mastra/fastembed no longer depends
 * on the unmaintained npm `fastembed` package.
 */

import { AddedToken, Tokenizer } from '@anush008/tokenizers';
import fs from 'node:fs';
import type { PathLike } from 'node:fs';
import https from 'node:https';
import path from 'node:path';
import * as ort from 'onnxruntime-node';
import Progress from 'progress';
import * as tar from 'tar';
import { downloadFileToCacheDir } from '@huggingface/hub';

export enum ExecutionProvider {
  CPU = 'cpu',
  CUDA = 'cuda',
  WebGL = 'webgl',
  WASM = 'wasm',
  XNNPACK = 'xnnpack',
}

export enum EmbeddingModel {
  AllMiniLML6V2 = 'fast-all-MiniLM-L6-v2',
  BGEBaseEN = 'fast-bge-base-en',
  BGEBaseENV15 = 'fast-bge-base-en-v1.5',
  BGESmallEN = 'fast-bge-small-en',
  BGESmallENV15 = 'fast-bge-small-en-v1.5',
  BGESmallZH = 'fast-bge-small-zh-v1.5',
  MLE5Large = 'fast-multilingual-e5-large',
  CUSTOM = 'custom',
}

export enum SparseEmbeddingModel {
  SpladePPEnV1 = 'prithivida/Splade_PP_en_v1',
  CUSTOM = 'custom',
}

export type SparseVector = {
  values: number[];
  indices: number[];
};

export interface InitOptionsBase {
  executionProviders?: ExecutionProvider[];
  maxLength?: number;
  cacheDir?: string;
  showDownloadProgress?: boolean;
}

interface ModelInfo {
  model: EmbeddingModel;
  dim: number;
  description: string;
}

interface SparseModelInfo {
  model: SparseEmbeddingModel;
  vocabSize: number;
  description: string;
}

type ModelInput = Record<string, ort.Tensor>;

function normalize(v: number[]): number[] {
  const norm = Math.sqrt(v.reduce((acc, val) => acc + val * val, 0));
  const epsilon = 1e-12;
  return v.map(val => val / Math.max(norm, epsilon));
}

function getEmbeddings(data: number[], dimensions: [number, number, number]): number[][] {
  const [x, _y, z] = dimensions;
  return new Array(x).fill(undefined).map((_, index) => {
    const startIndex = index * _y * z;
    const endIndex = startIndex + z;
    return data.slice(startIndex, endIndex);
  });
}

export interface InitStandardOptions extends InitOptionsBase {
  model: Exclude<EmbeddingModel, EmbeddingModel.CUSTOM>;
  modelAbsoluteDirPath?: undefined;
  modelName?: string;
}

export interface InitCustomOptions extends InitOptionsBase {
  model: EmbeddingModel.CUSTOM;
  modelAbsoluteDirPath: PathLike;
  modelName: string;
}

export type InitOptions = InitStandardOptions | InitCustomOptions;

export interface InitSparseStandardOptions extends InitOptionsBase {
  model: Exclude<SparseEmbeddingModel, SparseEmbeddingModel.CUSTOM>;
  modelAbsoluteDirPath?: undefined;
  modelName?: string;
}

export interface InitSparseCustomOptions extends InitOptionsBase {
  model: SparseEmbeddingModel.CUSTOM;
  modelAbsoluteDirPath: PathLike;
  modelName: string;
}

export type InitSparseOptions = InitSparseStandardOptions | InitSparseCustomOptions;

abstract class Embedding {
  abstract listSupportedModels(): ModelInfo[];
  abstract embed(texts: string[], batchSize?: number): AsyncGenerator<number[][], void, unknown>;
  abstract passageEmbed(texts: string[], batchSize: number): AsyncGenerator<number[][], void, unknown>;
  abstract queryEmbed(query: string): Promise<number[]>;
}

abstract class SparseEmbedding {
  abstract listSupportedModels(): SparseModelInfo[];
  abstract embed(texts: string[], batchSize?: number): AsyncGenerator<SparseVector[], void, unknown>;
  abstract passageEmbed(texts: string[], batchSize: number): AsyncGenerator<SparseVector[], void, unknown>;
  abstract queryEmbed(query: string): Promise<SparseVector>;
}

interface AddedTokenMap {
  content: string;
  single_word: boolean;
  lstrip: boolean;
  rstrip: boolean;
  normalized: boolean;
}

function isAddedTokenMap(token: unknown): token is AddedTokenMap {
  return (
    typeof token === 'object' &&
    token !== null &&
    'content' in token &&
    'single_word' in token &&
    'rstrip' in token &&
    'lstrip' in token &&
    'normalized' in token
  );
}

function loadTokenizerFromDir(modelDir: PathLike, maxLength: number): Tokenizer {
  const tokenizerPath = path.join(modelDir.toString(), 'tokenizer.json');
  if (!fs.existsSync(tokenizerPath)) {
    throw new Error(`Tokenizer file not found at ${tokenizerPath}`);
  }

  const configPath = path.join(modelDir.toString(), 'config.json');
  if (!fs.existsSync(configPath)) {
    throw new Error(`Config file not found at ${configPath}`);
  }
  const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

  const tokenizerFilePath = path.join(modelDir.toString(), 'tokenizer_config.json');
  if (!fs.existsSync(tokenizerFilePath)) {
    throw new Error(`Tokenizer config file not found at ${tokenizerFilePath}`);
  }
  const tokenizerConfig = JSON.parse(fs.readFileSync(tokenizerFilePath, 'utf-8'));
  maxLength = Math.min(maxLength, tokenizerConfig['model_max_length']);

  const tokensMapPath = path.join(modelDir.toString(), 'special_tokens_map.json');
  if (!fs.existsSync(tokensMapPath)) {
    throw new Error(`Tokens map file not found at ${tokensMapPath}`);
  }
  const tokensMap = JSON.parse(fs.readFileSync(tokensMapPath, 'utf-8'));

  const tokenizer = Tokenizer.fromFile(tokenizerPath);

  tokenizer.setTruncation(maxLength);
  tokenizer.setPadding({
    maxLength,
    padId: config['pad_token_id'],
    padToken: tokenizerConfig['pad_token'],
  });

  for (const token of Object.values(tokensMap)) {
    if (typeof token === 'string') {
      tokenizer.addSpecialTokens([token]);
    } else if (isAddedTokenMap(token)) {
      const addedToken = new AddedToken(token['content'], true, {
        singleWord: token['single_word'],
        leftStrip: token['lstrip'],
        rightStrip: token['rstrip'],
        normalized: token['normalized'],
      });
      tokenizer.addAddedTokens([addedToken]);
    }
  }
  return tokenizer;
}

export class FlagEmbedding extends Embedding {
  private constructor(
    private tokenizer: Tokenizer,
    private session: ort.InferenceSession,
    private model: EmbeddingModel,
  ) {
    super();
  }

  static async init(options: InitStandardOptions): Promise<FlagEmbedding>;
  static async init(options: InitCustomOptions): Promise<FlagEmbedding>;
  static async init({
    model = EmbeddingModel.BGESmallENV15,
    executionProviders = [ExecutionProvider.CPU],
    maxLength = 512,
    cacheDir = 'local_cache',
    showDownloadProgress = true,
    modelAbsoluteDirPath = '',
    modelName = '',
  }: Partial<InitOptions> = {}) {
    if (model === EmbeddingModel.CUSTOM) {
      if (!modelAbsoluteDirPath) {
        throw new Error('For custom model, modelAbsoluteDirPath is required in FlagEmbedding.init');
      }
      if (!modelName) {
        throw new Error('For custom model, modelName is required in FlagEmbedding.init');
      }
    }

    const modelDir =
      model === EmbeddingModel.CUSTOM
        ? modelAbsoluteDirPath
        : await FlagEmbedding.retrieveModel(model, cacheDir, showDownloadProgress);

    const tokenizer = loadTokenizerFromDir(modelDir, maxLength);
    const defaultModelName =
      model === EmbeddingModel.MLE5Large || model === EmbeddingModel.AllMiniLML6V2
        ? 'model.onnx'
        : 'model_optimized.onnx';
    const modelPath = path.join(modelDir.toString(), modelName || defaultModelName);
    if (!fs.existsSync(modelPath)) {
      throw new Error(`Model file not found at ${modelPath}`);
    }
    const session = await ort.InferenceSession.create(modelPath, {
      executionProviders,
      graphOptimizationLevel: 'all',
    });
    return new FlagEmbedding(tokenizer, session, model);
  }

  private static async downloadFileFromGCS(
    outputFilePath: PathLike,
    model: string,
    showDownloadProgress: boolean = true,
  ): Promise<PathLike> {
    if (fs.existsSync(outputFilePath)) {
      return outputFilePath;
    }

    // The AllMiniLML6V2 model URL doesn't follow the same naming convention as the other models
    if (model === EmbeddingModel.AllMiniLML6V2) {
      model = 'sentence-transformers' + model.substring(model.indexOf('-'));
    }
    const url = `https://storage.googleapis.com/qdrant-fastembed/${model}.tar.gz`;
    const fileStream = fs.createWriteStream(outputFilePath);

    return new Promise<PathLike>((resolve, reject) => {
      https
        .get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, response => {
          const status = response.statusCode ?? 0;
          if (status < 200 || status >= 300) {
            response.resume();
            reject(new Error(`Failed to download ${model}: HTTP ${status}`));
            return;
          }
          const totalSizeInBytes = parseInt(response.headers['content-length'] || '0', 10);

          if (totalSizeInBytes === 0) {
            console.warn(`Warning: Content-length header is missing or zero in the response from ${url}.`);
          }

          if (showDownloadProgress) {
            const progressBar = new Progress(`Downloading ${model} [:bar] :percent :etas`, {
              complete: '=',
              width: 20,
              total: totalSizeInBytes,
            });

            response.on('data', (chunk: Buffer) => {
              progressBar.tick(chunk.length, { speed: 'N/A' });
            });
          }
          response.on('error', error => {
            reject(error);
          });

          response.pipe(fileStream);

          fileStream.on('finish', () => {
            fileStream.close();
            resolve(outputFilePath);
          });

          fileStream.on('error', error => {
            reject(error);
          });
        })
        .on('error', error => {
          fs.unlink(outputFilePath, () => {
            reject(error);
          });
        });
    });
  }

  private static async decompressToCache(targzPath: PathLike, cacheDir: PathLike) {
    if (path.extname(targzPath.toString()) === '.gz') {
      await tar.x({
        file: targzPath.toString(),
        cwd: cacheDir.toString(),
      });
    } else {
      throw new Error(`Unsupported file extension: ${targzPath}`);
    }
  }

  static async retrieveModel(
    model: EmbeddingModel,
    cacheDir: PathLike,
    showDownloadProgress: boolean = true,
  ): Promise<PathLike> {
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { mode: 0o755 });
    }

    const modelDir = path.join(cacheDir.toString(), model);

    if (fs.existsSync(modelDir)) {
      return modelDir;
    }

    const modelTarGz = path.join(cacheDir.toString(), `${model}.tar.gz`);
    await this.downloadFileFromGCS(modelTarGz, model, showDownloadProgress);
    await this.decompressToCache(modelTarGz, cacheDir);
    fs.unlinkSync(modelTarGz);
    return modelDir;
  }

  async *embed(textStrings: string[], batchSize: number = 256) {
    for (let i = 0; i < textStrings.length; i += batchSize) {
      const batchTexts = textStrings.slice(i, i + batchSize);

      const encodedTexts = await Promise.all(batchTexts.map(textString => this.tokenizer.encode(textString)));

      const idsArray: bigint[][] = [];
      const maskArray: bigint[][] = [];
      const typeIdsArray: bigint[][] = [];

      encodedTexts.forEach(text => {
        const ids = text.getIds().map(BigInt);
        const mask = text.getAttentionMask().map(BigInt);
        const typeIds = text.getTypeIds().map(BigInt);

        idsArray.push(ids);
        maskArray.push(mask);
        typeIdsArray.push(typeIds);
      });

      const maxLength = idsArray[0]!.length;

      const batchInputIds = new ort.Tensor('int64', idsArray.flat() as unknown as number[], [
        batchTexts.length,
        maxLength,
      ]);
      const batchAttentionMask = new ort.Tensor('int64', maskArray.flat() as unknown as number[], [
        batchTexts.length,
        maxLength,
      ]);
      const batchTokenTypeId = new ort.Tensor('int64', typeIdsArray.flat() as unknown as number[], [
        batchTexts.length,
        maxLength,
      ]);

      const inputs: ModelInput = {
        input_ids: batchInputIds,
        attention_mask: batchAttentionMask,
        token_type_ids: batchTokenTypeId,
      };

      if (this.model === EmbeddingModel.MLE5Large) {
        delete inputs.token_type_ids;
      }

      const output = await this.session.run(inputs);

      const lastHiddenState = output.last_hidden_state!;
      const embeddings = getEmbeddings(
        lastHiddenState.data as unknown[] as number[],
        lastHiddenState.dims as [number, number, number],
      );

      yield embeddings.map(normalize);
    }
  }

  passageEmbed(texts: string[], batchSize: number = 256) {
    texts = texts.map(text => `passage: ${text}`);
    return this.embed(texts, batchSize);
  }

  async queryEmbed(query: string): Promise<number[]> {
    const result = await this.embed([`query: ${query}`]).next();
    return result.value![0]!;
  }

  listSupportedModels(): ModelInfo[] {
    return [
      { model: EmbeddingModel.BGESmallEN, dim: 384, description: 'Fast English model' },
      { model: EmbeddingModel.BGESmallENV15, dim: 384, description: 'v1.5 release of the fast, default English model' },
      { model: EmbeddingModel.BGEBaseEN, dim: 768, description: 'Base English model' },
      { model: EmbeddingModel.BGEBaseENV15, dim: 768, description: 'v1.5 release of Base English model' },
      { model: EmbeddingModel.BGESmallZH, dim: 512, description: 'v1.5 release of the fast, Chinese model' },
      { model: EmbeddingModel.AllMiniLML6V2, dim: 384, description: 'Sentence Transformer model, MiniLM-L6-v2' },
      {
        model: EmbeddingModel.MLE5Large,
        dim: 1024,
        description: 'Multilingual model, e5-large. Recommend using this model for non-English languages',
      },
    ];
  }
}

export class SparseTextEmbedding extends SparseEmbedding {
  private constructor(
    private tokenizer: Tokenizer,
    private session: ort.InferenceSession,
  ) {
    super();
  }

  static async init(options: InitSparseStandardOptions): Promise<SparseTextEmbedding>;
  static async init(options: InitSparseCustomOptions): Promise<SparseTextEmbedding>;
  static async init({
    model = SparseEmbeddingModel.SpladePPEnV1,
    executionProviders = [ExecutionProvider.CPU],
    maxLength = 512,
    cacheDir = 'local_cache',
    showDownloadProgress = true,
    modelAbsoluteDirPath = '',
    modelName = '',
  }: Partial<InitSparseOptions> = {}) {
    if (model === SparseEmbeddingModel.CUSTOM) {
      if (!modelAbsoluteDirPath) {
        throw new Error('For custom model, modelAbsoluteDirPath is required in SparseTextEmbedding.init');
      }
      if (!modelName) {
        throw new Error('For custom model, modelName is required in SparseTextEmbedding.init');
      }
    }

    const modelDir =
      model === SparseEmbeddingModel.CUSTOM
        ? modelAbsoluteDirPath
        : await SparseTextEmbedding.retrieveModel(model, cacheDir, showDownloadProgress);

    const { tokenizer } = this.loadTokenizer(modelDir, maxLength);

    const defaultModelName = 'model.onnx';
    const modelPath = path.join(modelDir.toString(), 'onnx', modelName || defaultModelName);

    if (!fs.existsSync(modelPath)) {
      throw new Error(`Model file not found at ${modelPath}`);
    }

    const session = await ort.InferenceSession.create(modelPath, {
      executionProviders,
      graphOptimizationLevel: 'all',
    });

    return new SparseTextEmbedding(tokenizer, session);
  }

  private static loadTokenizer(modelDir: PathLike, maxLength: number): { tokenizer: Tokenizer } {
    const tokenizer = loadTokenizerFromDir(modelDir, maxLength);
    return { tokenizer };
  }

  private static async retrieveModel(
    model: SparseEmbeddingModel,
    cacheDir: PathLike,
    _showDownloadProgress: boolean = true,
  ): Promise<PathLike> {
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { mode: 0o755 });
    }

    const modelDir = path.join(cacheDir.toString(), model.replace('/', '_'));

    if (fs.existsSync(modelDir)) {
      return modelDir;
    }

    fs.mkdirSync(modelDir, { mode: 0o755 });

    const filesToDownload = [
      'onnx/model.onnx',
      'tokenizer.json',
      'tokenizer_config.json',
      'config.json',
      'special_tokens_map.json',
    ];

    for (const fileName of filesToDownload) {
      const outputPath = path.join(modelDir, fileName);
      const outputDir = path.dirname(outputPath);

      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true, mode: 0o755 });
      }

      const downloaded = await downloadFileToCacheDir({
        repo: model,
        path: fileName,
      });

      if (downloaded && typeof downloaded === 'string') {
        fs.copyFileSync(downloaded, outputPath);
      }
    }

    return modelDir;
  }

  async *embed(textStrings: string[], batchSize: number = 256) {
    for (let i = 0; i < textStrings.length; i += batchSize) {
      const batchTexts = textStrings.slice(i, i + batchSize);

      const encodedTexts = await Promise.all(batchTexts.map(textString => this.tokenizer.encode(textString)));

      const idsArray: bigint[][] = [];
      const maskArray: number[][] = [];
      const typeIdsArray: bigint[][] = [];

      encodedTexts.forEach(text => {
        const ids = text.getIds().map(BigInt);
        const mask = text.getAttentionMask();
        const typeIds = text.getTypeIds().map(BigInt);

        idsArray.push(ids);
        maskArray.push(mask);
        typeIdsArray.push(typeIds);
      });

      const maxLength = idsArray[0]!.length;

      const batchInputIds = new ort.Tensor('int64', idsArray.flat() as unknown as number[], [
        batchTexts.length,
        maxLength,
      ]);
      const batchAttentionMask = new ort.Tensor('int64', maskArray.flat().map(BigInt) as unknown as number[], [
        batchTexts.length,
        maxLength,
      ]);
      const batchTokenTypeId = new ort.Tensor('int64', typeIdsArray.flat() as unknown as number[], [
        batchTexts.length,
        maxLength,
      ]);

      const inputs: ModelInput = {
        input_ids: batchInputIds,
        input_mask: batchAttentionMask,
        segment_ids: batchTokenTypeId,
      };

      const output = await this.session.run(inputs);

      // SPLADE postprocessing: log(1 + ReLU(logits))
      const outputTensor = output.output!;
      // @ts-expect-error cpuData exists at runtime on onnxruntime Tensor
      const logits = outputTensor.cpuData as Float32Array;
      const dims = outputTensor.dims as [number, number, number];
      const [currentBatchSize, seqLen, currentVocabSize] = dims;

      const sparseVectors: SparseVector[] = [];

      for (let batchIdx = 0; batchIdx < currentBatchSize; batchIdx++) {
        const valuesArr = new Float32Array(currentVocabSize).fill(0);

        for (let seqIdx = 0; seqIdx < seqLen; seqIdx++) {
          const attentionValue = maskArray[batchIdx]![seqIdx]!;

          if (attentionValue > 0) {
            for (let vocabIdx = 0; vocabIdx < currentVocabSize; vocabIdx++) {
              const logitIdx = batchIdx * seqLen * currentVocabSize + seqIdx * currentVocabSize + vocabIdx;
              const logitValue = logits[logitIdx]!;
              const reluValue = Math.max(0, logitValue);
              const logValue = Math.log(1 + reluValue);
              valuesArr[vocabIdx] = Math.max(valuesArr[vocabIdx]!, logValue);
            }
          }
        }

        const sparseVector: SparseVector = { values: [], indices: [] };
        for (let tokenId = 0; tokenId < currentVocabSize; tokenId++) {
          if (valuesArr[tokenId]! > 0) {
            sparseVector.indices.push(tokenId);
            sparseVector.values.push(valuesArr[tokenId]!);
          }
        }
        sparseVectors.push(sparseVector);
      }

      yield sparseVectors;
    }
  }

  passageEmbed(texts: string[], batchSize: number = 256) {
    return this.embed(texts, batchSize);
  }

  async queryEmbed(query: string): Promise<SparseVector> {
    const result = await this.embed([query]).next();
    return result.value![0]!;
  }

  listSupportedModels(): SparseModelInfo[] {
    return [
      {
        model: SparseEmbeddingModel.SpladePPEnV1,
        vocabSize: 30522,
        description: 'SPLADE++ English model for sparse retrieval',
      },
    ];
  }
}
