import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { IntegrationTools } from '../integrations/base.js';
import type { SourceControlSessionLookup } from '../session/factory-session.js';
import type { AuditRecorder } from '../storage/domains/audit/domain.js';
import type { WorkItemsStorage } from '../storage/domains/work-items/base.js';
import type { FactoryMessaging } from './messaging-tools.js';
import { requirePerson } from './scope.js';
import type { FactoryToolScope } from './scope.js';

export interface FactoryApprovalToolDependencies {
  sessions: Pick<SourceControlSessionLookup, 'getBySessionId'>;
  workItems: Pick<WorkItemsStorage, 'findActiveRunBindingForSession' | 'listSessionSubscriptions'>;
  auditRecorder: AuditRecorder;
  messaging: () => Promise<FactoryMessaging | null>;
}

/** The parts of a live session an answer needs: its open approval gates. */
interface ApprovalGateSession {
  approval: { isArmed(filter: { toolCallId: string }): boolean };
  respondToToolApproval(input: {
    decision: 'approve' | 'decline';
    toolCallId: string;
    declineContext?: { reason?: string };
  }): { accepted: true } | { accepted: false; reason: string };
}

/** Answers a tool call another session holds for approval. Only a signed-in person's turn may answer. */
export function createFactoryApprovalTools(
  scope: FactoryToolScope,
  deps: FactoryApprovalToolDependencies,
): IntegrationTools {
  const answer = createTool({
    id: 'factory_answer_approval',
    description: [
      'Approve or decline a tool call a session you follow is waiting on, as you.',
      'A `factory-session` notification of kind `approval` names the session, tool, arguments and toolCallId.',
      'Answer only what the person in this conversation agreed to; decline with a reason the session will see.',
    ].join(' '),
    inputSchema: z
      .object({
        sessionId: z.string().uuid().describe('The session holding the call, from the approval notice.'),
        toolCallId: z.string().trim().min(1).max(200),
        decision: z.enum(['approve', 'decline']),
        reason: z.string().trim().min(1).max(1000).optional().describe('Why, when declining.'),
      })
      .strict(),
    execute: async ({ sessionId, toolCallId, decision, reason }) => {
      requirePerson(scope, 'answer an approval');
      const row = await deps.sessions.getBySessionId(sessionId);
      if (!row || row.orgId !== scope.orgId || row.factoryProjectId !== scope.factoryProjectId) {
        throw new Error(`Session ${sessionId} was not found in this Factory.`);
      }
      if (row.visibility === 'private' && row.userId !== scope.userId) {
        throw new Error(`Session ${sessionId} is private to its owner.`);
      }

      // Only the sessions it reports to may answer it: its origin, or followers of its item.
      const binding = await deps.workItems.findActiveRunBindingForSession({
        orgId: scope.orgId,
        factoryProjectId: scope.factoryProjectId,
        sessionId,
      });
      const isOrigin = row.originSessionId === scope.sessionId;
      const follows =
        binding !== null &&
        (
          await deps.workItems.listSessionSubscriptions({
            orgId: scope.orgId,
            factoryProjectId: scope.factoryProjectId,
            sessionId: scope.sessionId,
          })
        ).some(subscription => subscription.workItemId === binding.workItemId);
      if (!isOrigin && !follows) {
        throw new Error(
          `This session doesn't follow session ${sessionId}: follow its work item first, or answer from that session.`,
        );
      }

      const messaging = await deps.messaging();
      if (!messaging) throw new Error('Answering approvals is not available on this server.');
      const live = (await messaging.controller.getSession(sessionId)) as ApprovalGateSession | null;
      if (!live?.approval.isArmed({ toolCallId })) {
        throw new Error(
          'Nothing is waiting on that tool call any more: the run that asked has ended or it was already answered. ' +
            'Message the session with factory_signal_session if it should try again.',
        );
      }
      const result = live.respondToToolApproval({
        decision,
        toolCallId,
        ...(decision === 'decline'
          ? { declineContext: { reason: reason ?? 'Declined by a session following it.' } }
          : {}),
      });
      if (!result.accepted) throw new Error(`The answer was not accepted (${result.reason}).`);

      deps.auditRecorder.record({
        orgId: scope.orgId,
        actorId: scope.userId,
        actorType: 'human',
        ...(scope.actorProfile ? { actorProfile: scope.actorProfile } : {}),
        action: decision === 'approve' ? 'factory.run.approved' : 'factory.run.dismissed',
        factoryProjectId: scope.factoryProjectId,
        targets: [
          { type: 'session', id: sessionId },
          ...(binding ? [{ type: 'work_item' as const, id: binding.workItemId }] : []),
        ],
        metadata: { toolCallId, sessionId, decision, cause: 'factory_tools' },
      });
      return { answered: decision, sessionId, toolCallId };
    },
  });

  return { factory_answer_approval: answer };
}
