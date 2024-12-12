import { Integration } from '@mastra/core';
import * as integrationClient from './client/services.gen';
// @ts-ignore
import ClaudeLogo from './assets/claude.png';
import { ClaudeConfig } from './types';
import { ClaudeToolset } from './toolset';


export class ClaudeIntegration extends Integration<void, typeof integrationClient> {
  readonly name = 'CLAUDE';
  readonly logoUrl = ClaudeLogo;
  config: ClaudeConfig;
  categories = ['ai', 'communications'];
  description = 'Claude is a next generation AI assistant built for work and trained to be safe, accurate, and secure.';

  constructor({ config }: { config: ClaudeConfig }) {
    super();

    this.config = config;

  }

  getStaticTools() {
    const openapi = new ClaudeToolset({
      config: this.config,
    })

    return openapi.tools;
  }

}
