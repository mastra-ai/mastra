import type { AgentControllerRequestContext } from '@mastra/core/agent-controller';
import type { RequestContext } from '@mastra/core/request-context';
import type { ApiRoute } from '@mastra/core/server';
import { registerApiRoute } from '@mastra/core/server';
import type { FactoryStorage } from '@mastra/core/storage';
import type { Context } from 'hono';

import type { WebAuthUser } from '../auth';
import { ensureWebAuthUser, getWebAuthOrgId, getWebAuthUserId, webAuthTenant } from '../auth';
import { FactoryDomain } from '../factory-domain';
import type { FactoryIntegration } from '../factory-integration';
import type {
  AuditContext,
  AuditEventPage,
  AuditEventRow,
  AuditTarget,
  ListAuditEventsInput,
  RecordAuditEventInput,
} from '../storage/domains/audit/base';
import { AuditStorage } from '../storage/domains/audit/base';
import { FactoryProjectsStorage } from '../storage/domains/projects/base';

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

interface FactorySessionState {
  factoryProjectId?: string;
  projectRepositoryId?: string;
}

export interface AuditDomainOptions {
  storage: FactoryStorage;
  integrations?: FactoryIntegration[];
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_ACTION_FILTERS = 16;

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

/** Factory-owned audit behavior backed by the separately registered audit storage domain. */
export class AuditDomain extends FactoryDomain implements AuditEmitter, AuditAgentEmitter {
  readonly #integrations: FactoryIntegration[];

  constructor({ storage, integrations = [] }: AuditDomainOptions) {
    super({ storage });
    this.#integrations = integrations;

    const ids = new Set<string>();
    for (const integration of this.#integrations) {
      if (!integration.id) throw new Error('Audit integration id must not be empty');
      if (ids.has(integration.id)) throw new Error(`Duplicate audit integration id '${integration.id}'`);
      ids.add(integration.id);
    }
  }

  async record(input: RecordAuditEventInput): Promise<AuditEventRow | null> {
    try {
      await this.storage.ensureDomainReady('audit');
      const row = await this.storage.getDomain<AuditStorage>('audit').record(input);
      for (const integration of this.#integrations) {
        if (!integration.audit) continue;
        void Promise.resolve()
          .then(() => integration.audit?.({ event: row }))
          .catch(err => {
            console.warn('[Audit] Audit integration failed', {
              integration: integration.id,
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
    await this.storage.ensureDomainReady('audit');
    return this.storage.getDomain<AuditStorage>('audit').list(input);
  }

  async emit({ context, input }: { context: Context; input: EmitAuditInput }): Promise<void> {
    try {
      const tenant = webAuthTenant(context);
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
        AgentControllerRequestContext<FactorySessionState> | undefined;
      const user = requestContext.get('user') as WebAuthUser | undefined;
      const orgId = getWebAuthOrgId(user);
      const userId = getWebAuthUserId(user);
      const threadId = context?.threadId;
      const state = context?.getState();
      if (!orgId || !userId || !threadId || !state?.factoryProjectId) return;

      await this.record({
        orgId,
        actorId: `agent:${threadId}`,
        actorType: 'agent',
        action: input.action,
        targets: input.targets,
        metadata: { ...input.metadata, startedBy: userId },
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
          await this.storage.ensureDomainReady('projects');
          const project = await this.storage
            .getDomain<FactoryProjectsStorage>('projects')
            .get({ orgId: tenant.orgId, id: projectId });
          if (!project) return c.json({ error: 'Project not found' }, 404);

          const page = await this.list({
            orgId: tenant.orgId,
            factoryProjectId: projectId,
            actions: parseActionsParam(c.req.query('actions')),
            actorId: c.req.query('actor') || undefined,
            before: c.req.query('before') || undefined,
            limit: parseLimitParam(c.req.query('limit')),
          });
          return c.json(page);
        },
      }),
    ];
  }

  async #resolveTenant(c: Context): Promise<{ orgId: string; userId: string } | { response: Response }> {
    await ensureWebAuthUser(c);
    const tenant = webAuthTenant(c);
    if (!tenant) return { response: c.json({ error: 'unauthorized' }, 401) };
    if (!tenant.orgId) {
      return {
        response: c.json(
          { error: 'organization_required', message: 'The audit trail requires a WorkOS organization.' },
          403,
        ),
      };
    }
    return { orgId: tenant.orgId, userId: tenant.userId };
  }
}
