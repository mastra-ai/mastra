import { OpenAPIToolset, ToolAction } from '@mastra/core';

// @ts-ignore
import ElevenlabsLogo from './assets/elevenlabs.png';
import { comments } from './client/service-comments';
import * as integrationClient from './client/services.gen';
import * as zodSchema from './client/zodSchema';
import { ElevenlabsConfig } from './types';

export class ElevenlabsToolset extends OpenAPIToolset {
    readonly name = 'ELEVENLABS';
    readonly logoUrl = ElevenlabsLogo;
    config: ElevenlabsConfig;
    readonly tools: Record<Exclude<keyof typeof integrationClient, 'client'>, ToolAction<any, any, any, any>>;
    categories = ['ai', 'communications'];
    description = 'Eleven Labs is an ai audio platform';

    constructor({ config }: { config: ElevenlabsConfig }) {
        super();

        this.config = config;
        this.tools = this._generateIntegrationTools<typeof this.tools>();
    }

    protected get toolSchemas() {
        return zodSchema;
    }

    protected get toolDocumentations() {
        return comments;
    }

    protected get baseClient() {
        integrationClient.client.setConfig({
            baseUrl: `https://api.elevenlabs.io`,
        });
        return integrationClient;
    }

    getApiClient = async () => {
        const value = {
            'x-api-key': this.config?.['xApiKey'],
        } as Record<string, any>;

        const baseClient = this.baseClient;

        baseClient.client.interceptors.request.use((request, options) => {
            request.headers.set('x-api-key', value?.['xApiKey']);
            return request;
        });

        return integrationClient;
    };
}
