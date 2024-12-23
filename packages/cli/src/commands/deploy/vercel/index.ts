import { execa } from 'execa';
import { writeFileSync, readFileSync } from 'fs';
import { join } from 'path';

import { DepsService } from '../../../services/service.deps.js';
import { Deployer } from '../deployer.js';
import { EXPRESS_SERVER } from '../server.js';

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
  name = 'Vercel';
  async installCli() {
    console.log('Installing Vercel CLI...');
    const depsService = new DepsService();
    await depsService.installPackages(['vercel -g']);
  }

  async writePkgJson() {
    writeFileSync(
      join(this.dotMastraPath, 'package.json'),
      JSON.stringify(
        {
          name: 'server',
          version: '1.0.0',
          description: '',
          main: 'index.mjs',
          scripts: {
            start: 'node ./index.mjs',
          },
          author: '',
          license: 'ISC',
          dependencies: {
            express: '^4.21.1',
            '@mastra/core': '0.1.27-alpha.35',
            'express-jsdoc-swagger': '^1.8.0',
            'serverless-http': '^3.2.0',
            zod: '3.24.0',
          },
        },
        null,
        2,
      ),
    );
  }

  writeFiles() {
    writeFileSync(
      join(this.dotMastraPath, 'vercel.json'),
      JSON.stringify(
        {
          version: 2,
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

    writeFileSync(join(this.dotMastraPath, 'index.mjs'), EXPRESS_SERVER);
  }

  private getProjectId(): string {
    const projectJsonPath = join(this.dotMastraPath, '.vercel', 'project.json');
    try {
      const projectJson = JSON.parse(readFileSync(projectJsonPath, 'utf-8'));
      return projectJson.projectId;
    } catch (error) {
      throw new Error('Could not find project ID. Make sure the project has been deployed first.');
    }
  }

  async syncEnv({ scope }: { scope: string }) {
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
      const projectId = this.getProjectId();

      const response = await fetch(`https://api.vercel.com/v10/projects/${projectId}/env?teamId=${scope}&upsert=true`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.token}`,
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

  async deployCommand({
    scope,
    projectName = 'mastra-starter',
  }: {
    scope: string;
    projectName?: string;
  }): Promise<void> {
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
      scope as string,
      '--cwd',
      join(process.cwd(), '.mastra'),
      'deploy',
      '--token',
      this.token,
      '--yes',
      ...(projectName ? ['--name', projectName] : []),
    ];

    // Add env vars to initial deployment
    for (const envVar of envVars) {
      commandArgs.push('--env', envVar);
    }

    // Run the Vercel deploy command
    console.log('Running command:', 'vercel', commandArgs.join(' '));
    const p2 = execa('vercel', commandArgs);

    p2.stdout.pipe(process.stdout);
    p2.stderr.pipe(process.stderr);

    console.log('Deployment started on Vercel. You can wait for it to finish or exit this command.');
    await p2;

    if (envVars.length > 0) {
      // Sync environment variables for future deployments
      await this.syncEnv({ scope });
    } else {
      console.log('\nAdd your ENV vars to .env or your vercel dashboard.\n');
    }
  }
}
