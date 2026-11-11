import { join } from 'node:path';
import { Mastra } from '@mastra/core/mastra';
import { LibSQLStore } from '@mastra/libsql';
import { CaseRepository } from '../src/mastra/storage/case-repository.js';
import { ReconciliationRepository } from '../src/mastra/storage/reconciliation-repository.js';
import { createCaseService } from '../src/mastra/services/case-service.js';
import { createReconciliationService } from '../src/mastra/services/reconciliation-service.js';
import { createInsuranceProcessingModel } from '../src/mastra/agents/insurance-processing-agent.js';
import { createPolicyCheckingWorkflow } from '../src/mastra/workflows/policy-checking-workflow.js';
import { createPdfProvider } from '../src/mastra/providers/pdf-input-provider.js';
import { inputLimits } from '../src/mastra/config/input-limits-config.js';
import { insuranceConfiguration } from '../src/mastra/config/insurance-config.js';

const input = JSON.parse(process.argv[2]);
const cases = new CaseRepository(input.root);
await cases.initialize();
const repository = new ReconciliationRepository(cases);
await repository.initialize();
const service = createReconciliationService(
  repository,
  createInsuranceProcessingModel(repository, { endpoint: input.endpoint }),
  input.configuration,
  insuranceConfiguration,
);
const caseService = createCaseService(cases, createPdfProvider(inputLimits), inputLimits, service.status);
const comparison = createPolicyCheckingWorkflow(service, caseService, input.context.operatorId);
const storage = new LibSQLStore({ id: 'recovery-worker', url: `file:${join(input.root, 'history.db')}` });
await storage.init();
new Mastra({ storage, workflows: { policyCheckingWorkflow: comparison.workflow } });
await comparison.runner.compare(input.context, input.request);
await storage.close();
cases.close();
