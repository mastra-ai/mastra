import { Integration, ToolApi } from '@mastra/core';

// @ts-ignore
import OpenaiLogo from './assets/openai.png';
import { comments } from './client/service-comments';
import * as integrationClient from './client/services.gen';
import * as zodSchema from './client/zodSchema';

type OpenaiConfig = {
  API_KEY: string;
  [key: string]: any;
};

export class OpenaiIntegration extends Integration {
  readonly name = 'OPENAI';
  readonly logoUrl = OpenaiLogo;
  config: OpenaiConfig;
  readonly tools: Record<Exclude<keyof typeof integrationClient, 'client'>, ToolApi>;
  categories = ['ai'];
  description =
    'OpenAI is an artificial intelligence platform that provides a set of tools and APIs for building AI-powered applications.';

  constructor({ config }: { config: OpenaiConfig }) {
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
      baseUrl: `https://api.openai.com/v1`,
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
