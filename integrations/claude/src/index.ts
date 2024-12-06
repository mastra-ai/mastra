import { Integration, ToolApi } from '@mastra/core';

// @ts-ignore
import ClaudeLogo from './assets/claude.png';
import { comments } from './client/service-comments';
import * as integrationClient from './client/services.gen';
import * as zodSchema from './client/zodSchema';

type ClaudeConfig = {
  ANTHROPIC_API_KEY: string;
  [key: string]: any;
};

export class ClaudeIntegration extends Integration {
  readonly name = 'CLAUDE';
  readonly logoUrl = ClaudeLogo;
  config: ClaudeConfig;
  readonly tools: Record<Exclude<keyof typeof integrationClient, 'client'>, ToolApi>;
  categories = ['ai', 'communications'];
  description = 'Claude is a next generation AI assistant built for work and trained to be safe, accurate, and secure.';

  constructor({ config }: { config: ClaudeConfig }) {
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
      baseUrl: `https://api.anthropic.com/v1`,
    });
    return integrationClient;
  }

  getApiClient = async () => {
    const value = {
      'x-api-key': this.config?.['ANTHROPIC_API_KEY'],
    } as Record<string, any>;

    const baseClient = this.baseClient;

    baseClient.client.interceptors.request.use((request, options) => {
      request.headers.set('x-api-key', value?.['ANTHROPIC_API_KEY']);
      return request;
    });

    return integrationClient;
  };
}
