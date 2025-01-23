import { MastraDeployer } from '@mastra/core';
import { execa } from 'execa';
import { existsSync, mkdirSync, renameSync, writeFileSync } from 'fs';
import { join } from 'path';

import { getOrCreateSite } from './helpers.js';

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
