import { Integration } from '@mastra/core';
import * as integrationClient from './client/services.gen';

// @ts-ignore
import ElevenlabsLogo from './assets/elevenlabs.png';
import { ElevenlabsConfig } from './types';
import { ElevenlabsToolset } from './toolset';

export class ElevenlabsIntegration extends Integration<void, typeof integrationClient> {
  readonly name = 'ELEVENLABS';
  readonly logoUrl = ElevenlabsLogo;
  config: ElevenlabsConfig;
  categories = ['ai', 'communications'];
  description = 'Eleven Labs is an ai audio platform';

  constructor({ config }: { config: ElevenlabsConfig }) {
    super();

    this.config = config;
  }

  getStaticTools() {
    const openapi = new ElevenlabsToolset({
      config: this.config,
    })

    return openapi.tools;
  }
}
