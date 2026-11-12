import { RequestContext } from '@mastra/core/request-context';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { IntegrationTools } from '../integrations/base.js';
import type { SourceControlSessionLookup } from '../session/factory-session.js';
import type { AuditRecorder } from '../storage/domains/audit/domain.js';
import type { WorkItemsStorage } from '../storage/domains/work-items/base.js';
import type { FactoryMessaging } from './messaging-tools.js';
import { resumesOnDecision } from './run-watch.js';
import { requirePerson } from './scope.js';
import type { FactoryToolScope } from './scope.js';

export interface FactoryApprovalToolDependencies {
  sessions: Pick<SourceControlSessionLookup, 'getBySessionId'>;
  workItems: Pick<WorkItemsStorage, 'findActiveRunBindingForSession' | 'listSessionSubscriptions'>;
  auditRecorder: AuditRecorder;
  messaging: () => Promise<FactoryMessaging | null>;
}

/** The parts of a live session an answer needs: the calls it waits on, and how each is answered. */
interface ApprovalGateSession {
  approval: { list(): Array<{ toolCallId: string; toolName: string }> };
  displayState: {
    get(): { pendingSuspensions: Map<string, { toolCallId: string; toolName: string; resumeSchema?: string }> };
  };
  respondToToolApproval(input: {
    decision: 'approve' | 'decline';
    toolCallId: string;
    requestContext?: RequestContext;
    declineContext?: { reason?: string };
  }): { accepted: true } | { accepted: false; reason: string };
  respondToToolSuspension(input: {
    resumeData: { action: 'approved' | 'rejected'; feedback?: string };
    toolCallId: string;
    requestContext?: RequestContext;
  }): Promise<void>;
}

/** A tool call waiting for a yes or no, and which of the session's two channels answers it. */
interface WaitingApproval {
  toolCallId: string;
  toolName: string;
  /** `gate`: the call has not run yet. `resume`: the tool paused itself to ask. */
  channel: 'gate' | 'resume';
}

function waitingApprovals(live: ApprovalGateSession): WaitingApproval[] {
  return [
    ...live.approval.list().map(({ toolCallId, toolName }) => ({ toolCallId, toolName, channel: 'gate' as const })),
    // Keyed by run address, not tool call id: read the id off each entry.
    ...[...live.displayState.get().pendingSuspensions.values()]
      .filter(suspension => resumesOnDecision(suspension.resumeSchema))
      .map(({ toolCallId, toolName }) => ({ toolCallId, toolName, channel: 'resume' as const })),
  ];
}

/**
 * Approve or decline a tool call a live session waits on, for a caller already allowed
 * to. Any tool can wait this way; with no `toolCallId` the session's only waiting call
 * is answered. The answered run carries on as the session's owner whoever answers: a
 * phase session keeps one identity from kickoff to finish, and a resume never runs with
 * no user.
 */
export async function answerParkedCall(
  deps: Pick<FactoryApprovalToolDependencies, 'messaging'>,
  input: {
    session: { sessionId: string; userId: string; orgId: string };
    toolCallId?: string;
    decision: 'approve' | 'decline';
    declineReason: string;
  },
): Promise<{ toolCallId: string; toolName: string }> {
  const { session, decision, declineReason } = input;
  const messaging = await deps.messaging();
  if (!messaging) throw new Error('Answering approvals is not available on this server.');
  const live = (await messaging.controller.getSession(session.sessionId)) as ApprovalGateSession | null;
  const waiting = live ? waitingApprovals(live) : [];
  const matches = input.toolCallId ? waiting.filter(call => call.toolCallId === input.toolCallId) : waiting;
  const [call] = matches;
  if (!live || !call) {
    throw new Error(
      input.toolCallId
        ? 'Nothing is waiting on that tool call any more: the run that asked has ended or it was already answered. ' +
            'Message the session with factory_signal_session if it should try again.'
        : 'This session is not waiting on an approval. Open it to see what it needs.',
    );
  }
  if (matches.length > 1) {
    throw new Error(
      `This session waits on ${matches.length} approvals (${matches.map(match => `${match.toolName}: ${match.toolCallId}`).join(', ')}). Name the toolCallId to answer.`,
    );
  }
  const { toolCallId, toolName } = call;
  const requestContext = new RequestContext();
  requestContext.set('user', { workosId: session.userId, organizationId: session.orgId });
  if (call.channel === 'resume') {
    await live.respondToToolSuspension({
      resumeData: decision === 'approve' ? { action: 'approved' } : { action: 'rejected', feedback: declineReason },
      toolCallId,
      requestContext,
    });
    return { toolCallId, toolName };
  }
  const result = live.respondToToolApproval({
    decision,
    toolCallId,
    requestContext,
    ...(decision === 'decline' ? { declineContext: { reason: declineReason } } : {}),
  });
  if (!result.accepted) throw new Error(`The answer was not accepted (${result.reason}).`);
  return { toolCallId, toolName };
}

/** Answers a tool call another session holds for approval. Only a signed-in person's turn may answer. */
export function createFactoryApprovalTools(
  scope: FactoryToolScope,
  deps: FactoryApprovalToolDependencies,
): IntegrationTools {
  const answer = createTool({
    id: 'factory_answer_approval',
    description: [
      'Approve or decline a tool call a session you follow is waiting on.',
      'The decision is recorded as yours; the run carries on as the owner of the session that asked.',
      'A `factory-session` notification of kind `approval` names the session, tool, arguments and toolCallId;',
      'a `blocked` notice for a session parked on a tool that waits for approval names the toolCallId to approve or decline.',
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

      await answerParkedCall(deps, {
        session: row,
        toolCallId,
        decision,
        declineReason: reason ?? 'Declined by a session following it.',
      });

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
