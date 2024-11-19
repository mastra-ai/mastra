import { Integration, ToolApi } from '@mastra/core';
import { z } from 'zod';

// @ts-ignore
import FirecrawlLogo from './assets/firecrawl.png';
import { comments } from './client/service-comments';
import * as integrationClient from './client/services.gen';
import * as zodSchema from './client/zodSchema';

type FirecrawlConfig = {
  API_KEY: string;
  [key: string]: any;
};

export class FirecrawlIntegration extends Integration {
  readonly name = FIRECRAWL;
  readonly logoUrl = FirecrawlLogo;
  config: FirecrawlConfig;
  readonly tools: Record<Exclude<keyof typeof integrationClient, 'client'>, ToolApi>;
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
      baseUrl: `https://api.firecrawl.com/v1`,
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
