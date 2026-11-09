import type { z } from 'zod';
import type { Config } from '@mastra/core/mastra';
import { inputProvider } from './config/input-providers';
import { outputProvider } from './config/output-providers';
import { intakeConfig, intakeConfigSchema } from './config/lead-ingestion';
import type { IntakeConfig } from './config/lead-ingestion';
import { qualificationConfig, qualificationConfigSchema } from './config/qualification';
import type { QualificationConfig } from './config/qualification';
import { reviewConfig, reviewConfigSchema } from './config/review';
import type { ReviewConfig } from './config/review';
import { runtimeConfig, runtimeSettingsSchema } from './config/runtime';
import type { RuntimeConfig } from './config/runtime';
import { createServerConfig } from './config/server';
import { LeadStorage } from './persistence/storage';
import { LeadIntake } from './intake';
import { evidenceProviders } from './config/evidence-providers';
import type { EvidenceProvider } from './providers/evidence';
import type { InputFactory } from './providers/input';
import type { OutputFactory } from './providers/output';
import type { PageRetriever } from './research/page-retrieval';
import { QualificationService } from './research/qualification';
import { ReviewService } from './review/service';
import { createLeadRoutes } from './routes/lead-event-routes';
import { createTelemetry } from './observability/telemetry';
import type { pricingSchema } from './observability/telemetry';
import { reviewLead } from './tools/review-lead';
import { LeadDispatcher } from './workers/lead-dispatcher';
import { createReceiveLeadWorkflow } from './workflows/receive-lead';

export interface ApplicationOptions {
  inputProvider?: InputFactory;
  outputProvider?: OutputFactory;
  runtime?: RuntimeConfig;
  telemetryPricing?: z.infer<typeof pricingSchema>;
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
  const createInput = options.inputProvider ?? inputProvider();
  const createOutput = options.outputProvider ?? outputProvider();
  const evidence = evidenceProviders(options.evidence);
  for (const id of qualificationSettings.sources.providerIds)
    if (!evidence.has(id)) throw new Error(`Unknown evidence provider: ${id}`);
  const telemetry = createTelemetry(options.telemetryPricing);
  let storage: LeadStorage | undefined;
  try {
    storage = await LeadStorage.open(runtime, () => telemetry.observability.flush());
    storage.leadEvents.qualifications.measurement = telemetry.research;
    const qualification = new QualificationService(
      storage.leadEvents.qualifications,
      evidence,
      options.pages,
      telemetry,
    );
    const output = createOutput(storage.leadEvents.client);
    const outputs = new Map([[output.id, output]]);
    const config = intakeConfigSchema.parse({
      ...(options.config ?? intakeConfig),
      source: { ...(options.config ?? intakeConfig).source, destinationProviderId: output.id },
    });
    const reviewService = new ReviewService(storage.leadEvents, outputs, reviewSettings, telemetry);
    const admission = new LeadIntake(storage.leadEvents, config, qualificationSettings);
    const input = await createInput({
      store: storage.leadEvents,
      reviews: reviewService,
      intake: admission,
      config,
      output,
    });
    config.source = intakeConfigSchema.shape.source.parse(input.source);
    if (config.source.inputProviderId !== input.id || config.source.destinationProviderId !== output.id)
      throw new Error('Input source does not match the configured providers');
    const intake = createReceiveLeadWorkflow(storage.leadEvents, config, qualification, reviewService);
    const dispatcher = new LeadDispatcher(storage.leadEvents, intake, config, telemetry, reviewService, input);
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
            input,
            admission,
            outputs,
            input.salesMapped,
          ),
          ...(input.routes ?? []),
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
      inputProvider: input,
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
