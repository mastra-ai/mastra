import { MIntegration } from '@mastra/core';

// @ts-ignore
import SendgridLogo from './assets/sendgrid.png';
import { SendgridToolset } from './toolset';
import { SendgridConfig } from './types';

export class SendgridIntegration extends MIntegration {
  readonly name = 'SENDGRID';
  readonly logoUrl = SendgridLogo;
  config: SendgridConfig;
  categories = ['marketing', 'communications'];
  description =
    'SendGrid is a cloud-based email marketing platform that provides tools for sending and tracking emails.';

  constructor({ config }: { config: SendgridConfig }) {
    super();
    this.config = config;
  }

  getStaticTools() {
    const openapi = new SendgridToolset({
      config: this.config,
    })

    return openapi.tools;
  }
}
