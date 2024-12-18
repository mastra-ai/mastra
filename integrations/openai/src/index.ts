import { Integration } from '@mastra/core';
import * as integrationClient from './client/services.gen';

// @ts-ignore
import OpenaiLogo from './assets/openai.png';
import { OpenaiConfig } from './types';
import { OpenaiToolset } from './toolset';

export class OpenaiIntegration extends Integration<void, typeof integrationClient> {
  readonly name = 'OPENAI';
  readonly logoUrl = OpenaiLogo;
  config: OpenaiConfig;
  categories = ['ai'];
  description =
    'OpenAI is an artificial intelligence platform that provides a set of tools and APIs for building AI-powered applications.';

  constructor({ config }: { config: OpenaiConfig }) {
    super();

    this.config = config;
  }

  getStaticTools() {
    const openapi = new OpenaiToolset({
      config: this.config,
    })

    return openapi.tools;

  }
}
