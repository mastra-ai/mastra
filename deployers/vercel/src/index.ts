import * as child_process from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import process from 'process';

import { Deployer } from '@mastra/deployer';

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

export class VercelDeployer extends Deployer {
  private teamSlug: string;
  private projectName: string;
  private token: string;

  constructor({ teamSlug, projectName, token }: { teamSlug: string; projectName: string; token: string }) {
    super({ name: 'VERCEL' });

    this.teamSlug = teamSlug;
    this.projectName = projectName;
    this.token = token;
  }

  writeFiles(outputDirectory: string): void {
    writeFileSync(
      join(outputDirectory, this.outputDir, 'vercel.json'),
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
    const projectJsonPath = join(dir, 'output', '.vercel', 'project.json');

    try {
      const projectJson = JSON.parse(readFileSync(projectJsonPath, 'utf-8'));
      return projectJson.projectId;
    } catch {
      throw new Error('Could not find project ID. Make sure the project has been deployed first.');
    }
  }

  private async getTeamId(): Promise<string> {
    const response = await fetch(`https://api.vercel.com/v2/teams`, {
      headers: {
        Authorization: `Bearer ${this.token}`,
      },
    });

    const res = (await response.json()) as any;
    const teams = res.teams;
    return teams.find((team: any) => team.slug === this.teamSlug)?.id;
  }

  private async syncEnv(envVars: Map<string, string>, { outputDirectory }: { outputDirectory: string }) {
    console.log('Syncing environment variables...');

    // Transform env vars into the format expected by Vercel API
    const vercelEnvVars: EnvVar[] = Array.from(envVars.entries()).map(([key, value]) => {
      if (!key || !value) {
        throw new Error(`Invalid environment variable format: ${key || value}`);
      }

      return {
        key,
        value,
        target: ['production', 'preview', 'development'],
        type: 'plain',
      };
    });

    try {
      const projectId = this.getProjectId({ dir: outputDirectory });
      const teamId = await this.getTeamId();

      const response = await fetch(
        `https://api.vercel.com/v10/projects/${projectId}/env?teamId=${teamId}&upsert=true`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(vercelEnvVars),
        },
      );

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

  async prepare(outputDirectory: string): Promise<void> {
    await super.prepare(outputDirectory);
    await this.writeFiles(outputDirectory);
  }

  private getEntry(): string {
    return `
import { handle } from 'hono/vercel'
import { mastra } from '#mastra';
import { createHonoServer } from '#server';

const app = await createHonoServer(mastra);

export const GET = handle(app);
export const POST = handle(app);
`;
  }

  async bundle(entryFile: string, outputDirectory: string, toolsPaths: string[]): Promise<void> {
    return this._bundle(this.getEntry(), entryFile, outputDirectory, toolsPaths);
  }

  async deploy(outputDirectory: string): Promise<void> {
    const envVars = await this.loadEnvVars();

    // Create the command array with base arguments
    const commandArgs = [
      '--scope',
      this.teamSlug,
      '--cwd',
      join(outputDirectory, this.outputDir),
      '--token',
      this.token,
      'deploy',
      '--yes',
      ...(this.projectName ? ['--name', this.projectName] : []),
    ];

    // Run the Vercel deploy command
    child_process.execSync(`npx vercel ${commandArgs.join(' ')}`, {
      cwd: join(outputDirectory, this.outputDir),
      env: {
        PATH: process.env.PATH,
      },
      stdio: 'inherit',
    });

    this.logger.info('Deployment started on Vercel. You can wait for it to finish or exit this command.');

    if (envVars.size > 0) {
      // Sync environment variables for future deployments
      await this.syncEnv(envVars, { outputDirectory });
    } else {
      this.logger.info('\nAdd your ENV vars to .env or your vercel dashboard.\n');
    }
  }
}
