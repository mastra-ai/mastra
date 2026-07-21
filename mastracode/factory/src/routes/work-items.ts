/**
 * Mastra `apiRoutes` for Factory work items (the kanban board).
 *
 * Registered alongside the other `/web/*` routes behind the host auth gate.
 * The board is org-wide: every route re-resolves the caller's `(orgId, userId)`
 * tenant and scopes reads/writes by `orgId`, so any org member sees and moves
 * the same cards while `created_by` / stage history record who acted.
 */

import type { ApiRoute } from '@mastra/core/server';
import { registerApiRoute } from '@mastra/core/server';
import type { Context } from 'hono';

import type { AuditEmitter } from '../storage/domains/audit/domain';
import type { FactoryProjectsStorage } from '../storage/domains/projects/base';
import type { QueueHealthStorage } from '../storage/domains/queue-health/base';
import { thresholdsOrDefault } from '../storage/domains/queue-health/base';
import type {
  CreateWorkItemInput,
  ExternalWorkItemSource,
  UpdateWorkItemInput,
  WorkItemPriorState,
  WorkItemRow,
  WorkItemSessionInput,
  WorkItemStage,
  WorkItemsStorage,
} from '../storage/domains/work-items/base';
import { clampMetricsWindow, computeFactoryMetrics } from '../storage/domains/work-items/metrics';
import type { RouteDependencies } from './route';
import { Route } from './route';

export interface WorkItemRoutesDeps extends RouteDependencies {
  audit: AuditEmitter;
  /** Factory projects domain — validates the `:id` project belongs to the caller's org. */
  projects: FactoryProjectsStorage;
  /** Work-items domain backing the kanban board. */
  workItems: WorkItemsStorage;
  /** Per-project queue-health threshold config. */
  queueHealth: QueueHealthStorage;
}

function loose(c: unknown): Context {
  return c as Context;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const MAX_STAGES = 16;
const MAX_STAGE_LENGTH = 64;
const MAX_METADATA_BYTES = 16 * 1024;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validStages(value: unknown): value is WorkItemStage[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.length <= MAX_STAGES &&
    value.every(
      stage => typeof stage === 'string' && stage.length <= MAX_STAGE_LENGTH && /^[a-z0-9][a-z0-9_-]*$/i.test(stage),
    ) &&
    new Set(value).size === value.length
  );
}

function validMetadata(value: unknown): value is Record<string, unknown> | null {
  if (value === null) return true;
  if (!isRecord(value)) return false;
  try {
    return JSON.stringify(value).length <= MAX_METADATA_BYTES;
  } catch {
    return false;
  }
}

function parseExternalSource(value: unknown): ExternalWorkItemSource | null | undefined {
  if (value === undefined || value === null) return value;
  if (!isRecord(value)) return undefined;
  const { integrationId, type, externalId, url } = value;
  if (typeof integrationId !== 'string' || integrationId.length === 0 || integrationId.length > 128) return undefined;
  if (typeof type !== 'string' || type.length === 0 || type.length > 128) return undefined;
  if (typeof externalId !== 'string' || externalId.length === 0 || externalId.length > 512) return undefined;
  if (url !== undefined && (typeof url !== 'string' || url.length > 2048)) return undefined;
  return { integrationId, type, externalId, ...(url !== undefined ? { url } : {}) };
}

function parseSessions(value: unknown): Record<string, WorkItemSessionInput> | undefined {
  if (!isRecord(value)) return undefined;
  const out: Record<string, WorkItemSessionInput> = {};
  for (const [role, session] of Object.entries(value)) {
    if (!role || role.length > 64 || !isRecord(session)) return undefined;
    const { projectPath, branch, threadId } = session;
    if (typeof projectPath !== 'string' || projectPath.length === 0 || projectPath.length > 2048) return undefined;
    if (typeof branch !== 'string' || branch.length === 0 || branch.length > 512) return undefined;
    if (typeof threadId !== 'string' || threadId.length === 0 || threadId.length > 512) return undefined;
    out[role] = { projectPath, branch, threadId };
  }
  return out;
}

/** Validate an untrusted create body. Unknown keys are dropped. */
export function parseCreateWorkItem(body: unknown): CreateWorkItemInput | null {
  if (!isRecord(body)) return null;
  const { externalSource, title, stages, sessions, metadata } = body;
  if (typeof title !== 'string' || title.trim().length === 0 || title.length > 500) return null;

  const parsedSource = parseExternalSource(externalSource);
  if (externalSource !== undefined && parsedSource === undefined) return null;
  if (stages !== undefined && !validStages(stages)) return null;
  const parsedSessions = sessions === undefined ? undefined : parseSessions(sessions);
  if (sessions !== undefined && parsedSessions === undefined) return null;
  if (metadata !== undefined && !validMetadata(metadata)) return null;

  return {
    title: title.trim(),
    ...(parsedSource !== undefined ? { externalSource: parsedSource } : {}),
    ...(stages !== undefined ? { stages } : {}),
    ...(parsedSessions !== undefined ? { sessions: parsedSessions } : {}),
    ...(metadata !== undefined ? { metadata } : {}),
  };
}

/** Validate an untrusted patch body. Unknown keys are dropped. */
export function parseUpdateWorkItem(body: unknown): UpdateWorkItemInput | null {
  if (!isRecord(body)) return null;
  const { title, stages, sessions, metadata } = body;
  if (title === undefined && stages === undefined && sessions === undefined && metadata === undefined) return null;
  if (title !== undefined && (typeof title !== 'string' || title.trim().length === 0 || title.length > 500))
    return null;
  if (stages !== undefined && !validStages(stages)) return null;
  const parsedSessions = sessions === undefined ? undefined : parseSessions(sessions);
  if (sessions !== undefined && parsedSessions === undefined) return null;
  if (metadata !== undefined && !validMetadata(metadata)) return null;

  return {
    ...(title !== undefined ? { title: title.trim() } : {}),
    ...(stages !== undefined ? { stages } : {}),
    ...(parsedSessions !== undefined ? { sessions: parsedSessions } : {}),
    ...(metadata !== undefined ? { metadata } : {}),
  };
}

async function readJson(c: Context): Promise<unknown | undefined> {
  try {
    return await c.req.json();
  } catch {
    return undefined;
  }
}

/** Fields a PATCH touched, for the bounded `updated` event summary. */
function patchedFields(patch: Record<string, unknown>): string[] {
  return Object.keys(patch).filter(key => patch[key] !== undefined);
}

export class WorkItemRoutes extends Route<WorkItemRoutesDeps> {
  /** Resolve the `(orgId, userId)` tenant or a ready-to-return error response. */
  async #resolveTenant(c: Context): Promise<{ orgId: string; userId: string } | { response: Response }> {
    await this.deps.auth.ensureUser(c);
    const tenant = this.deps.auth.tenant(c);
    if (!tenant) return { response: c.json({ error: 'unauthorized' }, 401) };
    if (!tenant.orgId) {
      return {
        response: c.json(
          { error: 'organization_required', message: 'The Factory board requires an organization.' },
          403,
        ),
      };
    }
    return { orgId: tenant.orgId, userId: tenant.userId };
  }

  /**
   * Resolve the tenant AND the org-owned project from the `:id` param. Work
   * items hang off a project, so listing/creating requires the project to
   * exist in the caller's org.
   */
  async #resolveProject(
    c: Context,
  ): Promise<{ orgId: string; userId: string; factoryProjectId: string } | { response: Response }> {
    const tenant = await this.#resolveTenant(c);
    if ('response' in tenant) return tenant;

    const projectId = c.req.param('id');
    if (!projectId || !UUID_RE.test(projectId)) {
      return { response: c.json({ error: 'Project not found' }, 404) };
    }
    const { projects } = this.deps;
    await projects.ensureReady();
    const project = await projects.get({ orgId: tenant.orgId, id: projectId });
    if (!project) {
      return { response: c.json({ error: 'Project not found' }, 404) };
    }
    return { ...tenant, factoryProjectId: projectId };
  }

  /**
   * Emit the audit events a successful work-item PATCH implies: always
   * `updated`, plus `stage_moved` when the stages actually changed and one
   * `run.started` per session role the patch introduced.
   */
  async #auditWorkItemPatch({
    context,
    item,
    previous,
    patch,
  }: {
    context: Context;
    item: WorkItemRow;
    previous: WorkItemPriorState;
    patch: Record<string, unknown>;
  }): Promise<void> {
    const { audit } = this.deps;
    const target = { type: 'work_item', id: item.id, name: item.title };
    await audit.emit({
      context,
      input: {
        action: 'factory.work_item.updated',
        factoryProjectId: item.factoryProjectId,
        targets: [target],
        metadata: { fields: patchedFields(patch) },
      },
    });

    const stagesChanged =
      patch.stages !== undefined &&
      (previous.stages.length !== item.stages.length || previous.stages.some((s, i) => s !== item.stages[i]));
    if (stagesChanged) {
      await audit.emit({
        context,
        input: {
          action: 'factory.work_item.stage_moved',
          factoryProjectId: item.factoryProjectId,
          targets: [target],
          metadata: { from: previous.stages, to: item.stages },
        },
      });
    }

    const newRoles = Object.keys(item.sessions).filter(role => !previous.sessionRoles.includes(role));
    for (const role of newRoles) {
      const session = item.sessions[role];
      await audit.emit({
        context,
        input: {
          action: 'factory.run.started',
          factoryProjectId: item.factoryProjectId,
          targets: [target],
          metadata: {
            role,
            branch: session?.branch,
            threadId: session?.threadId,
            projectPath: session?.projectPath,
          },
        },
      });
    }
  }

  /** Build the Factory work-item routes as Mastra `apiRoutes`. */
  routes(): ApiRoute[] {
    const { audit, workItems, queueHealth } = this.deps;
    return [
      // ── List the org's work items for a project ─────────────────────────────
      registerApiRoute('/web/factory/projects/:id/work-items', {
        method: 'GET',
        requiresAuth: false,
        handler: async c => {
          const resolved = await this.#resolveProject(loose(c));
          if ('response' in resolved) return resolved.response;
          await workItems.ensureReady();
          const items = await workItems.list({
            orgId: resolved.orgId,
            factoryProjectId: resolved.factoryProjectId,
          });
          return c.json({ workItems: items });
        },
      }),

      // ── Flow metrics aggregated over the project's work items ───────────────
      registerApiRoute('/web/factory/projects/:id/metrics', {
        method: 'GET',
        requiresAuth: false,
        handler: async c => {
          const resolved = await this.#resolveProject(loose(c));
          if ('response' in resolved) return resolved.response;
          const days = clampMetricsWindow(loose(c).req.query('days'));
          await workItems.ensureReady();
          const items = await workItems.list({
            orgId: resolved.orgId,
            factoryProjectId: resolved.factoryProjectId,
          });
          return c.json({ metrics: computeFactoryMetrics({ items, days, now: new Date() }) });
        },
      }),

      // ── Per-project queue-health age-threshold config (seconds) ─────────────
      registerApiRoute('/web/factory/projects/:id/health/thresholds', {
        method: 'GET',
        requiresAuth: false,
        handler: async c => {
          const resolved = await this.#resolveProject(loose(c));
          if ('response' in resolved) return resolved.response;
          await queueHealth.ensureReady();
          const stored = await queueHealth.getConfig(resolved.orgId, resolved.factoryProjectId);
          // Validate at the read choke point: `getConfig` round-trips a stored
          // JSONB row, and only `saveConfig` validates on write — a corrupted or
          // hand-edited row (empty / non-ascending) would otherwise flow to the
          // chart and invert bucket colors. Fall back to the default on invalid.
          return c.json({ thresholds: thresholdsOrDefault(stored) });
        },
      }),

      // ── Create (upsert on sourceKey) a work item ─────────────────────────────
      registerApiRoute('/web/factory/projects/:id/work-items', {
        method: 'POST',
        requiresAuth: false,
        handler: async c => {
          const resolved = await this.#resolveProject(loose(c));
          if ('response' in resolved) return resolved.response;

          const body = await readJson(loose(c));
          if (body === undefined) return c.json({ error: 'Invalid JSON body' }, 400);
          const input = parseCreateWorkItem(body);
          if (!input) return c.json({ error: 'invalid_work_item' }, 400);

          await workItems.ensureReady();
          const result = await workItems.upsert({
            orgId: resolved.orgId,
            userId: resolved.userId,
            factoryProjectId: resolved.factoryProjectId,
            input,
          });
          const item = result.item;
          if (result.created) {
            await audit.emit({
              context: loose(c),
              input: {
                action: 'factory.work_item.created',
                factoryProjectId: resolved.factoryProjectId,
                targets: [{ type: 'work_item', id: item.id, name: item.title }],
                metadata: { externalSource: item.externalSource, stages: item.stages },
              },
            });
          } else {
            // Source-key reuse: the POST updated an existing card, so audit it
            // as an update (plus stage/run events) instead of a false creation.
            await this.#auditWorkItemPatch({
              context: loose(c),
              item,
              previous: result.previous,
              patch: input as unknown as Record<string, unknown>,
            });
          }
          return c.json({ workItem: item });
        },
      }),

      // ── Patch stages / sessions / metadata / title ───────────────────────────
      registerApiRoute('/web/factory/work-items/:id', {
        method: 'PATCH',
        requiresAuth: false,
        handler: async c => {
          const tenant = await this.#resolveTenant(loose(c));
          if ('response' in tenant) return tenant.response;

          const id = loose(c).req.param('id');
          if (!id || !UUID_RE.test(id)) return c.json({ error: 'Work item not found' }, 404);

          const body = await readJson(loose(c));
          if (body === undefined) return c.json({ error: 'Invalid JSON body' }, 400);
          const patch = parseUpdateWorkItem(body);
          if (!patch) return c.json({ error: 'invalid_work_item_patch' }, 400);

          await workItems.ensureReady();
          const updated = await workItems.update({ orgId: tenant.orgId, id, userId: tenant.userId, patch });
          if (!updated) return c.json({ error: 'Work item not found' }, 404);
          await this.#auditWorkItemPatch({
            context: loose(c),
            item: updated.item,
            previous: updated.previous,
            patch: patch as Record<string, unknown>,
          });
          return c.json({ workItem: updated.item });
        },
      }),

      // ── Remove a work item ───────────────────────────────────────────────────
      registerApiRoute('/web/factory/work-items/:id', {
        method: 'DELETE',
        requiresAuth: false,
        handler: async c => {
          const tenant = await this.#resolveTenant(loose(c));
          if ('response' in tenant) return tenant.response;

          const id = loose(c).req.param('id');
          if (!id || !UUID_RE.test(id)) return c.json({ error: 'Work item not found' }, 404);

          await workItems.ensureReady();
          const deleted = await workItems.delete({ orgId: tenant.orgId, id });
          if (!deleted) return c.json({ error: 'Work item not found' }, 404);
          await audit.emit({
            context: loose(c),
            input: {
              action: 'factory.work_item.deleted',
              factoryProjectId: deleted.factoryProjectId,
              targets: [{ type: 'work_item', id: deleted.id, name: deleted.title }],
            },
          });
          return c.json({ ok: true });
        },
      }),
    ];
  }
}
