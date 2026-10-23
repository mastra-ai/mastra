import { createStep, createWorkflow } from '@mastra/core/workflows';
import { RequestContext } from '@mastra/core/request-context';
import { z } from 'zod';
import {
  compareRequestSchema,
  comparisonResultSchema,
  type ComparisonRunner,
} from '../domain/reconciliation-contracts.js';
import { failureSchema, IntakeError, safely } from '../domain/errors.js';
import type { CaseService } from '../services/case-service.js';
import type { ReconciliationService } from '../services/reconciliation-service.js';
import { operationContext } from '../tools/tool-context.js';

export function createPolicyCheckingWorkflow(service: ReconciliationService, cases: CaseService, operatorId: string) {
  const outputSchema = z.union([comparisonResultSchema, failureSchema]);
  const step = createStep({
    id: 'reconcile-insurance-evidence',
    inputSchema: compareRequestSchema,
    outputSchema,
    execute: async ({ inputData, requestContext, runId }) =>
      safely(() => service.process(operationContext(cases, operatorId, requestContext), inputData, runId)),
  });
  const workflow = createWorkflow({
    id: 'policy-checking-workflow',
    inputSchema: compareRequestSchema,
    outputSchema,
    options: { shouldPersistSnapshot: () => true, autoRestartActiveRuns: false },
  })
    .then(step)
    .commit();
  const runner: ComparisonRunner = {
    async compare(context, input) {
      const request = compareRequestSchema.parse(input);
      if (context.operatorId !== operatorId)
        throw new IntakeError(
          'CASE_CONTEXT',
          'The configured operator does not match this request.',
          'Use the current local Studio operator.',
        );
      const requestContext = new RequestContext();
      requestContext.set('insuranceThreadId', context.threadId);
      const run = await workflow.createRun({ resourceId: operatorId });
      const result = await run.start({ inputData: request, requestContext });
      if (result.status !== 'success')
        throw new IntakeError(
          'WORKFLOW_INTERRUPTED',
          'The comparison workflow did not complete.',
          'Read case status before explicitly retrying.',
        );
      return result.result;
    },
  };
  return { workflow, runner };
}
