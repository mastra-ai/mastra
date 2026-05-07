import type { LanguageModelV1, LanguageModelV1CallWarning, LanguageModelV1StreamPart } from '@ai-sdk/provider';
import type { LanguageModelV2, LanguageModelV2StreamPart } from '@ai-sdk/provider-v5';
import { createIdGenerator } from '@ai-sdk/provider-utils';

const generateId = createIdGenerator();

export class MockLanguageModelV1 implements LanguageModelV1 {
  readonly specificationVersion = 'v1';
  readonly defaultObjectGenerationMode = 'json' as const;
  readonly provider = 'mock-provider';
  readonly modelId = 'mock-model';

  private readonly generateFunc: (options: any) => Promise<{
    rawCall: { rawPrompt: any; rawSettings: any };
    finishReason: 'stop' | 'length' | 'content-filter' | 'tool-calls' | 'error' | 'other' | 'unknown';
    usage: { promptTokens: number; completionTokens: number };
    text?: string;
    toolCalls?: any[];
    warnings?: LanguageModelV1CallWarning[];
  }>;

  constructor({
    doGenerate,
  }: {
    doGenerate: (options: any) => Promise<{
      rawCall: { rawPrompt: any; rawSettings: any };
      finishReason: 'stop' | 'length' | 'content-filter' | 'tool-calls' | 'error' | 'other' | 'unknown';
      usage: { promptTokens: number; completionTokens: number };
      text?: string;
      toolCalls?: any[];
      warnings?: LanguageModelV1CallWarning[];
    }>;
  }) {
    this.generateFunc = doGenerate;
  }

  async doGenerate(
    options: Parameters<LanguageModelV1['doGenerate']>[0],
  ): Promise<Awaited<ReturnType<LanguageModelV1['doGenerate']>>> {
    return this.generateFunc(options);
  }

  async doStream(options: Parameters<LanguageModelV1['doStream']>[0]): Promise<{
    stream: ReadableStream<LanguageModelV1StreamPart>;
    rawCall: { rawPrompt: any; rawSettings: any };
    warnings?: LanguageModelV1CallWarning[];
  }> {
    throw new Error('Streaming not supported in mock model');
  }
}

/**
 * Mock Language Model V2 for testing/ingestion purposes.
 * Can be used in production code (doesn't depend on vitest).
 */
export class MockLanguageModelV2 implements LanguageModelV2 {
  readonly specificationVersion = 'v2';
  readonly provider = 'mock-provider';
  readonly modelId = 'mock-model';
  readonly supportedUrls = undefined;

  private readonly doGenerateFunc: LanguageModelV2['doGenerate'];
  private readonly doStreamFunc?: LanguageModelV2['doStream'];

  constructor(config: { doGenerate: LanguageModelV2['doGenerate']; doStream?: LanguageModelV2['doStream'] }) {
    this.doGenerateFunc = config.doGenerate;
    this.doStreamFunc = config.doStream;
  }

  async doGenerate(
    options: Parameters<LanguageModelV2['doGenerate']>[0],
  ): Promise<Awaited<ReturnType<LanguageModelV2['doGenerate']>>> {
    return this.doGenerateFunc(options);
  }

  async doStream(
    options: Parameters<LanguageModelV2['doStream']>[0],
  ): Promise<Awaited<ReturnType<LanguageModelV2['doStream']>>> {
    if (!this.doStreamFunc) {
      throw new Error('Streaming not supported in this mock model');
    }
    return this.doStreamFunc(options);
  }
}
