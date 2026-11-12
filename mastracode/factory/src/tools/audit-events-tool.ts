import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { SourceControlSessionLookup } from '../session/factory-session.js';
import { auditActionsInNamespaces, auditNamespaces, isAuditAction } from '../storage/domains/audit/actions.js';
import type { AuditNamespace } from '../storage/domains/audit/actions.js';
import {
  ACTOR_PROFILE_METADATA_KEY,
  auditCursorAt,
  decodeAuditAfterCursor,
  encodeAuditCursor,
} from '../storage/domains/audit/base.js';
import type { AuditEventRow } from '../storage/domains/audit/base.js';
import type { FactoryReadToolDependencies } from './read-tools.js';
import { MAX_LIST, MAX_TEXT, findWorkItem, truncate, workItemNotFound, workItemRefSchema } from './read-tools.js';
import type { FactoryToolScope } from './scope.js';

const DEFAULT_LIMIT = 25;
const PAGE_SIZE = 200;
/** Pages read per call before handing back a cursor, so a narrow filter can't scan the whole trail at once. */
const MAX_PAGES = 5;
const AGENT_ACTOR_PREFIX = 'agent:';

export interface FactoryAuditToolDependencies {
  workItems: FactoryReadToolDependencies['workItems'];
  audit: FactoryReadToolDependencies['audit'];
  messaging?: FactoryReadToolDependencies['messaging'];
  /** Finds the session an agent event ran in, to leave out other people's private sessions. */
  sessions?: Pick<SourceControlSessionLookup, 'getBySessionId'>;
}

const namespaces = auditNamespaces() as [AuditNamespace, ...AuditNamespace[]];

const inputSchema = z
  .object({
    actor: z
      .string()
      .trim()
      .min(1)
      .max(200)
      .optional()
      .describe('"me", a user id, or an agent actor id like "agent:<threadId>". Only events this actor performed.'),
    includeAgentRuns: z
      .boolean()
      .optional()
      .describe('With a person as `actor`: also include what agents did in runs that person started.'),
    namespace: z.enum(namespaces).optional().describe('Only actions in this namespace, e.g. "work_item" or "run".'),
    actions: z
      .array(z.string().refine(isAuditAction, { message: 'Not a Factory audit action.' }))
      .min(1)
      .max(50)
      .optional()
      .describe('Only these exact actions, e.g. ["factory.work_item.stage_moved"].'),
    workItem: workItemRefSchema.optional().describe('Only events that acted on this work item (id or "#123").'),
    since: z.iso.datetime({ offset: true }).optional().describe('Only events at or after this ISO time.'),
    until: z.iso.datetime({ offset: true }).optional().describe('Only events before this ISO time.'),
    cursor: z.string().min(1).max(200).optional().describe('`nextCursor` from a previous call, to read older events.'),
    limit: z.number().int().min(1).max(MAX_LIST).optional().describe(`Default ${DEFAULT_LIMIT}, max ${MAX_LIST}.`),
  })
  .strict();

/** A display name stamped at record time, or nothing when it is an email (the fallback when a person has no name). */
function actorName(event: AuditEventRow): string | undefined {
  const profile = event.metadata?.[ACTOR_PROFILE_METADATA_KEY] as { name?: unknown } | undefined;
  const name = typeof profile?.name === 'string' ? profile.name.trim() : '';
  return name && !name.includes('@') ? truncate(name, MAX_TEXT) : undefined;
}

function startedBy(event: AuditEventRow): string | undefined {
  const value = event.metadata?.startedBy;
  return event.actorType === 'agent' && typeof value === 'string' ? value : undefined;
}

/**
 * Who did what in this Factory, from its audit trail. The trail is org-wide and
 * its reads are unscoped by design, so this tool narrows what it hands back:
 * only this Factory's events, never request context (IP, user agent), names but
 * never emails, no metadata beyond what was acted on, and no agent events from
 * another person's private session.
 */
export function createAuditEventsTool(scope: FactoryToolScope, deps: FactoryAuditToolDependencies) {
  const project = { orgId: scope.orgId, factoryProjectId: scope.factoryProjectId };

  return createTool({
    id: 'factory_list_audit_events',
    description:
      'List this Factory\'s audit events, newest first: who did what to which work item, run, branch or setting, and when. Filter by actor ("me" or a user id, optionally with the agent runs they started), action namespace or exact actions, work item, and time range. Pass `nextCursor` back as `cursor` for older events. Events from other people\'s private sessions are left out.',
    inputSchema,
    execute: async input => {
      if (input.cursor && !decodeAuditAfterCursor(input.cursor)) {
        throw new Error('That cursor is not one this tool returned.');
      }
      const since = input.since ? new Date(input.since) : undefined;
      const until = input.until ? new Date(input.until) : undefined;
      if (since && until && since >= until) throw new Error('`since` must be before `until`.');
      if (input.includeAgentRuns && (!input.actor || input.actor.startsWith(AGENT_ACTOR_PREFIX))) {
        throw new Error('`includeAgentRuns` needs a person as `actor`.');
      }

      let workItemId: string | undefined;
      if (input.workItem) {
        const item = await findWorkItem(deps.workItems, scope, input.workItem);
        if (!item) throw workItemNotFound(input.workItem);
        workItemId = item.id;
      }

      const namespaceActions = input.namespace ? auditActionsInNamespaces([input.namespace]) : undefined;
      const actions =
        input.actions && namespaceActions
          ? input.actions.filter(action => namespaceActions.includes(action))
          : (input.actions ?? namespaceActions);
      if (actions && actions.length === 0) return { events: [] };

      const actorId = input.actor === 'me' ? scope.userId : input.actor;
      const limit = input.limit ?? DEFAULT_LIMIT;
      const visible = agentVisibility(scope, deps);

      const events: ReturnType<typeof summarize>[] = [];
      let before = input.cursor ?? (until ? auditCursorAt(until) : undefined);
      // `auditCursorAt` sits after every row at that instant; `until` excludes them.
      const beforeUntil = (event: AuditEventRow) => !until || event.occurredAt < until;
      for (let page = 0; page < MAX_PAGES; page++) {
        const result = await deps.audit.list({
          ...project,
          ...(actions ? { actions } : {}),
          ...(actorId && !input.includeAgentRuns ? { actorId } : {}),
          ...(before ? { before } : {}),
          limit: PAGE_SIZE,
        });
        for (const event of result.events) {
          if (since && event.occurredAt < since) return { events };
          if (!beforeUntil(event)) continue;
          if (actorId && event.actorId !== actorId && startedBy(event) !== actorId) continue;
          if (workItemId && !event.targets.some(target => target.type === 'work_item' && target.id === workItemId)) {
            continue;
          }
          if (!(await visible(event))) continue;
          events.push(summarize(event));
          if (events.length === limit) return { events, nextCursor: encodeAuditCursor(event) };
        }
        if (!result.nextCursor) return { events };
        before = result.nextCursor;
      }
      // Scan budget spent: hand back where to pick up, even with fewer events than asked for.
      return { events, nextCursor: before };
    },
  });
}

function summarize(event: AuditEventRow) {
  const name = actorName(event);
  const runStartedBy = startedBy(event);
  return {
    action: event.action,
    occurredAt: event.occurredAt.toISOString(),
    actor: { type: event.actorType, id: event.actorId, ...(name ? { name } : {}) },
    ...(runStartedBy ? { startedBy: runStartedBy } : {}),
    targets: event.targets.slice(0, 10).map(target => ({
      type: target.type,
      id: truncate(target.id, MAX_TEXT),
      ...(target.name ? { name: truncate(target.name, MAX_TEXT) } : {}),
    })),
  };
}

/**
 * Whether the caller may see an event. People's own acts show what the board
 * already shows; an agent's act belongs to the session it ran in, which may be
 * someone's private session. Fails closed when the session can't be found.
 */
function agentVisibility(scope: FactoryToolScope, deps: FactoryAuditToolDependencies) {
  const cache = new Map<string, Promise<boolean>>();
  let runThreads: Promise<Set<string>> | undefined;

  const threadVisible = async (threadId: string): Promise<boolean> => {
    // Work item runs are on the board for everyone in the Factory.
    runThreads ??= deps.workItems
      .listRunBindings(scope.orgId, scope.factoryProjectId)
      .then(bindings => new Set(bindings.map(binding => binding.threadId)));
    if ((await runThreads).has(threadId)) return true;

    const controller = (await deps.messaging?.())?.controller;
    if (!controller || !deps.sessions) return false;
    const thread = await controller.queryThreadById({ threadId });
    if (!thread) return false;
    const stamped = thread.metadata?.factorySessionId;
    const sessionId = typeof stamped === 'string' ? stamped : thread.id;
    const row = await deps.sessions.getBySessionId(sessionId);
    if (!row || row.orgId !== scope.orgId || row.factoryProjectId !== scope.factoryProjectId) return false;
    return row.visibility !== 'private' || row.userId === scope.userId;
  };

  return async (event: AuditEventRow): Promise<boolean> => {
    if (event.actorType !== 'agent') return true;
    if (startedBy(event) === scope.userId) return true;
    if (!event.actorId.startsWith(AGENT_ACTOR_PREFIX)) return false;
    const threadId = event.actorId.slice(AGENT_ACTOR_PREFIX.length);
    let result = cache.get(threadId);
    if (!result) {
      result = threadVisible(threadId).catch(() => false);
      cache.set(threadId, result);
    }
    return result;
  };
}
