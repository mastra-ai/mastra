import { OpenAPIToolset } from '@mastra/core/integration';
import type { ToolAction } from '@mastra/core/tools';

// @ts-ignore
// import GithubLogo from './assets/github.png';
import { comments } from './client/service-comments';
import * as integrationClient from './client/services.gen';
import * as zodSchema from './client/zodSchema';
import type { GithubConfig } from './types';

export class GithubToolset extends OpenAPIToolset {
  readonly name = 'GITHUB';
  readonly logoUrl = '';
  config: GithubConfig;
  readonly tools: Record<Exclude<keyof typeof integrationClient, 'client'>, ToolAction<any, any, any, any>>;
  categories = ['dev-tools'];
  description =
    'GitHub is a development platform inspired by the way you work. From open source to business, you can host and review code, manage projects, and build software alongside millions of other developers.';

  constructor({ config }: { config: GithubConfig }) {
    super();

    this.config = config;
    this.tools = this._generateIntegrationTools<typeof this.tools>();
  }

  protected get toolSchemas() {
    return zodSchema;
  }

  protected get toolDocumentations() {
    return comments;
  }

  protected get baseClient() {
    integrationClient.client.setConfig({
      baseUrl: `https://api.github.com`,
    });
    return integrationClient;
  }

  getApiClient = async () => {
    const value = {
      PERSONAL_ACCESS_TOKEN: this.config?.['PERSONAL_ACCESS_TOKEN'],
    } as Record<string, any>;

    const baseClient = this.baseClient;

    baseClient.client.interceptors.request.use(request => {
      request.headers.set('Authorization', `Bearer ${value?.['PERSONAL_ACCESS_TOKEN']}`);
      return request;
    });

    return integrationClient;
  };
}
