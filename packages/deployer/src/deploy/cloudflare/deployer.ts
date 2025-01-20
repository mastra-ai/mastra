import { execa } from 'execa';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

import { Deployer } from '../base.js';

import { getWorkerConfig } from './config.js';

export class CloudflareDeployer extends Deployer {
  name = 'Cloudflare';

  async installCli() {
    if (process.env.SKIP_INSTALL_CLI === 'true') {
      console.log('Skipping Wrangler CLI installation...');
      return;
    }
    console.log('Installing Wrangler CLI...');
    await this.deps.installPackages(['wrangler -g']);
  }

  async build({ dir }: { dir: string; useBanner: boolean }) {
    super.build({ dir, useBanner: false });
  }

  async writePkgJson() {
    let projectPkg: any = {
      dependencies: {},
    };
    try {
      projectPkg = JSON.parse(readFileSync(join(this.dotMastraPath, '..', 'package.json'), 'utf-8'));
    } catch (_e) {
      // no-op
    }

    const mastraDeps = Object.entries(projectPkg.dependencies)
      .filter(([name]) => name.startsWith('@mastra'))
      .reduce((acc: any, [name, version]) => {
        acc[name] = version;
        return acc;
      }, {});

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
            ...mastraDeps,
            'itty-router': '5.0.18',
            superjson: '^2.2.2',
            'zod-to-json-schema': '^3.24.1',
          },
        },
        null,
        2,
      ),
    );
  }

  writeFiles(): void {
    const cfWorkerName = process.env.CF_WORKER_NAME ?? 'mastra';
    const cfRoute = process.env.CF_ROUTE_NAME;
    const cfZone = process.env.CF_ZONE_NAME;
    const envVars = this.getEnvVars();

    // TODO ENV KEYS
    writeFileSync(
      join(this.dotMastraPath, 'wrangler.toml'),
      getWorkerConfig({
        workerName: cfWorkerName,
        route: cfRoute,
        zone: cfZone,
        envVars,
      }),
    );

    // writeFileSync(join(this.dotMastraPath, 'index.mjs'), SERVER);
  }

  async deployCommand({ scope }: { scope: string }): Promise<void> {
    const envVars = this.getEnvVars();
    const p2 = execa('wrangler', ['deploy'], {
      cwd: this.dotMastraPath,
      env: {
        CLOUDFLARE_API_TOKEN: this.token,
        CLOUDFLARE_ACCOUNT_ID: scope,
        ...envVars,
      },
    });
    p2.stdout.pipe(process.stdout);
    await p2;
  }
}
