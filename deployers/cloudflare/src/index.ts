import { MastraDeployer } from '@mastra/core';
import { execa } from 'execa';
import { writeFileSync } from 'fs';
import { join } from 'path';

interface CFRoute {
  pattern: string;
  zone_name: string;
}

export class CloudflareDeployer extends MastraDeployer {
  routes: CFRoute[] = [];
  constructor({
    scope,
    env,
    projectName,
    routes,
  }: {
    env?: Record<string, any>;
    scope: string;
    projectName: string;
    routes: CFRoute[];
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
        find_additional_modules: true,
        build: {
          command: 'pnpm install',
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
        import { app } from './hono.mjs';
        export default app
      `,
    );
  }

  // async syncEnv({ scope, dir, token }: { token: string; dir: string; scope: string }) {
  //   const envFiles = this.getEnvFiles();
  //   const envVars: string[] = [];

  //   for (const file of envFiles) {
  //     const vars = this.parseEnvFile(file);
  //     envVars.push(...vars);
  //   }

  //   console.log('Syncing environment variables...');

  //   // Transform env vars into the format expected by Vercel API
  //   const vercelEnvVars: EnvVar[] = envVars.map(envVar => {
  //     const [key, value] = envVar.split('=');
  //     if (!key || !value) {
  //       throw new Error(`Invalid environment variable format: ${envVar}`);
  //     }
  //     return {
  //       key,
  //       value,
  //       target: ['production', 'preview', 'development'],
  //       type: 'plain',
  //     };
  //   });

  //   try {
  //     const projectId = this.getProjectId({ dir });

  //     const response = await fetch(`https://api.vercel.com/v10/projects/${projectId}/env?teamId=${scope}&upsert=true`, {
  //       method: 'POST',
  //       headers: {
  //         Authorization: `Bearer ${token}`,
  //         'Content-Type': 'application/json',
  //       },
  //       body: JSON.stringify(vercelEnvVars),
  //     });

  //     if (!response.ok) {
  //       const error = (await response.json()) as VercelError;
  //       throw new Error(`Failed to sync environment variables: ${error.message}`);
  //     }

  //     console.log('✓ Successfully synced environment variables');
  //   } catch (error) {
  //     if (error instanceof Error) {
  //       console.error('Failed to sync environment variables:', error.message);
  //     } else {
  //       console.error('Failed to sync environment variables:', error);
  //     }
  //     throw error;
  //   }
  // }

  async deploy({ dir, token }: { dir: string; token: string }): Promise<void> {
    const p2 = execa('wrangler', ['deploy'], {
      cwd: dir,
      env: {
        CLOUDFLARE_API_TOKEN: token,
        CLOUDFLARE_ACCOUNT_ID: this.scope,
        ...this.env,
      },
    });
    p2.stdout.pipe(process.stdout);
    await p2;
  }
}
