import { OpenAPIToolset, ToolAction } from "@mastra/core";
import { SendgridConfig } from "./types";

// @ts-ignore
import SendgridLogo from './assets/sendgrid.png';
import { comments } from './client/service-comments';
import * as integrationClient from './client/services.gen';
import * as zodSchema from './client/zodSchema';

export class SendgridToolset extends OpenAPIToolset {
    readonly name = 'SENDGRID';
    readonly logoUrl = SendgridLogo;
    config: SendgridConfig;
    readonly tools: Record<Exclude<keyof typeof integrationClient, 'client'>, ToolAction<any, any, any, any>>;

    constructor({ config }: { config: SendgridConfig }) {
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
            baseUrl: `https://api.sendgrid.com`,
        });
        return integrationClient;
    }

    getApiClient = async () => {
        return integrationClient;
    };
}