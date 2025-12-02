import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { MastraModelGateway } from './base.js';
import type { ProviderConfig } from './base.js';
export interface AzureOpenAIGatewayConfig {
    resourceName: string;
    apiKey: string;
    apiVersion?: string;
    deployments?: string[];
    management?: {
        tenantId: string;
        clientId: string;
        clientSecret: string;
        subscriptionId: string;
        resourceGroup: string;
    };
}
export declare class AzureOpenAIGateway extends MastraModelGateway {
    private config;
    readonly id = "azure-openai";
    readonly name = "azure-openai";
    private tokenCache;
    constructor(config: AzureOpenAIGatewayConfig);
    private validateConfig;
    fetchProviders(): Promise<Record<string, ProviderConfig>>;
    private getManagementCredentials;
    private getAzureADToken;
    private fetchDeployments;
    buildUrl(_routerId: string, _envVars?: typeof process.env): undefined;
    getApiKey(_modelId: string): Promise<string>;
    resolveLanguageModel({ modelId, apiKey, }: {
        modelId: string;
        providerId: string;
        apiKey: string;
    }): Promise<LanguageModelV2>;
}
//# sourceMappingURL=azure.d.ts.map