import type { Config } from '@mastra/core/mastra';
import { intakeConfig, intakeConfigSchema } from './config/lead-ingestion';
import type { IntakeConfig } from './config/lead-ingestion';
import { runtimeConfig } from './config/runtime';
import type { RuntimeConfig } from './config/runtime';
import { createServerConfig } from './config/server';
import { LeadStorage } from './persistence/storage';
import { createLeadRoutes } from './routes/lead-event-routes';
import { createTelemetry } from './telemetry';
import { LeadDispatcher } from './workers/lead-dispatcher';
import { createReceiveLeadWorkflow } from './workflows/receive-lead';

export async function createApplicationRuntime(options: { runtime?: RuntimeConfig; config?: IntakeConfig } = {}) {
  const runtime = options.runtime ?? runtimeConfig();
  const config = intakeConfigSchema.parse(options.config ?? intakeConfig);
  const telemetry = createTelemetry();
  const storage = await LeadStorage.open(runtime, () => telemetry.observability.flush());

  const intake = createReceiveLeadWorkflow(storage.leadEvents, config);
  const dispatcher = new LeadDispatcher(storage.leadEvents, intake, config, telemetry);
  const serverConfig = createServerConfig(runtime, config.limits);
  const mastraConfig: Config = {
    ...serverConfig,
    server: { ...serverConfig.server, apiRoutes: createLeadRoutes(storage.leadEvents, config, telemetry) },
    workflows: { leadIntake: intake.workflow },
    workers: [dispatcher],
    storage,
    logger: telemetry.logger,
    observability: telemetry.observability,
  };

  return { mastraConfig, storage, intake, telemetry, dispatcher };
}
