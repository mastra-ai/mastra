import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import type { KnowledgeNotePayload, KnowledgePagePayload } from '../pageTypes';
import type {
  KnowledgeExplorerPageDetail,
  KnowledgeExplorerQueryState,
  KnowledgeExplorerSource,
  KnowledgeExplorerView,
} from './KnowledgePageExplorer';
import { KnowledgePageExplorer } from './KnowledgePageExplorer';

const HOURS_AGO = (hours: number) => new Date(Date.now() - hours * 3_600_000).toISOString();
const IMPORTER = { author: 'importer:kimp_cbd1e92f-c828-41a8-a118-dc6cbd322a16' };

function page(id: string, parentId: string | null, extra: Partial<KnowledgePagePayload> = {}): KnowledgePagePayload {
  return {
    id,
    scopeId: 'lin',
    parentId,
    isScope: parentId === null,
    position: 'a0',
    name: id,
    version: 1,
    createdBy: IMPORTER,
    updatedBy: IMPORTER,
    createdAt: HOURS_AGO(4),
    updatedAt: HOURS_AGO(4),
    ...extra,
  };
}

const ADDRESS = 'linear:lin_01M6M0HHKH3T8VAWTWZ13MKNCE';
const linear = page('lin', null, {
  name: ADDRESS,
  address: ADDRESS,
  displayLabel: 'Scope',
  description: 'Pages imported from a Linear connection.',
  childCount: 1,
});
const workspace = page('workspace', 'lin', {
  name: 'linear',
  key: 'linear',
  childCount: 2,
  description: 'Everything from the Linear workspace.',
});
const projects = page('projects', 'workspace', { name: 'project', key: 'project', childCount: 2 });
const documents = page('documents', 'workspace', { name: 'document', key: 'document', position: 'a1', childCount: 2 });
const launch = page('launch', 'documents', {
  name: 'Launch plan',
  key: 'launch-plan',
  version: 4,
  description: 'How the Knowledge explorer ships to Studio.',
  body: '## Goals\n\nShip the explorer to every Studio project, then turn on importers for Linear and Notion.\n\nSee [[linear:lin_01M6M0HHKH3T8VAWTWZ13MKNCE#linear/document/roadmap]] for dates.',
  updatedAt: HOURS_AGO(1),
});
const roadmap = page('roadmap', 'documents', { name: 'Roadmap', key: 'roadmap', position: 'a1' });
const studio = page('studio', 'projects', { name: 'Studio in Platform', key: 'studio' });
const gateway = page('gateway', 'projects', {
  name: 'Gateway BYOK connections and project routing for every environment',
  key: 'gateway',
  position: 'a1',
});
const pages = [linear, workspace, projects, documents, launch, roadmap, studio, gateway];

const notes: KnowledgeNotePayload[] = [
  {
    id: 'n1',
    pageId: 'launch',
    text: 'Moved the importer run log out of the table and into the expanded row. See [[Roadmap]].',
    stampScopeIds: [],
    mentions: ['roadmap'],
    provenance: { author: 'planner' },
    createdAt: HOURS_AGO(2),
    updatedAt: HOURS_AGO(2),
  },
];

const ok = <T,>(data: T): KnowledgeExplorerQueryState<T> => ({ data, isPending: false, isError: false, error: null });
const pending: KnowledgeExplorerQueryState<never> = { isPending: true, isError: false, error: null };
const failed: KnowledgeExplorerQueryState<never> = {
  isPending: false,
  isError: true,
  error: new Error('The knowledge service did not answer.'),
};

function detail(target: KnowledgePagePayload): KnowledgeExplorerPageDetail {
  const ancestors: KnowledgePagePayload[] = [];
  for (let at = target.parentId; at;) {
    const parent = pages.find(candidate => candidate.id === at);
    if (!parent) break;
    ancestors.unshift(parent);
    at = parent.parentId;
  }
  return { page: target, notes: target.id === 'launch' ? notes : [], ancestors, related: pages };
}

const SEARCH_HITS = [
  'Is there anything on the mobile piece for client SDKs?',
  'Query traces and spans reference: aggregate spans with the client SDK and group them by model, tool and agent',
  'Launch plan',
  'Roadmap',
];

function source(state: 'ready' | 'loading' | 'error'): KnowledgeExplorerSource {
  return {
    usePage: pageId => {
      if (state === 'loading') return pending;
      if (state === 'error') return failed;
      const target = pages.find(candidate => candidate.id === pageId);
      return target ? ok(detail(target)) : failed;
    },
    useSearch: query => ({
      data: {
        results: query ? SEARCH_HITS.map((name, index) => ({ page: page(`hit${index}`, 'lin', { name }) })) : [],
      },
    }),
    useTreeLevels: requests =>
      requests.map(request =>
        state === 'loading'
          ? pending
          : ok({ pages: pages.filter(candidate => candidate.parentId === (request.parentId || null)) }),
      ),
    useActivity: pageId =>
      ok({
        events: [
          {
            id: `updated-${pageId}`,
            action: 'page-updated',
            scopeId: 'lin',
            pageId,
            provenance: IMPORTER,
            createdAt: HOURS_AGO(1),
          },
          {
            id: `created-${pageId}`,
            action: pageId === 'lin' ? 'scope-created' : 'page-created',
            scopeId: 'lin',
            pageId,
            provenance: IMPORTER,
            createdAt: HOURS_AGO(4),
          },
        ],
      }),
  };
}

const graph = {
  pages,
  edges: [{ kind: 'link' as const, source: 'launch', target: 'roadmap' }],
  pinnedIds: [],
  truncated: false,
};

function Explorer({
  view: initialView,
  pageId,
  state = 'ready',
}: {
  view: KnowledgeExplorerView;
  pageId?: string;
  state?: 'ready' | 'loading' | 'error';
}) {
  const [selected, setSelected] = useState<string | null>(pageId ?? null);
  const [view, setView] = useState<KnowledgeExplorerView>(initialView);
  return (
    <div className="flex h-screen flex-col p-4">
      <KnowledgePageExplorer
        graph={graph}
        source={source(state)}
        selectedPageId={selected}
        onSelect={setSelected}
        view={view}
        onViewChange={setView}
      />
    </div>
  );
}

const meta: Meta<typeof Explorer> = {
  title: 'Domains/Knowledge/PageExplorer',
  component: Explorer,
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj<typeof Explorer>;

export const Graph: Story = { args: { view: 'graph' } };

export const GraphWithDrawer: Story = { args: { view: 'graph', pageId: 'launch' } };

export const ImportedScope: Story = { args: { view: 'page', pageId: 'lin' } };

export const Page: Story = { args: { view: 'page', pageId: 'launch' } };

export const LongPageName: Story = { args: { view: 'page', pageId: 'gateway' } };

export const Loading: Story = { args: { view: 'page', pageId: 'launch', state: 'loading' } };

export const PageError: Story = { args: { view: 'page', pageId: 'launch', state: 'error' } };
