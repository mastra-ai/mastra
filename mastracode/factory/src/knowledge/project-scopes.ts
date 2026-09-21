import type { ImportersOptions, ImporterScopesResolver } from '@mastra/connect';
import type { Knowledge } from '@mastra/core/knowledge';
import type { FactoryStorage } from '@mastra/core/storage';

import type { KnowledgeImporterRoutingStorage } from '../storage/domains/importer-routing/base.js';
import type { FactoryProject, FactoryProjectsStorage } from '../storage/domains/projects/base.js';

/**
 * Human name for each source's knowledge sub-scope. Falls back to a
 * capitalized integration id for providers outside the catalogue.
 */
const SOURCE_SCOPE_NAMES: Readonly<Record<string, string>> = {
  notion: 'Notion',
  confluence: 'Confluence',
  jira: 'Jira',
  linear: 'Linear',
  zendesk: 'Zendesk',
  fireflies: 'Fireflies',
};

function sourceScopeName(integrationId: string): string {
  return SOURCE_SCOPE_NAMES[integrationId] ?? integrationId.charAt(0).toUpperCase() + integrationId.slice(1);
}

/** Destination sub-scope for one source under one Factory project. */
export function connectSourceScopeAddress(projectId: string, integrationId: string): string {
  return `resource:${projectId}:connect:${integrationId}`;
}

export interface FactoryProjectScopesOptions {
  /**
   * Lazy handle to the Factory's Knowledge instance. The resolver and the
   * Knowledge instance are constructed together (the resolver is part of the
   * importer config the instance is built from), so the handle is a thunk
   * that's empty during construction and set before the first cron fire.
   *
   * When present, each resolution materializes the destination sub-scopes —
   * `org → resource → resource:<pid>:connect:<provider>` in dependency
   * order — so imports work for projects nobody has visited yet. Without it
   * the resolver only returns addresses and relies on the scopes existing.
   */
  knowledge?: () => Knowledge | undefined;
}

/**
 * Knowledge-importer scopes resolver over the Factory project inventory: one
 * `resource:<projectId>:connect:<integrationId>` sub-scope per project per
 * source, resolved live at each cron fire so projects created or deleted
 * after startup start/stop syncing automatically.
 *
 * Each source gets its own sub-scope under the project — the same topology
 * as repository knowledge (`resource:<pid>:github:<repo>`) — so Notion,
 * Linear, etc. show up as distinct scopes in the knowledge graph instead of
 * flattening into the project root.
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
 * Pair with a parameterized access map so every source sub-scope is writable:
 * `{ access: { 'resource:$projectId:connect:$sourceId': 'owner' }, scopes: factoryProjectScopes(storage, { knowledge }) }`.
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
        await materializeSourceScopeChain(knowledge, project, connection.integrationId);
      }
    }

    return inventory.map(project => connectSourceScopeAddress(project.id, connection.integrationId));
  };
}

/**
 * Materialize `org → resource → source` in dependency order, skipping rungs
 * that already exist. The org and resource shapes mirror the built-in scopes
 * Factory's knowledge routes materialize on first visit (same addresses,
 * same parameters, no name overrides), so whichever side runs first the
 * other coalesces idempotently. The source rung carries the provider's
 * display name — that's what the graph renders on the scope node.
 *
 * A failure here (storage blip, concurrent materialization conflict) throws
 * up to the importer runner, which keeps the last-good binding set and
 * retries on the next fire — the same contract as inventory enumeration.
 */
async function materializeSourceScopeChain(
  knowledge: Knowledge,
  project: FactoryProject,
  integrationId: string,
): Promise<void> {
  const orgAddress = `org:${project.orgId}`;
  const resourceAddress = `resource:${project.id}`;
  const sourceAddress = connectSourceScopeAddress(project.id, integrationId);

  if (!(await knowledge.resolveScopeAddress(orgAddress))) {
    await knowledge.materializeScope({
      address: orgAddress,
      contextualScopeAddress: orgAddress,
      parameters: { orgId: project.orgId },
    });
  }
  if (!(await knowledge.resolveScopeAddress(resourceAddress))) {
    await knowledge.materializeScope({
      address: resourceAddress,
      parentAddresses: [orgAddress],
      contextualScopeAddress: orgAddress,
      parameters: { resourceId: project.id },
    });
  }
  if (!(await knowledge.resolveScopeAddress(sourceAddress))) {
    await knowledge.materializeScope({
      address: sourceAddress,
      name: sourceScopeName(integrationId),
      parentAddresses: [resourceAddress],
      contextualScopeAddress: resourceAddress,
      parameters: { resourceId: project.id, sourceId: integrationId },
    });
  }
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
 * pass one: every catalogue provider syncs into its own
 * `resource:<projectId>:connect:<provider>` sub-scope per Factory project via
 * {@link factoryProjectScopes}. Host-supplied `integrations` are used
 * verbatim — the host owns the destination topology.
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
      { access: { 'resource:$projectId:connect:$sourceId': role }, scopes },
    ]),
  );
  return { ...options, integrations };
}
