import type { ApiRoute } from '@mastra/core/server';
import { registerApiRoute } from '@mastra/core/server';
import type { Context } from 'hono';
import { z } from 'zod';

import type { BoardRegistry } from '../boards/index.js';
import { cardLabels, moveCardToBoard } from '../boards/relocate.js';
import type { Intake, IntakeItem } from '../capabilities/intake.js';
import type { AuditEmitter } from '../storage/domains/audit/domain.js';
import { normalizeIntakeLabel, resolveIntakeLabelRoute } from '../storage/domains/intake/base.js';
import type { IntakeConfig, IntakeLabelRoute, IntakeStorage } from '../storage/domains/intake/base.js';
import type { WorkItemsStorage } from '../storage/domains/work-items/base.js';
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
  /** Installed boards, used to validate binding targets. Absent means only legacy routing is accepted. */
  boardRegistry?: BoardRegistry;
  /** Work items domain handle; when present, rebinding a source to another board moves its resting cards. */
  workItems?: Pick<WorkItemsStorage, 'list' | 'update' | 'supersedeDecisionsForWorkItem'>;
}

/** Upper bound on source pages read while relocating cards, so a huge source cannot stall the request. */
const REBIND_MAX_PAGES = 20;
/**
 * One deadline for the whole rebind read, not one per page: the binding is already saved when we
 * get here, so the caller is only waiting on relocation and a slow provider must not hold the
 * response for pages × timeout.
 */
const REBIND_READ_BUDGET_MS = 30_000;

/**
 * Keys under which an intake item may be persisted as a work item. Providers key items by their
 * own id, while materialization uses the human identifier (`linear:MAS-44`), so both are accepted.
 */
function intakeItemSourceKeys(integrationId: string, item: IntakeItem): string[] {
  const identifier = item.metadata?.identifier;
  return typeof identifier === 'string' && identifier.length > 0
    ? [item.source.externalId, `${integrationId}:${identifier}`]
    : [item.source.externalId];
}

/**
 * Move the cards that came from a rebound source onto its new board's initial phase. Terminal cards
 * stay put (they are history that belongs where it finished), as do cards with a session attached to
 * a current stage (a run owns them). Everything else moves, including cards parked in a working
 * phase that never started a run — auto-ingested issues sit in Work › Triage that way.
 */
async function relocateSourceCards({
  workItems,
  integration,
  boardRegistry,
  orgId,
  userId,
  factoryProjectId,
  sourceId,
  targetBoard,
}: {
  workItems: Pick<WorkItemsStorage, 'list' | 'update' | 'supersedeDecisionsForWorkItem'>;
  integration: IntakeIntegration;
  boardRegistry: BoardRegistry;
  orgId: string;
  userId: string;
  factoryProjectId: string;
  sourceId: string;
  targetBoard: string;
}): Promise<{ moved: number; skipped: number }> {
  if (!boardRegistry.has(targetBoard)) return { moved: 0, skipped: 0 };

  const sourceKeys = new Set<string>();
  let cursor: string | undefined;
  const deadline = Date.now() + REBIND_READ_BUDGET_MS;
  for (let page = 0; page < REBIND_MAX_PAGES; page += 1) {
    const result = await withTimeout(
      integration.id,
      () => integration.intake.listItems({ orgId, userId, sourceIds: [sourceId], cursor }),
      deadline - Date.now(),
    );
    for (const item of result.items) {
      for (const key of intakeItemSourceKeys(integration.id, item)) sourceKeys.add(key);
    }
    if (!result.nextCursor) break;
    cursor = result.nextCursor;
  }
  if (sourceKeys.size === 0) return { moved: 0, skipped: 0 };

  let moved = 0;
  let skipped = 0;
  const items = await workItems.list({ orgId, factoryProjectId });
  for (const item of items) {
    const source = item.externalSource;
    if (!source || source.integrationId !== integration.id || !sourceKeys.has(source.externalId)) continue;
    const outcome = await moveCardToBoard({ workItems, boardRegistry, userId, item, targetBoard });
    if (outcome === 'moved') moved += 1;
    else if (outcome === 'skipped') skipped += 1;
  }
  return { moved, skipped };
}

/**
 * After a label route changes, every issue card in the project that carries `label` is re-routed
 * under the project's current routes: to the board its labels now select, or back to Work when none
 * of them is routed any more.
 */
async function relocateLabeledCards({
  workItems,
  boardRegistry,
  orgId,
  userId,
  factoryProjectId,
  integrationId,
  label,
  routes,
}: {
  workItems: Pick<WorkItemsStorage, 'list' | 'update' | 'supersedeDecisionsForWorkItem'>;
  boardRegistry: BoardRegistry;
  orgId: string;
  userId: string;
  factoryProjectId: string;
  integrationId: string;
  label: string;
  routes: readonly IntakeLabelRoute[];
}): Promise<{ moved: number; skipped: number }> {
  const changed = normalizeIntakeLabel(label);
  let moved = 0;
  let skipped = 0;
  for (const item of await workItems.list({ orgId, factoryProjectId })) {
    const source = item.externalSource;
    if (!source || source.integrationId !== integrationId || source.type !== 'issue') continue;
    const labels = cardLabels(item);
    if (!labels.some(candidate => normalizeIntakeLabel(candidate) === changed)) continue;
    const targetBoard = resolveIntakeLabelRoute(routes, labels)?.board ?? 'work';
    const outcome = await moveCardToBoard({ workItems, boardRegistry, userId, item, targetBoard });
    if (outcome === 'moved') moved += 1;
    else if (outcome === 'skipped') skipped += 1;
  }
  return { moved, skipped };
}

/** One integration that failed while the rest of the aggregation succeeded. */
export interface IntakeIntegrationFailure {
  integrationId: string;
  message: string;
}

type SettledIntegration<T> = { integrationId: string; value: T } | IntakeIntegrationFailure;

const PROVIDER_READ_TIMEOUT_MS = 15_000;

/** The Intake contract takes no abort signal, so a slow read is abandoned, not cancelled. */
function withTimeout<T>(
  integrationId: string,
  read: () => Promise<T>,
  timeoutMs: number = PROVIDER_READ_TIMEOUT_MS,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const budget = Math.max(0, timeoutMs);
    const timer = setTimeout(
      () => reject(new Error(`${integrationId} did not answer within ${Math.round(budget / 1000)}s`)),
      budget,
    );
    read()
      .then(resolve, reject)
      .finally(() => clearTimeout(timer));
  });
}

/**
 * Read every integration concurrently and isolate the ones that throw or hang, so a single
 * unreachable provider degrades to a per-source error instead of failing the listing.
 */
async function settleByIntegration<T>(
  requests: Array<{ integrationId: string; read: () => Promise<T> }>,
): Promise<{ pages: Array<{ integrationId: string; value: T }>; failures: IntakeIntegrationFailure[] }> {
  const settled = await Promise.all(
    requests.map(async ({ integrationId, read }): Promise<SettledIntegration<T>> => {
      try {
        return { integrationId, value: await withTimeout(integrationId, read) };
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
  /** Installed board target; `null`/omitted keeps legacy source-type routing. */
  board: string | null;
}

/** Validate a binding request body, rejecting unknown shapes. */
export function parseIntakeBinding(body: unknown): ParsedBinding | null {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return null;
  const { integrationId, sourceId, factoryProjectId, board } = body as Record<string, unknown>;
  const isId = (value: unknown) => typeof value === 'string' && value.length > 0 && value.length <= 256;
  if (!isId(integrationId) || !isId(sourceId)) return null;
  if (factoryProjectId !== null && !isId(factoryProjectId)) return null;
  if (board !== undefined && board !== null && !isId(board)) return null;
  return {
    integrationId: integrationId as string,
    sourceId: sourceId as string,
    factoryProjectId: factoryProjectId as string | null,
    board: (board as string | null | undefined) ?? null,
  };
}

const identifier = z.string().min(1).max(256);
const labelRouteBodySchema = z.object({
  factoryProjectId: identifier,
  integrationId: identifier,
  label: z
    .string()
    .max(256)
    .transform(normalizeIntakeLabel)
    .refine(label => label.length > 0, 'label must not be blank'),
  /** Installed board target; `null` removes the route so the label falls back to Work. */
  board: identifier.nullish().transform(board => board ?? null),
});
type ParsedLabelRoute = z.output<typeof labelRouteBodySchema>;

/** Validate a label-route request body, rejecting unknown shapes. */
export function parseIntakeLabelRoute(body: unknown): ParsedLabelRoute | null {
  const parsed = labelRouteBodySchema.safeParse(body);
  return parsed.success ? parsed.data : null;
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
    const { audit, intake, projects, integrations = [], boardRegistry, workItems } = this.deps;
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
          if (binding.board !== null && !boardRegistry?.has(binding.board)) {
            return c.json({ error: 'invalid_board', message: `Board '${binding.board}' is not installed.` }, 422);
          }

          await intake.ensureReady();
          let auditFactoryProjectId = binding.factoryProjectId;
          let relocated: { moved: number; skipped: number } | null = null;
          if (binding.factoryProjectId === null) {
            const previousBinding = await intake.clearBinding({
              orgId: tenant.orgId,
              integrationId: binding.integrationId,
              sourceId: binding.sourceId,
            });
            auditFactoryProjectId = previousBinding?.factoryProjectId ?? null;
          } else {
            const previousBinding = await intake.getBinding({
              orgId: tenant.orgId,
              integrationId: binding.integrationId,
              sourceId: binding.sourceId,
            });
            await intake.setBinding({
              orgId: tenant.orgId,
              userId: tenant.userId,
              integrationId: binding.integrationId,
              sourceId: binding.sourceId,
              factoryProjectId: binding.factoryProjectId,
              board: binding.board,
            });
            // A source that stays in the same project but is pointed at a different board
            // takes its resting cards along. Bindings that predate persisted boards have a
            // null board yet still fed Work/Review, so relocation compares each card's
            // effective board rather than trusting the previous binding value.
            const nextBoard = binding.board;
            const integration = integrations.find(candidate => candidate.id === binding.integrationId);
            if (
              workItems &&
              boardRegistry &&
              integration &&
              previousBinding?.factoryProjectId === binding.factoryProjectId &&
              nextBoard !== null &&
              previousBinding.board !== nextBoard
            ) {
              try {
                relocated = await relocateSourceCards({
                  workItems,
                  integration,
                  boardRegistry,
                  orgId: tenant.orgId,
                  userId: tenant.userId,
                  factoryProjectId: binding.factoryProjectId,
                  sourceId: binding.sourceId,
                  targetBoard: nextBoard,
                });
              } catch (error) {
                // The binding is saved; the cards can be moved by hand if the provider was unreachable.
                console.error(`[factory] intake rebind could not relocate ${binding.integrationId} cards:`, error);
              }
            }
          }
          await audit.emit({
            context: loose(c),
            input: {
              action: 'factory.intake.binding_updated',
              ...(auditFactoryProjectId ? { factoryProjectId: auditFactoryProjectId } : {}),
              targets: [{ type: 'intake_source', id: `${binding.integrationId}:${binding.sourceId}` }],
              metadata: {
                factoryProjectId: binding.factoryProjectId,
                board: binding.board,
                ...(relocated ? { relocated } : {}),
              },
            },
          });
          return c.json({
            bindings: await intake.listBindings({ orgId: tenant.orgId }),
            ...(relocated ? { relocated } : {}),
          });
        },
      }),
      registerApiRoute('/web/intake/label-routes', {
        method: 'GET',
        requiresAuth: false,
        handler: async c => {
          const tenant = await this.#resolveTenant(loose(c));
          if ('response' in tenant) return tenant.response;
          const factoryProjectId = c.req.query('factoryProjectId');
          await intake.ensureReady();
          return c.json({
            routes: await intake.listLabelRoutes({
              orgId: tenant.orgId,
              ...(factoryProjectId ? { factoryProjectId } : {}),
            }),
          });
        },
      }),
      registerApiRoute('/web/intake/label-routes', {
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
          const route = parseIntakeLabelRoute(body);
          if (!route || !integrationIds.includes(route.integrationId)) {
            return c.json({ error: 'invalid_label_route' }, 400);
          }
          if (projects) {
            const project = await projects.get({ orgId: tenant.orgId, id: route.factoryProjectId });
            if (!project) return c.json({ error: 'factory_project_not_found' }, 404);
          }
          if (route.board !== null && !boardRegistry?.has(route.board)) {
            return c.json({ error: 'invalid_board', message: `Board '${route.board}' is not installed.` }, 422);
          }

          await intake.ensureReady();
          const scope = {
            orgId: tenant.orgId,
            factoryProjectId: route.factoryProjectId,
            integrationId: route.integrationId,
          };
          const previous = (await intake.listLabelRoutes(scope)).find(existing => existing.label === route.label);
          if (route.board === null) {
            await intake.clearLabelRoute({ ...scope, label: route.label });
          } else {
            await intake.setLabelRoute({ ...scope, label: route.label, board: route.board, userId: tenant.userId });
          }

          // Cards already carrying the label follow the route: onto the new board, or back to
          // Work when the label is no longer routed anywhere.
          let relocated: { moved: number; skipped: number } | null = null;
          if (workItems && boardRegistry && (previous?.board ?? null) !== route.board) {
            try {
              relocated = await relocateLabeledCards({
                workItems,
                boardRegistry,
                orgId: tenant.orgId,
                userId: tenant.userId,
                factoryProjectId: route.factoryProjectId,
                integrationId: route.integrationId,
                label: route.label,
                routes: await intake.listLabelRoutes(scope),
              });
            } catch (error) {
              // The route is saved; the cards can be moved by hand.
              console.error(`[factory] intake label route could not relocate ${route.integrationId} cards:`, error);
            }
          }
          await audit.emit({
            context: loose(c),
            input: {
              action: 'factory.intake.label_route_updated',
              factoryProjectId: route.factoryProjectId,
              targets: [{ type: 'intake_label_route', id: `${route.integrationId}:${route.label}` }],
              metadata: { board: route.board, ...(relocated ? { relocated } : {}) },
            },
          });
          return c.json({
            routes: await intake.listLabelRoutes({ orgId: tenant.orgId, factoryProjectId: route.factoryProjectId }),
            ...(relocated ? { relocated } : {}),
          });
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
