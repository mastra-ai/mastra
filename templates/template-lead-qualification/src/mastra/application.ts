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
import { LocalOutputProvider } from './providers/output';
import type { OutputProvider } from './providers/output';
import { ReviewService } from './review/service';
import { createTool } from '@mastra/core/tools';
import { decisionInputSchema, decisionSchema } from './review/contracts';
import { reviewConfig, reviewConfigSchema } from './config/review';
import type { ReviewConfig } from './config/review';

export async function createApplicationRuntime(
  options: {
    runtime?: RuntimeConfig;
    config?: IntakeConfig;
    qualification?: QualificationConfig;
    evidence?: EvidenceProvider[];
    pages?: PageRetriever;
    output?: OutputProvider[];
    review?: ReviewConfig;
  } = {},
) {
  const runtime = options.runtime ?? runtimeConfig();
  const config = intakeConfigSchema.parse(options.config ?? intakeConfig);
  const qualificationSettings = qualificationConfigSchema.parse(options.qualification ?? qualificationConfig);
  const reviewSettings = reviewConfigSchema.parse(options.review ?? reviewConfig);
  const outputIds = options.output?.map(provider => provider.id) ?? ['local'];
  if (!outputIds.includes(config.source.destinationProviderId))
    throw new Error('Configured output provider is unavailable');
  const providers = evidenceProviders(options.evidence);
  for (const id of qualificationSettings.sources.providerIds)
    if (!providers.has(id)) throw new Error('Configured evidence provider is unavailable');
  const telemetry = createTelemetry();
  const storage = await LeadStorage.open(runtime, () => telemetry.observability.flush());

  const qualification = new QualificationService(storage.leadEvents.qualifications, providers, options.pages);
  const outputs = new Map(
    (options.output ?? [new LocalOutputProvider(storage.leadEvents.client)]).map(provider => [provider.id, provider]),
  );
  const reviews = new ReviewService(storage.leadEvents, outputs, reviewSettings);
  const intake = createReceiveLeadWorkflow(storage.leadEvents, config, qualification, reviews);
  const dispatcher = new LeadDispatcher(storage.leadEvents, intake, config, telemetry);
  const serverConfig = createServerConfig(runtime, config.limits);
  const mastraConfig: Config = {
    ...serverConfig,
    server: {
      ...serverConfig.server,
      apiRoutes: createLeadRoutes(storage.leadEvents, config, telemetry, qualificationSettings, reviews),
    },
    workflows: { leadIntake: intake.workflow },
    tools: {
      reviewLead: createTool({
        id: 'review-lead',
        description:
          'Record a local operator decision for a published current review packet. Identity is the authenticated local operator; uncertain approvals need a reasoned override.',
        inputSchema: decisionInputSchema,
        outputSchema: decisionSchema,
        execute: input => reviews.decide(input),
      }),
    },
    workers: [dispatcher],
    storage,
    logger: telemetry.logger,
    observability: telemetry.observability,
  };

  return { mastraConfig, storage, intake, telemetry, dispatcher, qualification, reviews };
}
