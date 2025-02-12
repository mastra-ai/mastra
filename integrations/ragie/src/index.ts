import { Integration } from '@mastra/core';

// @ts-ignore
import RagieLogo from './assets/ragie.png';
import * as integrationClient from './client/services.gen';
import { RagieToolset } from './toolset';
import { type RagieConfig } from './types';

export class RagieIntegration extends Integration<void, typeof integrationClient> {
  readonly name = 'RAGIE';
  readonly logoUrl = RagieLogo;
  config: RagieConfig;
  categories = ['ai'];
  description = 'Ragie is an AI assistant that helps you find information and answer questions.';

  constructor({ config }: { config: RagieConfig }) {
    super();

    this.config = config;
  }

  getStaticTools() {
    const openapi = new RagieToolset({
      config: this.config,
    });

    return openapi.tools;
  }
}
