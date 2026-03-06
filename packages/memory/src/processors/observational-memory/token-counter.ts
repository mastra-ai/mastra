import { createHash } from 'node:crypto';
import type { MastraDBMessage } from '@mastra/core/agent';
import { Tiktoken } from 'js-tiktoken/lite';
import type { TiktokenBPE } from 'js-tiktoken/lite';
import o200k_base from 'js-tiktoken/ranks/o200k_base';

/**
 * Shared default encoder singleton.
 * Tiktoken(o200k_base) builds two internal Maps with ~200k entries each,
 * costing ~80-120 MB of heap per instance. Since ObservationalMemory creates
 * a TokenCounter for both input and output processors per request, sharing
 * the default encoder avoids duplicating this cost.
 *
 * Reuse the same global key as packages/core so both packages can share one
 * encoder instance without introducing a direct dependency between them.
 */
const GLOBAL_TIKTOKEN_KEY = '__mastraTiktoken';

function getDefaultEncoder(): Tiktoken {
  const cached = (globalThis as Record<string, unknown>)[GLOBAL_TIKTOKEN_KEY] as Tiktoken | undefined;
  if (cached) return cached;

  const encoder = new Tiktoken(o200k_base);
  (globalThis as Record<string, unknown>)[GLOBAL_TIKTOKEN_KEY] = encoder;
  return encoder;
}

type TokenEstimateCacheEntry = {
  v: number;
  source: string;
  key: string;
  tokens: number;
};

export type TokenCounterModelContext = {
  provider?: string;
  modelId?: string;
};

type TokenCounterOptions = {
  model?: string | TokenCounterModelContext;
};

type ImageTokenDetail = 'low' | 'high' | 'auto';

type ImageTokenEstimatorConfig = {
  baseTokens: number;
  tileTokens: number;
  fallbackTiles: number;
};

type ImageTokenEstimate = {
  tokens: number;
  cachePayload: string;
};

const IMAGE_FILE_EXTENSIONS = new Set([
  'png',
  'jpg',
  'jpeg',
  'webp',
  'gif',
  'bmp',
  'tiff',
  'tif',
  'heic',
  'heif',
  'avif',
]);

const TOKEN_ESTIMATE_CACHE_VERSION = 2;

const DEFAULT_IMAGE_ESTIMATOR: ImageTokenEstimatorConfig = {
  baseTokens: 85,
  tileTokens: 170,
  fallbackTiles: 4,
};

type CacheablePart = any;

function buildEstimateKey(kind: string, text: string): string {
  const payloadHash = createHash('sha1').update(text).digest('hex');
  return `${kind}:${payloadHash}`;
}

function resolveEncodingId(encoding?: TiktokenBPE): string {
  if (!encoding) return 'o200k_base';

  try {
    return `custom:${createHash('sha1').update(JSON.stringify(encoding)).digest('hex')}`;
  } catch {
    return 'custom:unknown';
  }
}

function isTokenEstimateEntry(value: unknown): value is TokenEstimateCacheEntry {
  if (!value || typeof value !== 'object') return false;
  const entry = value as Partial<TokenEstimateCacheEntry>;
  return (
    typeof entry.v === 'number' &&
    typeof entry.source === 'string' &&
    typeof entry.key === 'string' &&
    typeof entry.tokens === 'number'
  );
}

function getCacheEntry(cache: unknown, key: string): TokenEstimateCacheEntry | undefined {
  if (!cache || typeof cache !== 'object') return undefined;
  if (isTokenEstimateEntry(cache)) {
    return cache.key === key ? cache : undefined;
  }

  return undefined;
}

function getPartCacheEntry(part: CacheablePart, key: string): TokenEstimateCacheEntry | undefined {
  const cache = (part as any)?.providerMetadata?.mastra?.tokenEstimate;
  return getCacheEntry(cache, key);
}

function setPartCacheEntry(part: CacheablePart, _key: string, entry: TokenEstimateCacheEntry): void {
  const mutablePart = part as any;
  mutablePart.providerMetadata ??= {};
  mutablePart.providerMetadata.mastra ??= {};
  mutablePart.providerMetadata.mastra.tokenEstimate = entry;
}

function getMessageCacheEntry(message: MastraDBMessage, key: string): TokenEstimateCacheEntry | undefined {
  const content = message.content as any;
  if (content && typeof content === 'object') {
    const contentLevelCache = content.metadata?.mastra?.tokenEstimate;
    const contentLevelEntry = getCacheEntry(contentLevelCache, key);
    if (contentLevelEntry) return contentLevelEntry;
  }

  const messageLevelCache = (message as any)?.metadata?.mastra?.tokenEstimate;
  return getCacheEntry(messageLevelCache, key);
}

function setMessageCacheEntry(message: MastraDBMessage, _key: string, entry: TokenEstimateCacheEntry): void {
  const content = message.content as any;
  if (content && typeof content === 'object') {
    content.metadata ??= {};
    (content.metadata as any).mastra ??= {};
    (content.metadata as any).mastra.tokenEstimate = entry;
    return;
  }

  (message as any).metadata ??= {};
  (message as any).metadata.mastra ??= {};
  (message as any).metadata.mastra.tokenEstimate = entry;
}

function serializePartForTokenCounting(part: CacheablePart): string {
  const hasTokenEstimate = Boolean((part as any)?.providerMetadata?.mastra?.tokenEstimate);
  if (!hasTokenEstimate) {
    return JSON.stringify(part);
  }

  const clonedPart = {
    ...(part as any),
    providerMetadata: {
      ...((part as any).providerMetadata ?? {}),
      mastra: {
        ...((part as any).providerMetadata?.mastra ?? {}),
      },
    },
  };

  delete clonedPart.providerMetadata.mastra.tokenEstimate;

  if (Object.keys(clonedPart.providerMetadata.mastra).length === 0) {
    delete clonedPart.providerMetadata.mastra;
  }

  if (Object.keys(clonedPart.providerMetadata).length === 0) {
    delete clonedPart.providerMetadata;
  }

  return JSON.stringify(clonedPart);
}

function isValidCacheEntry(
  entry: TokenEstimateCacheEntry | undefined,
  expectedKey: string,
  expectedSource: string,
): entry is TokenEstimateCacheEntry {
  return Boolean(
    entry &&
    entry.v === TOKEN_ESTIMATE_CACHE_VERSION &&
    entry.source === expectedSource &&
    entry.key === expectedKey &&
    Number.isFinite(entry.tokens),
  );
}

function parseModelContext(model?: string | TokenCounterModelContext): TokenCounterModelContext | undefined {
  if (!model) return undefined;
  if (typeof model === 'object') {
    return model.provider || model.modelId ? { provider: model.provider, modelId: model.modelId } : undefined;
  }

  const slashIndex = model.indexOf('/');
  if (slashIndex === -1) {
    return { modelId: model };
  }

  return {
    provider: model.slice(0, slashIndex),
    modelId: model.slice(slashIndex + 1),
  };
}

function normalizeImageDetail(detail: unknown): ImageTokenDetail {
  if (detail === 'low' || detail === 'high') return detail;
  return 'auto';
}

function getObjectValue(value: unknown, key: string): unknown {
  if (!value || typeof value !== 'object') return undefined;
  return (value as Record<string, unknown>)[key];
}

function resolveImageDetail(part: CacheablePart): ImageTokenDetail {
  const openAIProviderOptions = getObjectValue(getObjectValue(part, 'providerOptions'), 'openai');
  const openAIProviderMetadata = getObjectValue(getObjectValue(part, 'providerMetadata'), 'openai');
  const mastraMetadata = getObjectValue(getObjectValue(part, 'providerMetadata'), 'mastra');

  return normalizeImageDetail(
    getObjectValue(part, 'detail') ??
      getObjectValue(part, 'imageDetail') ??
      getObjectValue(openAIProviderOptions, 'detail') ??
      getObjectValue(openAIProviderOptions, 'imageDetail') ??
      getObjectValue(openAIProviderMetadata, 'detail') ??
      getObjectValue(openAIProviderMetadata, 'imageDetail') ??
      getObjectValue(mastraMetadata, 'imageDetail'),
  );
}

function getFiniteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined;
}

function resolveImageDimensions(part: CacheablePart): { width?: number; height?: number } {
  const mastraMetadata = getObjectValue(getObjectValue(part, 'providerMetadata'), 'mastra');
  const dimensions = getObjectValue(mastraMetadata, 'imageDimensions');

  return {
    width:
      getFiniteNumber(getObjectValue(part, 'width')) ??
      getFiniteNumber(getObjectValue(part, 'imageWidth')) ??
      getFiniteNumber(getObjectValue(dimensions, 'width')),
    height:
      getFiniteNumber(getObjectValue(part, 'height')) ??
      getFiniteNumber(getObjectValue(part, 'imageHeight')) ??
      getFiniteNumber(getObjectValue(dimensions, 'height')),
  };
}

function getBase64Size(base64: string): number {
  const sanitized = base64.replace(/\s+/g, '');
  const padding = sanitized.endsWith('==') ? 2 : sanitized.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((sanitized.length * 3) / 4) - padding);
}

function resolveImageSourceStats(image: unknown): { source: 'url' | 'data-uri' | 'binary'; sizeBytes?: number } {
  if (image instanceof URL) {
    return { source: 'url' };
  }

  if (typeof image === 'string') {
    if (image.startsWith('data:')) {
      const commaIndex = image.indexOf(',');
      const encoded = commaIndex === -1 ? '' : image.slice(commaIndex + 1);
      return {
        source: 'data-uri',
        sizeBytes: getBase64Size(encoded),
      };
    }

    return {
      source: 'binary',
      sizeBytes: getBase64Size(image),
    };
  }

  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(image)) {
    return { source: 'binary', sizeBytes: image.length };
  }

  if (image instanceof Uint8Array) {
    return { source: 'binary', sizeBytes: image.byteLength };
  }

  if (image instanceof ArrayBuffer) {
    return { source: 'binary', sizeBytes: image.byteLength };
  }

  if (ArrayBuffer.isView(image)) {
    return { source: 'binary', sizeBytes: image.byteLength };
  }

  return { source: 'binary' };
}

function getPathnameExtension(value: string): string | undefined {
  const normalized = value.split('#', 1)[0]?.split('?', 1)[0] ?? value;
  const match = normalized.match(/\.([a-z0-9]+)$/i);
  return match?.[1]?.toLowerCase();
}

function hasImageFilenameExtension(filename: unknown): boolean {
  return typeof filename === 'string' && IMAGE_FILE_EXTENSIONS.has(getPathnameExtension(filename) ?? '');
}

function isImageLikeFilePart(part: CacheablePart): boolean {
  if (getObjectValue(part, 'type') !== 'file') {
    return false;
  }

  const mimeType = getObjectValue(part, 'mimeType');
  if (typeof mimeType === 'string' && mimeType.toLowerCase().startsWith('image/')) {
    return true;
  }

  const data = getObjectValue(part, 'data');
  if (typeof data === 'string' && data.startsWith('data:image/')) {
    return true;
  }

  if (data instanceof URL && hasImageFilenameExtension(data.pathname)) {
    return true;
  }

  return hasImageFilenameExtension(getObjectValue(part, 'filename'));
}

function resolveImageEstimatorConfig(modelContext?: TokenCounterModelContext): ImageTokenEstimatorConfig {
  const provider = modelContext?.provider?.toLowerCase();
  const modelId = modelContext?.modelId?.toLowerCase() ?? '';

  if (provider === 'openai') {
    if (modelId.startsWith('gpt-5') || modelId === 'gpt-5-chat-latest') {
      return { baseTokens: 70, tileTokens: 140, fallbackTiles: 4 };
    }

    if (modelId.startsWith('gpt-4o-mini')) {
      return { baseTokens: 2833, tileTokens: 5667, fallbackTiles: 1 };
    }

    if (modelId.startsWith('o1') || modelId.startsWith('o3')) {
      return { baseTokens: 75, tileTokens: 150, fallbackTiles: 4 };
    }

    if (modelId.includes('computer-use')) {
      return { baseTokens: 65, tileTokens: 129, fallbackTiles: 4 };
    }

    return DEFAULT_IMAGE_ESTIMATOR;
  }

  return DEFAULT_IMAGE_ESTIMATOR;
}

function scaleDimensionsForHighDetail(width: number, height: number): { width: number; height: number } {
  let scaledWidth = width;
  let scaledHeight = height;
  const largestSide = Math.max(scaledWidth, scaledHeight);

  if (largestSide > 2048) {
    const ratio = 2048 / largestSide;
    scaledWidth *= ratio;
    scaledHeight *= ratio;
  }

  const shortestSide = Math.min(scaledWidth, scaledHeight);
  if (shortestSide > 0 && shortestSide !== 768) {
    const ratio = 768 / shortestSide;
    scaledWidth *= ratio;
    scaledHeight *= ratio;
  }

  return {
    width: Math.max(1, Math.round(scaledWidth)),
    height: Math.max(1, Math.round(scaledHeight)),
  };
}

function estimateHighDetailTiles(
  dimensions: { width?: number; height?: number },
  sourceStats: { sizeBytes?: number },
  estimator: ImageTokenEstimatorConfig,
): number {
  if (dimensions.width && dimensions.height) {
    const scaled = scaleDimensionsForHighDetail(dimensions.width, dimensions.height);
    return Math.max(1, Math.ceil(scaled.width / 512) * Math.ceil(scaled.height / 512));
  }

  if (sourceStats.sizeBytes !== undefined) {
    if (sourceStats.sizeBytes <= 512 * 1024) return 1;
    if (sourceStats.sizeBytes <= 2 * 1024 * 1024) return 4;
    if (sourceStats.sizeBytes <= 4 * 1024 * 1024) return 6;
    return 8;
  }

  return estimator.fallbackTiles;
}

function resolveEffectiveImageDetail(
  detail: ImageTokenDetail,
  dimensions: { width?: number; height?: number },
  sourceStats: { sizeBytes?: number },
): Exclude<ImageTokenDetail, 'auto'> {
  if (detail === 'low' || detail === 'high') return detail;

  if (dimensions.width && dimensions.height) {
    return Math.max(dimensions.width, dimensions.height) > 768 ? 'high' : 'low';
  }

  if (sourceStats.sizeBytes !== undefined) {
    return sourceStats.sizeBytes > 1024 * 1024 ? 'high' : 'low';
  }

  return 'low';
}

/**
 * Token counting utility using tiktoken.
 * Uses o200k_base (GPT-4o encoding) as a reasonable default for text and
 * provider-aware heuristics for image parts so multimodal prompts are not
 * undercounted as generic JSON blobs.
 */
export class TokenCounter {
  private encoder: Tiktoken;
  private readonly cacheSource: string;
  private modelContext?: TokenCounterModelContext;

  // Per-message overhead: accounts for role tokens, message framing, and separators.
  // Empirically derived from OpenAI's token counting guide (3 tokens per message base +
  // fractional overhead from name/role encoding). 3.8 is a practical average across models.
  private static readonly TOKENS_PER_MESSAGE = 3.8;
  // Conversation-level overhead: system prompt framing, reply priming tokens, etc.
  private static readonly TOKENS_PER_CONVERSATION = 24;

  constructor(encoding?: TiktokenBPE, options?: TokenCounterOptions) {
    this.encoder = encoding ? new Tiktoken(encoding) : getDefaultEncoder();
    this.cacheSource = `v${TOKEN_ESTIMATE_CACHE_VERSION}:${resolveEncodingId(encoding)}`;
    this.modelContext = parseModelContext(options?.model);
  }

  setModelContext(model?: string | TokenCounterModelContext): void {
    this.modelContext = parseModelContext(model);
  }

  /**
   * Count tokens in a plain string
   */
  countString(text: string): number {
    if (!text) return 0;
    // Allow all special tokens to avoid errors with content containing tokens like <|endoftext|>
    return this.encoder.encode(text, 'all').length;
  }

  private readOrPersistPartEstimate(part: CacheablePart, kind: string, payload: string): number {
    const key = buildEstimateKey(kind, payload);
    const cached = getPartCacheEntry(part, key);
    if (isValidCacheEntry(cached, key, this.cacheSource)) {
      return cached.tokens;
    }

    const tokens = this.countString(payload);
    setPartCacheEntry(part, key, {
      v: TOKEN_ESTIMATE_CACHE_VERSION,
      source: this.cacheSource,
      key,
      tokens,
    });

    return tokens;
  }

  private readOrPersistFixedPartEstimate(part: CacheablePart, kind: string, payload: string, tokens: number): number {
    const key = buildEstimateKey(kind, payload);
    const cached = getPartCacheEntry(part, key);
    if (isValidCacheEntry(cached, key, this.cacheSource)) {
      return cached.tokens;
    }

    setPartCacheEntry(part, key, {
      v: TOKEN_ESTIMATE_CACHE_VERSION,
      source: this.cacheSource,
      key,
      tokens,
    });

    return tokens;
  }

  private readOrPersistMessageEstimate(message: MastraDBMessage, kind: string, payload: string): number {
    const key = buildEstimateKey(kind, payload);
    const cached = getMessageCacheEntry(message, key);
    if (isValidCacheEntry(cached, key, this.cacheSource)) {
      return cached.tokens;
    }

    const tokens = this.countString(payload);
    setMessageCacheEntry(message, key, {
      v: TOKEN_ESTIMATE_CACHE_VERSION,
      source: this.cacheSource,
      key,
      tokens,
    });

    return tokens;
  }

  private resolveToolResultForTokenCounting(
    part: CacheablePart,
    invocationResult: unknown,
  ): { value: unknown; usingStoredModelOutput: boolean } {
    const mastraMetadata = (part as any)?.providerMetadata?.mastra;
    if (mastraMetadata && typeof mastraMetadata === 'object' && 'modelOutput' in mastraMetadata) {
      return {
        value: (mastraMetadata as Record<string, unknown>).modelOutput,
        usingStoredModelOutput: true,
      };
    }

    return {
      value: invocationResult,
      usingStoredModelOutput: false,
    };
  }

  private estimateImageAssetTokens(part: CacheablePart, asset: unknown, kind: 'image' | 'file'): ImageTokenEstimate {
    const detail = resolveImageDetail(part);
    const dimensions = resolveImageDimensions(part);
    const sourceStats = resolveImageSourceStats(asset);
    const estimator = resolveImageEstimatorConfig(this.modelContext);
    const effectiveDetail = resolveEffectiveImageDetail(detail, dimensions, sourceStats);
    const tiles = effectiveDetail === 'high' ? estimateHighDetailTiles(dimensions, sourceStats, estimator) : 0;
    const tokens = estimator.baseTokens + tiles * estimator.tileTokens;

    return {
      tokens,
      cachePayload: JSON.stringify({
        kind,
        provider: this.modelContext?.provider ?? null,
        modelId: this.modelContext?.modelId ?? null,
        detail,
        effectiveDetail,
        width: dimensions.width ?? null,
        height: dimensions.height ?? null,
        source: sourceStats.source,
        sizeBytes: sourceStats.sizeBytes ?? null,
        mimeType: getObjectValue(part, 'mimeType') ?? null,
        filename: getObjectValue(part, 'filename') ?? null,
      }),
    };
  }

  private estimateImageTokens(part: CacheablePart): ImageTokenEstimate {
    return this.estimateImageAssetTokens(part, part.image, 'image');
  }

  private estimateImageLikeFileTokens(part: CacheablePart): ImageTokenEstimate {
    return this.estimateImageAssetTokens(part, part.data, 'file');
  }

  /**
   * Count tokens in a single message
   */
  countMessage(message: MastraDBMessage): number {
    let payloadTokens = this.countString(message.role);
    let overhead = TokenCounter.TOKENS_PER_MESSAGE;
    let toolResultCount = 0;

    if (typeof message.content === 'string') {
      payloadTokens += this.readOrPersistMessageEstimate(message, 'message-content', message.content);
    } else if (message.content && typeof message.content === 'object') {
      if (message.content.content && !Array.isArray(message.content.parts)) {
        payloadTokens += this.readOrPersistMessageEstimate(message, 'content-content', message.content.content);
      } else if (Array.isArray(message.content.parts)) {
        for (const part of message.content.parts as CacheablePart[]) {
          if (part.type === 'text') {
            payloadTokens += this.readOrPersistPartEstimate(part, 'text', part.text);
          } else if (part.type === 'image') {
            const estimate = this.estimateImageTokens(part);
            payloadTokens += this.readOrPersistFixedPartEstimate(part, 'image', estimate.cachePayload, estimate.tokens);
          } else if (part.type === 'file' && isImageLikeFilePart(part)) {
            const estimate = this.estimateImageLikeFileTokens(part);
            payloadTokens += this.readOrPersistFixedPartEstimate(
              part,
              'image-like-file',
              estimate.cachePayload,
              estimate.tokens,
            );
          } else if (part.type === 'tool-invocation') {
            const invocation = part.toolInvocation;
            if (invocation.state === 'call' || invocation.state === 'partial-call') {
              if (invocation.toolName) {
                payloadTokens += this.readOrPersistPartEstimate(
                  part,
                  `tool-${invocation.state}-name`,
                  invocation.toolName,
                );
              }
              if (invocation.args) {
                if (typeof invocation.args === 'string') {
                  payloadTokens += this.readOrPersistPartEstimate(
                    part,
                    `tool-${invocation.state}-args`,
                    invocation.args,
                  );
                } else {
                  const argsJson = JSON.stringify(invocation.args);
                  payloadTokens += this.readOrPersistPartEstimate(part, `tool-${invocation.state}-args-json`, argsJson);
                  // JSON.stringify adds ~12 tokens of structural overhead (braces, quotes, colons)
                  // that the model's native tool encoding doesn't use, so subtract to compensate.
                  overhead -= 12;
                }
              }
            } else if (invocation.state === 'result') {
              toolResultCount++;

              const { value: resultForCounting, usingStoredModelOutput } = this.resolveToolResultForTokenCounting(
                part,
                invocation.result,
              );

              if (resultForCounting !== undefined) {
                if (typeof resultForCounting === 'string') {
                  payloadTokens += this.readOrPersistPartEstimate(
                    part,
                    usingStoredModelOutput ? 'tool-result-model-output' : 'tool-result',
                    resultForCounting,
                  );
                } else {
                  const resultJson = JSON.stringify(resultForCounting);
                  payloadTokens += this.readOrPersistPartEstimate(
                    part,
                    usingStoredModelOutput ? 'tool-result-model-output-json' : 'tool-result-json',
                    resultJson,
                  );
                  overhead -= 12;
                }
              }
            } else {
              throw new Error(
                `Unhandled tool-invocation state '${(part as any).toolInvocation?.state}' in token counting for part type '${part.type}'`,
              );
            }
          } else if (typeof part.type === 'string' && part.type.startsWith('data-')) {
            // Skip data-* parts (e.g. data-om-activation, data-om-buffering-start, etc.)
            // These are OM metadata parts that are never sent to the LLM.
          } else if (part.type === 'reasoning') {
            // Skip reasoning parts (not sent to the model context).
          } else {
            const serialized = serializePartForTokenCounting(part);
            payloadTokens += this.readOrPersistPartEstimate(part, `part-${part.type}`, serialized);
          }
        }
      }
    }

    // Add overhead for tool results
    if (toolResultCount > 0) {
      overhead += toolResultCount * TokenCounter.TOKENS_PER_MESSAGE;
    }

    return Math.round(payloadTokens + overhead);
  }

  /**
   * Count tokens in an array of messages
   */
  countMessages(messages: MastraDBMessage[]): number {
    if (!messages || messages.length === 0) return 0;

    let total = TokenCounter.TOKENS_PER_CONVERSATION;
    for (const message of messages) {
      total += this.countMessage(message);
    }
    return total;
  }

  /**
   * Count tokens in observations string
   */
  countObservations(observations: string): number {
    return this.countString(observations);
  }
}
