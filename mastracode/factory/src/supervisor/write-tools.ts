import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { IntegrationTools } from '../integrations/base.js';
import type { FactoryTransitionService } from '../rules/transition-service.js';
import { FACTORY_RULE_STAGES, factoryRuleStage } from '../rules/types.js';
import type { AuditStorage } from '../storage/domains/audit/base.js';
import type { WorkItemRow, WorkItemsStorage } from '../storage/domains/work-items/base.js';
import type { SupervisorScope } from './read-tools.js';

interface SupervisorWriteDependencies {
  scope: SupervisorScope;
  userId: string;
  workItems: WorkItemsStorage;
  audit: AuditStorage;
  transitionService: FactoryTransitionService;
  reconcileAcceptanceLabels?: (input: { orgId: string; factoryProjectId: string; item: WorkItemRow }) => Promise<void>;
  signalSession?: (input: { sessionId: string; message: string; userId: string }) => Promise<unknown>;
  now?: () => Date;
}

export function createFactorySupervisorWriteTools(deps: SupervisorWriteDependencies): IntegrationTools {
  const now = deps.now ?? (() => new Date());
  const audit = async (action: string, target: { type: string; id: string }, metadata: Record<string, unknown> = {}) =>
    deps.audit.record({
      orgId: deps.scope.orgId,
      actorId: deps.userId,
      actorType: 'human',
      action,
      targets: [target],
      factoryProjectId: deps.scope.factoryProjectId,
      metadata: { ...metadata, cause: 'supervisor' },
      occurredAt: now(),
    });

  return {
    factory_retry_decision: createTool({
      id: 'factory_retry_decision',
      description: 'Retry one failed Factory decision after the person confirms the repair.',
      inputSchema: z.object({ decisionId: z.string().min(1) }),
      requireApproval: true,
      execute: async ({ decisionId }) => {
        const decision = await deps.workItems.retryDeferredDecision(
          deps.scope.orgId,
          deps.scope.factoryProjectId,
          decisionId,
          now(),
        );
        if (!decision) throw new Error('The decision is not failed, no longer exists, or belongs to another factory.');
        await audit(
          'factory.run.retry',
          { type: 'rule_decision', id: decisionId },
          { workItemId: decision.workItemId },
        );
        return { decisionId, status: decision.status, workItemId: decision.workItemId };
      },
    }),
    factory_dismiss_decision: createTool({
      id: 'factory_dismiss_decision',
      description: 'Dismiss one parked Factory proposal after the person confirms it is no longer wanted.',
      inputSchema: z.object({ decisionId: z.string().min(1) }),
      requireApproval: true,
      execute: async ({ decisionId }) => {
        const decision = await deps.workItems.dismissDeferredDecision(
          deps.scope.orgId,
          deps.scope.factoryProjectId,
          decisionId,
          now(),
        );
        if (!decision)
          throw new Error('The decision is not proposed, no longer exists, or belongs to another factory.');
        await audit(
          'factory.run.dismissed',
          { type: 'rule_decision', id: decisionId },
          { workItemId: decision.workItemId },
        );
        return { decisionId, status: decision.status, workItemId: decision.workItemId };
      },
    }),
    factory_resolve_proposal: createTool({
      id: 'factory_resolve_proposal',
      description: 'Approve or dismiss one proposed Factory decision after the person confirms the choice.',
      inputSchema: z.object({ decisionId: z.string().min(1), resolution: z.enum(['approve', 'dismiss']) }),
      requireApproval: true,
      execute: async ({ decisionId, resolution }) => {
        const decision =
          resolution === 'approve'
            ? await deps.workItems.approveDeferredDecision(
                deps.scope.orgId,
                deps.scope.factoryProjectId,
                decisionId,
                now(),
                deps.userId,
              )
            : await deps.workItems.dismissDeferredDecision(
                deps.scope.orgId,
                deps.scope.factoryProjectId,
                decisionId,
                now(),
              );
        if (!decision) throw new Error('The proposal is no longer open or belongs to another factory.');
        await audit(
          resolution === 'approve' ? 'factory.run.approved' : 'factory.run.dismissed',
          {
            type: 'rule_decision',
            id: decisionId,
          },
          { workItemId: decision.workItemId },
        );
        return { decisionId, resolution, status: decision.status, workItemId: decision.workItemId };
      },
    }),
    factory_transition_work_item: createTool({
      id: 'factory_transition_work_item',
      description: 'Move or accept one Factory work item after the person confirms the destination stage.',
      inputSchema: z.object({ workItemId: z.string().min(1), stage: z.enum(FACTORY_RULE_STAGES) }),
      requireApproval: true,
      execute: async ({ workItemId, stage }) => {
        const item = await deps.workItems.get({ orgId: deps.scope.orgId, id: workItemId });
        if (!item || item.factoryProjectId !== deps.scope.factoryProjectId) throw new Error('Work item not found.');
        const from = factoryRuleStage(item.stages);
        if (!from) throw new Error('The work item does not have one valid Factory stage.');
        const result = await deps.transitionService.transition({
          orgId: deps.scope.orgId,
          factoryProjectId: deps.scope.factoryProjectId,
          workItemId,
          board: item.externalSource?.type === 'pull-request' ? 'review' : 'work',
          stage,
          expectedRevision: item.revision,
          actor: { type: 'human', id: deps.userId },
          ingress: { type: 'human', identity: `supervisor:${deps.userId}:${workItemId}:${item.revision}:${stage}` },
          cause: 'supervisor',
        });
        await audit(
          result.status === 'accepted' ? 'factory.work_item.stage_moved' : 'factory.work_item.transition_rejected',
          { type: 'work_item', id: workItemId },
          result.status === 'accepted'
            ? { from, to: result.stage, revision: result.revision, transitionId: result.transitionId }
            : { from, to: stage, code: result.code, reason: result.reason, transitionId: result.transitionId },
        );
        if (result.status !== 'accepted') {
          throw new Error(`The transition was rejected (${result.code}): ${result.reason}`);
        }
        return result;
      },
    }),
    factory_reconcile_labels: createTool({
      id: 'factory_reconcile_labels',
      description: 'Reconcile stale acceptance labels for one accepted work item after the person confirms the repair.',
      inputSchema: z.object({ workItemId: z.string().min(1) }),
      requireApproval: true,
      execute: async ({ workItemId }) => {
        if (!deps.reconcileAcceptanceLabels) throw new Error('Acceptance-label reconciliation is unavailable.');
        const item = await deps.workItems.get({ orgId: deps.scope.orgId, id: workItemId });
        if (!item || item.factoryProjectId !== deps.scope.factoryProjectId) throw new Error('Work item not found.');
        if (!item.acceptedAt) throw new Error('The work item has not been accepted.');
        await deps.reconcileAcceptanceLabels({ ...deps.scope, item });
        await audit('factory.work_item.labels_reconciled', { type: 'work_item', id: workItemId });
        return { workItemId, reconciled: true };
      },
    }),
    factory_revoke_binding: createTool({
      id: 'factory_revoke_binding',
      description: 'Revoke an orphaned or stale run binding after a health finding and person confirmation.',
      inputSchema: z.object({ bindingId: z.string().min(1) }),
      requireApproval: true,
      execute: async ({ bindingId }) => {
        const binding = await deps.workItems.revokeRunBinding({
          orgId: deps.scope.orgId,
          factoryProjectId: deps.scope.factoryProjectId,
          bindingId,
          revokedAt: now(),
        });
        if (!binding) throw new Error('The binding is not active, no longer exists, or belongs to another factory.');
        await audit(
          'factory.intake.binding_updated',
          { type: 'run_binding', id: bindingId },
          {
            workItemId: binding.workItemId,
            role: binding.role,
            status: 'revoked',
          },
        );
        return { bindingId, status: binding.status, workItemId: binding.workItemId, role: binding.role };
      },
    }),
    factory_signal_session: createTool({
      id: 'factory_signal_session',
      description: 'Send bounded guidance to a worker session after the person confirms the exact message.',
      inputSchema: z.object({ sessionId: z.string().min(1), message: z.string().trim().min(1).max(2000) }),
      requireApproval: true,
      execute: async ({ sessionId, message }) => {
        if (!deps.signalSession) throw new Error('Worker session signaling is unavailable.');
        const bindings = await deps.workItems.listRunBindings(deps.scope.orgId, deps.scope.factoryProjectId);
        const binding = bindings.find(row => row.sessionId === sessionId);
        if (!binding) throw new Error('The session does not belong to this factory.');
        await deps.signalSession({ sessionId, message, userId: deps.userId });
        await audit(
          'factory.agent.signaled',
          { type: 'factory_session', id: sessionId },
          {
            workItemId: binding.workItemId,
            role: binding.role,
          },
        );
        return { sessionId, delivered: true, workItemId: binding.workItemId, role: binding.role };
      },
    }),
  };
}
