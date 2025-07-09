import { writeFileSync } from 'fs';
import { join } from 'path';
import process from 'process';
import { Deployer } from '@mastra/deployer';
import { move } from 'fs-extra/esm';

export class VercelDeployer extends Deployer {
  constructor() {
    super({ name: 'VERCEL' });
    this.outputDir = join('.vercel', 'output', 'functions', 'index.func');
  }

  async prepare(outputDirectory: string): Promise<void> {
    await super.prepare(outputDirectory);

    this.writeVercelJSON(join(outputDirectory, this.outputDir, '..', '..'));
  }

  private getEntry(): string {
    return `
import { handle } from 'hono/vercel'
import { mastra } from '#mastra';
import { createHonoServer } from '#server';

const app = await createHonoServer(mastra);

export const GET = handle(app);
export const POST = handle(app);
export const PUT = handle(app);
export const DELETE = handle(app);
export const OPTIONS = handle(app);
export const HEAD = handle(app);
`;
  }

  private writeVercelJSON(outputDirectory: string) {
    writeFileSync(
      join(outputDirectory, 'config.json'),
      JSON.stringify({
        version: 3,
        routes: [
          {
            src: '/(.*)',
            dest: '/',
          },
        ],
      }),
    );
  }

  async bundle(entryFile: string, outputDirectory: string, toolsPaths: string[]): Promise<void> {
    const result = await this._bundle(
      this.getEntry(),
      entryFile,
      outputDirectory,
      toolsPaths,
      join(outputDirectory, this.outputDir),
    );

    const nodeVersion = process.version?.split('.')?.[0]?.replace('v', '') ?? '22';
    writeFileSync(
      join(outputDirectory, this.outputDir, '.vc-config.json'),
      JSON.stringify(
        {
          handler: 'index.mjs',
          launcherType: 'Nodejs',
          runtime: `nodejs${nodeVersion}.x`,
          shouldAddHelpers: true,
        },
        null,
        2,
      ),
    );

    await move(join(outputDirectory, '.vercel', 'output'), join(process.cwd(), '.vercel', 'output'), {
      overwrite: true,
    });

    return result;
  }

  async deploy(): Promise<void> {
    this.logger?.info('Deploying to Vercel is deprecated. Please use the Vercel dashboard to deploy.');
  }

  async lint(entryFile: string, outputDirectory: string, toolsPaths: string[]): Promise<void> {
    await super.lint(entryFile, outputDirectory, toolsPaths);

    const hasLibsql = (await this.deps.checkDependencies(['@mastra/libsql'])) === `ok`;

    if (hasLibsql) {
      this.logger.error(
        `Vercel Deployer does not support @libsql/client(which may have been installed by @mastra/libsql) as a dependency. 
        Use other Mastra Storage options instead e.g @mastra/pg`,
      );
      process.exit(1);
    }
  }
}
