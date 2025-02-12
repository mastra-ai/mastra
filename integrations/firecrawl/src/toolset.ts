import { OpenAPIToolset } from '@mastra/core/integration';
import { type ToolAction } from '@mastra/core/tools';

import * as integrationClient from './client/sdk.gen';
import { comments } from './client/service-comments';
import * as zodSchema from './client/zodSchema';
import { type FirecrawlConfig } from './types';

export class FirecrawlToolset extends OpenAPIToolset {
  readonly name = 'FIRECRAWL';
  readonly logoUrl = '';
  config: FirecrawlConfig;

  readonly tools: Record<Exclude<keyof typeof integrationClient, 'client'>, ToolAction<any, any, any, any>>;

  categories = ['dev-tools', 'ai', 'automation'];
  description = 'Firecrawl is a web scraping platform';

  constructor({ config }: { config: FirecrawlConfig }) {
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
      baseUrl: `https://api.firecrawl.dev/v1`,
    });
    return integrationClient;
  }

  getApiClient = async () => {
    const value = {
      API_KEY: this.config?.['API_KEY'],
    } as Record<string, any>;

    const baseClient = this.baseClient;

    baseClient.client.interceptors.request.use(request => {
      request.headers.set('Authorization', `Bearer ${value?.['API_KEY']}`);
      return request;
    });

    return integrationClient;
  };
}

