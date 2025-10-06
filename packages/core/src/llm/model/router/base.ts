import type {
  LanguageModelV2CallOptions,
  LanguageModelV2CallWarning,
  LanguageModelV2FinishReason,
  LanguageModelV2StreamPart,
} from '@ai-sdk/provider-v5';
import type { ResolvedModelConfig } from '../gateway-resolver';
import type { MastraModelGateway } from '../gateways';

export type ResolvedRequestConfig = { url: string; headers: Record<string, string>; modelId: string };

export abstract class ModelRouterLanguageModelBase {
  constructor(
    public provider: string,
    public gateway: MastraModelGateway,
  ) {}

  abstract convertTools(tools: LanguageModelV2CallOptions['tools']): any[] | undefined;

  abstract mapFinishReason(reason: string | null): LanguageModelV2FinishReason;

  abstract resolveRequestConfig(config: ResolvedModelConfig, apiKey: string): Promise<ResolvedRequestConfig>;

  abstract doStream(
    options: LanguageModelV2CallOptions,
    config: ResolvedRequestConfig,
  ): Promise<{
    stream: ReadableStream<LanguageModelV2StreamPart>;
    request?: { body: string };
    response?: { headers: Record<string, string> };
    warnings: LanguageModelV2CallWarning[];
  }>;
}
