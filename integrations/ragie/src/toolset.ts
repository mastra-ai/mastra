import { OpenAPIToolset, type ToolAction } from '@mastra/core';

// @ts-ignore
import RagieLogo from './assets/ragie.png';
import { comments } from './client/service-comments';
import * as integrationClient from './client/services.gen';
import * as zodSchema from './client/zodSchema';
import { type RagieConfig } from './types';

export class RagieToolset extends OpenAPIToolset {
  readonly name = 'RAGIE';
  readonly logoUrl = RagieLogo;
  config: RagieConfig;
  readonly tools: Record<Exclude<keyof typeof integrationClient, 'client'>, ToolAction<any, any, any, any>>;
  categories = ['ai'];
  description = 'Ragie is an AI assistant that helps you find information and answer questions.';

  constructor({ config }: { config: RagieConfig }) {
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
      baseUrl: `https://api.ragie.ai`,
    });
    return integrationClient;
  }

  getApiClient = async () => {
    return integrationClient;
  };
}
