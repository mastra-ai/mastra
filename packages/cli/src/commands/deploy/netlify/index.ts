import { execa } from 'execa';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

import { DepsService } from '../../../services/service.deps.js';
import { Deployer } from '../deployer.js';
import { NETLIFY } from '../server.js';

export class NetlifyDeployer extends Deployer {
  name = 'Netlify';

  ensureNetlifyFolder() {
    if (!existsSync(join(this.dotMastraPath, 'netlify/functions'))) {
      mkdirSync(join(this.dotMastraPath, 'netlify/functions'), { recursive: true });
    }
  }

  async installCli() {
    console.log('Installing Netlify CLI...');
    const depsService = new DepsService();
    await depsService.installPackages(['netlify-cli -g']);
  }

  async writePkgJson() {
    writeFileSync(
      join(this.dotMastraPath, 'package.json'),
      JSON.stringify(
        {
          name: 'server',
          version: '1.0.0',
          description: '',
          main: 'api.mjs',
          type: 'module',
          scripts: {
            start: 'node ./api.mjs',
          },
          author: '',
          license: 'ISC',
          dependencies: {
            '@mastra/core': '0.1.27-alpha.18',
            'serverless-http': 'latest',
            '@netlify/functions': 'latest',
            superjson: '^2.2.2',
            'zod-to-json-schema': '^3.24.1',
            express: '^4.21.1',
          },
        },
        null,
        2,
      ),
    );
  }

  writeFiles(): void {
    // TODO ENV KEYS
    writeFileSync(
      join(this.dotMastraPath, 'netlify.toml'),
      `
        [functions]
        external_node_modules = ["express", "serverless-http"]
        node_bundler = "esbuild"
        directory = "/"
        [[redirects]]
        force = true
        from = "/*"
        status = 200
        to = "/.netlify/functions/api/:splat"
        `,
    );

    writeFileSync(join(this.dotMastraPath, 'api.mjs'), NETLIFY);
  }

  async deployCommand({ scope, siteId }: { siteId: string; scope: string }): Promise<void> {
    console.log(scope, siteId);
    const p2 = execa('netlify', ['deploy', '--site', siteId, '--auth', this.token, '--dir', '.', '--functions', '.'], {
      cwd: this.dotMastraPath,
    });

    p2.stdout.pipe(process.stdout);
    await p2;
  }
}
