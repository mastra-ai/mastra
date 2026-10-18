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
import { qualificationConfig, qualificationConfigSchema } from './config/qualification';
import type { QualificationConfig } from './config/qualification';
import { evidenceProviders } from './providers/evidence';
import type { EvidenceProvider } from './providers/evidence';
import { QualificationService } from './research/qualification';
import type { PageRetriever } from './research/page-retrieval';

export async function createApplicationRuntime(
  options: {
    runtime?: RuntimeConfig;
    config?: IntakeConfig;
    qualification?: QualificationConfig;
    evidence?: EvidenceProvider[];
    pages?: PageRetriever;
  } = {},
) {
  const runtime = options.runtime ?? runtimeConfig();
  const config = intakeConfigSchema.parse(options.config ?? intakeConfig);
  const qualificationSettings = qualificationConfigSchema.parse(options.qualification ?? qualificationConfig);
  const providers = evidenceProviders(options.evidence);
  for (const id of qualificationSettings.sources.providerIds)
    if (!providers.has(id)) throw new Error('Configured evidence provider is unavailable');
  const telemetry = createTelemetry();
  const storage = await LeadStorage.open(runtime, () => telemetry.observability.flush());

  const qualification = new QualificationService(storage.leadEvents.qualifications, providers, options.pages);
  const intake = createReceiveLeadWorkflow(storage.leadEvents, config, qualification);
  const dispatcher = new LeadDispatcher(storage.leadEvents, intake, config, telemetry);
  const serverConfig = createServerConfig(runtime, config.limits);
  const mastraConfig: Config = {
    ...serverConfig,
    server: {
      ...serverConfig.server,
      apiRoutes: createLeadRoutes(storage.leadEvents, config, telemetry, qualificationSettings),
    },
    workflows: { leadIntake: intake.workflow },
    workers: [dispatcher],
    storage,
    logger: telemetry.logger,
    observability: telemetry.observability,
  };

  return { mastraConfig, storage, intake, telemetry, dispatcher, qualification };
}
