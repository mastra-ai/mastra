import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { Deployer } from '@mastra/deployer';
import { injectStudioHtmlConfig } from '@mastra/deployer/build';
import { copy, move } from 'fs-extra/esm';
import type { VcConfig, VcConfigOverrides, VercelDeployerOptions } from './types';

export class VercelDeployer extends Deployer {
  private vcConfigOverrides: VcConfigOverrides = {};
  private studio: boolean;

  constructor(options: VercelDeployerOptions = {}) {
    super({ name: 'VERCEL' });
    this.outputDir = join('.vercel', 'output', 'functions', 'index.func');
    this.studio = options.studio ?? false;

    const { studio, ...overrides } = options;
    this.vcConfigOverrides = { ...overrides };
  }

  async prepare(outputDirectory: string): Promise<void> {
    await super.prepare(outputDirectory);

    this.writeVercelJSON(join(outputDirectory, this.outputDir, '..', '..'));

    if (this.studio) {
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = dirname(__filename);

      const studioSource = join(dirname(__dirname), 'dist', 'studio');
      const staticDir = join(outputDirectory, '.vercel', 'output', 'static');

      try {
        await copy(studioSource, staticDir, { overwrite: true });
      } catch (err) {
        throw new Error(
          `Failed to copy studio assets from "${studioSource}" to "${staticDir}": ${err instanceof Error ? err.message : err}`,
        );
      }

      this.injectStudioConfig(staticDir);
    }
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

  private injectStudioConfig(staticDir: string) {
    const indexPath = join(staticDir, 'index.html');
    let html = readFileSync(indexPath, 'utf-8');

    /**
     * Use window.location expressions so the SPA constructs the correct same-origin endpoint.
     * Port uses a ternary: window.location.port is '' for default ports (80/443), and the SPA falls back to 4111 for empty strings, so we return the default port explicitly instead.
     */
    html = injectStudioHtmlConfig(html, {
      host: `window.location.hostname`,
      port: `(window.location.port || (window.location.protocol === 'https:' ? '443' : '80'))`,
      protocol: `window.location.protocol.replace(':', '')`,
      apiPrefix: `'/api'`,
      basePath: '',
      hideCloudCta: `'true'`,
      cloudApiEndpoint: `''`,
      experimentalFeatures: `'false'`,
      telemetryDisabled: `''`,
      requestContextPresets: `''`,
    });

    writeFileSync(indexPath, html);
  }

  private writeVercelJSON(outputDirectory: string) {
    const routes = this.studio
      ? [
          { src: '/api/(.*)', dest: '/' },
          { src: '/health', dest: '/' },
          { handle: 'filesystem' as const },
          { src: '/(.*)', dest: '/index.html', check: true },
        ]
      : [{ src: '/(.*)', dest: '/' }];

    writeFileSync(join(outputDirectory, 'config.json'), JSON.stringify({ version: 3, routes }));
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
