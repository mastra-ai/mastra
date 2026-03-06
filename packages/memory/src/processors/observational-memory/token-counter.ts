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

type GoogleMediaResolution = 'low' | 'medium' | 'high' | 'ultra_high' | 'unspecified';

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

const TOKEN_ESTIMATE_CACHE_VERSION = 3;

const DEFAULT_IMAGE_ESTIMATOR: ImageTokenEstimatorConfig = {
  baseTokens: 85,
  tileTokens: 170,
  fallbackTiles: 4,
};

const GOOGLE_LEGACY_IMAGE_TOKENS_PER_TILE = 258;
const GOOGLE_GEMINI_3_IMAGE_TOKENS_BY_RESOLUTION: Record<GoogleMediaResolution, number> = {
  low: 280,
  medium: 560,
  high: 1120,
  ultra_high: 2240,
  unspecified: 1120,
};

const ANTHROPIC_IMAGE_TOKENS_PER_PIXEL = 1 / 750;
const ANTHROPIC_IMAGE_MAX_LONG_EDGE = 1568;

const GOOGLE_MEDIA_RESOLUTION_VALUES = new Set<GoogleMediaResolution>([
  'low',
  'medium',
  'high',
  'ultra_high',
  'unspecified',
]);

const ATTACHMENT_COUNT_TIMEOUT_MS = 20_000;
const PROVIDER_API_KEY_ENV_VARS: Record<string, string[]> = {
  openai: ['OPENAI_API_KEY'],
  google: ['GOOGLE_GENERATIVE_AI_API_KEY', 'GOOGLE_API_KEY'],
  anthropic: ['ANTHROPIC_API_KEY'],
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

function getFilenameFromAttachmentData(data: unknown): string | undefined {
  const pathname =
    data instanceof URL
      ? data.pathname
      : typeof data === 'string' && /^https?:\/\//i.test(data)
        ? (() => {
            try {
              return new URL(data).pathname;
            } catch {
              return undefined;
            }
          })()
        : undefined;

  const filename = pathname?.split('/').filter(Boolean).pop();
  return filename ? decodeURIComponent(filename) : undefined;
}

function serializeNonImageFilePartForTokenCounting(part: CacheablePart): string {
  const filename = getObjectValue(part, 'filename');
  const inferredFilename = getFilenameFromAttachmentData(getObjectValue(part, 'data'));

  return JSON.stringify({
    type: 'file',
    mimeType: getObjectValue(part, 'mimeType') ?? null,
    filename: typeof filename === 'string' && filename.trim().length > 0 ? filename.trim() : (inferredFilename ?? null),
  });
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

function normalizeGoogleMediaResolution(value: unknown): GoogleMediaResolution | undefined {
  return typeof value === 'string' && GOOGLE_MEDIA_RESOLUTION_VALUES.has(value as GoogleMediaResolution)
    ? (value as GoogleMediaResolution)
    : undefined;
}

function resolveGoogleMediaResolution(part: CacheablePart): GoogleMediaResolution {
  const providerOptions = getObjectValue(getObjectValue(part, 'providerOptions'), 'google');
  const providerMetadata = getObjectValue(getObjectValue(part, 'providerMetadata'), 'google');
  const mastraMetadata = getObjectValue(getObjectValue(part, 'providerMetadata'), 'mastra');

  return (
    normalizeGoogleMediaResolution(getObjectValue(part, 'mediaResolution')) ??
    normalizeGoogleMediaResolution(getObjectValue(providerOptions, 'mediaResolution')) ??
    normalizeGoogleMediaResolution(getObjectValue(providerMetadata, 'mediaResolution')) ??
    normalizeGoogleMediaResolution(getObjectValue(mastraMetadata, 'mediaResolution')) ??
    'unspecified'
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

function resolveProviderId(modelContext?: TokenCounterModelContext): string | undefined {
  return modelContext?.provider?.toLowerCase();
}

function resolveModelId(modelContext?: TokenCounterModelContext): string {
  return modelContext?.modelId?.toLowerCase() ?? '';
}

function resolveOpenAIImageEstimatorConfig(modelContext?: TokenCounterModelContext): ImageTokenEstimatorConfig {
  const modelId = resolveModelId(modelContext);

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

function isGoogleGemini3Model(modelContext?: TokenCounterModelContext): boolean {
  return resolveProviderId(modelContext) === 'google' && resolveModelId(modelContext).startsWith('gemini-3');
}

function scaleDimensionsForOpenAIHighDetail(width: number, height: number): { width: number; height: number } {
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

function scaleDimensionsForAnthropic(width: number, height: number): { width: number; height: number } {
  const largestSide = Math.max(width, height);
  if (largestSide <= ANTHROPIC_IMAGE_MAX_LONG_EDGE) {
    return { width, height };
  }

  const ratio = ANTHROPIC_IMAGE_MAX_LONG_EDGE / largestSide;
  return {
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio)),
  };
}

function estimateOpenAIHighDetailTiles(
  dimensions: { width?: number; height?: number },
  sourceStats: { sizeBytes?: number },
  estimator: ImageTokenEstimatorConfig,
): number {
  if (dimensions.width && dimensions.height) {
    const scaled = scaleDimensionsForOpenAIHighDetail(dimensions.width, dimensions.height);
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

function resolveEffectiveOpenAIImageDetail(
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

function estimateLegacyGoogleImageTiles(dimensions: { width?: number; height?: number }): number {
  if (!dimensions.width || !dimensions.height) return 1;
  return Math.max(1, Math.ceil(dimensions.width / 768) * Math.ceil(dimensions.height / 768));
}

function estimateAnthropicImageTokens(
  dimensions: { width?: number; height?: number },
  sourceStats: { sizeBytes?: number },
): number {
  if (dimensions.width && dimensions.height) {
    const scaled = scaleDimensionsForAnthropic(dimensions.width, dimensions.height);
    return Math.max(1, Math.ceil(scaled.width * scaled.height * ANTHROPIC_IMAGE_TOKENS_PER_PIXEL));
  }

  if (sourceStats.sizeBytes !== undefined) {
    if (sourceStats.sizeBytes <= 512 * 1024) return 341;
    if (sourceStats.sizeBytes <= 2 * 1024 * 1024) return 1366;
    if (sourceStats.sizeBytes <= 4 * 1024 * 1024) return 2048;
    return 2731;
  }

  return 1600;
}

function estimateGoogleImageTokens(
  modelContext: TokenCounterModelContext | undefined,
  part: CacheablePart,
  dimensions: { width?: number; height?: number },
): { tokens: number; mediaResolution: GoogleMediaResolution } {
  if (isGoogleGemini3Model(modelContext)) {
    const mediaResolution = resolveGoogleMediaResolution(part);
    return {
      tokens: GOOGLE_GEMINI_3_IMAGE_TOKENS_BY_RESOLUTION[mediaResolution],
      mediaResolution,
    };
  }

  return {
    tokens: estimateLegacyGoogleImageTiles(dimensions) * GOOGLE_LEGACY_IMAGE_TOKENS_PER_TILE,
    mediaResolution: 'unspecified',
  };
}

function getProviderApiKey(provider: string): string | undefined {
  for (const envVar of PROVIDER_API_KEY_ENV_VARS[provider] ?? []) {
    const value = process.env[envVar];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }

  return undefined;
}

function getAttachmentFilename(part: CacheablePart): string | undefined {
  const explicitFilename = getObjectValue(part, 'filename');
  if (typeof explicitFilename === 'string' && explicitFilename.trim().length > 0) {
    return explicitFilename.trim();
  }

  return getFilenameFromAttachmentData(getObjectValue(part, 'data') ?? getObjectValue(part, 'image'));
}

function getAttachmentMimeType(part: CacheablePart, fallback: string): string {
  const mimeType = getObjectValue(part, 'mimeType');
  if (typeof mimeType === 'string' && mimeType.trim().length > 0) {
    return mimeType.trim();
  }

  const asset = getObjectValue(part, 'data') ?? getObjectValue(part, 'image');
  if (typeof asset === 'string' && asset.startsWith('data:')) {
    const semicolonIndex = asset.indexOf(';');
    const commaIndex = asset.indexOf(',');
    const endIndex = semicolonIndex === -1 ? commaIndex : Math.min(semicolonIndex, commaIndex);
    if (endIndex > 5) {
      return asset.slice(5, endIndex);
    }
  }

  return fallback;
}

function getAttachmentUrl(asset: unknown): string | undefined {
  if (asset instanceof URL) {
    return asset.toString();
  }

  if (typeof asset === 'string' && /^(https?:\/\/|data:)/i.test(asset)) {
    return asset;
  }

  return undefined;
}

function encodeAttachmentBase64(asset: unknown): string | undefined {
  if (typeof asset === 'string') {
    if (asset.startsWith('data:')) {
      const commaIndex = asset.indexOf(',');
      return commaIndex === -1 ? undefined : asset.slice(commaIndex + 1);
    }

    if (/^https?:\/\//i.test(asset)) {
      return undefined;
    }

    return asset;
  }

  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(asset)) {
    return asset.toString('base64');
  }

  if (asset instanceof Uint8Array) {
    return Buffer.from(asset).toString('base64');
  }

  if (asset instanceof ArrayBuffer) {
    return Buffer.from(asset).toString('base64');
  }

  if (ArrayBuffer.isView(asset)) {
    return Buffer.from(asset.buffer, asset.byteOffset, asset.byteLength).toString('base64');
  }

  return undefined;
}

function createTimeoutSignal(timeoutMs: number): AbortSignal {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(new Error(`Attachment token counting timed out after ${timeoutMs}ms`)),
    timeoutMs,
  );
  controller.signal.addEventListener('abort', () => clearTimeout(timeout), { once: true });
  return controller.signal;
}

function getNumericResponseField(value: unknown, paths: string[][]): number | undefined {
  for (const path of paths) {
    let current: unknown = value;
    for (const segment of path) {
      current = getObjectValue(current, segment);
      if (current === undefined) break;
    }

    if (typeof current === 'number' && Number.isFinite(current)) {
      return current;
    }
  }

  return undefined;
}

function toOpenAIInputPart(part: CacheablePart): Record<string, unknown> | undefined {
  if (getObjectValue(part, 'type') === 'image' || isImageLikeFilePart(part)) {
    const asset = getObjectValue(part, 'image') ?? getObjectValue(part, 'data');
    const imageUrl = getAttachmentUrl(asset);
    if (imageUrl) {
      return { type: 'input_image', image_url: imageUrl, detail: resolveImageDetail(part) };
    }

    const base64 = encodeAttachmentBase64(asset);
    if (!base64) return undefined;
    return {
      type: 'input_image',
      image_url: `data:${getAttachmentMimeType(part, 'image/png')};base64,${base64}`,
      detail: resolveImageDetail(part),
    };
  }

  if (getObjectValue(part, 'type') === 'file') {
    const asset = getObjectValue(part, 'data');
    const fileUrl = getAttachmentUrl(asset);
    return fileUrl
      ? {
          type: 'input_file',
          file_url: fileUrl,
          filename: getAttachmentFilename(part) ?? 'attachment',
        }
      : (() => {
          const base64 = encodeAttachmentBase64(asset);
          if (!base64) return undefined;
          return {
            type: 'input_file',
            file_data: `data:${getAttachmentMimeType(part, 'application/octet-stream')};base64,${base64}`,
            filename: getAttachmentFilename(part) ?? 'attachment',
          };
        })();
  }

  return undefined;
}

function toAnthropicContentPart(part: CacheablePart): Record<string, unknown> | undefined {
  const asset = getObjectValue(part, 'image') ?? getObjectValue(part, 'data');
  const url = getAttachmentUrl(asset);

  if (getObjectValue(part, 'type') === 'image' || isImageLikeFilePart(part)) {
    return url && /^https?:\/\//i.test(url)
      ? { type: 'image', source: { type: 'url', url } }
      : (() => {
          const base64 = encodeAttachmentBase64(asset);
          if (!base64) return undefined;
          return {
            type: 'image',
            source: { type: 'base64', media_type: getAttachmentMimeType(part, 'image/png'), data: base64 },
          };
        })();
  }

  if (getObjectValue(part, 'type') === 'file') {
    return url && /^https?:\/\//i.test(url)
      ? { type: 'document', source: { type: 'url', url } }
      : (() => {
          const base64 = encodeAttachmentBase64(asset);
          if (!base64) return undefined;
          return {
            type: 'document',
            source: { type: 'base64', media_type: getAttachmentMimeType(part, 'application/pdf'), data: base64 },
          };
        })();
  }

  return undefined;
}

function toGooglePart(part: CacheablePart): Record<string, unknown> | undefined {
  const asset = getObjectValue(part, 'image') ?? getObjectValue(part, 'data');
  const url = getAttachmentUrl(asset);
  const mimeType = getAttachmentMimeType(
    part,
    getObjectValue(part, 'type') === 'file' && !isImageLikeFilePart(part) ? 'application/pdf' : 'image/png',
  );

  if (url && !url.startsWith('data:')) {
    return { fileData: { mimeType, fileUri: url } };
  }

  const base64 = encodeAttachmentBase64(asset);
  if (!base64) return undefined;
  return { inlineData: { mimeType, data: base64 } };
}

async function fetchOpenAIAttachmentTokenEstimate(modelId: string, part: CacheablePart): Promise<number | undefined> {
  const apiKey = getProviderApiKey('openai');
  const inputPart = toOpenAIInputPart(part);
  if (!apiKey || !inputPart) return undefined;

  const response = await fetch('https://api.openai.com/v1/responses/input_tokens', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: modelId,
      input: [{ role: 'user', content: [inputPart] }],
    }),
    signal: createTimeoutSignal(ATTACHMENT_COUNT_TIMEOUT_MS),
  });

  if (!response.ok) return undefined;
  const body = await response.json();
  return getNumericResponseField(body, [
    ['input_tokens'],
    ['total_tokens'],
    ['usage', 'input_tokens'],
    ['usage', 'total_tokens'],
  ]);
}

async function fetchAnthropicAttachmentTokenEstimate(
  modelId: string,
  part: CacheablePart,
): Promise<number | undefined> {
  const apiKey = getProviderApiKey('anthropic');
  const contentPart = toAnthropicContentPart(part);
  if (!apiKey || !contentPart) return undefined;

  const response = await fetch('https://api.anthropic.com/v1/messages/count_tokens', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: modelId,
      messages: [{ role: 'user', content: [contentPart] }],
    }),
    signal: createTimeoutSignal(ATTACHMENT_COUNT_TIMEOUT_MS),
  });

  if (!response.ok) return undefined;
  const body = await response.json();
  return getNumericResponseField(body, [['input_tokens']]);
}

async function fetchGoogleAttachmentTokenEstimate(modelId: string, part: CacheablePart): Promise<number | undefined> {
  const apiKey = getProviderApiKey('google');
  const googlePart = toGooglePart(part);
  if (!apiKey || !googlePart) return undefined;

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelId}:countTokens`, {
    method: 'POST',
    headers: {
      'x-goog-api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [googlePart] }],
    }),
    signal: createTimeoutSignal(ATTACHMENT_COUNT_TIMEOUT_MS),
  });

  if (!response.ok) return undefined;
  const body = await response.json();
  return getNumericResponseField(body, [['totalTokens'], ['total_tokens']]);
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
    const provider = resolveProviderId(this.modelContext);
    const modelId = this.modelContext?.modelId ?? null;
    const detail = resolveImageDetail(part);
    const dimensions = resolveImageDimensions(part);
    const sourceStats = resolveImageSourceStats(asset);

    if (provider === 'google') {
      const googleEstimate = estimateGoogleImageTokens(this.modelContext, part, dimensions);
      return {
        tokens: googleEstimate.tokens,
        cachePayload: JSON.stringify({
          kind,
          provider,
          modelId,
          estimator: isGoogleGemini3Model(this.modelContext) ? 'google-gemini-3' : 'google-legacy',
          mediaResolution: googleEstimate.mediaResolution,
          width: dimensions.width ?? null,
          height: dimensions.height ?? null,
          source: sourceStats.source,
          sizeBytes: sourceStats.sizeBytes ?? null,
          mimeType: getObjectValue(part, 'mimeType') ?? null,
          filename: getObjectValue(part, 'filename') ?? null,
        }),
      };
    }

    if (provider === 'anthropic') {
      return {
        tokens: estimateAnthropicImageTokens(dimensions, sourceStats),
        cachePayload: JSON.stringify({
          kind,
          provider,
          modelId,
          estimator: 'anthropic',
          width: dimensions.width ?? null,
          height: dimensions.height ?? null,
          source: sourceStats.source,
          sizeBytes: sourceStats.sizeBytes ?? null,
          mimeType: getObjectValue(part, 'mimeType') ?? null,
          filename: getObjectValue(part, 'filename') ?? null,
        }),
      };
    }

    const estimator = resolveOpenAIImageEstimatorConfig(this.modelContext);
    const effectiveDetail = resolveEffectiveOpenAIImageDetail(detail, dimensions, sourceStats);
    const tiles = effectiveDetail === 'high' ? estimateOpenAIHighDetailTiles(dimensions, sourceStats, estimator) : 0;
    const tokens = estimator.baseTokens + tiles * estimator.tileTokens;

    return {
      tokens,
      cachePayload: JSON.stringify({
        kind,
        provider,
        modelId,
        estimator: provider === 'openai' ? 'openai' : 'fallback',
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

  private countAttachmentPartSync(part: CacheablePart): number | undefined {
    if (part.type === 'image') {
      const estimate = this.estimateImageTokens(part);
      return this.readOrPersistFixedPartEstimate(part, 'image', estimate.cachePayload, estimate.tokens);
    }

    if (part.type === 'file' && isImageLikeFilePart(part)) {
      const estimate = this.estimateImageLikeFileTokens(part);
      return this.readOrPersistFixedPartEstimate(part, 'image-like-file', estimate.cachePayload, estimate.tokens);
    }

    if (part.type === 'file') {
      return this.readOrPersistPartEstimate(part, 'file-descriptor', serializeNonImageFilePartForTokenCounting(part));
    }

    return undefined;
  }

  private buildRemoteAttachmentCachePayload(part: CacheablePart): string | undefined {
    const provider = resolveProviderId(this.modelContext);
    const modelId = this.modelContext?.modelId ?? null;
    if (!provider || !modelId || !['openai', 'google', 'anthropic'].includes(provider)) {
      return undefined;
    }

    const asset = getObjectValue(part, 'image') ?? getObjectValue(part, 'data');
    const sourceStats = resolveImageSourceStats(asset);
    return JSON.stringify({
      strategy: 'provider-endpoint',
      provider,
      modelId,
      type: getObjectValue(part, 'type') ?? null,
      detail: part.type === 'image' || isImageLikeFilePart(part) ? resolveImageDetail(part) : null,
      mediaResolution: provider === 'google' ? resolveGoogleMediaResolution(part) : null,
      mimeType: getAttachmentMimeType(
        part,
        part.type === 'file' && !isImageLikeFilePart(part) ? 'application/pdf' : 'image/png',
      ),
      filename: getAttachmentFilename(part) ?? null,
      width: resolveImageDimensions(part).width ?? null,
      height: resolveImageDimensions(part).height ?? null,
      source: sourceStats.source,
      sizeBytes: sourceStats.sizeBytes ?? null,
    });
  }

  private async fetchProviderAttachmentTokenEstimate(part: CacheablePart): Promise<number | undefined> {
    const provider = resolveProviderId(this.modelContext);
    const modelId = this.modelContext?.modelId;
    if (!provider || !modelId) return undefined;

    try {
      if (provider === 'openai') {
        return await fetchOpenAIAttachmentTokenEstimate(modelId, part);
      }

      if (provider === 'google') {
        return await fetchGoogleAttachmentTokenEstimate(modelId, part);
      }

      if (provider === 'anthropic') {
        return await fetchAnthropicAttachmentTokenEstimate(modelId, part);
      }
    } catch {
      return undefined;
    }

    return undefined;
  }

  private async countAttachmentPartAsync(part: CacheablePart): Promise<number | undefined> {
    const localTokens = this.countAttachmentPartSync(part);
    const remotePayload = this.buildRemoteAttachmentCachePayload(part);

    if (localTokens === undefined || !remotePayload) {
      return localTokens;
    }

    const remoteKey = buildEstimateKey('attachment-provider', remotePayload);
    const cachedRemote = getPartCacheEntry(part, remoteKey);
    if (isValidCacheEntry(cachedRemote, remoteKey, this.cacheSource)) {
      return cachedRemote.tokens;
    }

    const fallbackPayload = JSON.stringify({ ...JSON.parse(remotePayload), strategy: 'local-fallback' });
    const fallbackKey = buildEstimateKey('attachment-provider', fallbackPayload);
    const cachedFallback = getPartCacheEntry(part, fallbackKey);
    if (isValidCacheEntry(cachedFallback, fallbackKey, this.cacheSource)) {
      return cachedFallback.tokens;
    }

    const remoteTokens = await this.fetchProviderAttachmentTokenEstimate(part);
    if (typeof remoteTokens === 'number' && Number.isFinite(remoteTokens) && remoteTokens > 0) {
      setPartCacheEntry(part, remoteKey, {
        v: TOKEN_ESTIMATE_CACHE_VERSION,
        source: this.cacheSource,
        key: remoteKey,
        tokens: remoteTokens,
      });
      return remoteTokens;
    }

    setPartCacheEntry(part, fallbackKey, {
      v: TOKEN_ESTIMATE_CACHE_VERSION,
      source: this.cacheSource,
      key: fallbackKey,
      tokens: localTokens,
    });
    return localTokens;
  }

  private countNonAttachmentPart(part: CacheablePart): {
    tokens: number;
    overheadDelta: number;
    toolResultDelta: number;
  } {
    let overheadDelta = 0;
    let toolResultDelta = 0;

    if (part.type === 'text') {
      return { tokens: this.readOrPersistPartEstimate(part, 'text', part.text), overheadDelta, toolResultDelta };
    }

    if (part.type === 'tool-invocation') {
      const invocation = part.toolInvocation;
      let tokens = 0;

      if (invocation.state === 'call' || invocation.state === 'partial-call') {
        if (invocation.toolName) {
          tokens += this.readOrPersistPartEstimate(part, `tool-${invocation.state}-name`, invocation.toolName);
        }
        if (invocation.args) {
          if (typeof invocation.args === 'string') {
            tokens += this.readOrPersistPartEstimate(part, `tool-${invocation.state}-args`, invocation.args);
          } else {
            const argsJson = JSON.stringify(invocation.args);
            tokens += this.readOrPersistPartEstimate(part, `tool-${invocation.state}-args-json`, argsJson);
            overheadDelta -= 12;
          }
        }

        return { tokens, overheadDelta, toolResultDelta };
      }

      if (invocation.state === 'result') {
        toolResultDelta++;
        const { value: resultForCounting, usingStoredModelOutput } = this.resolveToolResultForTokenCounting(
          part,
          invocation.result,
        );

        if (resultForCounting !== undefined) {
          if (typeof resultForCounting === 'string') {
            tokens += this.readOrPersistPartEstimate(
              part,
              usingStoredModelOutput ? 'tool-result-model-output' : 'tool-result',
              resultForCounting,
            );
          } else {
            const resultJson = JSON.stringify(resultForCounting);
            tokens += this.readOrPersistPartEstimate(
              part,
              usingStoredModelOutput ? 'tool-result-model-output-json' : 'tool-result-json',
              resultJson,
            );
            overheadDelta -= 12;
          }
        }

        return { tokens, overheadDelta, toolResultDelta };
      }

      throw new Error(
        `Unhandled tool-invocation state '${(part as any).toolInvocation?.state}' in token counting for part type '${part.type}'`,
      );
    }

    if (typeof part.type === 'string' && part.type.startsWith('data-')) {
      return { tokens: 0, overheadDelta, toolResultDelta };
    }

    if (part.type === 'reasoning') {
      return { tokens: 0, overheadDelta, toolResultDelta };
    }

    const serialized = serializePartForTokenCounting(part);
    return {
      tokens: this.readOrPersistPartEstimate(part, `part-${part.type}`, serialized),
      overheadDelta,
      toolResultDelta,
    };
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
          const attachmentTokens = this.countAttachmentPartSync(part);
          if (attachmentTokens !== undefined) {
            payloadTokens += attachmentTokens;
            continue;
          }

          const result = this.countNonAttachmentPart(part);
          payloadTokens += result.tokens;
          overhead += result.overheadDelta;
          toolResultCount += result.toolResultDelta;
        }
      }
    }

    if (toolResultCount > 0) {
      overhead += toolResultCount * TokenCounter.TOKENS_PER_MESSAGE;
    }

    return Math.round(payloadTokens + overhead);
  }

  async countMessageAsync(message: MastraDBMessage): Promise<number> {
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
          const attachmentTokens = await this.countAttachmentPartAsync(part);
          if (attachmentTokens !== undefined) {
            payloadTokens += attachmentTokens;
            continue;
          }

          const result = this.countNonAttachmentPart(part);
          payloadTokens += result.tokens;
          overhead += result.overheadDelta;
          toolResultCount += result.toolResultDelta;
        }
      }
    }

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

  async countMessagesAsync(messages: MastraDBMessage[]): Promise<number> {
    if (!messages || messages.length === 0) return 0;

    let total = TokenCounter.TOKENS_PER_CONVERSATION;
    for (const message of messages) {
      total += await this.countMessageAsync(message);
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
