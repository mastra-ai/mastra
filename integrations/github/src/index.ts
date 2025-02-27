import { Integration } from '@mastra/core/integration';

import type * as integrationClient from './client/services.gen';
import { GithubToolset } from './toolset';
// @ts-ignore
// import GithubLogo from './assets/github.png';
import type { GithubConfig } from './types';

export class GithubIntegration extends Integration<void, typeof integrationClient> {
  readonly name = 'GITHUB';
  readonly logoUrl = '';
  config: GithubConfig;
  categories = ['dev-tools'];
  description =
    'GitHub is a development platform inspired by the way you work. From open source to business, you can host and review code, manage projects, and build software alongside millions of other developers.';

  openapi: GithubToolset;

  constructor({ config }: { config: GithubConfig }) {
    super();

    this.config = config;

    this.openapi = new GithubToolset({
      config: this.config,
    });
  }

  getStaticTools() {
    return this.openapi.tools;
  }

  async getApiClient() {
    return this.openapi.getApiClient();
  }
}
