import { defineEvent } from '@mastra/mcp';
import { z } from 'zod';

import { canViewSourceControlSession } from '../routes/session-access.js';
import type { SourceControlSessionLookup } from '../session/factory-session.js';
import { parseAuditAction } from '../storage/domains/audit/actions.js';
import { AUDIT_ACTOR_TYPES } from '../storage/domains/audit/actors.js';
import type { AuditStorage, AuditEventRow } from '../storage/domains/audit/base.js';
import {
  ACTOR_PROFILE_METADATA_KEY,
  auditCursorAt,
  decodeAuditAfterCursor,
  encodeAuditCursor,
} from '../storage/domains/audit/base.js';
import type { SourceControlSession } from '../storage/domains/source-control/base.js';
import type { WorkItemsStorage } from '../storage/domains/work-items/base.js';

const activityArgs = z
  .object({
    workItemId: z.string().min(1).optional().describe('Only activity on this work item.'),
    actions: z
      .array(z.string().min(1))
      .max(50)
      .optional()
      .describe('Only these actions, e.g. `factory.work_item.stage_moved`.'),
  })
  .strict();

const activityPayload = z.object({
  action: z.string(),
  occurredAt: z.string(),
  actor: z.object({
    type: z.enum(AUDIT_ACTOR_TYPES),
    id: z.string(),
    name: z.string().optional(),
  }),
  workItemId: z.string().optional(),
  sessionId: z.string().optional(),
  summary: z.string(),
});

export type FactoryActivity = z.infer<typeof activityPayload>;

export interface FactoryActivityEventDeps {
  orgId: string;
  factoryProjectId: string;
  audit: Pick<AuditStorage, 'list'>;
  workItems: Pick<WorkItemsStorage, 'getForProject'>;
  sessions: Pick<SourceControlSessionLookup, 'getBySessionId'>;
  /** Who is polling: sessions they can't view keep their activity out. */
  viewer: { orgId: string; userId: string };
}

type Subject = { workItem?: { id: string; name?: string }; session?: SourceControlSession };

function toActivity(event: AuditEventRow, { workItem, session }: Subject): FactoryActivity {
  const profile = event.metadata[ACTOR_PROFILE_METADATA_KEY] as { name?: unknown } | undefined;
  const parsed = parseAuditAction(event.action);
  const verb = parsed
    ? `${parsed.namespace === 'work_item' ? '' : `${parsed.namespace} `}${parsed.leaf}`.replaceAll('_', ' ')
    : event.action;
  return {
    action: event.action,
    occurredAt: event.occurredAt.toISOString(),
    actor: {
      type: event.actorType,
      id: event.actorId,
      ...(typeof profile?.name === 'string' ? { name: profile.name } : {}),
    },
    ...(workItem ? { workItemId: workItem.id } : {}),
    ...(session ? { sessionId: session.sessionId } : {}),
    summary: `${verb}: ${workItem ? (workItem.name ?? workItem.id) : (session?.title ?? session?.branch ?? session?.sessionId)}`,
  };
}

/**
 * How long polling waits before moving past a row. `occurred_at` is set when the
 * row is written, so a row that commits after a poll is still younger than this
 * and lies ahead of the cursor, even if it shares a millisecond with the cursor row.
 */
export const ACTIVITY_SETTLE_MS = 5_000;

/**
 * `factory.activity`: the Factory's audit trail as polled MCP events (SEP-3415, experimental).
 *
 * Serves activity on work items and sessions. Sessions follow the same rule as the
 * session routes (`canViewSourceControlSession`): another member's private session,
 * or a session that can't be found, keeps the whole event out, even when it also
 * names a work item. An agent's activity counts as its session's when the agent's
 * thread is a session. Events naming neither (intake settings, rule bindings'
 * own actions) are not served.
 *
 * Poll-only by design: the MCP server is built per request, so there is nothing
 * to push from, and every poll reads storage from the client's cursor. Events are
 * delivered once they are {@link ACTIVITY_SETTLE_MS} old.
 */
export function factoryActivityEvent(deps: FactoryActivityEventDeps) {
  const project = { orgId: deps.orgId, factoryProjectId: deps.factoryProjectId };
  return defineEvent({
    description:
      'Activity on this Factory’s work items and the sessions you can see: items created, updated, moved and commented on, runs, approvals, signals and agent commits, pushes and pull requests.',
    inputSchema: activityArgs,
    payloadSchema: activityPayload,
    // The server is already scoped to the caller's Factory; this only rejects a work item outside it.
    authorize: async ({ arguments: args }) =>
      !args.workItemId ||
      (await deps.workItems.getForProject(deps.orgId, deps.factoryProjectId, args.workItemId)) !== null,
    poll: async ({ arguments: args, cursor, maxEvents, maxAgeMs }) => {
      const now = Date.now();
      if (cursor == null || !decodeAuditAfterCursor(cursor)) {
        // No cursor means "from now". An unreadable one can't be resumed, so say events may have been missed.
        return { events: [], cursor: auditCursorAt(new Date(now)), ...(cursor != null ? { truncated: true } : {}) };
      }

      const page = await deps.audit.list({
        ...project,
        ...(args.actions?.length ? { actions: args.actions } : {}),
        after: cursor,
        limit: maxEvents,
      });
      const sessionCache = new Map<string, Promise<SourceControlSession | null>>();
      const lookup = (sessionId: string) => {
        let found = sessionCache.get(sessionId);
        if (!found) sessionCache.set(sessionId, (found = deps.sessions.getBySessionId(sessionId)));
        return found;
      };
      const visible = (session: SourceControlSession | null): session is SourceControlSession =>
        session !== null && canViewSourceControlSession(session, deps.viewer);
      /** What the event is about, or `undefined` when the caller may not see it. */
      const subjectOf = async (event: AuditEventRow): Promise<Subject | undefined> => {
        const workItem = event.targets.find(target => target.type === 'work_item');
        const named = event.targets.filter(target => target.type === 'session').map(target => target.id);
        const sessions = await Promise.all(named.map(lookup));
        if (!sessions.every(visible)) return undefined;
        let session = sessions[0];
        if (event.actorType === 'agent' && event.actorId.startsWith('agent:')) {
          const actorSession = await lookup(event.actorId.slice('agent:'.length));
          if (actorSession && !visible(actorSession)) return undefined;
          session ??= actorSession ?? undefined;
        }
        if (!workItem && !session) return undefined;
        return { ...(workItem ? { workItem } : {}), ...(session ? { session } : {}) };
      };

      const settledUntil = now - ACTIVITY_SETTLE_MS;
      const expiredBefore = maxAgeMs === undefined ? -Infinity : now - maxAgeMs;
      const events = [];
      let next = cursor;
      let unsettled = false;
      let expired = false;
      for (const event of page.events) {
        const at = event.occurredAt.getTime();
        if (at > settledUntil) {
          unsettled = true;
          break;
        }
        // Skipped rows still advance the cursor, so a filtered-out page isn't read again.
        next = encodeAuditCursor(event);
        if (at < expiredBefore) {
          expired = true;
          continue;
        }
        if (args.workItemId && !event.targets.some(t => t.type === 'work_item' && t.id === args.workItemId)) continue;
        const subject = await subjectOf(event);
        if (!subject) continue;
        events.push({ eventId: event.id, timestamp: event.occurredAt, data: toActivity(event, subject) });
      }
      return {
        events,
        cursor: next,
        ...(page.nextCursor && !unsettled ? { hasMore: true } : {}),
        ...(expired ? { truncated: true } : {}),
      };
    },
  });
}
