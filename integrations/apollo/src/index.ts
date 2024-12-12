import { Integration } from '@mastra/core';
import * as integrationClient from './client/services.gen';
// @ts-ignore
import ApolloLogo from './assets/apollo.png';
import { ApolloConfig } from './types';
import { ApolloToolset } from './toolset';

export class ApolloIntegration extends Integration<void, typeof integrationClient> {
  readonly name = 'APOLLO';
  readonly logoUrl = ApolloLogo;
  config: ApolloConfig;
  categories = ['communications', 'marketing', 'ats', 'hiring'];
  description =
    'Apollo is a sales engagement platform that helps sales teams generate more meetings, manage their pipeline, and close more deals.';

  constructor({ config }: { config: ApolloConfig }) {
    super();

    this.config = config;
  }

  getStaticTools() {
    const openapi = new ApolloToolset({
      config: this.config,
    })

    return openapi.tools;
  }
}
