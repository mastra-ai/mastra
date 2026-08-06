import type { AgentControllerRequestContext } from '@mastra/core/agent-controller';
import type { RequestContext } from '@mastra/core/request-context';
import type { ApiRoute, IUserProvider } from '@mastra/core/server';
import { registerApiRoute } from '@mastra/core/server';
import type { Context } from 'hono';

import type { RouteAuth } from '../../../routes/route.js';
import type { FactoryProjectsStorage } from '../projects/base.js';
import type {
  AuditContext,
  AuditEventPage,
  AuditEventRow,
  AuditStorage,
  AuditTarget,
  ListAuditEventsInput,
  RecordAuditEventInput,
} from './base.js';

export interface EmitAuditInput {
  action: string;
  factoryProjectId?: string;
  projectRepositoryId?: string;
  targets: AuditTarget[];
  metadata?: Record<string, unknown>;
}

export interface EmitAgentAuditInput {
  action: string;
  targets: AuditTarget[];
  metadata?: Record<string, unknown>;
}

export interface AuditEmitter {
  emit(args: { context: Context; input: EmitAuditInput }): Promise<void>;
}

export interface AuditAgentEmitter {
  emitAgent(args: { requestContext: RequestContext; input: EmitAgentAuditInput }): Promise<void>;
}

/** Best-effort destination for locally persisted audit events (e.g. an integration's audit log). */
export interface AuditSink {
  id: string;
  audit?(args: { event: AuditEventRow }): Promise<void>;
}

interface FactorySessionState {
  factoryProjectId?: string;
  projectRepositoryId?: string;
}

export interface AuditActorProfile {
  id: string;
  name: string;
  avatarUrl?: string;
}

export interface AuditDomainOptions {
  auth: RouteAuth;
  /** Audit storage domain handle. */
  audit: AuditStorage;
  /** Projects domain handle, used to scope the audit trail route. */
  projects: FactoryProjectsStorage;
  /** Resolve persisted human actor ids to display names and profile images. */
  users?: Pick<IUserProvider, 'getUser' | 'getUsers'>;
  /** Best-effort fan-out destinations notified after each recorded event. */
  sinks?: AuditSink[];
  /** Resolve the acting tenant for agent-emitted events from the request context. */
  agentTenant?: (requestContext: RequestContext) => { orgId?: string; userId?: string } | undefined;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_ACTION_FILTERS = 16;
const MAX_ACTOR_PROFILES = 100;
const AUTOMATION_ACTORS = new Set([
  'factory',
  'system',
  'automation',
  'factory-rule-dispatcher',
  'factory-tool-result-rule',
]);

function loose(c: unknown): Context {
  return c as Context;
}

function parseActionsParam(raw: string | undefined): string[] | undefined {
  if (!raw) return undefined;
  const actions = raw
    .split(',')
    .map(action => action.trim())
    .filter(Boolean)
    .slice(0, MAX_ACTION_FILTERS);
  return actions.length > 0 ? actions : undefined;
}

function isHumanActorId(actorId: string | undefined): actorId is string {
  if (!actorId) return false;
  return !AUTOMATION_ACTORS.has(actorId) && !actorId.startsWith('agent:') && !actorId.startsWith('github:');
}

function parseActorIdsParam(raw: string | undefined): string[] {
  if (!raw) return [];
  return [
    ...new Set(
      raw
        .split(',')
        .map(actorId => actorId.trim())
        .filter(isHumanActorId),
    ),
  ].slice(0, MAX_ACTOR_PROFILES);
}

function parseLimitParam(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  const limit = Number.parseInt(raw, 10);
  return Number.isFinite(limit) ? limit : undefined;
}

export function auditRequestContext(c: Context): AuditContext {
  const location = c.req.header('x-forwarded-for')?.split(',')[0]?.trim();
  const userAgent = c.req.header('user-agent');
  return {
    ...(location ? { location } : {}),
    ...(userAgent ? { userAgent } : {}),
  };
}

/** Factory-owned audit behavior backed by the audit storage domain. */
export class AuditDomain implements AuditEmitter, AuditAgentEmitter {
  readonly #auth: RouteAuth;
  readonly #audit: AuditStorage;
  readonly #projects: FactoryProjectsStorage;
  readonly #users: AuditDomainOptions['users'];
  readonly #sinks: AuditSink[];
  readonly #agentTenant: AuditDomainOptions['agentTenant'];

  constructor({ auth, audit, projects, users, sinks = [], agentTenant }: AuditDomainOptions) {
    this.#auth = auth;
    this.#audit = audit;
    this.#projects = projects;
    this.#users = users;
    this.#sinks = sinks;
    this.#agentTenant = agentTenant;

    const ids = new Set<string>();
    for (const sink of this.#sinks) {
      if (!sink.id) throw new Error('Audit integration id must not be empty');
      if (ids.has(sink.id)) throw new Error(`Duplicate audit integration id '${sink.id}'`);
      ids.add(sink.id);
    }
  }

  async record(input: RecordAuditEventInput): Promise<AuditEventRow | null> {
    try {
      await this.#audit.ensureReady();
      const row = await this.#audit.record(input);
      for (const sink of this.#sinks) {
        if (!sink.audit) continue;
        void Promise.resolve()
          .then(() => sink.audit?.({ event: row }))
          .catch(err => {
            console.warn('[Audit] Audit integration failed', {
              integration: sink.id,
              action: row.action,
              error: err instanceof Error ? err.message : String(err),
            });
          });
      }
      return row;
    } catch (err) {
      console.warn('[Audit] Failed to record audit event', {
        action: input.action,
        error: err instanceof Error ? err.message : String(err),
      });
      return null;
    }
  }

  async list(input: ListAuditEventsInput): Promise<AuditEventPage> {
    await this.#audit.ensureReady();
    return this.#audit.list(input);
  }

  async emit({ context, input }: { context: Context; input: EmitAuditInput }): Promise<void> {
    try {
      const tenant = this.#auth.tenant(context);
      if (!tenant?.orgId) return;
      await this.record({
        orgId: tenant.orgId,
        actorId: tenant.userId,
        action: input.action,
        targets: input.targets,
        metadata: input.metadata,
        factoryProjectId: input.factoryProjectId,
        projectRepositoryId: input.projectRepositoryId,
        context: auditRequestContext(context),
      });
    } catch (err) {
      console.warn('[Audit] Failed to emit audit event', {
        action: input.action,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  async emitAgent({
    requestContext,
    input,
  }: {
    requestContext: RequestContext;
    input: EmitAgentAuditInput;
  }): Promise<void> {
    try {
      const context = requestContext.get('controller') as
        | AgentControllerRequestContext<FactorySessionState>
        | undefined;
      const tenant = this.#agentTenant?.(requestContext);
      const orgId = tenant?.orgId;
      const userId = tenant?.userId;
      const threadId = context?.threadId;
      const state = context?.getState();
      if (!orgId || !userId || !threadId || !state?.factoryProjectId) return;

      const modeId = context.session.modeId?.trim();
      const modelId = context.session.modelId?.trim();
      await this.record({
        orgId,
        actorId: `agent:${threadId}`,
        actorType: 'agent',
        action: input.action,
        targets: input.targets,
        metadata: {
          ...input.metadata,
          startedBy: userId,
          ...(modeId ? { agentName: `${modeId} agent` } : {}),
          ...(modelId ? { modelId } : {}),
        },
        factoryProjectId: state.factoryProjectId,
        projectRepositoryId: state.projectRepositoryId,
        context: {},
      });
    } catch (err) {
      console.warn('[Audit] Failed to emit agent audit event', {
        action: input.action,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  async #resolveActorProfiles(
    events: AuditEventRow[],
    requestedActorIds: string[] = [],
  ): Promise<Record<string, AuditActorProfile>> {
    if (!this.#users) return {};

    const actorIds = [
      ...new Set(
        [
          ...requestedActorIds,
          ...events.filter(event => event.actorType === 'human').map(event => event.actorId),
        ].filter(isHumanActorId),
      ),
    ].slice(0, MAX_ACTOR_PROFILES);
    if (actorIds.length === 0) return {};

    try {
      const users = this.#users.getUsers
        ? await this.#users.getUsers(actorIds)
        : await Promise.all(actorIds.map(actorId => this.#users?.getUser(actorId) ?? null));
      const profiles: Record<string, AuditActorProfile> = {};
      for (const [index, user] of users.entries()) {
        if (!user) continue;
        const name = user.name?.trim() || user.email?.trim() || user.id;
        profiles[actorIds[index] ?? user.id] = {
          id: user.id,
          name,
          ...(user.avatarUrl ? { avatarUrl: user.avatarUrl } : {}),
        };
      }
      return profiles;
    } catch (err) {
      console.warn('[Audit] Failed to resolve audit actor profiles', {
        error: err instanceof Error ? err.message : String(err),
      });
      return {};
    }
  }

  routes(): ApiRoute[] {
    return [
      registerApiRoute('/web/factory/projects/:id/audit', {
        method: 'GET',
        handler: async cc => {
          const c = loose(cc);
          const tenant = await this.#resolveTenant(c);
          if ('response' in tenant) return tenant.response;

          const projectId = c.req.param('id');
          if (!projectId || !UUID_RE.test(projectId)) return c.json({ error: 'Project not found' }, 404);
          await this.#projects.ensureReady();
          const project = await this.#projects.get({ orgId: tenant.orgId, id: projectId });
          if (!project) return c.json({ error: 'Project not found' }, 404);

          const page = await this.list({
            orgId: tenant.orgId,
            factoryProjectId: projectId,
            actions: parseActionsParam(c.req.query('actions')),
            actorId: c.req.query('actor') || undefined,
            before: c.req.query('before') || undefined,
            limit: parseLimitParam(c.req.query('limit')),
          });
          const actors = await this.#resolveActorProfiles(page.events, parseActorIdsParam(c.req.query('actorIds')));
          return c.json({ ...page, actors });
        },
      }),
    ];
  }

  async #resolveTenant(c: Context): Promise<{ orgId: string; userId: string } | { response: Response }> {
    await this.#auth.ensureUser(c);
    const tenant = this.#auth.tenant(c);
    if (!tenant) return { response: c.json({ error: 'unauthorized' }, 401) };
    if (!tenant.orgId) {
      return {
        response: c.json({ error: 'organization_required', message: 'The audit trail requires an organization.' }, 403),
      };
    }
    return { orgId: tenant.orgId, userId: tenant.userId };
  }
}
