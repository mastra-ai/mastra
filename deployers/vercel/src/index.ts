import { MastraDeployer } from '@mastra/core';
import * as child_process from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

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

export class VercelDeployer extends MastraDeployer {
  constructor({ scope, env, projectName }: { env?: Record<string, any>; scope: string; projectName: string }) {
    super({ scope, env, projectName });
  }

  writeFiles({ dir }: { dir: string }): void {
    this.writeIndex({ dir });

    writeFileSync(
      join(dir, 'vercel.json'),
      JSON.stringify(
        {
          version: 2,
          installCommand: 'npm install --omit=dev',
          builds: [
            {
              src: 'index.mjs',
              use: '@vercel/node',
              config: { includeFiles: ['**'] },
            },
          ],
          routes: [
            {
              src: '/(.*)',
              dest: 'index.mjs',
            },
          ],
        },
        null,
        2,
      ),
    );
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
    // Get env vars for initial deployment
    const envFiles = this.getEnvFiles();
    const envVars: string[] = [];

    for (const file of envFiles) {
      const vars = this.parseEnvFile(file);
      envVars.push(...vars);
    }

    // Create the command array with base arguments
    const commandArgs = [
      '--scope',
      this.scope as string,
      '--cwd',
      dir,
      'deploy',
      '--token',
      token,
      '--yes',
      ...(this.projectName ? ['--name', this.projectName] : []),
    ];

    // Add env vars to initial deployment
    for (const envVar of envVars) {
      commandArgs.push('--env', envVar);
    }

    // Run the Vercel deploy command
    child_process.execSync(`vercel ${commandArgs.join(' ')}`, {
      cwd: dir,
      env: {
        ...this.env,
        PATH: process.env.PATH,
      },
      stdio: 'inherit',
    });

    console.log('Deployment started on Vercel. You can wait for it to finish or exit this command.');

    if (envVars.length > 0) {
      // Sync environment variables for future deployments
      await this.syncEnv({ scope: this.scope, dir, token });
    } else {
      console.log('\nAdd your ENV vars to .env or your vercel dashboard.\n');
    }
  }

  writeIndex({ dir }: { dir: string }): void {
    writeFileSync(
      join(dir, 'index.mjs'),
      `
                import { handle } from 'hono/vercel'
                import { app } from './hono.mjs';
                export const GET = handle(app);
                export const POST = handle(app);
            `,
    );
  }
}
