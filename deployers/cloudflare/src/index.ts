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
  constructor({
    scope,
    env,
    projectName,
    routes,
  }: {
    env?: Record<string, any>;
    scope: string;
    projectName: string;
    routes?: CFRoute[];
  }) {
    super({ scope, env, projectName });

    this.routes = routes;
  }

  writeFiles({ dir }: { dir: string }): void {
    this.loadEnvVars();

    this.writeIndex({ dir });

    const cfWorkerName = this.projectName || 'mastra';

    writeFileSync(
      join(dir, 'wrangler.json'),
      JSON.stringify({
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
        routes: this.routes,
        vars: this.env,
      }),
    );
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
    child_process.execSync(`npm exec wrangler deploy`, {
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
