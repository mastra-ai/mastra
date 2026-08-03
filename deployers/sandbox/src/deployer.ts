import { access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Config } from '@mastra/core/mastra';
import type { WorkspaceSandbox } from '@mastra/core/workspace';
import { Deployer } from '@mastra/deployer';
import { copy } from 'fs-extra/esm';
import { updateEdgeConfigAlias } from './alias';
import { deployToSandbox } from './engine';
import { writeDeploymentManifest } from './manifest';
import { DEFAULT_PORT } from './shared';
import type { SandboxDeployerOptions } from './types';

/**
 * Deploy a full Mastra server into any workspace sandbox that supports
 * networking (Vercel Sandbox, E2B, ...) and get a live public URL.
 *
 * Positioning: ephemeral environments — instant previews, PR/CI smoke deploys,
 * agent-built-app verification. Not production hosting.
 *
 * @example
 * ```typescript
 * import { SandboxDeployer } from '@mastra/deployer-sandbox';
 * import { VercelSandbox } from '@mastra/vercel';
 *
 * export const mastra = new Mastra({
 *   deployer: new SandboxDeployer({
 *     sandbox: new VercelSandbox({ sandboxName: 'my-preview', timeout: 3_600_000, ports: [4111] }),
 *   }),
 * });
 * ```
 */
export class SandboxDeployer extends Deployer {
  /** Sandbox deploys are push-style: `mastra build` runs `deploy()` after bundling. */
  readonly deployOnBuild = true;
  readonly sandbox: WorkspaceSandbox;
  readonly port: number;
  readonly studio: boolean;
  /** Explicit remote dir, when configured. The engine defaults to `$HOME/mastra-app` inside the sandbox. */
  readonly remoteDir?: string;
  private readonly env: Record<string, string>;
  private readonly alias?: SandboxDeployerOptions['alias'];
  private readonly healthCheckTimeoutMs?: number;

  constructor(options: SandboxDeployerOptions) {
    super({ name: 'SANDBOX' });

    this.sandbox = options.sandbox;
    this.port = options.port ?? DEFAULT_PORT;
    this.studio = options.studio ?? true;
    this.remoteDir = options.remoteDir;
    this.env = options.env ?? {};
    this.alias = options.alias;
    this.healthCheckTimeoutMs = options.healthCheckTimeoutMs;
  }

  /**
   * Merge all existing env files instead of only the first one (base behavior).
   * Later files win in `loadEnvVars()`, so order least → most specific: a
   * `.env.local` written by `vercel env pull` shouldn't shadow the `.env` that
   * holds the app's own keys.
   */
  override async getEnvFiles(): Promise<string[]> {
    const candidates = ['.env', '.env.production', '.env.local'];
    const existing: string[] = [];
    for (const file of candidates) {
      try {
        await access(file);
        existing.push(file);
      } catch {
        // skip missing files
      }
    }
    return existing;
  }

  protected async getUserBundlerOptions(
    mastraEntryFile: string,
    outputDirectory: string,
  ): Promise<NonNullable<Config['bundler']>> {
    const bundlerOptions = await super.getUserBundlerOptions(mastraEntryFile, outputDirectory);

    // Dependencies are installed inside the sandbox, so keep them external.
    return {
      ...bundlerOptions,
      externals: true,
    };
  }

  protected getEntry(): string {
    return `
    // @ts-expect-error
    import { scoreTracesWorkflow } from '@mastra/core/evals/scoreTraces';
    import { mastra } from '#mastra';
    import { createNodeServer, getToolExports } from '#server';
    import { tools } from '#tools';

    // @ts-expect-error
    await createNodeServer(mastra, { tools: getToolExports(tools), studio: ${this.studio} });

    const storage = mastra.getStorage();
    if (storage) {
      if (!storage.disableInit) {
        storage.init();
      }
      mastra.__registerInternalWorkflow(scoreTracesWorkflow);
    }
    `;
  }

  async prepare(outputDirectory: string): Promise<void> {
    await super.prepare(outputDirectory);

    if (this.studio) {
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = dirname(__filename);

      const studioSource = join(dirname(__dirname), 'dist', 'studio');
      const studioServePath = join(outputDirectory, this.outputDir, 'studio');

      try {
        await copy(studioSource, studioServePath, { overwrite: true });
      } catch (err) {
        throw new Error(
          `Failed to copy studio assets from "${studioSource}" to "${studioServePath}": ${err instanceof Error ? err.message : err}`,
        );
      }
    }
  }

  async bundle(
    entryFile: string,
    outputDirectory: string,
    { toolsPaths, projectRoot }: { toolsPaths: (string | string[])[]; projectRoot: string },
  ): Promise<void> {
    return this._bundle(this.getEntry(), entryFile, { outputDirectory, projectRoot }, toolsPaths);
  }

  /**
   * Deploy the built output into the sandbox and wait for the server to come
   * up on its public URL. Writes `sandbox-deployment.json` into the output
   * directory and updates the Edge Config alias when configured.
   */
  async deploy(outputDirectory: string): Promise<void> {
    const dir = join(outputDirectory, this.outputDir);

    // Merge .env file vars under explicitly configured env.
    const envVars = await this.loadEnvVars();
    const env: Record<string, string> = { ...Object.fromEntries(envVars), ...this.env };
    if (envVars.size > 0) {
      this.logger.warn(
        'Environment variables from your .env file are injected into the remote sandbox. ' +
          'Anyone with access to the sandbox can read them.',
      );
    }

    const deployment = await deployToSandbox({
      sandbox: this.sandbox,
      dir,
      port: this.port,
      env,
      studio: this.studio,
      remoteDir: this.remoteDir,
      healthCheckTimeoutMs: this.healthCheckTimeoutMs,
      logger: this.logger,
    });

    await writeDeploymentManifest(dir, {
      provider: this.sandbox.provider,
      sandboxId: deployment.sandboxId,
      url: deployment.url,
      port: this.port,
      deployedAt: new Date().toISOString(),
      expiresAt: deployment.expiresAt?.toISOString(),
    });

    if (this.alias) {
      await updateEdgeConfigAlias({ ...this.alias, url: deployment.url });
      this.logger.info(`Edge Config alias "${this.alias.key}" now points at ${deployment.url}`);
    }

    this.logger.info(`Mastra server deployed: ${deployment.url}/api`);
    if (this.studio) {
      this.logger.info(`Studio: ${deployment.url}`);
    }
    if (deployment.expiresAt) {
      this.logger.warn(`Sandbox expires at ${deployment.expiresAt.toISOString()} (provider runtime cap).`);
    }
  }
}
