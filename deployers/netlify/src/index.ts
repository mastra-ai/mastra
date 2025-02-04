import { Deployer } from '@mastra/deployer';
import { getBundler } from '@mastra/deployer/build';
import virtual from '@rollup/plugin-virtual';
import { execa } from 'execa';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

import { getOrCreateSite } from './helpers.js';

export class NetlifyDeployer extends Deployer {
  protected scope: string;
  protected projectName: string;
  protected token: string;

  constructor({ scope, projectName, token }: { scope: string; projectName: string; token: string }) {
    super({ name: 'NETLIFY' });

    this.scope = scope;
    this.projectName = projectName;
    this.token = token;
  }

  writeFiles({ dir }: { dir: string }): void {
    if (!existsSync(join(dir, 'netlify/functions/api'))) {
      mkdirSync(join(dir, 'netlify/functions/api'), { recursive: true });
    }

    // TODO ENV KEYS
    writeFileSync(
      join(dir, 'netlify.toml'),
      `[functions]
node_bundler = "esbuild"            
directory = "netlify/functions"

[[redirects]]
force = true
from = "/*"
status = 200
to = "/.netlify/functions/api/:splat"
`,
    );
  }

  async deploy(outputDirectory: string): Promise<void> {
    const site = await getOrCreateSite({ token: this.token, name: this.projectName || `mastra`, scope: this.scope });

    const p2 = execa(
      'npx',
      [
        'netlify-cli',
        'deploy',
        '--site',
        site.id,
        '--auth',
        this.token,
        '--dir',
        '.',
        '--functions',
        './netlify/functions',
      ],
      {
        cwd: outputDirectory,
      },
    );

    p2.stdout.pipe(process.stdout);
    await p2;
  }

  async prepare(outputDirectory: string): Promise<void> {
    await super.prepare(outputDirectory);

    // Prepare the deployment directory
    if (!existsSync(join(outputDirectory, 'netlify/functions/api'))) {
      mkdirSync(join(outputDirectory, 'netlify/functions/api'), { recursive: true });
    }
    this.writeFiles({ dir: outputDirectory });
  }

  async bundle(mastraDir: string, outputDirectory: string): Promise<void> {
    const bundler = await getBundler({
      input: '#entry',
      external: [/^@opentelemetry\//],
      plugins: [virtual({ '#entry': this.getEntry() })],
    });

    await bundler.write({
      inlineDynamicImports: true,
      file: join(outputDirectory, 'netlify', 'functions', 'api', 'index.mjs'),
      format: 'es',
    });
  }

  private getEntry(): string {
    return `
import { handle } from 'hono/netlify'
import { mastra } from '#mastra';
import { createHonoServer } from '#server';

const app = await createHonoServer(mastra);

export default handle(app)
`;
  }
}
