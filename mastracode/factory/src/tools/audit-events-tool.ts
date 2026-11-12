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
const SESSION_ACTOR_PREFIX = 'session:';

export interface FactoryAuditToolDependencies {
  workItems: FactoryReadToolDependencies['workItems'];
  audit: FactoryReadToolDependencies['audit'];
  messaging?: FactoryReadToolDependencies['messaging'];
  /** Finds the sessions an event names or an agent ran in, to leave out other people's private sessions. */
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
 * never emails, no metadata beyond what was acted on, and no events from or
 * about another person's private session.
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
      const visible = eventVisibility(scope, deps);

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

/** Sessions an event names: its session targets and the session it records it acted in. */
function sessionRefs(event: AuditEventRow): string[] {
  const ids = event.targets.filter(target => target.type === 'session').map(target => target.id);
  const recorded = event.metadata?.sessionId;
  if (typeof recorded === 'string') ids.push(recorded);
  return [...new Set(ids)];
}

/**
 * Whether the caller may see an event. An event that names a session, or an
 * agent's act (which belongs to the session it ran in), is only visible when
 * every such session is shared or the caller's own. Fails closed when a
 * session can't be found.
 */
function eventVisibility(scope: FactoryToolScope, deps: FactoryAuditToolDependencies) {
  const sessions = new Map<string, Promise<boolean>>();
  const threads = new Map<string, Promise<boolean>>();
  let runs: Promise<{ threads: Set<string>; sessions: Set<string> }> | undefined;
  // Work item runs are on the board for everyone in the Factory.
  const boardRuns = () =>
    (runs ??= deps.workItems.listRunBindings(scope.orgId, scope.factoryProjectId).then(bindings => ({
      threads: new Set(bindings.map(binding => binding.threadId)),
      sessions: new Set(bindings.map(binding => binding.sessionId)),
    })));

  const sessionVisible = (sessionId: string): Promise<boolean> => {
    let result = sessions.get(sessionId);
    if (!result) {
      result = (async () => {
        const row = await deps.sessions?.getBySessionId(sessionId);
        if (!row || row.orgId !== scope.orgId || row.factoryProjectId !== scope.factoryProjectId) return false;
        return row.visibility !== 'private' || row.userId === scope.userId;
      })().catch(() => false);
      sessions.set(sessionId, result);
    }
    return result;
  };

  const threadVisible = async (threadId: string): Promise<boolean> => {
    if ((await boardRuns()).threads.has(threadId)) return true;

    const controller = (await deps.messaging?.())?.controller;
    if (!controller) return false;
    const thread = await controller.queryThreadById({ threadId });
    if (!thread) return false;
    const stamped = thread.metadata?.factorySessionId;
    return sessionVisible(typeof stamped === 'string' ? stamped : thread.id);
  };

  const agentVisible = (event: AuditEventRow): Promise<boolean> | boolean => {
    if (startedBy(event) === scope.userId) return true;
    if (!event.actorId.startsWith(AGENT_ACTOR_PREFIX)) return false;
    const threadId = event.actorId.slice(AGENT_ACTOR_PREFIX.length);
    let result = threads.get(threadId);
    if (!result) {
      // Turns nobody signed in started are recorded as their session's agent: `agent:session:<sessionId>`.
      const sessionId = threadId.startsWith(SESSION_ACTOR_PREFIX)
        ? threadId.slice(SESSION_ACTOR_PREFIX.length)
        : undefined;
      result = (
        sessionId
          ? boardRuns().then(({ sessions }) => sessions.has(sessionId) || sessionVisible(sessionId))
          : threadVisible(threadId)
      ).catch(() => false);
      threads.set(threadId, result);
    }
    return result;
  };

  return async (event: AuditEventRow): Promise<boolean> => {
    if (event.actorType === 'agent' && !(await agentVisible(event))) return false;
    for (const sessionId of sessionRefs(event)) {
      if (!(await sessionVisible(sessionId))) return false;
    }
    return true;
  };
}
