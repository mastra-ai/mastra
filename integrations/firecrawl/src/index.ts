import { MIntegration } from '@mastra/core';
// @ts-ignore
// import FirecrawlLogo from './assets/firecrawl.png';
import { FirecrawlToolset } from './toolset';
import { FirecrawlConfig } from './types';
export class FirecrawlIntegration extends MIntegration {
  readonly name = 'FIRECRAWL';
  readonly logoUrl = '';
  config: FirecrawlConfig;
  categories = ['dev-tools', 'ai', 'automation'];
  description = 'Firecrawl is a web scraping platform';

  constructor({ config }: { config: FirecrawlConfig }) {
    super();
    this.config = config;
  }

  getStaticTools() {
    const openapi = new FirecrawlToolset({
      config: this.config,
    })

    return openapi.tools;
  }
}

