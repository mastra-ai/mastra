import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { Bundler } from '@mastra/deployer/bundler';

export interface AdminBundlerOptions {
  /** Project ID for observability context */
  projectId: string;
  /** Deployment ID for observability context */
  deploymentId: string;
  /** Server/build ID for observability context */
  serverId: string;
  /** Path where observability files should be written */
  observabilityPath: string;
}

export class AdminBundler extends Bundler {
  private adminOptions: AdminBundlerOptions | null = null;

  constructor() {
    super('admin-bundler', 'BUNDLER');
  }

  /**
   * Returns an empty array since Admin builds use environment variables
   * from the runner configuration, not .env files.
   */
  getEnvFiles(): Promise<string[]> {
    return Promise.resolve([]);
  }

  /**
   * Standard bundle interface implementation.
   * Use bundleForAdmin() for admin-specific bundling with observability injection.
   */
  async bundle(
    entryFile: string,
    outputDirectory: string,
    { toolsPaths, projectRoot }: { toolsPaths: (string | string[])[]; projectRoot: string },
  ): Promise<void> {
    // If admin options are set via bundleForAdmin, use them
    if (this.adminOptions) {
      return this._bundle(this.getEntry(this.adminOptions), entryFile, { outputDirectory, projectRoot }, toolsPaths);
    }

    // Fallback to standard bundling without admin injection
    return this._bundle(this.getStandardEntry(), entryFile, { outputDirectory, projectRoot }, toolsPaths);
  }

  /**
   * Bundle a Mastra project with Admin-specific observability injection.
   *
   * This method finds the mastra entry file and tools automatically,
   * then bundles with FileExporter injection for span persistence.
   */
  async bundleForAdmin(mastraDir: string, outputDirectory: string, options: AdminBundlerOptions): Promise<void> {
    const mastraEntryFile = this.getMastraEntryFile(mastraDir);
    const mastraAppDir = this.getMastraAppDir(mastraDir);
    const discoveredTools = this.getAllToolPaths(mastraAppDir);

    await this.prepare(outputDirectory);
    await this._bundle(
      this.getEntry(options),
      mastraEntryFile,
      {
        outputDirectory,
        projectRoot: mastraDir,
      },
      discoveredTools,
    );
  }

  /**
   * Lint implementation - delegates to parent.
   */
  async lint(entryFile: string, outputDirectory: string, toolsPaths: (string | string[])[]): Promise<void> {
    await super.lint(entryFile, outputDirectory, toolsPaths);
  }

  private getMastraAppDir(mastraDir: string): string {
    const srcMastraPath = join(mastraDir, 'src', 'mastra');
    const mastraPath = join(mastraDir, 'mastra');

    if (existsSync(srcMastraPath)) return srcMastraPath;
    if (existsSync(mastraPath)) return mastraPath;

    throw new Error(
      `No Mastra directory found in ${mastraDir}.\n` +
        `Expected one of:\n` +
        `  - ${srcMastraPath}\n` +
        `  - ${mastraPath}`,
    );
  }

  private getMastraEntryFile(mastraDir: string): string {
    const possiblePaths = [
      join(mastraDir, 'src', 'mastra', 'index.ts'),
      join(mastraDir, 'src', 'mastra', 'index.js'),
      join(mastraDir, 'mastra', 'index.ts'),
      join(mastraDir, 'mastra', 'index.js'),
    ];

    for (const path of possiblePaths) {
      if (existsSync(path)) return path;
    }

    throw new Error(
      `No Mastra entry file found. Searched:\n` +
        possiblePaths.map(p => `  - ${p}`).join('\n') +
        `\n\nEnsure your project has a mastra/index.ts or src/mastra/index.ts file.`,
    );
  }

  /**
   * Generate standard entry without admin observability injection.
   */
  private getStandardEntry(): string {
    return `
import { createNodeServer, getToolExports } from '#server';
import { tools } from '#tools';
import { mastra } from '#mastra';

if (mastra.storage) {
  await mastra.storage.init();
}

await createNodeServer(mastra, {
  studio: false,
  swaggerUI: false,
  tools: getToolExports(tools),
});
`;
  }

  /**
   * Generate entry code with Admin observability injection.
   */
  private getEntry(options: AdminBundlerOptions): string {
    return `
import { createNodeServer, getToolExports } from '#server';
import { tools } from '#tools';
import { mastra } from '#mastra';

// ============================================================
// ADMIN OBSERVABILITY INJECTION
// ============================================================

const ADMIN_CONFIG = {
  projectId: '${options.projectId}',
  deploymentId: '${options.deploymentId}',
  serverId: '${options.serverId}',
  observabilityPath: '${options.observabilityPath}',
};

console.log('[Admin] Initializing observability:', {
  projectId: ADMIN_CONFIG.projectId,
  deploymentId: ADMIN_CONFIG.deploymentId,
  observabilityPath: ADMIN_CONFIG.observabilityPath,
});

// Inject FileExporter for span persistence
try {
  const { FileExporter } = await import('@mastra/observability');

  const fileExporter = new FileExporter({
    outputPath: ADMIN_CONFIG.observabilityPath,
    projectId: ADMIN_CONFIG.projectId,
    deploymentId: ADMIN_CONFIG.deploymentId,
    maxBatchSize: 50,
    maxBatchWaitMs: 3000,
  });

  // Get existing observability instance and add our exporter
  const existingInstance = mastra.observability?.getDefaultInstance?.();

  if (existingInstance && typeof existingInstance.addExporter === 'function') {
    existingInstance.addExporter(fileExporter);
    console.log('[Admin] Added FileExporter to existing observability');
  } else if (mastra.observability?.registerExporter) {
    // Alternative registration path
    mastra.observability.registerExporter('admin-file', fileExporter);
    console.log('[Admin] Registered FileExporter via observability entrypoint');
  } else {
    console.warn('[Admin] Could not inject FileExporter - no compatible observability instance');
  }

  // Handle graceful shutdown
  const shutdown = async () => {
    console.log('[Admin] Shutting down FileExporter...');
    await fileExporter.shutdown();
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

} catch (err) {
  console.error('[Admin] Failed to initialize FileExporter:', err);
  // Continue without file observability - don't crash server
}

// ============================================================
// STORAGE INITIALIZATION
// ============================================================

if (mastra.storage) {
  try {
    await mastra.storage.init();
    console.log('[Admin] Storage initialized');
  } catch (err) {
    console.error('[Admin] Storage initialization failed:', err);
  }
}

// ============================================================
// START SERVER
// ============================================================

console.log('[Admin] Starting server...');

await createNodeServer(mastra, {
  studio: false,
  swaggerUI: false,
  tools: getToolExports(tools),
});

console.log('[Admin] Server started successfully');
`;
  }
}
