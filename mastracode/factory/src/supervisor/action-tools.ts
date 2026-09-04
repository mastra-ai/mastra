import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { IntegrationTools } from '../integrations/base.js';
import type { AuditActorType, AuditStorage } from '../storage/domains/audit/base.js';
import type { WorkItemsStorage } from '../storage/domains/work-items/base.js';
import type { SupervisorScope } from './read-tools.js';

/**
 * Who a supervisor turn is acting as. Authenticated turns carry the human's
 * user id; signal-woken turns carry the agent identity (`agent:<threadId>`),
 * following the audit trail's existing convention.
 */
export interface SupervisorActor {
  type: AuditActorType;
  id: string;
}

interface SupervisorActionDependencies {
  scope: SupervisorScope;
  actor: SupervisorActor;
  workItems: Pick<WorkItemsStorage, 'escalateSupervisorFinding'>;
  audit: Pick<AuditStorage, 'record'>;
  now?: () => Date;
}

/**
 * Supervisor tools that are deliberately approval-free: they are how the
 * supervisor reaches a human (escalate) or acts on a human's behalf without
 * putting that human back in the loop. Guardrails are the audit trail and the
 * supervisor's instructions, not an approval prompt. These register on both
 * authenticated and signal-woken turns.
 */
export function createFactorySupervisorActionTools(deps: SupervisorActionDependencies): IntegrationTools {
  const now = deps.now ?? (() => new Date());
  const audit = async (action: string, target: { type: string; id: string }, metadata: Record<string, unknown> = {}) =>
    deps.audit.record({
      orgId: deps.scope.orgId,
      actorId: deps.actor.id,
      actorType: deps.actor.type,
      action,
      targets: [target],
      factoryProjectId: deps.scope.factoryProjectId,
      metadata: { ...metadata, cause: 'supervisor' },
      occurredAt: now(),
    });

  return {
    factory_escalate_finding: createTool({
      id: 'factory_escalate_finding',
      description:
        'Surface one open health finding to the humans on the Attention rail with a short note saying what you found and what you need from them. Use this when a finding needs a decision or information only a person has; it is the only way an open supervisor-actionable finding becomes visible to people before the backstop.',
      inputSchema: z.object({
        findingKey: z.string().min(1),
        note: z.string().trim().min(1).max(600),
      }),
      execute: async ({ findingKey, note }) => {
        const escalatedAt = now();
        const finding = await deps.workItems.escalateSupervisorFinding({
          orgId: deps.scope.orgId,
          factoryProjectId: deps.scope.factoryProjectId,
          findingKey,
          note,
          escalatedAt,
        });
        if (!finding) throw new Error('The finding is not open, no longer exists, or belongs to another factory.');
        await audit('factory.supervisor.finding_escalated', { type: 'supervisor_finding', id: findingKey }, { note });
        return {
          findingKey,
          status: finding.status,
          escalatedAt: escalatedAt.toISOString(),
          note: finding.escalationNote,
        };
      },
    }),
  };
}
