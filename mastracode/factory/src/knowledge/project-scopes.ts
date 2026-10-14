import type { ImportersOptions, ImporterScopesResolver } from '@mastra/connect';
import type { Knowledge } from '@mastra/core/knowledge';
import type { FactoryStorage } from '@mastra/core/storage';

import type { KnowledgeImporterRoutingStorage } from '../storage/domains/importer-routing/base.js';
import type { FactoryProject, FactoryProjectsStorage } from '../storage/domains/projects/base.js';

export interface FactoryProjectScopesOptions {
  /**
   * Lazy handle to the Factory's Knowledge instance. The resolver and the
   * Knowledge instance are constructed together (the resolver is part of the
   * importer config the instance is built from), so the handle is a thunk
   * that's empty during construction and set before the first cron fire.
   *
   * When present, each resolution materializes `org → project:<pid>` in
   * dependency order, so imports work for projects nobody has visited yet.
   * Without it the resolver only returns addresses and relies on the scopes
   * existing.
   */
  knowledge?: () => Knowledge | undefined;
}

/**
 * Knowledge-importer scopes resolver over the Factory project inventory: each
 * connection binds to `project:<projectId>` for every project it syncs to,
 * resolved live at each cron fire so projects created or deleted after
 * startup start/stop syncing automatically.
 *
 * Wave 2 reads are exact-scope: a Factory session reads `org:`, `project:<pid>`
 * and its thread scope, never their children, so imports land on the project
 * scope itself. Connections sharing a project stay separate by binding — each
 * imports under its own `<provider>:<connectionId>` source, and re-syncs and
 * removals only touch that source's records.
 *
 * Honors per-connection routing when the `importer-routing` storage domain is
 * registered: a connection routed to selected projects resolves only those
 * (intersected with the live inventory, so deleted projects drop out); a
 * connection with no routing row — or `mode: 'all'` — resolves every project.
 *
 * Reads storage domains registered by `MastraFactory` during prepare.
 * Resolution before that registration throws — the core importer runner logs
 * the failure, falls back to the static bindings for that fire, and retries
 * on the next one.
 *
 * With `mode: 'all'`, enumerates projects across every org in the storage
 * backend — the platform connection feeding the importers is deployment-level,
 * so in a multi-org deployment its content lands in all orgs' projects. Hosts
 * needing an org boundary should pass their own `scopes` resolver filtered
 * accordingly (or route each connection to selected projects).
 *
 * Pair with a parameterized access map so every project scope is writable:
 * `{ access: { 'project:$projectId': 'owner' }, scopes: factoryProjectScopes(storage, { knowledge }) }`.
 */
export function factoryProjectScopes(
  storage: FactoryStorage,
  options: FactoryProjectScopesOptions = {},
): ImporterScopesResolver {
  return async ({ connection }) => {
    const projects = storage.getDomain<FactoryProjectsStorage>('projects');
    await projects.ensureReady();
    let inventory = await projects.listAll();

    if (storage.hasDomain('importer-routing')) {
      const routing = storage.getDomain<KnowledgeImporterRoutingStorage>('importer-routing');
      await routing.ensureReady();
      const record = await routing.get(connection.id);
      if (record?.mode === 'selected') {
        const selected = new Set(record.projectIds);
        inventory = inventory.filter(project => selected.has(project.id));
      }
    }

    const knowledge = options.knowledge?.();
    if (knowledge) {
      for (const project of inventory) {
        await materializeProjectScopeChain(knowledge, project);
      }
    }

    return inventory.map(project => `project:${project.id}`);
  };
}

/**
 * Materialize `org → project` in dependency order, skipping rungs that already
 * exist. The inputs are the ones Factory's knowledge routes pass when a
 * project is first viewed (same addresses, name and parameters), so whichever
 * side runs first, `materializeScope` coalesces the other.
 *
 * A failure here (storage blip, concurrent materialization conflict) throws
 * up to the importer runner, which falls back to the static bindings for
 * that fire and retries on the next one.
 */
async function materializeProjectScopeChain(knowledge: Knowledge, project: FactoryProject): Promise<void> {
  const store = await knowledge.getStorage();
  const orgAddress = `org:${project.orgId}`;
  const projectAddress = `project:${project.id}`;

  if (!(await store.getScopeAddress(orgAddress))) {
    await knowledge.materializeScope({
      address: orgAddress,
      contextualScopeAddress: orgAddress,
      parameters: { orgId: project.orgId },
    });
  }
  if (!(await store.getScopeAddress(projectAddress))) {
    await knowledge.materializeScope({
      address: projectAddress,
      name: project.name,
      parentAddresses: [orgAddress],
      contextualScopeAddress: orgAddress,
      parameters: { orgId: project.orgId, resourceId: project.id },
    });
  }
}

/**
 * Default role per catalogue provider when the Factory auto-constructs its
 * importer config: document sources own their nodes (stale pages get removed),
 * transcript sources only upsert.
 */
const KNOWLEDGE_IMPORTER_DEFAULT_ROLES: Readonly<Record<string, 'owner' | 'edit'>> = {
  notion: 'owner',
  confluence: 'owner',
  // Linear syncs Documents and Zendesk syncs Help Center articles — both
  // document-shaped, so they own their nodes (archived/draft content is removed).
  linear: 'owner',
  zendesk: 'owner',
  fireflies: 'edit',
};

/**
 * Fill in the default per-project integration config when the host didn't
 * pass one: every catalogue provider syncs each connected account into its
 * the `project:<projectId>` scope of each Factory project it routes to via
 * {@link factoryProjectScopes}. Host-supplied `integrations` are
 * used verbatim — the host owns the destination topology.
 */
export function withProjectScopedIntegrations(
  options: Omit<ImportersOptions, 'client'> | undefined,
  storage: FactoryStorage,
  scopesOptions: FactoryProjectScopesOptions = {},
): Omit<ImportersOptions, 'client'> {
  if (options?.integrations) return options;
  const scopes = factoryProjectScopes(storage, scopesOptions);
  const integrations = Object.fromEntries(
    Object.entries(KNOWLEDGE_IMPORTER_DEFAULT_ROLES).map(([integrationId, role]) => [
      integrationId,
      { access: { 'project:$projectId': role }, scopes },
    ]),
  );
  return { ...options, integrations };
}
