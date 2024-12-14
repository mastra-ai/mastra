import { Integration } from '@mastra/core';
import * as integrationClient from './client/sdk.gen';
// @ts-ignore
// import FirecrawlLogo from './assets/firecrawl.png';
import { FirecrawlToolset } from './toolset';
import { FirecrawlConfig } from './types';
export class FirecrawlIntegration extends Integration<void, typeof integrationClient> {
  readonly name = 'FIRECRAWL';
  readonly logoUrl = '';
  config: FirecrawlConfig;
  categories = ['dev-tools', 'ai', 'automation'];
  description = 'Firecrawl is a web scraping platform';

  openapi: FirecrawlToolset;

  constructor({ config }: { config: FirecrawlConfig }) {
    super();
    this.config = config;

    this.openapi = new FirecrawlToolset({
      config: this.config,
    })
  }

  getStaticTools() {
    return this.openapi.tools;
  }

  async getApiClient () {
    return this.openapi.getApiClient();
  }
}

