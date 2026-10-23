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
  const caseService = createCaseService(
    repository,
    registry.resolve('input', undefined, 'pdf-attachments'),
    limits,
    reconciliation.status,
  );
  const comparison = createPolicyCheckingWorkflow(reconciliation, caseService, operatorId);
  return {
    storage,
    agents: {
      policyCheckingAgent: createPolicyCheckingAgent(caseService, memory, operatorId, testEndpoint, comparison.runner),
    },
    workflows: { policyCheckingWorkflow: comparison.workflow },
    server: createLocalServer(port, limits),
  };
}
