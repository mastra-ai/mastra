import { MastraDeployer } from '@mastra/core';
import { createChildProcessLogger } from '@mastra/deployer';
import { Cloudflare } from 'cloudflare';
import { writeFileSync } from 'fs';
import { join } from 'path';

import { bundleForCloudflare } from './bunder';

interface CFRoute {
  pattern: string;
  zone_name: string;
  custom_domain?: boolean;
}

export class CloudflareDeployer extends MastraDeployer {
  private cloudflare: Cloudflare | undefined;
  routes?: CFRoute[] = [];
  workerNamespace?: string;
  constructor({
    scope,
    env,
    projectName,
    routes,
    workerNamespace,
    auth,
  }: {
    env?: Record<string, any>;
    scope: string;
    projectName: string;
    routes?: CFRoute[];
    workerNamespace?: string;
    auth?: {
      apiToken: string;
      apiEmail: string;
    };
  }) {
    super({ scope, env, projectName });

    this.routes = routes;
    this.workerNamespace = workerNamespace;

    if (auth) {
      this.cloudflare = new Cloudflare(auth);
    }
  }

  async writeFiles({ dir }: { dir: string }): Promise<void> {
    this.loadEnvVars();

    await this.writeIndex({ dir });

    const cfWorkerName = this.projectName || 'mastra';

    const wranglerConfig: Record<string, any> = {
      name: cfWorkerName,
      main: 'index.mjs',
      compatibility_date: '2024-12-02',
      compatibility_flags: ['nodejs_compat'],
      build: {
        command: 'npm install',
      },
      observability: {
        logs: {
          enabled: true,
        },
      },
      vars: this.env,
    };

    if (!this.workerNamespace && this.routes) {
      wranglerConfig.routes = this.routes;
    }

    writeFileSync(join(dir, 'wrangler.json'), JSON.stringify(wranglerConfig));
  }

  async writeIndex({ dir }: { dir: string }): Promise<void> {
    writeFileSync(
      join(dir, './index-template.mjs'),
      `
      export default {
        fetch: async (request, env, context) => {
          Object.keys(env).forEach(key => {
            process.env[key] = env[key]
          })
          const { app } = await import('./hono.mjs');
          return app.fetch(request, env, context);
        }
      }
      `,
    );

    await bundleForCloudflare(join(dir, './index-template.mjs'), join(dir, './index.mjs'));
  }

  async deploy({ dir, token }: { dir: string; token: string }): Promise<void> {
    const cmd = this.workerNamespace
      ? `npm exec -- wrangler deploy --dispatch-namespace ${this.workerNamespace}`
      : 'npm exec -- wrangler deploy';

    const cpLogger = createChildProcessLogger({
      logger: this.logger,
      root: dir,
    });

    await cpLogger({
      cmd,
      args: [],
      env: {
        CLOUDFLARE_API_TOKEN: token,
        CLOUDFLARE_ACCOUNT_ID: this.scope,
        ...this.env,
        PATH: process.env.PATH!,
      },
    });
  }

  async tagWorker({
    workerName,
    namespace,
    tags,
    scope,
  }: {
    scope: string;
    workerName: string;
    namespace: string;
    tags: string[];
  }): Promise<void> {
    if (!this.cloudflare) {
      throw new Error('Cloudflare Deployer not initialized');
    }

    await this.cloudflare.workersForPlatforms.dispatch.namespaces.scripts.tags.update(namespace, workerName, {
      account_id: scope,
      body: tags,
    });
  }
}
