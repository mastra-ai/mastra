import { Deployer } from '@mastra/deployer';
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

    // @ts-expect-error - seems to be fine
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
        cwd: join(outputDirectory, this.outputDir),
      },
    );

    p2.stdout.pipe(process.stdout);
    await p2;
  }

  async prepare(outputDirectory: string): Promise<void> {
    await super.prepare(outputDirectory);

    this.writeFiles({ dir: join(outputDirectory, this.outputDir) });
  }

  async bundle(entryFile: string, outputDirectory: string): Promise<void> {
    return this._bundle(
      this.getEntry(),
      entryFile,
      outputDirectory,
      join(outputDirectory, this.outputDir, 'netlify', 'functions', 'api'),
    );
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
