/**
 * The supervisor emit path: notification signals to the per-factory
 * supervisor session. The notification is the doorbell, never the source of
 * truth — the woken turn reads the finding rows for the real state. Core's
 * coalescing (`coalesceKey` = finding key) is the storm control; there is no
 * factory-side emit gate.
 */

import type { MastraCodeState } from '@mastra/code-sdk/schema';
import type { AgentController } from '@mastra/core/agent-controller';
import type { NotificationPriority } from '@mastra/core/notifications';

import { supervisorResourceId, supervisorThreadId } from './session.js';

/**
 * Finding kinds the supervisor can act on itself — these wake it (high).
 * Everything else is inherently waiting on a person and stays low (persisted,
 * summarized, no wake).
 */
export const SUPERVISOR_HIGH_PRIORITY_KINDS: ReadonlySet<string> = new Set([
  'decision-failed',
  'decision-stuck',
  'start-stalled',
  'seat-orphaned',
  'seat-missing',
]);

export function supervisorNotificationPriority(kind: string): NotificationPriority {
  return SUPERVISOR_HIGH_PRIORITY_KINDS.has(kind) ? 'high' : 'low';
}

type SupervisorNotifyController = Pick<AgentController<MastraCodeState>, 'getSessionByResource' | 'createSession'>;

export interface NotifySupervisorInput {
  projectId: string;
  findingKey: string;
  kind: string;
  summary: string;
  failureCode?: string;
  /** Overrides the kind-derived priority (dispatcher call sites pass high explicitly). */
  priority?: NotificationPriority;
}

/**
 * Emit one notification signal to a project's supervisor session, creating
 * the session first when it has never been reached. Creation must come first:
 * delivery-time stream options resolve through `getSessionByResource`, so a
 * notification sent before the session exists produces a wake with no model.
 * `createSession` is get-or-create with in-flight coalescing in the
 * controller, so concurrent emits for a never-created project share one
 * creation, and `hydrateSupervisorSession` (a session-created listener) stamps
 * scope, instructions and factory defaults on the way in.
 */
export async function notifySupervisor(
  deps: { controller: SupervisorNotifyController },
  input: NotifySupervisorInput,
): Promise<void> {
  const resourceId = supervisorResourceId(input.projectId);
  const session =
    (await deps.controller.getSessionByResource(resourceId)) ??
    (await deps.controller.createSession({
      id: resourceId,
      resourceId,
      threadId: supervisorThreadId(input.projectId),
    }));
  await session.sendNotificationSignal({
    source: 'factory',
    kind: 'supervisor-finding',
    summary: input.summary,
    priority: input.priority ?? supervisorNotificationPriority(input.kind),
    coalesceKey: input.findingKey,
    payload: {
      findingKey: input.findingKey,
      kind: input.kind,
      ...(input.failureCode ? { failureCode: input.failureCode } : {}),
    },
  });
}
