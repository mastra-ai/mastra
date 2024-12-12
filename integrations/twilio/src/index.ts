import { MIntegration } from '@mastra/core';

// @ts-ignore
import TwilioLogo from './assets/twilio.png';
import { TwilioConfig } from './types';
import { TwilioToolset } from './toolset';


export class TwilioIntegration extends MIntegration {
  readonly name = 'TWILIO';
  readonly logoUrl = TwilioLogo;
  config: TwilioConfig;
  categories = ['communications'];
  description = 'Twilio is a cloud communications platform as a service company based in San Francisco, California.';

  constructor({ config }: { config: TwilioConfig }) {
    super();
    this.config = config;
  }

  getStaticTools() {
    const openapi = new TwilioToolset({
      config: this.config,
    })

    return openapi.tools;
  }
}
