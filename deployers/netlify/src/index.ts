import { MastraDeployer } from '@mastra/core';
import { execa } from 'execa';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'fs';
import { join } from 'path';

import { getOrCreateSite } from './helpers.js';

interface EnvVar {
  key: string;
  value: string;
  target: ('production' | 'preview' | 'development')[];
  type: 'plain' | 'secret';
}

interface VercelError {
  message: string;
  code: string;
}

export class NetlifyDeployer extends MastraDeployer {
  constructor({ scope, env, projectName }: { projectName: string; env?: Record<string, any>; scope: string }) {
    super({ scope, env, projectName });
  }

  writeFiles({ dir }: { dir: string }): void {
    if (!existsSync(join(dir, 'netlify/functions/api'))) {
      mkdirSync(join(dir, 'netlify/functions/api'), { recursive: true });
    }

    // TODO ENV KEYS
    writeFileSync(
      join(dir, 'netlify.toml'),
      `
              [functions]
              node_bundler = "esbuild"            
              directory = "/netlify/functions"

              [[redirects]]
              force = true
              from = "/*"
              status = 200
              to = "/.netlify/functions/api/:splat"
              `,
    );

    this.writeIndex({ dir });
  }

  private getProjectId({ dir }: { dir: string }): string {
    const projectJsonPath = join(dir, '.vercel', 'project.json');
    try {
      const projectJson = JSON.parse(readFileSync(projectJsonPath, 'utf-8'));
      return projectJson.projectId;
    } catch (error) {
      throw new Error('Could not find project ID. Make sure the project has been deployed first.');
    }
  }

  async syncEnv({ scope, dir, token }: { token: string; dir: string; scope: string }) {
    const envFiles = this.getEnvFiles();
    const envVars: string[] = [];

    for (const file of envFiles) {
      const vars = this.parseEnvFile(file);
      envVars.push(...vars);
    }

    console.log('Syncing environment variables...');

    // Transform env vars into the format expected by Vercel API
    const vercelEnvVars: EnvVar[] = envVars.map(envVar => {
      const [key, value] = envVar.split('=');
      if (!key || !value) {
        throw new Error(`Invalid environment variable format: ${envVar}`);
      }
      return {
        key,
        value,
        target: ['production', 'preview', 'development'],
        type: 'plain',
      };
    });

    try {
      const projectId = this.getProjectId({ dir });

      const response = await fetch(`https://api.vercel.com/v10/projects/${projectId}/env?teamId=${scope}&upsert=true`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(vercelEnvVars),
      });

      if (!response.ok) {
        const error = (await response.json()) as VercelError;
        throw new Error(`Failed to sync environment variables: ${error.message}`);
      }

      console.log('✓ Successfully synced environment variables');
    } catch (error) {
      if (error instanceof Error) {
        console.error('Failed to sync environment variables:', error.message);
      } else {
        console.error('Failed to sync environment variables:', error);
      }
      throw error;
    }
  }

  async deploy({ dir, token }: { dir: string; token: string }): Promise<void> {
    const site = await getOrCreateSite({ token, name: this.projectName || `mastra`, scope: this.scope });

    const p2 = execa(
      'netlify',
      ['deploy', '--site', site.id, '--auth', token, '--dir', '.', '--functions', './netlify/functions'],
      {
        cwd: dir,
      },
    );

    p2.stdout.pipe(process.stdout);
    await p2;
  }

  writeIndex({ dir }: { dir: string }): void {
    ['mastra.mjs', 'hono.mjs', 'server.mjs'].forEach(file => {
      renameSync(join(dir, file), join(dir, `netlify/functions/api/${file}`));
    });

    writeFileSync(
      join(dir, 'netlify/functions/api/api.mts'),
      `                
             export default async (req, context) => {
                const { app } = await import('./hono.mjs');
                    // Pass the request directly to Hono
                    return app.fetch(req, {
                        // Optional context passing if needed
                        env: { context }
                    })
                }
            `,
    );
  }
}
