import type { ImportersOptions, ImporterScopesResolver } from '@mastra/connect';
import type { FactoryStorage } from '@mastra/core/storage';

import type { KnowledgeImporterRoutingStorage } from '../storage/domains/importer-routing/base.js';
import type { FactoryProjectsStorage } from '../storage/domains/projects/base.js';

/**
 * Knowledge-importer scopes resolver over the Factory project inventory: one
 * `resource:<projectId>` per project, resolved live at each cron fire so
 * projects created or deleted after startup start/stop syncing automatically.
 *
 * Honors per-connection routing when the `importer-routing` storage domain is
 * registered: a connection routed to selected projects resolves only those
 * (intersected with the live inventory, so deleted projects drop out); a
 * connection with no routing row — or `mode: 'all'` — resolves every project.
 *
 * Reads storage domains registered by `MastraFactory` during prepare.
 * Resolution before that registration throws — the core importer runner logs
 * the failure, falls back to the last successfully resolved set, and retries
 * on the next fire.
 *
 * With `mode: 'all'`, enumerates projects across every org in the storage
 * backend — the platform connection feeding the importers is deployment-level,
 * so in a multi-org deployment its content lands in all orgs' projects. Hosts
 * needing an org boundary should pass their own `scopes` resolver filtered
 * accordingly (or route each connection to selected projects).
 *
 * Pair with a parameterized access map so every project scope is writable:
 * `{ access: { 'resource:$projectId': 'owner' }, scopes: factoryProjectScopes(storage) }`.
 */
export function factoryProjectScopes(storage: FactoryStorage): ImporterScopesResolver {
  return async ({ connection }) => {
    const projects = storage.getDomain<FactoryProjectsStorage>('projects');
    await projects.ensureReady();
    const inventory = await projects.listAll();

    if (storage.hasDomain('importer-routing')) {
      const routing = storage.getDomain<KnowledgeImporterRoutingStorage>('importer-routing');
      await routing.ensureReady();
      const record = await routing.get(connection.id);
      if (record?.mode === 'selected') {
        const selected = new Set(record.projectIds);
        return inventory.filter(project => selected.has(project.id)).map(project => `resource:${project.id}`);
      }
    }

    return inventory.map(project => `resource:${project.id}`);
  };
}

/**
 * Default role per catalogue provider when the Factory auto-constructs its
 * importer config: document sources own their nodes (stale pages get removed),
 * ticket/transcript sources only upsert.
 */
const KNOWLEDGE_IMPORTER_DEFAULT_ROLES: Readonly<Record<string, 'owner' | 'edit'>> = {
  notion: 'owner',
  confluence: 'owner',
  jira: 'edit',
  // Linear syncs Documents and Zendesk syncs Help Center articles — both
  // document-shaped, so they own their nodes (archived/draft content is removed).
  linear: 'owner',
  zendesk: 'owner',
  fireflies: 'edit',
};

/**
 * Fill in the default per-project integration config when the host didn't
 * pass one: every catalogue provider syncs into one `resource:<projectId>`
 * scope per Factory project via {@link factoryProjectScopes}. Host-supplied
 * `integrations` are used verbatim — the host owns the destination topology.
 */
export function withProjectScopedIntegrations(
  options: Omit<ImportersOptions, 'client'> | undefined,
  storage: FactoryStorage,
): Omit<ImportersOptions, 'client'> {
  if (options?.integrations) return options;
  const scopes = factoryProjectScopes(storage);
  const integrations = Object.fromEntries(
    Object.entries(KNOWLEDGE_IMPORTER_DEFAULT_ROLES).map(([integrationId, role]) => [
      integrationId,
      { access: { 'resource:$projectId': role }, scopes },
    ]),
  );
  return { ...options, integrations };
}
