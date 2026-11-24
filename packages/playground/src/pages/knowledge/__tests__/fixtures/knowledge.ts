import type {
  KnowledgeChangeNotice,
  KnowledgeActivityResponse,
  KnowledgeGraphResponse,
  KnowledgeInstanceSummary,
  KnowledgePageResponse,
  KnowledgeSearchResponse,
  KnowledgeTreeResponse,
} from '@mastra/client-js';

type Page = KnowledgeGraphResponse['pages'][number];

const at = '2026-01-01T00:00:00.000Z';

const page = (
  fields: Pick<Page, 'id' | 'scopeId' | 'parentId' | 'isScope' | 'name' | 'position'> & Partial<Page>,
): Page => ({
  version: 1,
  createdBy: { author: 'agent:alex' },
  updatedBy: { author: 'agent:alex' },
  createdAt: at,
  updatedAt: at,
  ...fields,
});

export const knowledgeInstances: { instances: KnowledgeInstanceSummary[] } = {
  instances: [{ key: 'main', id: 'kb' }],
};

export const orgScope = page({
  id: 'scope-acme',
  scopeId: 'scope-acme',
  parentId: null,
  isScope: true,
  address: 'org:acme',
  declaration: 'org:$orgId',
  name: 'Acme',
  position: 'a0',
});

export const paymentsPage = page({
  id: 'page-payments',
  scopeId: 'scope-acme',
  parentId: 'scope-acme',
  isScope: false,
  key: 'payments',
  name: 'Payments Service',
  description: 'Handles card charges.',
  position: 'a0',
});

export const runbookPage = page({
  id: 'page-runbook',
  scopeId: 'scope-acme',
  parentId: 'scope-acme',
  isScope: false,
  name: 'Deploy Runbook',
  position: 'a1',
});

/** The graph from a server whose `org:$orgId` declaration has `displayLabel: 'Organization'`. */
export const knowledgeGraphWithDisplayLabel = (): KnowledgeGraphResponse => ({
  ...knowledgeGraph,
  pages: [{ ...orgScope, displayLabel: 'Organization' }, paymentsPage, runbookPage],
});

export const knowledgeGraph: KnowledgeGraphResponse = {
  pages: [orgScope, paymentsPage, runbookPage],
  outsideIds: [],
  edges: [
    { source: 'scope-acme', target: 'page-payments', kind: 'parent' },
    { source: 'scope-acme', target: 'page-runbook', kind: 'parent' },
    { source: 'page-runbook', target: 'page-payments', kind: 'mention', count: 1 },
  ],
  pinnedIds: ['page-payments'],
  truncated: false,
};

export const emptyKnowledgeGraph: KnowledgeGraphResponse = {
  pages: [],
  outsideIds: [],
  edges: [],
  pinnedIds: [],
  truncated: false,
};

export const paymentsPageView: KnowledgePageResponse = {
  page: paymentsPage,
  ancestors: [orgScope],
  notes: [
    {
      id: 'note-1',
      pageId: 'page-payments',
      text: 'Retries card charges three times before failing.',
      stampScopeIds: ['scope-acme'],
      mentions: [],
      provenance: { author: 'agent:alex' },
      version: 1,
      createdAt: at,
      updatedAt: at,
    },
  ],
  pin: null,
  related: [],
  mentionedBy: [],
};

/** The same page after an agent rewrote its body. */
export const paymentsPageViewAfterEdit: KnowledgePageResponse = {
  ...paymentsPageView,
  page: { ...paymentsPage, body: 'Card charges now retry five times.', version: paymentsPage.version + 1 },
};

export const runbookSearch: KnowledgeSearchResponse = {
  results: [{ type: 'page', page: runbookPage }],
};

/** One tree level: the children of `parentId` (root scopes when null) among the graph's pages. */
export const knowledgeTreeLevel = (parentId: string | null): KnowledgeTreeResponse => ({
  pages: knowledgeGraph.pages.filter(candidate => candidate.parentId === parentId),
  truncated: false,
});

/** A page an agent adds under the org scope while Studio is open. */
export const chargebacksPage = page({
  id: 'page-chargebacks',
  scopeId: 'scope-acme',
  parentId: 'scope-acme',
  isScope: false,
  name: 'Chargebacks',
  position: 'a9',
});

/** The org scope's tree level after `chargebacksPage` was added. */
export const knowledgeTreeLevelWithChargebacks = (parentId: string | null): KnowledgeTreeResponse =>
  parentId === 'scope-acme'
    ? { ...knowledgeTreeLevel(parentId), pages: [...knowledgeTreeLevel(parentId).pages, chargebacksPage] }
    : knowledgeTreeLevel(parentId);

export const paymentsActivity: KnowledgeActivityResponse = {
  events: [
    {
      id: 'event-1',
      action: 'page-updated',
      scopeId: 'scope-acme',
      pageId: 'page-payments',
      provenance: { author: 'agent:alex' },
      createdAt: at,
    },
  ],
};

/** The payments page with a markdown body, as agents now write them. */
export const paymentsPageMarkdownView: KnowledgePageResponse = {
  ...paymentsPageView,
  page: {
    ...paymentsPage,
    body: '## Retries\n\nCharges retry **three** times.<script>window.__injected = true</script>',
  },
};

/** What the events route sends when an agent updates the Payments page. */
export const paymentsUpdatedNotice: KnowledgeChangeNotice = {
  kind: 'page',
  op: 'update',
  pageId: 'page-payments',
  scopeId: 'scope-acme',
  at: '2026-10-29T12:00:00.000Z',
};

/** The graph with grants: a written role scope and a declared one nothing was written to yet. */
export const knowledgeGraphWithGrants: KnowledgeGraphResponse = {
  ...knowledgeGraph,
  grants: [{ principal: 'role:acme:admin', principalLabel: 'acme admin', target: 'scope-acme', role: 'owner' }],
};
