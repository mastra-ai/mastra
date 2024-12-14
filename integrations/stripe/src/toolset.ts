import { OpenAPIToolset, ToolAction } from '@mastra/core';

// @ts-ignore
import StripeLogo from './assets/stripe.png';
import { comments } from './client/service-comments';
import * as integrationClient from './client/services.gen';
import * as zodSchema from './client/zodSchema';
import { StripeConfig } from './types';

export class StripeToolset extends OpenAPIToolset {
    readonly name = 'STRIPE';
    readonly logoUrl = StripeLogo;
    config: StripeConfig;
    readonly tools: Record<Exclude<keyof typeof integrationClient, 'client'>, ToolAction<any, any, any, any>>;
    categories = ['payments'];
    description = 'Stripe is a technology company that builds economic infrastructure for the internet.';

    constructor({ config }: { config: StripeConfig }) {
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
            baseUrl: `https://api.stripe.com`,
        });
        return integrationClient;
    }

    getApiClient = async () => {
        const value = {
            API_KEY: this.config?.['API_KEY'],
        } as Record<string, any>;

        const baseClient = this.baseClient;

        baseClient.client.interceptors.request.use((request, options) => {
            request.headers.set('Authorization', `Basic ${btoa(`${value?.['API_KEY']}`)}`);
            return request;
        });

        return integrationClient;
    };
}
