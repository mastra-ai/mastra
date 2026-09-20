import type { ImportersOptions, ImporterScopesResolver } from '@mastra/connect';
import type { FactoryStorage } from '@mastra/core/storage';

import type { FactoryProjectsStorage } from '../storage/domains/projects/base.js';

/**
 * Knowledge-importer scopes resolver over the Factory project inventory: one
 * `resource:<projectId>` per project, resolved live at each cron fire so
 * projects created or deleted after startup start/stop syncing automatically.
 *
 * Reads the `projects` storage domain registered by `MastraFactory` during
 * prepare. Resolution before that registration throws — the core importer
 * runner logs the failure, skips the dynamic portion of that fire, and
 * retries on the next one.
 *
 * Pair with a parameterized access map so every project scope is writable:
 * `{ access: { 'resource:$projectId': 'owner' }, scopes: factoryProjectScopes(storage) }`.
 */
export function factoryProjectScopes(storage: FactoryStorage): ImporterScopesResolver {
  return async () => {
    const projects = storage.getDomain<FactoryProjectsStorage>('projects');
    await projects.ensureReady();
    return (await projects.listAll()).map(project => `resource:${project.id}`);
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
  linear: 'edit',
  zendesk: 'edit',
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
