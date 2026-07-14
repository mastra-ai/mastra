import type { LanguageModelV4, LanguageModelV4CallOptions, LanguageModelV4FilePart } from '@ai-sdk/provider-v7';
import { convertToDataContent } from '../../../../stream/aisdk/v5/compat/content';
import type { MastraLanguageModelV4 } from '../../shared.types';
import { createStreamFromGenerateResult } from '../generate-to-stream';

type StreamResult = Awaited<ReturnType<LanguageModelV4['doStream']>>;
type LegacyFileData = string | URL | Uint8Array | ArrayBuffer;
type FileData = LegacyFileData | LanguageModelV4FilePart['data'];

/**
 * Remaps tool types from V2 format ('provider-defined') to V4 format ('provider').
 * Tools may arrive in V2 format when prepared upstream (e.g., by ToolBuilder or
 * prepareToolsAndToolChoice) without knowing the final model version. This ensures
 * provider tools (like openai.tools.webSearch()) work correctly with V4 models.
 *
 * V4 shares the V3 convention ('provider'), so the same remap applies.
 */
function remapToolsToV4(options: LanguageModelV4CallOptions): LanguageModelV4CallOptions {
  if (!options.tools?.length) {
    return options;
  }

  const remappedTools = options.tools.map((tool: Record<string, unknown>) => {
    if (tool.type === 'provider-defined') {
      return { ...tool, type: 'provider' as const };
    }
    return tool;
  });

  return {
    ...options,
    tools: remappedTools as typeof options.tools,
  };
}

function isTaggedV4FileData(data: unknown): data is LanguageModelV4FilePart['data'] {
  if (typeof data !== 'object' || data === null || !('type' in data)) {
    return false;
  }

  const type = data.type;
  return type === 'data' || type === 'url' || type === 'reference' || type === 'text';
}

/**
 * The Agent loop calls V4 providers directly, bypassing AI SDK v7's prompt
 * conversion. Agent prompts may therefore still contain V2/V3 flat file data.
 * Convert that legacy shape while preserving already-normalized V4 data.
 */
function normalizeFileDataForV4(data: FileData): {
  data: LanguageModelV4FilePart['data'];
  mediaType?: string;
} {
  if (isTaggedV4FileData(data)) {
    return { data };
  }

  const { data: convertedData, mediaType } = convertToDataContent(data);

  return {
    data: convertedData instanceof URL ? { type: 'url', url: convertedData } : { type: 'data', data: convertedData },
    mediaType,
  };
}

function remapFilePartsToV4(options: LanguageModelV4CallOptions): LanguageModelV4CallOptions {
  let promptModified = false;
  const prompt = options.prompt.map(message => {
    if (message.role !== 'user' && message.role !== 'assistant') {
      return message;
    }

    let contentModified = false;
    const content = message.content.map(part => {
      if (part.type !== 'file') {
        return part;
      }

      const { data, mediaType } = normalizeFileDataForV4(part.data);
      if (data === part.data && mediaType == null) {
        return part;
      }

      contentModified = true;
      return {
        ...part,
        data,
        mediaType: mediaType ?? part.mediaType,
      };
    });

    if (!contentModified) {
      return message;
    }

    promptModified = true;
    return { ...message, content };
  });

  // The map only replaces file parts with file parts, but TS widens the
  // mapped message union across roles, so restore the prompt type.
  return promptModified ? { ...options, prompt: prompt as typeof options.prompt } : options;
}

function remapCallOptionsToV4(options: LanguageModelV4CallOptions): LanguageModelV4CallOptions {
  return remapToolsToV4(remapFilePartsToV4(options));
}

/**
 * Wrapper class for AI SDK V7 (LanguageModelV4) that converts doGenerate to return
 * a stream format for consistency with Mastra's streaming architecture.
 */
export class AISDKV7LanguageModel implements MastraLanguageModelV4 {
  /**
   * The language model must specify which language model interface version it implements.
   */
  readonly specificationVersion: 'v4' = 'v4';
  /**
   * Name of the provider for logging purposes.
   */
  readonly provider: string;
  /**
   * Provider-specific model ID for logging purposes.
   */
  readonly modelId: string;
  /**
   * Supported URL patterns by media type for the provider.
   *
   * The keys are media type patterns or full media types (e.g. `*\/*` for everything, `audio/*`, `video/*`, or `application/pdf`).
   * and the values are arrays of regular expressions that match the URL paths.
   * The matching should be against lower-case URLs.
   * Matched URLs are supported natively by the model and are not downloaded.
   * @returns A map of supported URL patterns by media type (as a promise or a plain object).
   */
  supportedUrls: PromiseLike<Record<string, RegExp[]>> | Record<string, RegExp[]>;

  #model: LanguageModelV4;

  constructor(config: LanguageModelV4) {
    this.#model = config;
    this.provider = this.#model.provider;
    this.modelId = this.#model.modelId;
    this.supportedUrls = this.#model.supportedUrls;
  }

  async doGenerate(options: LanguageModelV4CallOptions) {
    const result = await this.#model.doGenerate(remapCallOptionsToV4(options));

    return {
      ...result,
      request: result.request!,
      response: result.response as unknown as StreamResult['response'],
      stream: createStreamFromGenerateResult(result),
    };
  }

  async doStream(options: LanguageModelV4CallOptions) {
    return await this.#model.doStream(remapCallOptionsToV4(options));
  }

  /**
   * Custom serialization for tracing/observability spans.
   * `#model` is already a true JS private field and not enumerable, so
   * the wrapped provider SDK client can't leak. This method makes the
   * safe shape explicit and avoids walking `supportedUrls` (a
   * PromiseLike / regex map that isn't useful in spans).
   */
  serializeForSpan(): { specificationVersion: 'v4'; modelId: string; provider: string } {
    return {
      specificationVersion: this.specificationVersion,
      modelId: this.modelId,
      provider: this.provider,
    };
  }
}
