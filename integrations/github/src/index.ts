import { Integration } from '@mastra/core';
import * as integrationClient from './client/services.gen';
// @ts-ignore
import GithubLogo from './assets/github.png';
import { GithubConfig } from './types';
import { GithubToolset } from './toolset';

export class GithubIntegration extends Integration<void, typeof integrationClient> {
  readonly name = 'GITHUB';
  readonly logoUrl = GithubLogo;
  config: GithubConfig;
  categories = ['dev-tools'];
  description =
    'GitHub is a development platform inspired by the way you work. From open source to business, you can host and review code, manage projects, and build software alongside millions of other developers.';

  constructor({ config }: { config: GithubConfig }) {
    super();

    this.config = config;

  }

  getStaticTools() {
    const openapi = new GithubToolset({
      config: this.config,
    })

    return openapi.tools;
  }
}
