import { Integration, ToolApi } from '@mastra/core';

// @ts-ignore
import SendgridLogo from './assets/sendgrid.png';
import { comments } from './client/service-comments';
import * as integrationClient from './client/services.gen';
import * as zodSchema from './client/zodSchema';

type SendgridConfig = {
  API_KEY: string;
  [key: string]: any;
};

export class SendgridIntegration extends Integration {
  readonly name = 'SENDGRID';
  readonly logoUrl = SendgridLogo;
  config: SendgridConfig;
  readonly tools: Record<Exclude<keyof typeof integrationClient, 'client'>, ToolApi>;
  categories = ['marketing', 'communications'];
  description =
    'SendGrid is a cloud-based email marketing platform that provides tools for sending and tracking emails.';

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
