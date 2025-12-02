import type { LanguageModelV2, LanguageModelV2CallOptions } from '@ai-sdk/provider-v5';
import type { MastraModelGateway } from './gateways/base.js';
import { ModelsDevGateway } from './gateways/models-dev.js';
import { NetlifyGateway } from './gateways/netlify.js';
import type { ModelRouterModelId } from './provider-registry.js';
import type { MastraLanguageModelV2, OpenAICompatibleConfig } from './shared.types.js';
type StreamResult = Awaited<ReturnType<LanguageModelV2['doStream']>>;
export declare const defaultGateways: (ModelsDevGateway | NetlifyGateway)[];
/**
 * @deprecated Use defaultGateways instead. This export will be removed in a future version.
 */
export declare const gateways: (ModelsDevGateway | NetlifyGateway)[];
export declare class ModelRouterLanguageModel implements MastraLanguageModelV2 {
    readonly specificationVersion: "v2";
    readonly defaultObjectGenerationMode: "json";
    readonly supportsStructuredOutputs = true;
    readonly supportsImageUrls = true;
    readonly supportedUrls: Record<string, RegExp[]>;
    readonly modelId: string;
    readonly provider: string;
    private config;
    private gateway;
    constructor(config: ModelRouterModelId | OpenAICompatibleConfig, customGateways?: MastraModelGateway[]);
    doGenerate(options: LanguageModelV2CallOptions): Promise<StreamResult>;
    doStream(options: LanguageModelV2CallOptions): Promise<StreamResult>;
    private resolveLanguageModel;
    private static modelInstances;
}
export {};
//# sourceMappingURL=router.d.ts.map