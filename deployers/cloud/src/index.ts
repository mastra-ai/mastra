import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Config } from '@mastra/core/mastra';
import { Deployer } from '@mastra/deployer';
import { copy, readJSON } from 'fs-extra/esm';

import { getAuthEntrypoint } from './utils/auth.js';
import { MASTRA_DIRECTORY, BUILD_ID, PROJECT_ID, TEAM_ID } from './utils/constants.js';
import { installDeps } from './utils/deps.js';
import { getMastraEntryFile } from './utils/file.js';
import { successEntrypoint } from './utils/report.js';

export class CloudDeployer extends Deployer {
  private studio: boolean;

  constructor({ studio }: { studio?: boolean } = {}) {
    super({ name: 'cloud' });
    this.studio = studio ?? false;
  }

  protected async getUserBundlerOptions(
    mastraEntryFile: string,
    outputDirectory: string,
  ): Promise<NonNullable<Config['bundler']>> {
    const bundlerOptions = await super.getUserBundlerOptions(mastraEntryFile, outputDirectory);

    // Always force externals: true for cloud deployments.
    // The cloud deployer installs all dependencies from npm into node_modules,
    // so bundling them inline serves no purpose. Bundling inline can also cause
    // circular module evaluation deadlocks when dynamic imports (e.g. in
    // MemoryLibSQL.init()) reference chunks that depend back on the entry module,
    // resulting in "Detected unsettled top-level await" warnings.
    return {
      ...bundlerOptions,
      externals: true,
    };
  }

  async deploy(_outputDirectory: string): Promise<void> {}

  async prepare(outputDirectory: string): Promise<void> {
    await super.prepare(outputDirectory);

    if (this.studio) {
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = dirname(__filename);

      const studioServePath = join(outputDirectory, this.outputDir, 'studio');
      await copy(join(dirname(__dirname), join('dist', 'studio')), studioServePath, {
        overwrite: true,
      });
    }
  }
  async writePackageJson(outputDirectory: string, dependencies: Map<string, string>) {
    const versions = (await readJSON(join(dirname(fileURLToPath(import.meta.url)), '../versions.json'))) as
      | Record<string, string>
      | undefined;
    for (const [pkgName, version] of Object.entries(versions || {})) {
      dependencies.set(pkgName, version);
    }

    return super.writePackageJson(outputDirectory, dependencies);
  }

  async lint() {}

  protected async installDependencies(outputDirectory: string, _rootDir = process.cwd()) {
    await installDeps({ path: join(outputDirectory, 'output'), pm: 'npm' });
  }

  async bundle(mastraDir: string, outputDirectory: string): Promise<void> {
    const currentCwd = process.cwd();
    process.chdir(mastraDir);

    const mastraEntryFile = getMastraEntryFile(mastraDir);

    const mastraAppDir = join(mastraDir, MASTRA_DIRECTORY);

    // Use the getAllToolPaths method to prepare tools paths
    const discoveredTools = this.getAllToolPaths(mastraAppDir);

    await this.prepare(outputDirectory);
    await this._bundle(
      this.getEntry(),
      mastraEntryFile,
      {
        outputDirectory,
        projectRoot: mastraDir,
      },
      discoveredTools,
    );
    process.chdir(currentCwd);
  }

  getAuthEntrypoint() {
    return getAuthEntrypoint();
  }

  private getEntry(): string {
    return `
import { createNodeServer, getToolExports } from '#server';
import { tools } from '#tools';
import { mastra } from '#mastra';
import { MultiLogger } from '@mastra/core/logger';
import { PinoLogger } from '@mastra/loggers';
import { HttpTransport } from '@mastra/loggers/http';
import { LibSQLStore, LibSQLVector } from '@mastra/libsql';
import { scoreTracesWorkflow } from '@mastra/core/evals/scoreTraces';
const startTime = process.env.RUNNER_START_TIME ? new Date(process.env.RUNNER_START_TIME).getTime() : Date.now();
const createNodeServerStartTime = Date.now();

console.log(JSON.stringify({
  message: "Server starting",
  operation: 'builder.createNodeServer',
  operation_startTime: createNodeServerStartTime,
  type: "READINESS",
  startTime,
  metadata: {
    teamId: "${TEAM_ID}",
    projectId: "${PROJECT_ID}",
    buildId: "${BUILD_ID}",
  },
}));

const transports = {}
if (process.env.CI !== 'true') {
  if (process.env.BUSINESS_API_RUNNER_LOGS_ENDPOINT) {
    transports.default = new HttpTransport({
      url: process.env.BUSINESS_API_RUNNER_LOGS_ENDPOINT,
      headers: {
        Authorization: 'Bearer ' + process.env.BUSINESS_JWT_TOKEN,
      },
    });
  }
}

const logger = new PinoLogger({
  name: 'MastraCloud',
  transports,
  level: 'debug',
});
const existingLogger = mastra?.getLogger();
const combinedLogger = existingLogger ? new MultiLogger([logger, existingLogger]) : logger;

mastra.setLogger({ logger: combinedLogger });

if (process.env.MASTRA_STORAGE_URL && process.env.MASTRA_STORAGE_AUTH_TOKEN) {
  const { MastraStorage } = await import('@mastra/core/storage');
  logger.info('Using Mastra Cloud Storage: ' + process.env.MASTRA_STORAGE_URL)
  const storage = new LibSQLStore({
    id: 'mastra-cloud-storage-libsql',
    url: process.env.MASTRA_STORAGE_URL,
    authToken: process.env.MASTRA_STORAGE_AUTH_TOKEN,
  })
  const vector = new LibSQLVector({
    id: 'mastra-cloud-storage-libsql-vector',
    url: process.env.MASTRA_STORAGE_URL,
    authToken: process.env.MASTRA_STORAGE_AUTH_TOKEN,
  })

  await storage.init()
  mastra?.setStorage(storage)
} else {
  const userStorage = mastra?.getStorage();
  if (userStorage && !userStorage.disableInit) {
    userStorage.init();
  }
}

if (mastra?.getStorage()) {
  mastra.__registerInternalWorkflow(scoreTracesWorkflow);
}

${getAuthEntrypoint()}

await createNodeServer(mastra, { studio: ${this.studio}, swaggerUI: false, tools: getToolExports(tools) });

${successEntrypoint()}

console.log(JSON.stringify({
  message: "Server started",
  operation: 'builder.createNodeServer',
  operation_startTime: createNodeServerStartTime,
  operation_durationMs: Date.now() - createNodeServerStartTime,
  type: "READINESS",
  startTime,
  metadata: {
    teamId: "${TEAM_ID}",
    projectId: "${PROJECT_ID}",
    buildId: "${BUILD_ID}",
  },
}));


console.log(JSON.stringify({
  message: "Runner Initialized",
  type: "READINESS",
  startTime,
  durationMs: Date.now() - startTime,
  metadata: {
    teamId: "${TEAM_ID}",
    projectId: "${PROJECT_ID}",
    buildId: "${BUILD_ID}",
  },
}));
`;
  }
}
