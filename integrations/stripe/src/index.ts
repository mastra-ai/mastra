import { MIntegration } from '@mastra/core';

// @ts-ignore
import StripeLogo from './assets/stripe.png';
import { StripeToolset } from './toolset';

type StripeConfig = {
  API_KEY: string;
  [key: string]: any;
};

export class StripeIntegration extends MIntegration {
  readonly name = 'STRIPE';
  readonly logoUrl = StripeLogo;
  config: StripeConfig;
  categories = ['payments'];
  description = 'Stripe is a technology company that builds economic infrastructure for the internet.';

  constructor({ config }: { config: StripeConfig }) {
    super();

    this.config = config;
  }

  getStaticTools() {
    const openapi = new StripeToolset({
      config: this.config,
    })

    return openapi.tools;
  }
}
