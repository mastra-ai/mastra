import { builtinModules } from 'node:module';
import { join } from 'node:path';
import process from 'node:process';
import { Deployer } from '@mastra/deployer';
import type { analyzeBundle } from '@mastra/deployer/analyze';
import type { BundlerOptions } from '@mastra/deployer/bundler';
import { DepsService } from '@mastra/deployer/services';
import { move, writeJson } from 'fs-extra/esm';

/**
 * Rollup plugin that adds the `node:` prefix to bare Node.js built-in imports.
 * Deno requires `node:events` instead of `events`, `node:fs` instead of `fs`, etc.
 */
function nodeBuiltinPrefix() {
  const builtins = new Set(builtinModules.filter(m => !m.startsWith('_')));
  return {
    name: 'node-builtin-prefix',
    resolveId(source: string) {
      const base = source.split('/')[0]!;
      if (builtins.has(base) && !source.startsWith('node:')) {
        return { id: `node:${source}`, external: true };
      }
      return null;
    },
  };
}

export interface NetlifyDeployerOptions {
  /**
   * Deploy target for Netlify.
   *
   * - `'serverless'` — Standard Netlify Functions (Node.js runtime, 10s default timeout).
   * - `'edge'` — Netlify Edge Functions (Deno-based runtime, no hard timeout, runs at the edge).
   *
   * @default 'serverless'
   */
  target?: 'serverless' | 'edge';
}

export class NetlifyDeployer extends Deployer {
  readonly target: 'serverless' | 'edge';

  constructor(options: NetlifyDeployerOptions = {}) {
    super({ name: 'NETLIFY' });

    this.target = options.target ?? 'serverless';

    this.outputDir =
      this.target === 'edge' ? join('.netlify', 'v1', 'edge-functions') : join('.netlify', 'v1', 'functions', 'api');
  }

  protected async installDependencies(outputDirectory: string, rootDir = process.cwd()) {
    const deps = new DepsService(rootDir);
    deps.__setLogger(this.logger);

    if (this.target === 'edge') {
      // Edge functions run on Deno — no platform-specific architecture constraints
      await deps.install({ dir: join(outputDirectory, this.outputDir) });
    } else {
      await deps.install({
        dir: join(outputDirectory, this.outputDir),
        architecture: {
          os: ['linux'],
          cpu: ['x64'],
          libc: ['gnu'],
        },
      });
    }
  }

  async deploy(): Promise<void> {
    this.logger?.info('Deploying to Netlify failed. Please use the Netlify dashboard to deploy.');
  }

  async prepare(outputDirectory: string): Promise<void> {
    await super.prepare(outputDirectory);
  }

  protected async getBundlerOptions(
    serverFile: string,
    mastraEntryFile: string,
    analyzedBundleInfo: Awaited<ReturnType<typeof analyzeBundle>>,
    toolsPaths: (string | string[])[],
    bundlerOptions: BundlerOptions,
  ) {
    const inputOptions = await super.getBundlerOptions(serverFile, mastraEntryFile, analyzedBundleInfo, toolsPaths, {
      ...bundlerOptions,
      enableEsmShim: this.target !== 'edge',
    });

    if (this.target === 'edge' && Array.isArray(inputOptions.plugins)) {
      // Add node: prefix plugin at the start so it runs before subpathExternalsResolver
      inputOptions.plugins.unshift(nodeBuiltinPrefix());
    }

    return inputOptions;
  }

  async bundle(
    entryFile: string,
    outputDirectory: string,
    { toolsPaths, projectRoot }: { toolsPaths: (string | string[])[]; projectRoot: string },
  ): Promise<void> {
    const result = await this._bundle(
      this.getEntry(),
      entryFile,
      { outputDirectory, projectRoot, enableEsmShim: this.target !== 'edge' },
      toolsPaths,
      join(outputDirectory, this.outputDir),
    );

    // Use Netlify Frameworks API config.json
    // https://docs.netlify.com/build/frameworks/frameworks-api/
    if (this.target === 'edge') {
      await writeJson(join(outputDirectory, '.netlify', 'v1', 'config.json'), {
        edge_functions: [
          {
            function: 'index',
            path: '/*',
          },
        ],
      });
    } else {
      await writeJson(join(outputDirectory, '.netlify', 'v1', 'config.json'), {
        functions: {
          directory: '.netlify/v1/functions',
          node_bundler: 'none', // Mastra pre-bundles, don't re-bundle
          included_files: ['.netlify/v1/functions/**'],
        },
        redirects: [
          {
            force: true,
            from: '/*',
            to: '/.netlify/functions/api/:splat',
            status: 200,
          },
        ],
      });
    }

    await move(join(outputDirectory, '.netlify', 'v1'), join(process.cwd(), '.netlify', 'v1'), {
      overwrite: true,
    });

    return result;
  }

  private getEntry(): string {
    return `
    import { handle } from 'hono/netlify'
    import { mastra } from '#mastra';
    import { createHonoServer, getToolExports } from '#server';
    import { tools } from '#tools';
    import { scoreTracesWorkflow } from '@mastra/core/evals/scoreTraces';

    if (mastra.getStorage()) {
      mastra.__registerInternalWorkflow(scoreTracesWorkflow);
    }

    const app = await createHonoServer(mastra, { tools: getToolExports(tools) });

    export default handle(app)
`;
  }

  async lint(entryFile: string, outputDirectory: string, toolsPaths: (string | string[])[]): Promise<void> {
    await super.lint(entryFile, outputDirectory, toolsPaths);

    // LibSQL uses native Node.js bindings — incompatible with both serverless and edge environments
    const hasLibsql = (await this.deps.checkDependencies(['@mastra/libsql'])) === `ok`;

    if (hasLibsql) {
      this.logger?.error(
        `Netlify Deployer does not support @libsql/client (which may have been installed by @mastra/libsql) as a dependency.
        LibSQL with file URLs uses native Node.js bindings that cannot run in ${this.target} environments. Use other Mastra Storage options instead.`,
      );
      process.exit(1);
    }
  }
}
