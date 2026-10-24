import { Mastra } from '@mastra/core/mastra';
import { LibSQLStore } from '@mastra/libsql';
import { Memory } from '@mastra/memory';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { createInsuranceProcessingModel } from '../src/mastra/agents/insurance-processing-agent.js';
import { createPolicyCheckingAgent } from '../src/mastra/agents/policy-checking-agent.js';
import { inputLimits } from '../src/mastra/config/input-limits-config.js';
import { insuranceConfiguration } from '../src/mastra/config/insurance-config.js';
import type { InputProvider, OutputProvider } from '../src/mastra/domain/case-contracts.js';
import type { ProcessingBudget } from '../src/mastra/domain/reconciliation-contracts.js';
import { workingMemorySchema } from '../src/mastra/processors/document-intake-processor.js';
import { createApprovedOutputProvider } from '../src/mastra/providers/approved-output-provider.js';
import { createDraftPdfProvider } from '../src/mastra/providers/draft-pdf-provider.js';
import { createPdfProvider } from '../src/mastra/providers/pdf-input-provider.js';
import { privateFrameworkLogger } from '../src/mastra/runtime/operation-logger.js';
import { createCaseService } from '../src/mastra/services/case-service.js';
import { createReconciliationService } from '../src/mastra/services/reconciliation-service.js';
import { createReportService } from '../src/mastra/services/report-service.js';
import { createReviewService } from '../src/mastra/services/review-service.js';
import { CaseRepository } from '../src/mastra/storage/case-repository.js';
import { FinalizationRepository } from '../src/mastra/storage/finalization-repository.js';
import { ReconciliationRepository } from '../src/mastra/storage/reconciliation-repository.js';
import { ReportRepository } from '../src/mastra/storage/report-repository.js';
import { ReviewRepository } from '../src/mastra/storage/review-repository.js';
import { createPolicyCheckingWorkflow } from '../src/mastra/workflows/policy-checking-workflow.js';

export const reportContext = { threadId: 'report-thread', operatorId: 'local-broker' };
// Applies solely to the controlled socket service. Production budget remains null.
export const reportTestBudget: ProcessingBudget = {
  maxAttempts: 3,
  maxRequests: 16,
  maxInputTokensPerRequest: 200000,
  maxOutputTokensPerRequest: 30000,
  maxTotalTokens: 2000000,
  maxCostMicros: 20000000,
  inputMicrosPerToken: 1,
  outputMicrosPerToken: 2,
  pricingAssumption: 'Controlled HTTP report test, no paid dispatch.',
  timeoutMs: 10000,
  maxResponseBytes: 2000000,
};
export async function reportRuntime(
  root: string,
  endpoint?: string,
  output: OutputProvider<'draftOutput'> = createDraftPdfProvider(),
  input: InputProvider = createPdfProvider(inputLimits),
  final: OutputProvider<'reportOutput'> = createApprovedOutputProvider('reportOutput'),
  correction: OutputProvider<'correctionOutput'> = createApprovedOutputProvider('correctionOutput'),
  budget: ProcessingBudget = reportTestBudget,
) {
  const cases = new CaseRepository(root);
  await cases.initialize();
  const reconciliationRepository = new ReconciliationRepository(cases);
  await reconciliationRepository.initialize();
  const reportRepository = new ReportRepository(reconciliationRepository);
  await reportRepository.initialize();
  const reconciliation = createReconciliationService(
    reconciliationRepository,
    createInsuranceProcessingModel(reconciliationRepository, { endpoint }),
    { model: 'gpt-6.1-sol', budget },
    insuranceConfiguration,
  );
  const reviewRepository = new ReviewRepository(reportRepository);
  await reviewRepository.initialize();
  const finalizations = new FinalizationRepository(reviewRepository);
  await finalizations.initialize();
  const review = createReviewService(reviewRepository, finalizations, final, correction);
  const reports = createReportService(reportRepository, output, review);
  const caseService = createCaseService(cases, input, inputLimits, reconciliation.status, async context => {
    const record = await cases.active(context);
    return record?.latestReportId ? reports.current(context, { caseId: record.id }) : null;
  });
  const comparison = createPolicyCheckingWorkflow(reconciliation, caseService, reportContext.operatorId, reports);
  const storage = new LibSQLStore({ id: randomUUID(), url: `file:${join(root, 'history.db')}` });
  await storage.init();
  const memory = new Memory({
    storage,
    options: {
      semanticRecall: false,
      generateTitle: false,
      workingMemory: { enabled: true, scope: 'thread', schema: workingMemorySchema, agentManaged: false },
    },
  });
  const agent = createPolicyCheckingAgent(
    caseService,
    memory,
    reportContext.operatorId,
    undefined,
    comparison.runner,
    comparison.report,
    comparison.review,
  );
  const mastra = new Mastra({
    logger: privateFrameworkLogger,
    storage,
    agents: { policyCheckingAgent: agent },
    workflows: { policyCheckingWorkflow: comparison.workflow },
  });
  return {
    cases,
    reconciliation,
    reconciliationRepository,
    reportRepository,
    reports,
    review,
    reviewRepository,
    finalizations,
    caseService,
    comparison,
    storage,
    memory,
    agent,
    mastra,
    async close() {
      await storage.close();
      cases.close();
    },
  };
}

/** Native Studio displays tripwire reasons as text; linked replies are read from saved history. */
export async function conversationReply(memory: Memory, transient: string) {
  if (!transient.includes('Reload this conversation')) return transient;
  const history = await memory.recall({ threadId: reportContext.threadId, resourceId: reportContext.operatorId });
  const reply = [...history.messages].reverse().find(message => message.role === 'assistant');
  return (
    reply?.content.parts
      .filter(part => part.type === 'text')
      .map(part => part.text)
      .join('\n') ?? ''
  );
}
