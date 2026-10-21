import { defineEvent } from '@mastra/mcp';
import { z } from 'zod';

import { parseAuditAction } from '../storage/domains/audit/actions.js';
import { AUDIT_ACTOR_TYPES } from '../storage/domains/audit/actors.js';
import type { AuditStorage, AuditEventRow } from '../storage/domains/audit/base.js';
import {
  ACTOR_PROFILE_METADATA_KEY,
  auditCursorAt,
  decodeAuditAfterCursor,
  encodeAuditCursor,
} from '../storage/domains/audit/base.js';
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
  workItemId: z.string(),
  summary: z.string(),
});

export type FactoryActivity = z.infer<typeof activityPayload>;

export interface FactoryActivityEventDeps {
  orgId: string;
  factoryProjectId: string;
  audit: Pick<AuditStorage, 'list'>;
  workItems: Pick<WorkItemsStorage, 'getForProject'>;
}

function workItemTarget(event: AuditEventRow) {
  return event.targets.find(target => target.type === 'work_item');
}

function toActivity(event: AuditEventRow, workItem: { id: string; name?: string }): FactoryActivity {
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
    workItemId: workItem.id,
    summary: `${verb}: ${workItem.name ?? workItem.id}`,
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
 * Only work item activity is served — the same events `factory_inspect_work_item`
 * already shows any member of the Factory — and without session ids. Session
 * activity (signals, git pushes from private sessions) stays out until the
 * trail has a visibility rule.
 *
 * Poll-only by design: the MCP server is built per request, so there is nothing
 * to push from, and every poll reads storage from the client's cursor. Events are
 * delivered once they are {@link ACTIVITY_SETTLE_MS} old.
 */
export function factoryActivityEvent(deps: FactoryActivityEventDeps) {
  const project = { orgId: deps.orgId, factoryProjectId: deps.factoryProjectId };
  return defineEvent({
    description:
      'Activity on this Factory’s work items: created, updated, moved between stages, commented on, and the runs working on them.',
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
        const workItem = workItemTarget(event);
        if (!workItem || (args.workItemId && workItem.id !== args.workItemId)) continue;
        events.push({ eventId: event.id, timestamp: event.occurredAt, data: toActivity(event, workItem) });
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
