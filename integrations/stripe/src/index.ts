import { Integration } from '@mastra/core';
import * as integrationClient from './client/services.gen';

// @ts-ignore
import StripeLogo from './assets/stripe.png';
import { StripeToolset } from './toolset';
import { StripeConfig } from './types';
export class StripeIntegration extends Integration<void, typeof integrationClient> {
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
