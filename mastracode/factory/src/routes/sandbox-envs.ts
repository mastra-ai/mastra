import type { ApiRoute } from '@mastra/core/server';
import { registerApiRoute } from '@mastra/core/server';
import type { Context } from 'hono';

import type { AuditEmitter, EmitAuditInput } from '../storage/domains/audit/domain.js';
import type { FactoryProjectsStorage } from '../storage/domains/projects/base.js';
import type { SandboxEnvMetadata, SandboxEnvStore } from '../storage/domains/sandbox-envs/base.js';
import { FACTORY_ROUTE_CONTRACTS, UUID_PATTERN } from './contracts.js';
import type { RouteDependencies } from './route.js';
import { loose, Route } from './route.js';

const UUID_RE = new RegExp(UUID_PATTERN);

export interface SandboxEnvRoutesDeps extends RouteDependencies {
  projects: Pick<FactoryProjectsStorage, 'get'>;
  sandboxEnvs: SandboxEnvStore;
  /**
   * False when auth is on but no secret encryption is configured: values would
   * be stored as plaintext, so writes are refused and the UI says why.
   */
  writable: boolean;
  audit?: AuditEmitter;
  /** Called after a variable changed; Build variables are part of the environment template. */
  onEnvironmentSaved?: (projectId: string) => void;
}

type Resolved = { orgId: string; userId: string; projectId: string };

function payload(env: SandboxEnvMetadata) {
  return { name: env.name, appliesTo: env.appliesTo, updatedAt: env.updatedAt.toISOString(), updatedBy: env.updatedBy };
}

/**
 * Factory-wide sandbox environment variables. Values go in through PUT and
 * never come back out: every response carries names and settings only, and
 * none may be cached.
 */
export class SandboxEnvRoutes extends Route<SandboxEnvRoutesDeps> {
  async #resolve(context: Context): Promise<Resolved | { response: Response }> {
    await this.deps.auth.ensureUser(context);
    const tenant = this.deps.auth.tenant(context);
    if (!tenant) return { response: context.json({ error: 'unauthorized' }, 401) };
    if (!tenant.orgId) {
      return {
        response: context.json(
          { error: 'organization_required', message: 'Factory projects require an organization.' },
          403,
        ),
      };
    }
    const projectId = context.req.param('id');
    if (!projectId || !UUID_RE.test(projectId)) return { response: context.json({ error: 'Project not found' }, 404) };
    const project = await this.deps.projects.get({ orgId: tenant.orgId, id: projectId });
    if (!project) return { response: context.json({ error: 'Project not found' }, 404) };
    return { orgId: tenant.orgId, userId: tenant.userId, projectId };
  }

  /** Validates the `:name` param; the schema names why a name is refused. */
  #name(context: Context): { name: string } | { response: Response } {
    const parsed = FACTORY_ROUTE_CONTRACTS.projectSandboxEnvSet.pathSchema.safeParse(context.req.param());
    if (parsed.success) return { name: parsed.data.name };
    const issue = parsed.error.issues.find(candidate => candidate.path[0] === 'name') ?? parsed.error.issues[0];
    const name = context.req.param('name') ?? '';
    return {
      response: context.json({ error: 'invalid_name', message: `${name}: ${issue?.message ?? 'Invalid name.'}` }, 400),
    };
  }

  async #body(context: Context): Promise<{ body: unknown } | { response: Response }> {
    const type = context.req.header('content-type') ?? '';
    if (!/^application\/json\b/i.test(type)) {
      return { response: context.json({ error: 'unsupported_media_type' }, 415) };
    }
    try {
      return { body: await context.req.json() };
    } catch {
      return { response: context.json({ error: 'invalid_body' }, 400) };
    }
  }

  /** Audit is best-effort: an event the mirror rejects must never fail the write. */
  async #audit(context: Context, scope: Resolved, input: Omit<EmitAuditInput, 'factoryProjectId'>) {
    try {
      await this.deps.audit?.emit({ context, input: { ...input, factoryProjectId: scope.projectId } });
    } catch (error) {
      console.warn('[factory] Failed to record sandbox env audit event', {
        action: input.action,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  #route(
    contract: { path: string; method: 'GET' | 'PUT' | 'PATCH' | 'DELETE' },
    handle: (context: Context, scope: Resolved) => Promise<Response>,
  ): ApiRoute {
    return registerApiRoute(contract.path, {
      method: contract.method,
      requiresAuth: false,
      handler: async routeContext => {
        const context = loose(routeContext);
        const scope = await this.#resolve(context);
        const response = 'response' in scope ? scope.response : await handle(context, scope);
        response.headers.set('Cache-Control', 'no-store');
        return response;
      },
    });
  }

  routes(): ApiRoute[] {
    const contracts = FACTORY_ROUTE_CONTRACTS;
    const refused = (context: Context) =>
      context.json(
        {
          error: 'encryption_not_configured',
          message: 'Configure a credential encryption key before saving sandbox environment variables.',
        },
        409,
      );
    return [
      this.#route(contracts.projectSandboxEnvsList, async (context, scope) => {
        const envs = await this.deps.sandboxEnvs.list(scope.orgId, scope.projectId);
        return context.json({ envs: envs.map(payload), writable: this.deps.writable });
      }),
      this.#route(contracts.projectSandboxEnvSet, async (context, scope) => {
        const name = this.#name(context);
        if ('response' in name) return name.response;
        if (!this.deps.writable) return refused(context);
        const body = await this.#body(context);
        if ('response' in body) return body.response;
        const parsed = contracts.projectSandboxEnvSet.bodySchema.safeParse(body.body);
        if (!parsed.success) {
          return context.json({ error: 'invalid_sandbox_env', message: parsed.error.issues[0]?.message }, 400);
        }
        const env = await this.deps.sandboxEnvs.set(
          scope.orgId,
          scope.projectId,
          { name: name.name, value: parsed.data.value, appliesTo: parsed.data.appliesTo },
          scope.userId,
        );
        await this.#audit(context, scope, {
          action: 'factory.sandbox_env.set',
          targets: [{ type: 'sandbox_env', id: env.name, name: env.name }],
          metadata: { appliesTo: env.appliesTo },
        });
        this.deps.onEnvironmentSaved?.(scope.projectId);
        return context.json({ env: payload(env) });
      }),
      this.#route(contracts.projectSandboxEnvUpdate, async (context, scope) => {
        const name = this.#name(context);
        if ('response' in name) return name.response;
        if (!this.deps.writable) return refused(context);
        const body = await this.#body(context);
        if ('response' in body) return body.response;
        const parsed = contracts.projectSandboxEnvUpdate.bodySchema.safeParse(body.body);
        if (!parsed.success) {
          return context.json({ error: 'invalid_sandbox_env', message: parsed.error.issues[0]?.message }, 400);
        }
        const env = await this.deps.sandboxEnvs.updateAppliesTo(
          scope.orgId,
          scope.projectId,
          name.name,
          parsed.data.appliesTo,
          scope.userId,
        );
        if (!env) return context.json({ error: 'Variable not found', message: 'Variable not found.' }, 404);
        await this.#audit(context, scope, {
          action: 'factory.sandbox_env.updated',
          targets: [{ type: 'sandbox_env', id: env.name, name: env.name }],
          metadata: { appliesTo: env.appliesTo },
        });
        this.deps.onEnvironmentSaved?.(scope.projectId);
        return context.json({ env: payload(env) });
      }),
      this.#route(contracts.projectSandboxEnvDelete, async (context, scope) => {
        const name = this.#name(context);
        if ('response' in name) return name.response;
        // Deleting stays allowed without encryption, so a plaintext value can always be removed.
        if (!(await this.deps.sandboxEnvs.delete(scope.orgId, scope.projectId, name.name))) {
          return context.json({ error: 'Variable not found', message: 'Variable not found.' }, 404);
        }
        await this.#audit(context, scope, {
          action: 'factory.sandbox_env.deleted',
          targets: [{ type: 'sandbox_env', id: name.name, name: name.name }],
        });
        this.deps.onEnvironmentSaved?.(scope.projectId);
        return context.body(null, 204);
      }),
    ];
  }
}
