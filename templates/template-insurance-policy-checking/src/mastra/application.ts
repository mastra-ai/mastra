import { operation, privateFrameworkLogger } from './runtime/operations.js';
import { ReviewRepository } from './storage/reviews.js';
import { FinalizationRepository } from './storage/finalizations.js';
import { createReviewService } from './services/review-service.js';
import { ReportRepository } from './storage/reports.js';
import { createReportService } from './services/report-service.js';
import { resolve } from 'node:path';
import { LibSQLStore } from '@mastra/libsql';
import { Memory } from '@mastra/memory';
import * as registrations from './providers.js';
import { inputLimits, inputLimitsSchema } from './config/limits.js';
import { insuranceConfiguration, insuranceConfigurationSchema } from './config/insurance.js';
import { createRegistry } from './providers/provider-registry.js';
import { CaseRepository } from './storage/cases.js';
import { createCaseService } from './services/case-service.js';
import { createPolicyCheckingAgent } from './agents/policy-checking.js';
import { createLocalServer, resolveControlledProviderEndpoint } from './runtime/server.js';
import { workingMemorySchema } from './processors/document-intake-processor.js';
import { applicationConfigurationSchema } from './domain/contracts.js';
import { projectRoot, ensurePrivateDirectory } from './runtime/paths.js';
import { processingConfiguration } from './config/processing.js';
import { ReconciliationRepository } from './storage/reconciliation.js';
import { createInsuranceProcessingModel } from './agents/insurance-processing.js';
import { createReconciliationService } from './services/reconciliation-service.js';
import { createPolicyCheckingWorkflow } from './workflows/policy-checking.js';

export async function createApplication() {
  operation({ stage: 'startup', outcome: 'started', costMicros: null });
  const limits = inputLimitsSchema.parse(inputLimits);
  insuranceConfigurationSchema.parse(insuranceConfiguration);
  const { port, operatorId, dataDirectory } = applicationConfigurationSchema.parse({
    port: process.env.PORT,
    operatorId: process.env.POLICY_OPERATOR_ID,
    dataDirectory: process.env.POLICY_DATA_DIR,
  });
  const testEndpoint = resolveControlledProviderEndpoint();
  const root = resolve(projectRoot(), dataDirectory);
  await ensurePrivateDirectory(root);
  const repository = new CaseRepository(root);
  await repository.initialize();
  const reconciliationRepository = new ReconciliationRepository(repository);
  await reconciliationRepository.initialize();
  const processingModel = createInsuranceProcessingModel(reconciliationRepository, { endpoint: testEndpoint });
  const reconciliation = createReconciliationService(
    reconciliationRepository,
    processingModel,
    processingConfiguration,
    insuranceConfiguration,
  );
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
  const registry = createRegistry(registrations, registrations.providerDefaults);
  const reportRepository = new ReportRepository(reconciliationRepository);
  await reportRepository.initialize();
  const reviewRepository = new ReviewRepository(reportRepository);
  await reviewRepository.initialize();
  const finalizations = new FinalizationRepository(reviewRepository);
  await finalizations.initialize();
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
    repository,
    registry.resolve('input', undefined, 'pdf-attachments'),
    limits,
    reconciliation.status,
    reports.status,
  );
  const comparison = createPolicyCheckingWorkflow(reconciliation, caseService, operatorId, reports);
  return {
    logger: privateFrameworkLogger,
    storage,
    agents: {
      policyCheckingAgent: createPolicyCheckingAgent(
        caseService,
        memory,
        operatorId,
        process.env.NODE_ENV === 'test' && process.env.POLICY_TEST_PROCESSING_ONLY === '1' ? undefined : testEndpoint,
        comparison.runner,
        comparison.report,
        comparison.review,
      ),
    },
    workflows: { policyCheckingWorkflow: comparison.workflow },
    server: createLocalServer(port, limits, reportRepository, operatorId, finalizations),
  };
}
