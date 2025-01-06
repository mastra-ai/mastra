import { execa } from 'execa';
import { writeFileSync } from 'fs';
import { join } from 'path';

import { DepsService } from '../../../services/service.deps.js';
import { Deployer } from '../deployer.js';
import { WORKER } from '../server.js';

export class CloudflareDeployer extends Deployer {
  name = 'Cloudflare';

  async installCli() {
    console.log('Installing Wrangler CLI...');
    const depsService = new DepsService();
    await depsService.installPackages(['wrangler -g']);
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
            '@mastra/core': '0.1.27-alpha.18',
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
    const envVars = this.getEnvVars();

    // TODO ENV KEYS
    writeFileSync(
      join(this.dotMastraPath, 'wrangler.toml'),
      `
        name = "mastra"
        main = "index.mjs"  # Your main worker file
        compatibility_date = "2024-12-02"
        compatibility_flags = ["nodejs_compat"]
        
        [build]
        command = "npm install" 
        
        [[build.upload]]
        type = "javascript_module"
        main = "mastra.mjs"
        
        [observability.logs]
        enabled = true
        
        [vars]
        ${Object.entries(envVars || {})
          ?.map(([key, value]) => `${key} = "${value}"`)
          .join('\n')}
        `,
    ),
      writeFileSync(join(this.dotMastraPath, 'index.mjs'), WORKER);
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
