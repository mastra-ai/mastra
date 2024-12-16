import { OpenAPIToolset, ToolAction } from '@mastra/core';

// @ts-ignore
import CodaLogo from './assets/coda.png';
import { comments } from './client/service-comments';
import * as integrationClient from './client/services.gen';
import * as zodSchema from './client/zodSchema';
import { CodaConfig } from './types';

export class CodaToolset extends OpenAPIToolset {
    readonly name = 'CODA';
    readonly logoUrl = CodaLogo;
    config: CodaConfig;
    readonly tools: Record<Exclude<keyof typeof integrationClient, 'client'>, ToolAction<any, any, any, any>>;

    constructor({ config }: { config: CodaConfig }) {
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
            baseUrl: `https://coda.io/apis/v1`,
        });
        return integrationClient;
    }

    getApiClient = async () => {
        const value = {
            API_KEY: this.config?.['API_KEY'],
        } as Record<string, any>;

        const baseClient = this.baseClient;

        baseClient.client.interceptors.request.use((request, options) => {
            request.headers.set('Authorization', `Bearer ${value?.['API_KEY']}`);
            return request;
        });

        return integrationClient;
    };
}
