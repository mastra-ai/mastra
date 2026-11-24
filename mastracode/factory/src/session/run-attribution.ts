import { isHumanActorId } from '../storage/domains/audit/actors.js';
import { factoryPrincipalId } from '../storage/domains/projects/base.js';
import type { SourceControlSession } from '../storage/domains/source-control/base.js';
import type { WorkItemsStorage } from '../storage/domains/work-items/base.js';

/** How far a side session walks back through the sessions that started it. */
const MAX_ORIGIN_DEPTH = 5;

/**
 * Who a session's source-control writes are credited to. Attribution only: the session's
 * authenticated owner still runs it, and its repository access and credentials never change.
 *
 * - A person working in a session they do not own keeps their own credit.
 * - A card's run credits the person who started its role (`initiatedBy`), else the Factory.
 * - A person's own session credits them.
 * - A side session the Factory owns credits whoever its origin session's run credits.
 * - Anything else credits the Factory.
 *
 * Never the Factory's creator or the repository's connector, who only own or connect it.
 */
export async function resolveAttributionUserId({
  authenticatedUserId,
  session,
  factoryProjectId,
  workItems,
  sessions,
}: {
  authenticatedUserId: string;
  session: SourceControlSession;
  factoryProjectId: string;
  workItems?: Pick<WorkItemsStorage, 'listRunBindingsForSession' | 'get'>;
  sessions: { getBySessionId(sessionId: string): Promise<SourceControlSession | null> };
}): Promise<string> {
  const factory = factoryPrincipalId(factoryProjectId);
  const person = isHumanActorId(authenticatedUserId) ? authenticatedUserId : undefined;
  if (person && person !== session.userId) return person;

  const runCredit = async (current: SourceControlSession): Promise<string | undefined> => {
    if (!workItems) return undefined;
    const binding = (
      await workItems.listRunBindingsForSession({ orgId: current.orgId, sessionId: current.sessionId })
    ).at(-1);
    if (!binding) return undefined;
    const item = await workItems.get({ orgId: binding.orgId, id: binding.workItemId });
    return item?.sessions[binding.role]?.initiatedBy ?? factory;
  };

  const own = await runCredit(session);
  if (own) return own;
  if (person) return person;

  let origin = session;
  for (let depth = 0; origin.originSessionId && depth < MAX_ORIGIN_DEPTH; depth++) {
    const next = await sessions.getBySessionId(origin.originSessionId);
    if (!next || next.orgId !== session.orgId) break;
    const credit = await runCredit(next);
    if (credit) return credit;
    origin = next;
  }
  return factory;
}
