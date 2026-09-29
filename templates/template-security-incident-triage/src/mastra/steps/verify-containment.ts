import { createStep } from '@mastra/core/workflows';

import { ContainmentExecutionResultSchema } from '../../approval/contracts.js';
import { createLibSqlOperationalStore } from '../../db/libsql-operational-store.js';
import type { OperationalStore } from '../../db/operational-store.js';
import { withinWorkflowBoundary } from '../workflow-trace.js';

export function createVerifyContainmentStep(dependencies: Readonly<{ openStore?: () => OperationalStore }> = {}) {
  return createStep({
    id: 'verify-containment',
    description: 'Rejects any aggregate that lacks a persisted successful post-condition.',
    inputSchema: ContainmentExecutionResultSchema,
    outputSchema: ContainmentExecutionResultSchema,
    execute: async ({ inputData }) => {
      if (inputData.status !== 'containment-succeeded') return inputData;
      const store = (dependencies.openStore ?? createLibSqlOperationalStore)();
      try {
        return await withinWorkflowBoundary(
          store,
          {
            tenantId: inputData.plan.tenantId,
            incidentId: inputData.plan.incidentId,
            workflowRunId: inputData.workflowRunId,
            correlationId: inputData.correlationId,
            boundary: 'containment.verify',
            stepId: 'verify-containment',
          },
          async () =>
            inputData.outcomes.every(outcome => outcome.status === 'completed' && outcome.verification === 'verified')
              ? inputData
              : {
                  ...inputData,
                  status: 'containment-failed' as const,
                  partial: inputData.outcomes.some(outcome => outcome.status === 'completed'),
                },
        );
      } finally {
        store.close();
      }
    },
  });
}
