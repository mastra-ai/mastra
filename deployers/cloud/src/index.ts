import { fileURLToPath } from 'node:url';
import { join, dirname } from 'path';
import { Deployer } from '@mastra/deployer';
import { copy } from 'fs-extra';

import { getAuthEntrypoint } from './utils/auth.js';
import { MASTRA_DIRECTORY, BUILD_ID, PROJECT_ID, TEAM_ID } from './utils/constants.js';
import { installDeps } from './utils/deps.js';
import { getMastraEntryFile } from './utils/file.js';
import { successEntrypoint } from './utils/report.js';

export class CloudDeployer extends Deployer {
  constructor() {
    super({ name: 'cloud' });
  }

  async deploy(_outputDirectory: string): Promise<void> {}
  async writeInstrumentationFile(outputDirectory: string) {
    const instrumentationFile = join(outputDirectory, 'instrumentation.mjs');
    const __dirname = dirname(fileURLToPath(import.meta.url));

    await copy(join(__dirname, '../templates', 'instrumentation-template.js'), instrumentationFile);
  }
  writePackageJson(outputDirectory: string, dependencies: Map<string, string>) {
    dependencies.set('@mastra/loggers', '0.10.6');
    dependencies.set('@mastra/libsql', '0.13.1');
    dependencies.set('@mastra/cloud', '0.1.7');
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

    const defaultToolsPath = join(mastraDir, MASTRA_DIRECTORY, 'tools');

    await this._bundle(
      this.getEntry(),
      mastraEntryFile,
      {
        outputDirectory,
        projectRoot: mastraDir,
      },
      [defaultToolsPath],
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
import { evaluate } from '@mastra/core/eval';
import { AvailableHooks, registerHook } from '@mastra/core/hooks';
import { LibSQLStore, LibSQLVector } from '@mastra/libsql';

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

if (mastra?.storage) {
  mastra.storage.init()
}

if (process.env.MASTRA_STORAGE_URL && process.env.MASTRA_STORAGE_AUTH_TOKEN) {
  const { MastraStorage } = await import('@mastra/core/storage');
  logger.info('Using Mastra Cloud Storage: ' + process.env.MASTRA_STORAGE_URL)
  const storage = new LibSQLStore({
    url: process.env.MASTRA_STORAGE_URL,
    authToken: process.env.MASTRA_STORAGE_AUTH_TOKEN,
  })
  const vector = new LibSQLVector({
    connectionUrl: process.env.MASTRA_STORAGE_URL,
    authToken: process.env.MASTRA_STORAGE_AUTH_TOKEN,
  })

  await storage.init()
  mastra?.setStorage(storage)

  mastra?.memory?.setStorage(storage)
  mastra?.memory?.setVector(vector)

  registerHook(AvailableHooks.ON_GENERATION, ({ input, output, metric, runId, agentName, instructions }) => {
    evaluate({
      agentName,
      input,
      metric,
      output,
      runId,
      globalRunId: runId,
      instructions,
    });
  });
  registerHook(AvailableHooks.ON_EVALUATION, async traceObject => {
    if (mastra?.storage) {
      await mastra.storage.insert({
        tableName: MastraStorage.TABLE_EVALS,
        record: {
          input: traceObject.input,
          output: traceObject.output,
          result: JSON.stringify(traceObject.result),
          agent_name: traceObject.agentName,
          metric_name: traceObject.metricName,
          instructions: traceObject.instructions,
          test_info: null,
          global_run_id: traceObject.globalRunId,
          run_id: traceObject.runId,
          created_at: new Date().toISOString(),
        },
      });
    }
  });
}

${getAuthEntrypoint()}

await createNodeServer(mastra, { playground: false, swaggerUI: false, tools: getToolExports(tools) });

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
