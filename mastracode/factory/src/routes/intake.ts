import type { ApiRoute } from '@mastra/core/server';
import { registerApiRoute } from '@mastra/core/server';
import type { Context } from 'hono';

import type { Intake, IntakeItem } from '../capabilities/intake.js';
import type { AuditEmitter } from '../storage/domains/audit/domain.js';
import type { IntakeConfig, IntakeStorage } from '../storage/domains/intake/base.js';
import type { RouteDependencies } from './route.js';
import { Route } from './route.js';

export interface IntakeIntegration {
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

export interface IntakeRoutesDeps extends RouteDependencies {
  audit: AuditEmitter;
  /** Intake selection domain handle. */
  intake: IntakeStorage;
  /** Factory project domain handle, used to validate binding targets. */
  projects?: { get(input: { orgId: string; id: string }): Promise<unknown | null> };
  integrations?: IntakeIntegration[];
}

/** One integration that failed while the rest of the aggregation succeeded. */
export interface IntakeIntegrationFailure {
  integrationId: string;
  message: string;
}

type SettledIntegration<T> = { integrationId: string; value: T } | IntakeIntegrationFailure;

/**
 * Read every integration concurrently and isolate the ones that throw, so a single
 * unreachable provider degrades to a per-source error instead of failing the listing.
 */
async function settleByIntegration<T>(
  requests: Array<{ integrationId: string; read: () => Promise<T> }>,
): Promise<{ pages: Array<{ integrationId: string; value: T }>; failures: IntakeIntegrationFailure[] }> {
  const settled = await Promise.all(
    requests.map(async ({ integrationId, read }): Promise<SettledIntegration<T>> => {
      try {
        return { integrationId, value: await read() };
      } catch (error) {
        console.error(`[factory] intake integration ${integrationId} is unavailable:`, error);
        return { integrationId, message: error instanceof Error ? error.message : String(error) };
      }
    }),
  );
  const pages: Array<{ integrationId: string; value: T }> = [];
  const failures: IntakeIntegrationFailure[] = [];
  for (const entry of settled) {
    if ('value' in entry) pages.push(entry);
    else failures.push(entry);
  }
  return { pages, failures };
}

interface ParsedBinding {
  integrationId: string;
  sourceId: string;
  factoryProjectId: string | null;
}

/** Validate a binding request body, rejecting unknown shapes. */
export function parseIntakeBinding(body: unknown): ParsedBinding | null {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return null;
  const { integrationId, sourceId, factoryProjectId } = body as Record<string, unknown>;
  const isId = (value: unknown) => typeof value === 'string' && value.length > 0 && value.length <= 256;
  if (!isId(integrationId) || !isId(sourceId)) return null;
  if (factoryProjectId !== null && !isId(factoryProjectId)) return null;
  return {
    integrationId: integrationId as string,
    sourceId: sourceId as string,
    factoryProjectId: factoryProjectId as string | null,
  };
}

function loose(c: unknown): Context {
  return c as Context;
}

function sanitizeIdList(value: unknown): string[] | null | undefined {
  if (value === null) return null;
  if (!Array.isArray(value) || value.length > 200) return undefined;
  const ids = value.filter((item): item is string => typeof item === 'string' && item.length > 0 && item.length <= 256);
  return ids.length === value.length && new Set(ids).size === ids.length ? ids : undefined;
}

/** Validate a request body into an intake config, rejecting unknown shapes. */
export function parseIntakeConfig(body: unknown): IntakeConfig | null {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return null;
  const entries = Object.entries(body);
  if (entries.length > 50) return null;

  // Null-prototype so an `__proto__` key lands as a real entry instead of silently
  // reassigning the prototype and disappearing from the validation below.
  const config: IntakeConfig = Object.create(null);
  for (const [integrationId, value] of entries) {
    if (
      !integrationId ||
      integrationId.length > 128 ||
      typeof value !== 'object' ||
      value === null ||
      Array.isArray(value)
    ) {
      return null;
    }
    const selection = value as { enabled?: unknown; sourceIds?: unknown };
    if (typeof selection.enabled !== 'boolean') return null;
    const sourceIds = sanitizeIdList(selection.sourceIds ?? null);
    if (sourceIds === undefined) return null;
    config[integrationId] = { enabled: selection.enabled, sourceIds };
  }
  return config;
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

export class IntakeRoutes extends Route<IntakeRoutesDeps> {
  async #resolveTenant(c: Context): Promise<{ orgId: string; userId: string } | { response: Response }> {
    await this.deps.auth.ensureUser(c);
    const tenant = this.deps.auth.tenant(c);
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

  routes(): ApiRoute[] {
    const { audit, intake, projects, integrations = [] } = this.deps;
    const integrationIds = integrations.map(integration => integration.id);

    return [
      registerApiRoute('/web/intake/config', {
        method: 'GET',
        requiresAuth: false,
        handler: async c => {
          const tenant = await this.#resolveTenant(loose(c));
          if ('response' in tenant) return tenant.response;
          await intake.ensureReady();
          const config = await intake.getConfig({ ...tenant, integrationIds });
          return c.json({ config });
        },
      }),
      registerApiRoute('/web/intake/config', {
        method: 'PUT',
        requiresAuth: false,
        handler: async c => {
          const tenant = await this.#resolveTenant(loose(c));
          if ('response' in tenant) return tenant.response;

          let body: unknown;
          try {
            body = await c.req.json();
          } catch {
            return c.json({ error: 'Invalid JSON body' }, 400);
          }
          const config = parseIntakeConfig(body);
          if (!config) {
            return c.json({ error: 'invalid_config' }, 400);
          }

          const registeredConfig: IntakeConfig = Object.create(null);
          for (const [integrationId, selection] of Object.entries(config)) {
            if (integrationIds.includes(integrationId)) {
              registeredConfig[integrationId] = selection;
              continue;
            }
            if (selection.enabled || selection.sourceIds?.length) {
              return c.json({ error: 'invalid_config' }, 400);
            }
          }

          await intake.ensureReady();
          await intake.saveConfig({ ...tenant, config: registeredConfig });
          await audit.emit({
            context: loose(c),
            input: {
              action: 'factory.intake.config_updated',
              targets: [{ type: 'intake_config', id: tenant.orgId }],
              metadata: Object.fromEntries(
                Object.entries(registeredConfig).map(([integrationId, selection]) => [
                  integrationId,
                  { enabled: selection.enabled, sources: selection.sourceIds?.length ?? null },
                ]),
              ),
            },
          });
          return c.json({ config: registeredConfig });
        },
      }),
      registerApiRoute('/web/intake/bindings', {
        method: 'GET',
        requiresAuth: false,
        handler: async c => {
          const tenant = await this.#resolveTenant(loose(c));
          if ('response' in tenant) return tenant.response;
          await intake.ensureReady();
          return c.json({ bindings: await intake.listBindings({ orgId: tenant.orgId }) });
        },
      }),
      registerApiRoute('/web/intake/bindings', {
        method: 'PUT',
        requiresAuth: false,
        handler: async c => {
          const tenant = await this.#resolveTenant(loose(c));
          if ('response' in tenant) return tenant.response;

          let body: unknown;
          try {
            body = await c.req.json();
          } catch {
            return c.json({ error: 'Invalid JSON body' }, 400);
          }
          const binding = parseIntakeBinding(body);
          if (!binding || !integrationIds.includes(binding.integrationId)) {
            return c.json({ error: 'invalid_binding' }, 400);
          }
          if (binding.factoryProjectId && projects) {
            const project = await projects.get({ orgId: tenant.orgId, id: binding.factoryProjectId });
            if (!project) return c.json({ error: 'factory_project_not_found' }, 404);
          }

          await intake.ensureReady();
          let auditFactoryProjectId = binding.factoryProjectId;
          if (binding.factoryProjectId === null) {
            const previousBinding = await intake.clearBinding({
              orgId: tenant.orgId,
              integrationId: binding.integrationId,
              sourceId: binding.sourceId,
            });
            auditFactoryProjectId = previousBinding?.factoryProjectId ?? null;
          } else {
            await intake.setBinding({
              orgId: tenant.orgId,
              userId: tenant.userId,
              integrationId: binding.integrationId,
              sourceId: binding.sourceId,
              factoryProjectId: binding.factoryProjectId,
            });
          }
          await audit.emit({
            context: loose(c),
            input: {
              action: 'factory.intake.binding_updated',
              ...(auditFactoryProjectId ? { factoryProjectId: auditFactoryProjectId } : {}),
              targets: [{ type: 'intake_source', id: `${binding.integrationId}:${binding.sourceId}` }],
              metadata: { factoryProjectId: binding.factoryProjectId },
            },
          });
          return c.json({ bindings: await intake.listBindings({ orgId: tenant.orgId }) });
        },
      }),
      registerApiRoute('/web/intake/sources', {
        method: 'GET',
        requiresAuth: false,
        handler: async c => {
          const tenant = await this.#resolveTenant(loose(c));
          if ('response' in tenant) return tenant.response;
          const { pages, failures } = await settleByIntegration(
            integrations.map(integration => ({
              integrationId: integration.id,
              read: () => integration.intake.listSources(tenant),
            })),
          );
          return c.json({
            sources: pages.flatMap(({ integrationId, value }) => value.map(source => ({ integrationId, ...source }))),
            failures,
          });
        },
      }),
      registerApiRoute('/web/intake/items', {
        method: 'GET',
        requiresAuth: false,
        handler: async c => {
          const tenant = await this.#resolveTenant(loose(c));
          if ('response' in tenant) return tenant.response;
          const cursors = decodeCursor(c.req.query('cursor'));
          if (!cursors) return c.json({ error: 'invalid_cursor' }, 400);

          await intake.ensureReady();
          const config = await intake.getConfig({ ...tenant, integrationIds });
          const { pages, failures } = await settleByIntegration(
            integrations.flatMap(integration => {
              const selection = config[integration.id];
              if (!selection?.enabled || !selection.sourceIds?.length) return [];
              const sourceIds = selection.sourceIds;
              const cursor = cursors[integration.id];
              return [
                {
                  integrationId: integration.id,
                  read: () => integration.intake.listItems({ ...tenant, sourceIds, ...(cursor ? { cursor } : {}) }),
                },
              ];
            }),
          );

          const items: AggregatedIntakeItem[] = [];
          const nextCursors: Record<string, string> = {};
          for (const { integrationId, value } of pages) {
            items.push(
              ...value.items.map(item => {
                const { source, ...candidate } = item;
                return { ...candidate, integrationId, externalSource: { integrationId, ...source } };
              }),
            );
            if (value.nextCursor) nextCursors[integrationId] = value.nextCursor;
          }
          // Keep the cursor an unavailable integration came in with, so the next page resumes there instead of replaying it.
          for (const { integrationId } of failures) {
            const cursor = cursors[integrationId];
            if (cursor) nextCursors[integrationId] = cursor;
          }
          return c.json({ items, nextCursor: encodeCursor(nextCursors), failures });
        },
      }),
    ];
  }
}
