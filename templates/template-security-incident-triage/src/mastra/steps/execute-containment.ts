import { createStep } from '@mastra/core/workflows';

import { ApprovalResolvedResultSchema, ContainmentExecutionResultSchema } from '../../approval/contracts.js';
import { ContainmentGateway } from '../../containment/gateway.js';
import type { LocalContainmentState } from '../../containment/local-state.js';
import { recordContainmentOutcome } from '../../db/containment-outcome-operations.js';
import { getIncident, transitionIncident } from '../../db/incident-operations.js';
import { createLibSqlOperationalStore } from '../../db/libsql-operational-store.js';
import type { OperationalStore } from '../../db/operational-store.js';
import type { Clock } from '../../domain/clock.js';
import type { IdGenerator } from '../../domain/id-generator.js';
import { ContainmentActionOutcomeSchema } from '../../schemas/containment.js';
import type { IdentityProvider } from '../../providers/identity-provider.js';
import { startWorkflowBoundary } from '../observability.js';
import { advanceWorkflowTrace, readWorkflowTrace } from '../workflow-trace.js';
import { createApprovedContainmentTool } from '../tools/approved-containment-tool.js';

export function createExecuteContainmentStep(
  dependencies: Readonly<{
    openStore?: () => OperationalStore;
    state: LocalContainmentState;
    mode: 'local' | 'staging' | 'production';
    timeoutMs: number;
    rateLimit: number;
    identityProvider?: IdentityProvider;
    clock?: Clock;
    ids?: IdGenerator;
  }>,
) {
  return createStep({
    id: 'execute-containment',
    description: 'Executes approved local actions sequentially and stops at the first failed verification.',
    inputSchema: ApprovalResolvedResultSchema,
    outputSchema: ContainmentExecutionResultSchema,
    execute: async ({ inputData }) => {
      if (inputData.status !== 'approval-resolved') return inputData;
      if (inputData.authoritative.decision === 'expired') {
        return {
          status: 'expired' as const,
          decision: inputData.decision,
          summary: inputData.summary,
          plan: inputData.plan,
          authoritative: inputData.authoritative,
          workflowRunId: inputData.workflowRunId,
          correlationId: inputData.correlationId,
        };
      }
      const common = {
        decision: inputData.decision,
        summary: inputData.summary,
        plan: inputData.plan,
        authoritative: inputData.authoritative,
        workflowRunId: inputData.workflowRunId,
        correlationId: inputData.correlationId,
      };
      if (inputData.authoritative.decision === 'rejected') {
        return { status: 'rejected' as const, ...common };
      }
      const store = (dependencies.openStore ?? createLibSqlOperationalStore)();
      try {
        let traceContext = await readWorkflowTrace(store, {
          tenantId: inputData.plan.tenantId,
          incidentId: inputData.plan.incidentId,
          workflowRunId: inputData.workflowRunId,
        });
        const approved = await getIncident(store, inputData.plan.tenantId, inputData.plan.incidentId);
        if (approved.status === 'contained' || approved.status === 'failed') {
          const persisted = await store.execute({
            sql: `SELECT attempt.action_id, attempt.status, attempt.verification,
              attempt.provider_ref, attempt.error_code
              FROM containment_action_attempts attempt
              WHERE attempt.tenant_id = ? AND attempt.plan_id = ?
                AND attempt.attempt = (
                  SELECT max(latest.attempt) FROM containment_action_attempts latest
                  WHERE latest.tenant_id = attempt.tenant_id
                    AND latest.plan_id = attempt.plan_id
                    AND latest.action_id = attempt.action_id
                ) ORDER BY (
                  SELECT ordinal FROM containment_actions action
                  WHERE action.tenant_id = attempt.tenant_id
                    AND action.plan_id = attempt.plan_id
                    AND action.action_id = attempt.action_id
                )`,
            args: [inputData.plan.tenantId, inputData.plan.planId],
          });
          const outcomes = persisted.rows.map(row =>
            ContainmentActionOutcomeSchema.parse({
              actionId: row.action_id,
              status: row.status,
              verification: row.verification,
              ...(row.provider_ref ? { providerRef: row.provider_ref } : {}),
              ...(row.error_code ? { errorCode: row.error_code } : {}),
            }),
          );
          return approved.status === 'contained'
            ? {
                status: 'containment-succeeded' as const,
                ...common,
                outcomes,
              }
            : {
                status: 'containment-failed' as const,
                ...common,
                partial: outcomes.some(
                  outcome => outcome.status === 'completed' && outcome.verification === 'verified',
                ),
                outcomes,
              };
        }
        if (approved.status === 'approved') {
          await transitionIncident(
            store,
            {
              tenantId: inputData.plan.tenantId,
              incidentId: inputData.plan.incidentId,
              expectedVersion: approved.version,
              to: 'containing',
              runId: inputData.workflowRunId,
              correlationId: inputData.correlationId,
              causationId: inputData.authoritative.approvalId,
            },
            {
              ...(dependencies.clock ? { clock: dependencies.clock } : {}),
              ...(dependencies.ids ? { ids: dependencies.ids } : {}),
            },
          );
        } else if (approved.status !== 'containing') {
          throw new Error('incident is not recoverable for containment');
        }
        const gateway = new ContainmentGateway({
          store,
          state: dependencies.state,
          mode: dependencies.mode,
          timeoutMs: dependencies.timeoutMs,
          rateLimit: dependencies.rateLimit,
          ...(dependencies.identityProvider ? { identityProvider: dependencies.identityProvider } : {}),
          ...(dependencies.clock ? { clock: dependencies.clock } : {}),
          ...(dependencies.ids ? { ids: dependencies.ids } : {}),
        });
        const outcomes = [];
        const tool = createApprovedContainmentTool(gateway, {
          tenantId: inputData.plan.tenantId,
          incidentId: inputData.plan.incidentId,
          workflowRunId: inputData.workflowRunId,
          approvalId: inputData.authoritative.approvalId,
          plan: inputData.plan,
        });
        for (const action of inputData.plan.actions) {
          // The resume step advances the durable carrier immediately before
          // this step. Re-read at the external-provider boundary so a resumed
          // workflow cannot retain a stale decision parent from an earlier
          // in-memory snapshot.
          traceContext =
            (await readWorkflowTrace(store, {
              tenantId: inputData.plan.tenantId,
              incidentId: inputData.plan.incidentId,
              workflowRunId: inputData.workflowRunId,
            })) ?? traceContext;
          const trace = startWorkflowBoundary({
            boundary: 'provider.containment',
            tenantId: inputData.plan.tenantId,
            incidentId: inputData.plan.incidentId,
            runId: inputData.workflowRunId,
            correlationId: inputData.correlationId,
            requestId: inputData.workflowRunId,
            ...(traceContext ? { context: traceContext } : {}),
            identifiers: {
              stepId: 'execute-containment',
              toolCallId: action.actionId,
              provider: 'local-containment',
            },
          });
          let outcome;
          try {
            outcome = ContainmentActionOutcomeSchema.parse(
              await tool.execute!(
                { actionId: action.actionId },
                { observe: { span: async (_name, fn) => fn(), log: () => {} } },
              ),
            );
            trace.span.end({ attributes: { success: true } as never });
            if (traceContext) {
              const next = {
                ...trace.context,
                runId: inputData.workflowRunId,
                requestId: traceContext.requestId,
              };
              await advanceWorkflowTrace(store, {
                tenantId: inputData.plan.tenantId,
                incidentId: inputData.plan.incidentId,
                workflowRunId: inputData.workflowRunId,
                previous: traceContext,
                next,
              });
              traceContext = next;
            }
          } catch (error) {
            trace.span.error({ error: error as Error, endSpan: true });
            throw error;
          }
          outcomes.push(outcome);
          if (outcome.status !== 'completed' || outcome.verification !== 'verified') break;
        }
        const failed = outcomes.some(outcome => outcome.status !== 'completed' || outcome.verification !== 'verified');
        const completedCount = outcomes.filter(
          outcome => outcome.status === 'completed' && outcome.verification === 'verified',
        ).length;
        const containing = await getIncident(store, inputData.plan.tenantId, inputData.plan.incidentId);
        await recordContainmentOutcome(
          store,
          {
            tenantId: inputData.plan.tenantId,
            incidentId: inputData.plan.incidentId,
            workflowRunId: inputData.workflowRunId,
            correlationId: inputData.correlationId,
            approvalId: inputData.authoritative.approvalId,
            expectedVersion: containing.version,
            status: failed ? 'failed' : 'contained',
            partial: failed && completedCount > 0,
            completedCount,
            failedCount: failed ? 1 : 0,
          },
          {
            ...(dependencies.clock ? { clock: dependencies.clock } : {}),
            ...(dependencies.ids ? { ids: dependencies.ids } : {}),
          },
        );
        return failed
          ? {
              status: 'containment-failed' as const,
              ...common,
              partial: completedCount > 0,
              outcomes,
            }
          : { status: 'containment-succeeded' as const, ...common, outcomes };
      } finally {
        store.close();
      }
    },
  });
}
