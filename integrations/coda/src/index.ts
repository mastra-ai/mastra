import { MIntegration } from '@mastra/core';

// @ts-ignore
import CodaLogo from './assets/coda.png';
import { CodaConfig } from './types';
import { CodaToolset } from './toolset';

export class CodaIntegration extends MIntegration {
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
