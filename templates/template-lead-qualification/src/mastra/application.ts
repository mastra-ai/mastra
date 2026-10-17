import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { Config, Mastra } from '@mastra/core/mastra';
import { SimpleAuth } from '@mastra/core/server';
import { MastraCompositeStore } from '@mastra/core/storage';
import { DuckDBStore } from '@mastra/duckdb';
import { LibSQLStore } from '@mastra/libsql';
import { intakeConfig, intakeConfigSchema, runtimeConfig } from './config/intake';
import type { IntakeConfig, RuntimeConfig } from './config/intake';
import { createDispatcher } from './dispatcher';
import { IntakeStore } from './persistence/intake';
import { intakeRoutes } from './routes/intake';
import { createTelemetry } from './telemetry';
import { createIntakeWorkflow } from './workflows/intake';

export async function createApplicationRuntime(
  options: {
    runtime?: RuntimeConfig;
    config?: IntakeConfig;
    startDispatcher?: boolean;
  } = {},
) {
  const runtime = options.runtime ?? runtimeConfig();
  const config = intakeConfigSchema.parse(options.config ?? intakeConfig);
  await mkdir(dirname(runtime.applicationPath), { recursive: true });
  await mkdir(dirname(runtime.observabilityPath), { recursive: true });
  const url = pathToFileURL(runtime.applicationPath).href;
  const store = new IntakeStore(url);
  const operational = new LibSQLStore({ id: 'lead-operations', url });
  const duckdb = new DuckDBStore({
    id: 'lead-observability',
    path: runtime.observabilityPath,
    memoryLimit: '512MB',
    threads: 2,
  });
  const storage = new MastraCompositeStore({
    id: 'lead-storage',
    default: operational,
    domains: { observability: duckdb.observability },
  });
  const telemetry = createTelemetry();
  const intake = createIntakeWorkflow(store, config);
  const auth =
    runtime.mode === 'production'
      ? new SimpleAuth({
          tokens: { [runtime.token!]: { id: 'lead-operator' } },
          headers: ['Authorization'],
          mapUserToResourceId: user => user.id,
        })
      : undefined;
  try {
    await store.init();
    await storage.init();
    await duckdb.init();
  } catch (error) {
    store.close();
    await operational.close();
    await duckdb.close();
    throw error;
  }
  const dispatcher = createDispatcher(store, intake, config, telemetry);
  const mastraConfig: Config = {
    workflows: { leadIntake: intake.workflow },
    storage,
    logger: telemetry.logger,
    observability: telemetry.observability,
    // Both auth surfaces must agree: Studio selects its auth by request header.
    studio: { auth },
    server: {
      host: runtime.host,
      port: 4111,
      auth,
      cors: false,
      bodySizeLimit: config.limits.maxBodyBytes,
      handleShutdownSignals: false,
      apiRoutes: intakeRoutes(store, config, telemetry, () => {
        if (options.startDispatcher !== false) dispatcher.start();
      }),
      build: { apiReqLogs: false },
      onError: () =>
        new Response(JSON.stringify({ error: 'request_failed' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }),
    },
  };
  let closing: Promise<void> | undefined;
  function close(mastra: Mastra) {
    closing ??= (async () => {
      await dispatcher.stop();
      try {
        await mastra.shutdown();
      } finally {
        store.close();
        await operational.close();
        await duckdb.close();
      }
    })();
    return closing;
  }
  return { mastraConfig, store, duckdb, intake, telemetry, dispatcher, close };
}
export type Application = Awaited<ReturnType<typeof createApplicationRuntime>>;
