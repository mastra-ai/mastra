import { createHash } from 'node:crypto';
import type { LanguageModelV2Prompt } from '@ai-sdk/provider-v5';
import type { ProcessLLMRequestArgs, ProcessLLMRequestResult, Processor } from '../index';
import { downscaleImage } from './image-resize';

export interface ImageDownscalerOptions {
  /**
   * Largest width or height, in pixels, of an image sent to the model. Larger
   * PNG and JPEG images are scaled down to fit, keeping their aspect ratio.
   * Defaults to 2000, which every major provider accepts.
   */
  maxDimension?: number;
  /** JPEG quality (1-100) used when re-encoding a downscaled JPEG. Defaults to 85. */
  jpegQuality?: number;
}

const DEFAULT_MAX_DIMENSION = 2000;
const CACHE_SIZE = 32;

function toInlineBytes(data: unknown): Uint8Array | undefined {
  if (data instanceof Uint8Array) return data;
  let text: string | undefined;
  if (typeof data === 'string') text = data;
  else if (data instanceof URL && data.protocol === 'data:') text = data.href;
  if (text === undefined) return undefined;
  if (text.startsWith('data:')) {
    const comma = text.indexOf(',');
    if (comma === -1 || !text.slice(0, comma).endsWith(';base64')) return undefined;
    text = text.slice(comma + 1);
  } else if (/^[a-z][a-z0-9+.-]*:\/\//i.test(text)) {
    return undefined;
  }
  return Buffer.from(text, 'base64');
}

/**
 * Scales down oversized PNG and JPEG images before they reach the model:
 * images the user sends, and images tools return (such as full-page browser
 * screenshots). Providers reject or silently shrink large images; Anthropic,
 * for example, rejects any image over 8000 pixels on a side.
 *
 * Only the prompt sent to the model changes: the stored messages keep the
 * original images. Formats it can't decode (WebP, GIF, interlaced PNG, ...)
 * pass through unchanged.
 *
 * @example
 * ```typescript
 * const agent = new Agent({
 *   // ...
 *   inputProcessors: [new ImageDownscaler({ maxDimension: 2000 })],
 * });
 * ```
 */
export class ImageDownscaler implements Processor<'image-downscaler'> {
  readonly id = 'image-downscaler';
  readonly name = 'Image Downscaler';

  readonly #maxDimension: number;
  readonly #jpegQuality: number;
  // Every step re-sends the thread's images; remember recent results so an
  // oversized screenshot is decoded once rather than on every step.
  readonly #cache = new Map<string, { data: Uint8Array; mediaType: string } | null>();

  constructor(options: ImageDownscalerOptions = {}) {
    this.#maxDimension = options.maxDimension ?? DEFAULT_MAX_DIMENSION;
    this.#jpegQuality = options.jpegQuality ?? 85;
    if (!Number.isFinite(this.#maxDimension) || this.#maxDimension < 1) {
      throw new Error('ImageDownscaler: maxDimension must be a positive number');
    }
  }

  processLLMRequest({ prompt }: ProcessLLMRequestArgs): ProcessLLMRequestResult {
    let changed = false;
    const next = prompt.map(message => {
      if (message.role === 'user') {
        let messageChanged = false;
        const content = message.content.map(part => {
          if (part.type !== 'file' || !part.mediaType.startsWith('image/')) return part;
          const resized = this.#resize(part.data);
          if (!resized) return part;
          messageChanged = true;
          return { ...part, data: resized.data, mediaType: resized.mediaType };
        });
        if (!messageChanged) return message;
        changed = true;
        return { ...message, content };
      }
      if (message.role === 'tool') {
        let messageChanged = false;
        const content = message.content.map(part => {
          if (part.output.type !== 'content') return part;
          let outputChanged = false;
          const value = part.output.value.map(item => {
            if (item.type !== 'media' || !item.mediaType.startsWith('image/')) return item;
            const resized = this.#resize(item.data);
            if (!resized) return item;
            outputChanged = true;
            return { ...item, data: Buffer.from(resized.data).toString('base64'), mediaType: resized.mediaType };
          });
          if (!outputChanged) return part;
          messageChanged = true;
          return { ...part, output: { ...part.output, value } };
        });
        if (!messageChanged) return message;
        changed = true;
        return { ...message, content };
      }
      return message;
    }) as LanguageModelV2Prompt;

    return changed ? { prompt: next } : {};
  }

  #resize(data: unknown): { data: Uint8Array; mediaType: string } | undefined {
    const bytes = toInlineBytes(data);
    if (!bytes) return undefined;
    const key = createHash('sha1').update(bytes).digest('hex');
    if (this.#cache.has(key)) {
      const cached = this.#cache.get(key)!;
      this.#cache.delete(key);
      this.#cache.set(key, cached);
      return cached ?? undefined;
    }
    let resized: { data: Uint8Array; mediaType: string } | null = null;
    try {
      resized = downscaleImage(bytes, { maxDimension: this.#maxDimension, jpegQuality: this.#jpegQuality }) ?? null;
    } catch {
      // A corrupt image is the provider's to reject; leave it as it is.
    }
    this.#cache.set(key, resized);
    if (this.#cache.size > CACHE_SIZE) this.#cache.delete(this.#cache.keys().next().value!);
    return resized ?? undefined;
  }
}
