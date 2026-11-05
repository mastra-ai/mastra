import type { ApiRoute } from '@mastra/core/server';
import { registerApiRoute } from '@mastra/core/server';
import type { Context } from 'hono';
import type { z } from 'zod';

import type { AuditEmitter } from '../storage/domains/audit/domain.js';
import type { ConnectToolSettingsStorage } from '../storage/domains/connect-tools/base.js';
import { FACTORY_ROUTE_CONTRACTS } from './contracts.js';
import type { RouteDependencies } from './route.js';
import { Route } from './route.js';

export interface ConnectToolRoutesDeps extends RouteDependencies {
  audit: AuditEmitter;
  storage: ConnectToolSettingsStorage;
  available: () => boolean;
}

interface Resolved {
  orgId: string;
  userId: string;
}

class Refusal {
  constructor(
    readonly status: 400 | 401 | 403 | 422,
    readonly body: Record<string, unknown>,
  ) {}
}

function issueMessage(issues: readonly z.core.$ZodIssue[]): string {
  return issues
    .map(issue => (issue.path.length > 0 ? `${issue.path.join('.')}: ${issue.message}` : issue.message))
    .join('; ');
}

export class ConnectToolRoutes extends Route<ConnectToolRoutesDeps> {
  async #resolve(c: Context): Promise<Resolved> {
    const { auth } = this.deps;
    await auth.ensureUser(c);
    const tenant = auth.tenant(c);
    if (!tenant) throw new Refusal(401, { error: 'unauthorized' });
    if (!tenant.orgId) {
      throw new Refusal(403, { error: 'organization_required', message: 'Connect tools belong to an organization.' });
    }
    return { orgId: tenant.orgId, userId: tenant.userId };
  }

  async #requireAdmin(c: Context, scope: Resolved): Promise<void> {
    if (!(await this.deps.auth.isOrganizationAdmin(c, scope.orgId))) {
      throw new Refusal(403, {
        error: 'organization_admin_required',
        message: 'Organization administrator access is required to change Connect tools.',
      });
    }
  }

  async #body<T>(c: Context, schema: z.ZodType<T>): Promise<T> {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      throw new Refusal(400, { error: 'invalid_request', message: 'Invalid JSON body.' });
    }
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      throw new Refusal(422, { error: 'invalid_connect_tools', message: issueMessage(parsed.error.issues) });
    }
    return parsed.data;
  }

  async #audit(c: Context, scope: Resolved, enabledProviders: string[]): Promise<void> {
    await this.deps.audit.emit({
      context: c,
      input: {
        action: 'factory.connect_tools.updated',
        targets: [{ type: 'connect_tools', id: scope.orgId }],
        metadata: { enabledProviders },
      },
    });
  }

  async #respond(c: Context, scope: Resolved): Promise<Response> {
    const { storage, available } = this.deps;
    await storage.ensureReady();
    const enabledProviders = [...(await storage.get({ orgId: scope.orgId }))].sort();
    return c.json({
      available: available(),
      canEdit: await this.deps.auth.isOrganizationAdmin(c, scope.orgId),
      enabledProviders,
    });
  }

  #route(contract: { path: string; method: 'GET' | 'PUT' }, handle: (c: Context) => Promise<Response>): ApiRoute {
    return registerApiRoute(contract.path, {
      method: contract.method,
      requiresAuth: false,
      handler: async c => {
        try {
          return await handle(c);
        } catch (error) {
          if (error instanceof Refusal) return c.json(error.body, error.status);
          throw error;
        }
      },
    });
  }

  routes(): ApiRoute[] {
    const contracts = FACTORY_ROUTE_CONTRACTS;
    return [
      this.#route(contracts.connectToolsGet, async c => this.#respond(c, await this.#resolve(c))),
      this.#route(contracts.connectToolsUpdate, async c => {
        const scope = await this.#resolve(c);
        await this.#requireAdmin(c, scope);
        const { enabledProviders } = await this.#body(c, contracts.connectToolsUpdate.bodySchema);
        await this.deps.storage.ensureReady();
        await this.deps.storage.save({ orgId: scope.orgId, enabledProviders, updatedBy: scope.userId });
        await this.#audit(c, scope, enabledProviders);
        return this.#respond(c, scope);
      }),
    ];
  }
}
