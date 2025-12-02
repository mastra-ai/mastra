import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { MastraModelGateway } from './base.js';
import type { ProviderConfig } from './base.js';
export declare class NetlifyGateway extends MastraModelGateway {
    readonly id = "netlify";
    readonly name = "Netlify AI Gateway";
    private tokenCache;
    fetchProviders(): Promise<Record<string, ProviderConfig>>;
    buildUrl(routerId: string, envVars?: typeof process.env): Promise<string>;
    /**
     * Get cached token or fetch a new site-specific AI Gateway token from Netlify
     */
    private getOrFetchToken;
    /**
     * Get cached token or fetch a new site-specific AI Gateway token from Netlify
     */
    getApiKey(modelId: string): Promise<string>;
    resolveLanguageModel({ modelId, providerId, apiKey, headers, }: {
        modelId: string;
        providerId: string;
        apiKey: string;
        headers?: Record<string, string>;
    }): Promise<LanguageModelV2>;
}
//# sourceMappingURL=netlify.d.ts.map