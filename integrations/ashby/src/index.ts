import { Integration } from '@mastra/core';
import * as integrationClient from './client/services.gen';
// @ts-ignore
import AshbyLogo from './assets/ashby.png';
import { AshbyConfig } from './types';
import { AshbyToolset } from './toolset';

export class AshbyIntegration extends Integration<void, typeof integrationClient> {
  readonly name = 'ASHBY';
  readonly logoUrl = AshbyLogo;
  config: AshbyConfig;
  categories = ['hr', 'communications'];
  description = 'Ashby is a platform for managing your team’s onboarding, offboarding, and everything in between.';

  constructor({ config }: { config: AshbyConfig }) {
    super();

    this.config = config;
  }

  getStaticTools() {
    const openapi = new AshbyToolset({
      config: this.config,
    })

    return openapi.tools;
  }
}
