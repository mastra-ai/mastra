import { MIntegration } from '@mastra/core';

// @ts-ignore
import RagieLogo from './assets/ragie.png';
import { RagieToolset } from './toolset';
import { RagieConfig } from './types';
export class RagieIntegration extends MIntegration {
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
    })

    return openapi.tools;
  }
}
