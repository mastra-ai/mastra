import type { ApiRoute } from '@mastra/core/server';
import { registerApiRoute } from '@mastra/core/server';
import type { Context } from 'hono';

import type { AuditEmitter } from '../audit/domain';
import { ensureWebAuthUser, webAuthTenant } from '../auth';
import type { Intake, IntakeItem } from '../capabilities/intake';
import { getIntakeConfig, parseIntakeConfig, saveIntakeConfig } from './store';

interface IntakeIntegration {
  id: string;
  intake: Pick<Intake, 'listSources' | 'listItems'>;
}

interface AggregatedIntakeItem extends Omit<IntakeItem, 'source'> {
  integrationId: string;
  externalSource: {
    integrationId: string;
    type: string;
    externalId: string;
    url?: string;
  };
}

function loose(c: unknown): Context {
  return c as Context;
}

async function resolveTenant(c: Context): Promise<{ orgId: string; userId: string } | { response: Response }> {
  await ensureWebAuthUser(c);
  const tenant = webAuthTenant(c);
  if (!tenant) return { response: c.json({ error: 'unauthorized' }, 401) };
  if (!tenant.orgId) {
    return {
      response: c.json(
        { error: 'organization_required', message: 'Intake configuration requires an organization.' },
        403,
      ),
    };
  }
  return { orgId: tenant.orgId, userId: tenant.userId };
}

function encodeCursor(cursors: Record<string, string>): string | null {
  return Object.keys(cursors).length > 0 ? Buffer.from(JSON.stringify(cursors)).toString('base64url') : null;
}

function decodeCursor(value: string | undefined): Record<string, string> | null {
  if (!value) return {};
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as unknown;
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null;
    const entries = Object.entries(parsed);
    if (entries.some(([key, cursor]) => !key || typeof cursor !== 'string')) return null;
    return Object.fromEntries(entries) as Record<string, string>;
  } catch {
    return null;
  }
}

export function buildIntakeRoutes({
  audit,
  integrations = [],
}: {
  audit: AuditEmitter;
  integrations?: IntakeIntegration[];
}): ApiRoute[] {
  const integrationIds = integrations.map(integration => integration.id);

  return [
    registerApiRoute('/web/intake/config', {
      method: 'GET',
      requiresAuth: false,
      handler: async c => {
        const tenant = await resolveTenant(loose(c));
        if ('response' in tenant) return tenant.response;
        const config = await getIntakeConfig({ ...tenant, integrationIds });
        return c.json({ config });
      },
    }),
    registerApiRoute('/web/intake/config', {
      method: 'PUT',
      requiresAuth: false,
      handler: async c => {
        const tenant = await resolveTenant(loose(c));
        if ('response' in tenant) return tenant.response;

        let body: unknown;
        try {
          body = await c.req.json();
        } catch {
          return c.json({ error: 'Invalid JSON body' }, 400);
        }
        const config = parseIntakeConfig(body);
        if (!config || Object.keys(config).some(integrationId => !integrationIds.includes(integrationId))) {
          return c.json({ error: 'invalid_config' }, 400);
        }

        await saveIntakeConfig({ ...tenant, config });
        await audit.emit({
          context: loose(c),
          input: {
            action: 'factory.intake.config_updated',
            targets: [{ type: 'intake_config', id: tenant.orgId }],
            metadata: Object.fromEntries(
              Object.entries(config).map(([integrationId, selection]) => [
                integrationId,
                { enabled: selection.enabled, sources: selection.sourceIds?.length ?? null },
              ]),
            ),
          },
        });
        return c.json({ config });
      },
    }),
    registerApiRoute('/web/intake/sources', {
      method: 'GET',
      requiresAuth: false,
      handler: async c => {
        const tenant = await resolveTenant(loose(c));
        if ('response' in tenant) return tenant.response;
        const pages = await Promise.all(
          integrations.map(async integration => ({
            integrationId: integration.id,
            sources: await integration.intake.listSources(tenant),
          })),
        );
        return c.json({
          sources: pages.flatMap(page =>
            page.sources.map(source => ({ integrationId: page.integrationId, ...source })),
          ),
        });
      },
    }),
    registerApiRoute('/web/intake/items', {
      method: 'GET',
      requiresAuth: false,
      handler: async c => {
        const tenant = await resolveTenant(loose(c));
        if ('response' in tenant) return tenant.response;
        const cursors = decodeCursor(c.req.query('cursor'));
        if (!cursors) return c.json({ error: 'invalid_cursor' }, 400);

        const config = await getIntakeConfig({ ...tenant, integrationIds });
        const items: AggregatedIntakeItem[] = [];
        const nextCursors: Record<string, string> = {};
        for (const integration of integrations) {
          const selection = config[integration.id];
          if (!selection?.enabled || !selection.sourceIds?.length) continue;
          const page = await integration.intake.listItems({
            ...tenant,
            sourceIds: selection.sourceIds,
            ...(cursors[integration.id] ? { cursor: cursors[integration.id] } : {}),
          });
          items.push(
            ...page.items.map(item => {
              const { source, ...candidate } = item;
              return {
                ...candidate,
                integrationId: integration.id,
                externalSource: { integrationId: integration.id, ...source },
              };
            }),
          );
          if (page.nextCursor) nextCursors[integration.id] = page.nextCursor;
        }
        return c.json({ items, nextCursor: encodeCursor(nextCursors) });
      },
    }),
  ];
}
