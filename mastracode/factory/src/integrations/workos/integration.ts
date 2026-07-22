import { WorkOSAdminPortal } from '@mastra/auth-workos';
import type { ApiRoute } from '@mastra/core/server';
import { registerApiRoute } from '@mastra/core/server';
import type { Context } from 'hono';

import type { AuditEventRow } from '../../storage/domains/audit/base';
import type { FactoryIntegration, IntegrationContext } from '../base';

type WorkOSClient = ConstructorParameters<typeof WorkOSAdminPortal>[0];

const UNKNOWN_LOCATION = 'unknown';

function loose(c: unknown): Context {
  return c as Context;
}

function flattenMetadata(metadata: Record<string, unknown>): Record<string, string | number | boolean> {
  const flat: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (value === undefined || value === null) continue;
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      flat[key] = value;
      continue;
    }
    try {
      flat[key] = JSON.stringify(value);
    } catch {
      // Drop unserializable metadata rather than the event.
    }
  }
  return flat;
}

export function toWorkOSEvent(event: AuditEventRow): {
  action: string;
  occurredAt: Date;
  actor: { type: string; id: string };
  targets: Array<{ type: string; id: string; name?: string }>;
  context: { location: string; userAgent?: string };
  metadata: Record<string, string | number | boolean>;
} {
  return {
    action: event.action,
    occurredAt: event.occurredAt,
    actor: { type: event.actorType === 'agent' ? 'agent' : 'user', id: event.actorId },
    targets: event.targets.map(target => ({
      type: target.type,
      id: target.id,
      ...(target.name !== undefined ? { name: target.name } : {}),
    })),
    context: {
      location: event.context.location ?? UNKNOWN_LOCATION,
      ...(event.context.userAgent !== undefined ? { userAgent: event.context.userAgent } : {}),
    },
    metadata: flattenMetadata(event.metadata),
  };
}

/** Optional WorkOS mirror and Admin Portal route, independent of the auth adapter. */
export class WorkOSAuditIntegration implements FactoryIntegration {
  readonly id = 'workos';
  readonly #client: WorkOSClient;
  readonly #returnUrl: string;

  constructor({ client, returnUrl }: { client: WorkOSClient; returnUrl: string }) {
    this.#client = client;
    this.#returnUrl = returnUrl;
  }

  async audit({ event }: { event: AuditEventRow }): Promise<void> {
    try {
      await this.#client.auditLogs.createEvent(event.orgId, toWorkOSEvent(event));
    } catch (err) {
      console.warn('[Audit] Failed to forward audit event to WorkOS', {
        action: event.action,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  routes(ctx: IntegrationContext): ApiRoute[] {
    const { auth } = ctx;
    return [
      registerApiRoute('/web/audit/portal-link', {
        method: 'GET',
        handler: async cc => {
          const c = loose(cc);
          await auth.ensureUser(c);
          const tenant = auth.tenant(c);
          if (!tenant) return c.json({ error: 'unauthorized' }, 401);
          if (!tenant.orgId) {
            return c.json(
              { error: 'organization_required', message: 'The audit trail requires a WorkOS organization.' },
              403,
            );
          }

          try {
            const portal = new WorkOSAdminPortal(this.#client, { returnUrl: this.#returnUrl });
            const url = await portal.getPortalLink(tenant.orgId, 'audit_logs');
            return c.json({ url });
          } catch (err) {
            console.warn('[Audit] Failed to generate WorkOS Admin Portal link', {
              error: err instanceof Error ? err.message : String(err),
            });
            return c.json({ error: 'portal_link_failed' }, 502);
          }
        },
      }),
    ];
  }

  diagnostics(): Record<string, unknown> {
    return { configured: true };
  }
}
