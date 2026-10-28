import { LibSQLStore } from '@mastra/libsql';
import { Memory } from '@mastra/memory';
import { resolve } from 'node:path';
import { createInsuranceProcessingModel } from './agents/insurance-processing-agent.js';
import { createPolicyCheckingAgent } from './agents/policy-checking-agent.js';
import { inputLimits, inputLimitsSchema } from './config/input-limits-config.js';
import { insuranceConfiguration, insuranceConfigurationSchema } from './config/insurance-config.js';
import { processingConfiguration } from './config/processing-config.js';
import { applicationConfigurationSchema } from './domain/case-contracts.js';
import { workingMemorySchema } from './processors/document-intake-processor.js';
import * as registrations from './provider-config.js';
import { createRegistry } from './providers/provider-registry.js';
import { createLocalServer, resolveControlledProviderEndpoint } from './runtime/local-server.js';
import { operation, privateFrameworkLogger } from './runtime/operation-logger.js';
import { ensurePrivateDirectory, projectRoot } from './runtime/storage-paths.js';
import { createCaseService } from './services/case-service.js';
import { createReconciliationService } from './services/reconciliation-service.js';
import { createReportService } from './services/report-service.js';
import { createReviewService } from './services/review-service.js';
import { CaseRepository } from './storage/case-repository.js';
import { FinalizationRepository } from './storage/finalization-repository.js';
import { ReconciliationRepository } from './storage/reconciliation-repository.js';
import { ReportRepository } from './storage/report-repository.js';
import { ReviewRepository } from './storage/review-repository.js';
import { createPolicyCheckingWorkflow } from './workflows/policy-checking-workflow.js';

/** Open private storage and assemble the local agent, providers, services, and review workflow. */
export async function createApplication() {
  operation({ stage: 'startup', outcome: 'started', costMicros: null });

  const { port, operatorId, dataDirectory } = applicationConfigurationSchema.parse({
    port: process.env.PORT,
    operatorId: process.env.POLICY_OPERATOR_ID,
    dataDirectory: process.env.POLICY_DATA_DIR,
  });
  const root = resolve(projectRoot(), dataDirectory);
  await ensurePrivateDirectory(root);

  const storage = new LibSQLStore({ id: 'insurance-history', url: `file:${resolve(root, 'history.db')}` });
  const memory = new Memory({
    storage,
    options: {
      lastMessages: 20,
      semanticRecall: false,
      generateTitle: false,
      workingMemory: { enabled: true, scope: 'thread', schema: workingMemorySchema, agentManaged: false },
    },
  });

  const caseRepository = new CaseRepository(root);
  await caseRepository.initialize();
  const reconciliationRepository = new ReconciliationRepository(caseRepository);
  await reconciliationRepository.initialize();
  // Deterministic tests may use a loopback model server; production uses the default provider.
  const controlledProviderEndpoint = resolveControlledProviderEndpoint();
  const processingModel = createInsuranceProcessingModel(reconciliationRepository, {
    endpoint: controlledProviderEndpoint,
  });
  const limits = inputLimitsSchema.parse(inputLimits);
  insuranceConfigurationSchema.parse(insuranceConfiguration);
  const reportRepository = new ReportRepository(reconciliationRepository);
  await reportRepository.initialize();
  const reviewRepository = new ReviewRepository(reportRepository);
  await reviewRepository.initialize();
  const finalizations = new FinalizationRepository(reviewRepository);
  await finalizations.initialize();

  const registry = createRegistry(registrations, registrations.providerDefaults);
  const reconciliation = createReconciliationService(
    reconciliationRepository,
    processingModel,
    processingConfiguration,
    insuranceConfiguration,
  );
  const review = createReviewService(
    reviewRepository,
    finalizations,
    registry.resolve('reportOutput', undefined, 'approved-output'),
    registry.resolve('correctionOutput', undefined, 'approved-output'),
  );
  const reports = createReportService(
    reportRepository,
    registry.resolve('draftOutput', undefined, 'immutable-draft'),
    review,
  );
  const caseService = createCaseService(
    caseRepository,
    registry.resolve('input', undefined, 'pdf-attachments'),
    limits,
    reconciliation.status,
    reports.status,
  );

  const comparison = createPolicyCheckingWorkflow(reconciliation, caseService, operatorId, reports);

  return {
    storage,
    agents: {
      policyCheckingAgent: createPolicyCheckingAgent(
        caseService,
        memory,
        operatorId,
        process.env.NODE_ENV === 'test' && process.env.POLICY_TEST_PROCESSING_ONLY === '1'
          ? undefined
          : controlledProviderEndpoint,
        comparison.runner,
        comparison.report,
        comparison.review,
      ),
    },
    workflows: { policyCheckingWorkflow: comparison.workflow },
    logger: privateFrameworkLogger,
    server: createLocalServer(port, limits, reportRepository, operatorId, finalizations),
  };
}
