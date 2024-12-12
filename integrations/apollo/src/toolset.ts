import { OpenAPIToolset, ToolApi } from '@mastra/core';

// @ts-ignore
import ApolloLogo from './assets/apollo.png';
import { comments } from './client/service-comments';
import * as integrationClient from './client/services.gen';
import * as zodSchema from './client/zodSchema';
import { ApolloConfig } from './types';


export class ApolloToolset extends OpenAPIToolset {
    readonly name = 'APOLLO';
    readonly logoUrl = ApolloLogo;
    config: ApolloConfig;
    readonly tools: Record<Exclude<keyof typeof integrationClient, 'client'>, ToolApi>;
    categories = ['communications', 'marketing', 'ats', 'hiring'];
    description =
        'Apollo is a sales engagement platform that helps sales teams generate more meetings, manage their pipeline, and close more deals.';

    constructor({ config }: { config: ApolloConfig }) {
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
            baseUrl: `https://app.apollo.io/api`,
        });
        return integrationClient;
    }

    getApiClient = async () => {
        const value = {
            'X-Api-Key': this.config?.['API_KEY'],
        } as Record<string, any>;

        const baseClient = this.baseClient;

        baseClient.client.interceptors.request.use((request, options) => {
            request.headers.set('X-Api-Key', value?.['API_KEY']);
            return request;
        });

        return integrationClient;
    };
}
