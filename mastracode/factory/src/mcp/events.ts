import { defineEvent } from '@mastra/mcp';
import { z } from 'zod';

import { parseAuditAction } from '../storage/domains/audit/actions.js';
import type { AuditStorage, AuditEventRow } from '../storage/domains/audit/base.js';
import { ACTOR_PROFILE_METADATA_KEY, decodeAuditCursor, encodeAuditCursor } from '../storage/domains/audit/base.js';
import type { WorkItemsStorage } from '../storage/domains/work-items/base.js';

/** Sorts before every audit row, so polling from it misses nothing recorded later. */
const START_OF_TRAIL = `${new Date(0).toISOString()}_0`;

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
    type: z.enum(['human', 'agent', 'system']),
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
}

function workItemTarget(event: AuditEventRow) {
  return event.targets.find(target => target.type === 'work_item');
}

function toActivity(event: AuditEventRow): FactoryActivity {
  const workItem = workItemTarget(event);
  const sessionId = event.targets.find(target => target.type === 'session')?.id;
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
    ...(sessionId ? { sessionId } : {}),
    summary: workItem ? `${verb}: ${workItem.name ?? workItem.id}` : verb,
  };
}

/**
 * `factory.activity`: the Factory's audit trail as polled MCP events (SEP-3415, experimental).
 *
 * Only work item activity is served — the same events `factory_inspect_work_item`
 * already shows any member of the Factory. Session-only activity (signals, git
 * pushes from private sessions) stays out until the trail has a visibility rule.
 *
 * Poll-only by design: the MCP server is built per request, so there is nothing
 * to push from, and every poll reads storage from the client's cursor.
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
    poll: async ({ arguments: args, cursor, maxEvents }) => {
      const start = cursor && decodeAuditCursor(cursor) ? cursor : undefined;
      if (!start) {
        // No cursor means "from now". An unreadable one can't be resumed, so say events may have been missed.
        const newest = (await deps.audit.list({ ...project, limit: 1 })).events[0];
        return {
          events: [],
          cursor: newest ? encodeAuditCursor(newest) : START_OF_TRAIL,
          ...(cursor ? { truncated: true } : {}),
        };
      }

      const page = await deps.audit.list({
        ...project,
        ...(args.actions?.length ? { actions: args.actions } : {}),
        after: start,
        limit: maxEvents,
      });
      const last = page.events.at(-1);
      return {
        events: page.events
          .filter(event => {
            const workItem = workItemTarget(event);
            return workItem !== undefined && (!args.workItemId || workItem.id === args.workItemId);
          })
          .map(event => ({ eventId: event.id, timestamp: event.occurredAt, data: toActivity(event) })),
        // Skipped rows still advance the cursor, so a filtered-out page isn't read again.
        cursor: last ? encodeAuditCursor(last) : start,
        ...(page.nextCursor ? { hasMore: true } : {}),
      };
    },
  });
}
