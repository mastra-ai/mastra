import { Integration, ToolApi } from '@mastra/core';

// @ts-ignore
import ResendLogo from './assets/resend.png';
import { comments } from './client/service-comments';
import * as integrationClient from './client/services.gen';
import * as zodSchema from './client/zodSchema';

type ResendConfig = {
  API_KEY: string;
  [key: string]: any;
};

export class ResendIntegration extends Integration {
  readonly name = 'RESEND';
  readonly logoUrl = ResendLogo;
  config: ResendConfig;
  readonly tools: Record<Exclude<keyof typeof integrationClient, 'client'>, ToolApi>;
  categories = ['communications', 'marketing'];
  description = 'Resend is a platform for sending transactional and marketing emails.';

  constructor({ config }: { config: ResendConfig }) {
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
      baseUrl: `https://api.resend.com`,
    });
    return integrationClient;
  }

  getApiClient = async () => {
    return integrationClient;
  };
}
