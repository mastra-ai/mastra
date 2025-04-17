import { writeFile } from 'fs/promises';
import { join } from 'path';

import { Deployer, createChildProcessLogger } from '@mastra/deployer';
import type { analyzeBundle } from '@mastra/deployer/analyze';
import virtual from '@rollup/plugin-virtual';
import { Cloudflare } from 'cloudflare';

interface CFRoute {
  pattern: string;
  zone_name: string;
  custom_domain?: boolean;
}

export class CloudflareDeployer extends Deployer {
  private cloudflare: Cloudflare | undefined;
  routes?: CFRoute[] = [];
  workerNamespace?: string;
  scope: string;
  env?: Record<string, any>;
  projectName?: string;

  constructor({
    scope,
    env,
    projectName = 'mastra',
    routes,
    workerNamespace,
    auth,
  }: {
    env?: Record<string, any>;
    scope: string;
    projectName?: string;
    routes?: CFRoute[];
    workerNamespace?: string;
    auth: {
      apiToken: string;
      apiEmail?: string;
    };
  }) {
    super({ name: 'CLOUDFLARE' });

    this.scope = scope;
    this.projectName = projectName;
    this.routes = routes;
    this.workerNamespace = workerNamespace;

    if (env) {
      this.env = env;
    }

    this.cloudflare = new Cloudflare(auth);
  }

  async writeFiles(outputDirectory: string): Promise<void> {
    const env = await this.loadEnvVars();
    const envsAsObject = Object.assign({}, Object.fromEntries(env.entries()), this.env);

    const cfWorkerName = this.projectName;

    const wranglerConfig: Record<string, any> = {
      name: cfWorkerName,
      main: './index.mjs',
      compatibility_date: '2025-04-01',
      compatibility_flags: ['nodejs_compat', 'nodejs_compat_populate_process_env'],
      observability: {
        logs: {
          enabled: true,
        },
      },
      vars: envsAsObject,
    };

    if (!this.workerNamespace && this.routes) {
      wranglerConfig.routes = this.routes;
    }

    await writeFile(join(outputDirectory, this.outputDir, 'wrangler.json'), JSON.stringify(wranglerConfig));
  }

  private getEntry(): string {
    return `
import '#polyfills';
import { mastra } from '#mastra';
import { createHonoServer } from '#server';

export default {
  fetch: async (request, env, context) => {
    const app = await createHonoServer(mastra)
    return app.fetch(request, env, context);
  }
}
`;
  }
  async prepare(outputDirectory: string): Promise<void> {
    await super.prepare(outputDirectory);
    await this.writeFiles(outputDirectory);
  }

  async getBundlerOptions(
    serverFile: string,
    mastraEntryFile: string,
    analyzedBundleInfo: Awaited<ReturnType<typeof analyzeBundle>>,
    toolsPaths: string[],
  ) {
    const inputOptions = await super.getBundlerOptions(serverFile, mastraEntryFile, analyzedBundleInfo, toolsPaths);

    if (Array.isArray(inputOptions.plugins)) {
      inputOptions.plugins = [
        virtual({
          '#polyfills': `
process.versions = process.versions || {};
process.versions.node = '${process.versions.node}';
      `,
        }),
        ...inputOptions.plugins,
      ];
    }

    return inputOptions;
  }

  async bundle(entryFile: string, outputDirectory: string, toolsPaths: string[]): Promise<void> {
    return this._bundle(this.getEntry(), entryFile, outputDirectory, toolsPaths);
  }

  async deploy(outputDirectory: string): Promise<void> {
    const cmd = this.workerNamespace
      ? `npm exec -- wrangler@latest deploy --dispatch-namespace ${this.workerNamespace}`
      : 'npm exec -- wrangler@latest deploy';

    const cpLogger = createChildProcessLogger({
      logger: this.logger,
      root: join(outputDirectory, this.outputDir),
    });

    await cpLogger({
      cmd,
      args: [],
      env: {
        CLOUDFLARE_API_TOKEN: this.cloudflare!.apiToken!,
        CLOUDFLARE_ACCOUNT_ID: this.scope,
        ...this.env,
        PATH: process.env.PATH!,
      },
    });
  }

  async tagWorker({
    workerName,
    namespace,
    tags,
    scope,
  }: {
    scope: string;
    workerName: string;
    namespace: string;
    tags: string[];
  }): Promise<void> {
    if (!this.cloudflare) {
      throw new Error('Cloudflare Deployer not initialized');
    }

    await this.cloudflare.workersForPlatforms.dispatch.namespaces.scripts.tags.update(namespace, workerName, {
      account_id: scope,
      body: tags,
    });
  }
}
