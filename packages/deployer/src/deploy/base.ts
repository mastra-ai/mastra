import { Mastra } from '@mastra/core';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import path, { join } from 'path';
import { fileURLToPath } from 'url';

import { bundle } from '../build/bundle.js';
import { Deps } from '../build/deps.js';
import { upsertMastraDir } from '../build/utils.js';

export class Deployer {
  deps: Deps = new Deps();
  dotMastraPath: string;
  name: string = '';

  constructor({ dir }: { dir: string }) {
    console.log('[Mastra Deploy] - Deployer initialized');
    this.dotMastraPath = join(dir, '.mastra');
  }

  getMastraPath() {
    return this.dotMastraPath;
  }

  async getMastra() {
    return (await import(join(this.dotMastraPath, 'mastra.mjs'))) as { mastra: Mastra };
  }

  async writePackageJson() {
    console.log('[Mastra Deploy] - Writing package.json');
    let projectPkg: any = {
      dependencies: {},
    };

    try {
      projectPkg = JSON.parse(readFileSync(join(this.dotMastraPath, '..', 'package.json'), 'utf-8'));
    } catch (_e) {
      // no-op
    }

    const mastraDeps = Object.entries(projectPkg.dependencies)
      .filter(([name]) => name.startsWith('@mastra') && !name.startsWith('@mastra/deployer'))
      .reduce((acc: any, [name, version]) => {
        if (version === 'workspace:*') {
          acc[name] = 'latest';
        } else {
          acc[name] = version;
        }

        return acc;
      }, {});

    writeFileSync(
      join(this.dotMastraPath, 'package.json'),
      JSON.stringify(
        {
          name: 'server',
          version: '1.0.0',
          description: '',
          type: 'module',
          main: 'index.mjs',
          scripts: {
            start: 'node ./index.mjs',
          },
          author: '',
          license: 'ISC',
          dependencies: {
            ...mastraDeps,
            hono: '4.6.17',
            execa: 'latest',
            '@hono/node-server': '^1.13.7',
            superjson: '^2.2.2',
            'zod-to-json-schema': '^3.24.1',
          },
        },
        null,
        2,
      ),
    );
  }

  async install() {
    console.log('[Mastra Deploy] - Installing dependencies...');
    await this.deps.install();
  }

  protected getEnvFiles(): string[] {
    const envFiles = ['.env', '.env.development', '.env.local']
      .map(file => join(process.cwd(), file))
      .filter(file => existsSync(file));
    return envFiles;
  }

  getEnvVars() {
    // Get all env vars
    const envFiles = this.getEnvFiles();
    const envVars: Record<string, string> = {};

    for (const file of envFiles) {
      const vars = this.parseEnvFile(file);
      for (const envVar of vars) {
        const [key, value] = envVar.split('=');
        if (key && value) {
          envVars[key] = value;
        }
      }
    }

    return envVars;
  }

  protected parseEnvFile(filePath: string): string[] {
    const content = readFileSync(filePath, 'utf-8');
    return content
      .split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#'))
      .filter(line => line.includes('=')); // Only include valid KEY=value pairs
  }

  async build({ dir, useBanner = true }: { dir: string; useBanner?: boolean }) {
    if (!existsSync(this.dotMastraPath)) {
      mkdirSync(this.dotMastraPath);
    }

    await bundle(dir, { useBanner, outfile: join(this.dotMastraPath, 'mastra.mjs') });
  }

  async buildServer() {
    upsertMastraDir();

    const templatePath = join(this.dotMastraPath, 'hono.mjs');

    writeFileSync(
      templatePath,
      `
      import { createHonoServer } from './server.mjs';
      import { mastra } from './mastra.mjs';

      export const app = await createHonoServer(mastra, { playground: false });
    `,
    );
  }

  async writeServerFile() {
    const fileServerPath = await import.meta.resolve('@mastra/deployer/server');
    const serverPath = fileURLToPath(fileServerPath);
    copyFileSync(serverPath, join(this.dotMastraPath, 'server.mjs'));
  }

  async prepare({ dir }: { dir?: string }) {
    console.log('[Mastra Deploy] - Preparing .mastra directory');
    upsertMastraDir();
    const dirPath = dir || path.join(process.cwd(), 'src/mastra');
    this.writePackageJson();
    this.writeServerFile();
    await this.install();
    try {
      await this.build({ dir: dirPath, useBanner: true });
    } catch (e) {
      console.error('[Mastra Deploy] - Error building:', e);
    }

    console.log('BUILD SERVER');
    await this.buildServer();
  }
}
