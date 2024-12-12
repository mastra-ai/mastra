import { Integration } from '@mastra/core';
import * as integrationClient from './client/services.gen';
// @ts-ignore
import CodaLogo from './assets/coda.png';
import { CodaConfig } from './types';
import { CodaToolset } from './toolset';

export class CodaIntegration extends Integration<void, typeof integrationClient> {
  readonly name = 'CODA';
  readonly logoUrl = CodaLogo;
  config: CodaConfig;
  constructor({ config }: { config: CodaConfig }) {
    super();

    this.config = config;
  }

  getStaticTools() {
    const openapi = new CodaToolset({
      config: this.config,
    })

    return openapi.tools;
  }
}
