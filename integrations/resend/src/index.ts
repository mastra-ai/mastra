import { Integration } from '@mastra/core';
import * as integrationClient from './client/services.gen';

// @ts-ignore
import ResendLogo from './assets/resend.png';
import { ResendToolset } from './toolset';

type ResendConfig = {
  API_KEY: string;
  [key: string]: any;
};

export class ResendIntegration extends Integration<void, typeof integrationClient> {
  readonly name = 'RESEND';
  readonly logoUrl = ResendLogo;
  config: ResendConfig;
  categories = ['communications', 'marketing'];
  description = 'Resend is a platform for sending transactional and marketing emails.';

  constructor({ config }: { config: ResendConfig }) {
    super();

    this.config = config;
  }

  getStaticTools() {
    const openapi = new ResendToolset({
      config: this.config,
    })

    return openapi.tools;
  }
}
