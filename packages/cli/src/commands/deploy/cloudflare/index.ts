import { execa } from 'execa';
import { writeFileSync } from 'fs';
import { join } from 'path';

import getPackageManager from '../../../utils/getPackageManager.js';
import { Deployer } from '../deployer.js';

export class CloudflareDeployer extends Deployer {
  async installCli() {
    console.log('Installing Wrangler CLI...');
    const p = execa(getPackageManager(), ['install', 'wrangler', '-g']);
    p.stdout.pipe(process.stdout);
    await p;
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
        OPENAI_API_KEY = ""
        `,
    );
  }

  async deployCommand({ scope }: { scope: string }): Promise<void> {
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
