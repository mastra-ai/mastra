import type { Config } from '@mastra/core/mastra';
import type { IntakeConfig } from './config/lead-ingestion';
import type { QualificationConfig } from './config/qualification';
import { qualificationConfig, qualificationConfigSchema } from './config/qualification';
import type { ReviewConfig } from './config/review';
import { reviewConfig, reviewConfigSchema } from './config/review';
import type { RuntimeConfig } from './config/runtime';
import { runtimeConfig, runtimeSettingsSchema } from './config/runtime';
import { createServerConfig } from './config/server';
import { LeadStorage } from './persistence/storage';
import { initializeProviders } from './providers';
import type { ProviderOptions } from './providers';
import { LeadIntake } from './intake';
import type { EvidenceProvider } from './providers/evidence';
import type { PageRetriever } from './research/page-retrieval';
import { QualificationService } from './research/qualification';
import { ReviewService } from './review/service';
import { createLeadRoutes } from './routes/lead-event-routes';
import { createTelemetry } from './telemetry';
import { reviewLead } from './tools/review-lead';
import { LeadDispatcher } from './workers/lead-dispatcher';
import { createReceiveLeadWorkflow } from './workflows/receive-lead';

export interface ApplicationOptions extends ProviderOptions {
  runtime?: RuntimeConfig;
  config?: IntakeConfig;
  qualification?: QualificationConfig;
  evidence?: EvidenceProvider[];
  pages?: PageRetriever;
  review?: ReviewConfig;
}

export async function createApplicationRuntime(options: ApplicationOptions = {}) {
  const runtime = runtimeSettingsSchema.parse(options.runtime ?? runtimeConfig());
  const qualificationSettings = qualificationConfigSchema.parse(options.qualification ?? qualificationConfig);
  const reviewSettings = reviewConfigSchema.parse(options.review ?? reviewConfig);
  const providers = initializeProviders({ ...options, mode: runtime.mode, qualification: qualificationSettings });
  const config = providers.config;
  const telemetry = createTelemetry();
  let storage: LeadStorage | undefined;
  try {
    storage = await LeadStorage.open(runtime, () => telemetry.observability.flush());
    const qualification = new QualificationService(
      storage.leadEvents.qualifications,
      providers.evidence,
      options.pages,
    );
    const outputs = providers.createOutputs(storage.leadEvents.client);
    const reviewService = new ReviewService(storage.leadEvents, outputs, reviewSettings);
    const admission = new LeadIntake(storage.leadEvents, config, qualificationSettings);
    const inputs = await providers.createInputs({
      store: storage.leadEvents,
      reviews: reviewService,
      intake: admission,
      config,
    });
    const sources = [...inputs.values()].map(provider => provider.source);
    const intake = createReceiveLeadWorkflow(storage.leadEvents, config, qualification, reviewService, sources);
    const dispatcher = new LeadDispatcher(storage.leadEvents, intake, config, telemetry, reviewService, [
      ...inputs.values(),
    ]);

    const serverConfig = createServerConfig(runtime, config.limits);
    const mastraConfig: Config = {
      ...serverConfig,
      server: {
        ...serverConfig.server,
        apiRoutes: [
          ...createLeadRoutes(
            storage.leadEvents,
            config,
            telemetry,
            reviewService,
            inputs.get(config.source.inputProviderId)!,
            admission,
            outputs,
          ),
          ...[...inputs.values()].flatMap(provider => provider.routes ?? []),
        ],
      },
      workflows: { leadIntake: intake.workflow },
      tools: { reviewLead: reviewLead(reviewService) },
      workers: [dispatcher],
      storage,
      logger: telemetry.logger,
      observability: telemetry.observability,
    };

    return {
      mastraConfig,
      storage,
      intake,
      telemetry,
      dispatcher,
      qualification,
      reviews: reviewService,
      inputs,
      outputs,
    };
  } catch (error) {
    try {
      await storage?.close();
    } finally {
      await telemetry.observability.shutdown();
    }
    throw error;
  }
}
