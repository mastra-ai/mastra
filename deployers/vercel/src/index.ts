import { writeFileSync } from 'fs';
import { join } from 'path';
import process from 'process';
import { Deployer } from '@mastra/deployer';
import { move } from 'fs-extra/esm';
import type { VcConfig, VcConfigOverrides, VercelDeployerOptions } from './types';

export class VercelDeployer extends Deployer {
  private vcConfigOverrides: VcConfigOverrides = {};

  constructor(options: VercelDeployerOptions = {}) {
    super({ name: 'VERCEL' });
    this.outputDir = join('.vercel', 'output', 'functions', 'index.func');

    // Store all overrides centrally
    this.vcConfigOverrides = { ...options };
  }

  async prepare(outputDirectory: string): Promise<void> {
    await super.prepare(outputDirectory);

    this.writeVercelJSON(join(outputDirectory, this.outputDir, '..', '..'));
  }

  private getEntry(): string {
    return `
import { handle } from 'hono/vercel'
import { mastra } from '#mastra';
import { createHonoServer, getToolExports } from '#server';
import { tools } from '#tools';
import { scoreTracesWorkflow } from '@mastra/core/evals/scoreTraces';

if (mastra.getStorage()) {
  mastra.__registerInternalWorkflow(scoreTracesWorkflow);
}

const app = await createHonoServer(mastra, { tools: getToolExports(tools) });

export const GET = handle(app);
export const POST = handle(app);
export const PUT = handle(app);
export const DELETE = handle(app);
export const PATCH = handle(app);
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

  async bundle(
    entryFile: string,
    outputDirectory: string,
    { toolsPaths, projectRoot }: { toolsPaths: (string | string[])[]; projectRoot: string },
  ): Promise<void> {
    const result = await this._bundle(
      this.getEntry(),
      entryFile,
      { outputDirectory, projectRoot },
      toolsPaths,
      join(outputDirectory, this.outputDir),
    );

    const nodeVersion = process.version?.split('.')?.[0]?.replace('v', '') ?? '22';

    const vcConfig: VcConfig = {
      handler: 'index.mjs',
      launcherType: 'Nodejs',
      runtime: `nodejs${nodeVersion}.x`,
      shouldAddHelpers: true,
    };

    // Merge supported overrides
    const { maxDuration, memory, regions } = this.vcConfigOverrides;
    if (typeof maxDuration === 'number') vcConfig.maxDuration = maxDuration;
    if (typeof memory === 'number') vcConfig.memory = memory;
    if (Array.isArray(regions) && regions.length > 0) vcConfig.regions = regions;

    writeFileSync(join(outputDirectory, this.outputDir, '.vc-config.json'), JSON.stringify(vcConfig, null, 2));

    await move(join(outputDirectory, '.vercel', 'output'), join(process.cwd(), '.vercel', 'output'), {
      overwrite: true,
    });

    return result;
  }

  async deploy(): Promise<void> {
    this.logger?.info('Deploying to Vercel is deprecated. Please use the Vercel dashboard to deploy.');
  }

  async lint(entryFile: string, outputDirectory: string, toolsPaths: (string | string[])[]): Promise<void> {
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
