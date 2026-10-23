import { join } from 'node:path';
import { Mastra } from '@mastra/core/mastra';
import { LibSQLStore } from '@mastra/libsql';
import { CaseRepository } from '../src/mastra/storage/cases.js';
import { ReconciliationRepository } from '../src/mastra/storage/reconciliation.js';
import { createCaseService } from '../src/mastra/domain/case-service.js';
import { createReconciliationService } from '../src/mastra/domain/reconciliation-service.js';
import { createOpenAIProcessingModel } from '../src/mastra/providers/openai-processing.js';
import { createPolicyCheckingWorkflow } from '../src/mastra/workflows/policy-checking.js';
import { createPdfProvider } from '../src/mastra/providers/pdf.js';
import { inputLimits } from '../src/mastra/config/limits.js';
import { insuranceConfiguration } from '../src/mastra/config/insurance.js';

const input = JSON.parse(process.argv[2]);
const cases = new CaseRepository(input.root);
await cases.initialize();
const repository = new ReconciliationRepository(cases);
await repository.initialize();
const service = createReconciliationService(
  repository,
  createOpenAIProcessingModel(repository, { endpoint: input.endpoint }),
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
