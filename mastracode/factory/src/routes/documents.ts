/**
 * Mastra `apiRoutes` for a factory project's documents.
 *
 * Serves the Documents page in factory-ui from the synced copy in the
 * `documents` domain: the inventory (every catalog kind with status, no
 * bodies), one document with its markdown body, and an explicit refresh that
 * re-syncs from a live sandbox. Reads are scoped fail-closed to the caller's
 * org and the validated `:id` project; nothing here touches the repository
 * directly.
 */

import type { ApiRoute } from '@mastra/core/server';
import { registerApiRoute } from '@mastra/core/server';
import type { Context } from 'hono';

import type { FactoryDocumentIndexEntry, FactoryDocumentsStorage } from '../storage/domains/documents/base.js';
import {
  FACTORY_DOC_KINDS,
  FACTORY_DOCS_DIR,
  FACTORY_DOCS_MANIFEST,
  isFactoryDocKind,
} from '../storage/domains/documents/catalog.js';
import type { FactoryDocumentsRefresher } from '../storage/domains/documents/refresh.js';
import type { FactoryProjectsStorage } from '../storage/domains/projects/base.js';
import type { RouteDependencies } from './route.js';
import { Route } from './route.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface DocumentRoutesDeps extends RouteDependencies {
  projects: Pick<FactoryProjectsStorage, 'ensureReady' | 'get'>;
  documents: Pick<FactoryDocumentsStorage, 'ensureReady' | 'list' | 'getByKind' | 'syncState'>;
  /** Absent when no sandbox is configured — refresh then answers 503. */
  refresh?: FactoryDocumentsRefresher;
}

function loose(c: unknown): Context {
  return c as Context;
}

function wireEntry(entry: FactoryDocumentIndexEntry) {
  return {
    id: entry.id,
    kind: entry.kind,
    path: entry.path,
    title: entry.title,
    summary: entry.summary,
    status: entry.status,
    contentHash: entry.contentHash,
    sizeBytes: entry.sizeBytes,
    sourceRef: entry.sourceRef,
    sourceSha: entry.sourceSha,
    syncedAt: entry.syncedAt.toISOString(),
  };
}

export class DocumentRoutes extends Route<DocumentRoutesDeps> {
  async #resolveProject(
    c: Context,
  ): Promise<{ orgId: string; userId: string; factoryProjectId: string } | { response: Response }> {
    await this.deps.auth.ensureUser(c);
    const tenant = this.deps.auth.tenant(c);
    if (!tenant) return { response: c.json({ error: 'unauthorized' }, 401) };
    if (!tenant.orgId) {
      return {
        response: c.json(
          { error: 'organization_required', message: 'Factory documents require an organization.' },
          403,
        ),
      };
    }
    const projectId = c.req.param('id');
    if (!projectId || !UUID_RE.test(projectId)) return { response: c.json({ error: 'Project not found' }, 404) };
    await this.deps.projects.ensureReady();
    const project = await this.deps.projects.get({ orgId: tenant.orgId, id: projectId });
    if (!project) return { response: c.json({ error: 'Project not found' }, 404) };
    await this.deps.documents.ensureReady();
    return { orgId: tenant.orgId, userId: tenant.userId, factoryProjectId: projectId };
  }

  routes(): ApiRoute[] {
    return [
      registerApiRoute('/web/factory/projects/:id/documents', {
        method: 'GET',
        requiresAuth: false,
        handler: async c => {
          const scope = await this.#resolveProject(loose(c));
          if ('response' in scope) return scope.response;
          const [entries, sync] = await Promise.all([
            this.deps.documents.list(scope),
            this.deps.documents.syncState(scope),
          ]);
          return c.json({
            docsRoot: FACTORY_DOCS_DIR,
            manifestPath: FACTORY_DOCS_MANIFEST,
            catalog: FACTORY_DOC_KINDS.map(definition => ({
              kind: definition.kind,
              group: definition.group,
              label: definition.label,
              defaultPath: definition.defaultPath,
              purpose: definition.purpose,
            })),
            documents: entries.map(wireEntry),
            sync: sync
              ? {
                  sourceRef: sync.sourceRef,
                  sourceSha: sync.sourceSha,
                  manifestStatus: sync.manifestStatus,
                  syncedAt: sync.syncedAt.toISOString(),
                }
              : null,
          });
        },
      }),
      registerApiRoute('/web/factory/projects/:id/documents/:kind', {
        method: 'GET',
        requiresAuth: false,
        handler: async c => {
          const scope = await this.#resolveProject(loose(c));
          if ('response' in scope) return scope.response;
          const kind = c.req.param('kind');
          if (!kind || !isFactoryDocKind(kind)) return c.json({ error: 'Document not found' }, 404);
          const record = await this.deps.documents.getByKind(scope, kind);
          if (!record) return c.json({ error: 'Document not found' }, 404);
          return c.json({ document: { ...wireEntry(record), content: record.content } });
        },
      }),
      registerApiRoute('/web/factory/projects/:id/documents/refresh', {
        method: 'POST',
        requiresAuth: false,
        handler: async c => {
          const scope = await this.#resolveProject(loose(c));
          if ('response' in scope) return scope.response;
          const refresh = this.deps.refresh;
          if (!refresh) {
            return c.json(
              { error: 'documents_refresh_unavailable', message: 'No sandbox is configured for this factory.' },
              503,
            );
          }
          const result = await refresh({ orgId: scope.orgId, factoryProjectId: scope.factoryProjectId });
          switch (result.outcome) {
            case 'synced':
            case 'unchanged': {
              const sync = await this.deps.documents.syncState(scope);
              return c.json({
                ok: true as const,
                outcome: result.outcome,
                sync: sync
                  ? {
                      sourceRef: sync.sourceRef,
                      sourceSha: sync.sourceSha,
                      manifestStatus: sync.manifestStatus,
                      syncedAt: sync.syncedAt.toISOString(),
                    }
                  : null,
              });
            }
            case 'no_repository':
              return c.json(
                { error: 'no_repository', message: 'This factory has no linked repository to sync documents from.' },
                409,
              );
            case 'no_active_sandbox':
              return c.json(
                {
                  error: 'no_active_sandbox',
                  message:
                    'No running sandbox holds this repository. Start a run (or open a workspace) and the index refreshes automatically.',
                },
                409,
              );
            case 'ref_unavailable':
              return c.json(
                { error: 'ref_unavailable', message: `The default branch could not be read: ${result.reason}` },
                409,
              );
          }
        },
      }),
    ];
  }
}
