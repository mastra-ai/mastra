import { OpenAPIToolset, ToolAction } from '@mastra/core';

// @ts-ignore
import TwilioLogo from './assets/twilio.png';
import { comments } from './client/service-comments';
import * as integrationClient from './client/services.gen';
import * as zodSchema from './client/zodSchema';
import { TwilioConfig } from './types';


export class TwilioToolset extends OpenAPIToolset {
    readonly name = 'TWILIO';
    readonly logoUrl = TwilioLogo;
    config: TwilioConfig;
    readonly tools: Record<Exclude<keyof typeof integrationClient, 'client'>, ToolAction<any, any, any, any>>;
    categories = ['communications'];
    description = 'Twilio is a cloud communications platform as a service company based in San Francisco, California.';

    constructor({ config }: { config: TwilioConfig }) {
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
            baseUrl: `https://api.twilio.com`,
        });
        return integrationClient;
    }

    getApiClient = async () => {
        const value = {
            ACCOUNT_SID: this.config?.['ACCOUNT_SID'],
            AUTH_TOKEN: this.config?.['AUTH_TOKEN'],
        } as Record<string, any>;

        const baseClient = this.baseClient;

        baseClient.client.interceptors.request.use((request, options) => {
            request.headers.set('Authorization', `Basic ${btoa(`${value?.['ACCOUNT_SID']}:${value?.['AUTH_TOKEN']}`)}`);
            return request;
        });

        return integrationClient;
    };
}