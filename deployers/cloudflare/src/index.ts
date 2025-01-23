import { MastraDeployer } from '@mastra/core';
import * as child_process from 'child_process';
import { writeFileSync } from 'fs';
import { join } from 'path';

interface CFRoute {
  pattern: string;
  zone_name: string;
  custom_domain?: boolean;
}

export class CloudflareDeployer extends MastraDeployer {
  routes?: CFRoute[] = [];
  workerNamespace?: string;
  constructor({
    scope,
    env,
    projectName,
    routes,
    workerNamespace,
  }: {
    env?: Record<string, any>;
    scope: string;
    projectName: string;
    routes?: CFRoute[];
    workerNamespace?: string;
  }) {
    super({ scope, env, projectName });

    this.routes = routes;
    this.workerNamespace = workerNamespace;
  }

  writeFiles({ dir }: { dir: string }): void {
    this.loadEnvVars();

    this.writeIndex({ dir });

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

  writeIndex({ dir }: { dir: string }): void {
    writeFileSync(
      join(dir, './index.mjs'),
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
  }

  async deploy({ dir, token }: { dir: string; token: string }): Promise<void> {
    const cmd = this.workerNamespace
      ? `npm exec -- wrangler deploy --dispatch-namespace ${this.workerNamespace}`
      : 'npm exec -- wrangler deploy';
    child_process.execSync(cmd, {
      cwd: dir,
      stdio: 'inherit',
      env: {
        CLOUDFLARE_API_TOKEN: token,
        CLOUDFLARE_ACCOUNT_ID: this.scope,
        ...this.env,
        PATH: process.env.PATH,
      },
    });
  }
}
