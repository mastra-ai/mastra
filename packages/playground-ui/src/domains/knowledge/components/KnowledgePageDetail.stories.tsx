import type { Meta, StoryObj } from '@storybook/react-vite';
import type { KnowledgeNotePayload, KnowledgePagePayload } from '../pageTypes';
import { KnowledgePageDetail } from './KnowledgePageDetail';

const HOURS_AGO = (hours: number) => new Date(Date.now() - hours * 3_600_000).toISOString();

function page(id: string, parentId: string | null, extra: Partial<KnowledgePagePayload> = {}): KnowledgePagePayload {
  return {
    id,
    scopeId: 'org',
    parentId,
    isScope: parentId === null,
    position: 'a0',
    name: id,
    version: 1,
    createdBy: { author: 'planner' },
    updatedBy: { author: 'planner' },
    createdAt: HOURS_AGO(30),
    updatedAt: HOURS_AGO(3),
    ...extra,
  };
}

const org = page('org', null, { name: 'Acme', address: 'org:acme', displayLabel: 'Organization' });
const policies = page('policies', 'org', { name: 'Policies', key: 'policies' });
const refunds = page('refunds', 'policies', {
  name: 'Refund policy',
  key: 'refunds',
  version: 7,
  description: 'When support can refund a charge without asking billing.',
  body: '## Limits\n\nSupport refunds up to **$100** on its own. Anything larger goes to [[org:acme#policies/escalation]].',
});
const escalation = page('escalation', 'policies', { name: 'Escalation process', key: 'escalation' });
const linear = page('lin', null, {
  name: 'linear:lin_01M6M0HHKH3T8VAWTWZ13MKNCE',
  address: 'linear:lin_01M6M0HHKH3T8VAWTWZ13MKNCE',
  description: 'Pages imported from a Linear connection.',
  updatedBy: { author: 'importer:kimp_cbd1e92f-c828-41a8-a118-dc6cbd322a16' },
});
const pagesById = new Map([org, policies, refunds, escalation, linear].map(entry => [entry.id, entry]));

const note = (
  id: string,
  text: string,
  author: string,
  hours: number,
  mentions: string[] = [],
): KnowledgeNotePayload => ({
  id,
  pageId: 'refunds',
  text,
  stampScopeIds: [],
  mentions,
  provenance: { author },
  createdAt: HOURS_AGO(hours),
  updatedAt: HOURS_AGO(hours),
});

const meta: Meta<typeof KnowledgePageDetail> = {
  title: 'Domains/Knowledge/PageDetail',
  component: KnowledgePageDetail,
  parameters: { layout: 'fullscreen' },
  decorators: [
    Story => (
      <div className="flex h-screen p-4">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-background">
          <Story />
        </div>
      </div>
    ),
  ],
  args: { pagesById, onPageClick: () => {} },
};

export default meta;
type Story = StoryObj<typeof KnowledgePageDetail>;

export const PageWithNotes: Story = {
  args: {
    page: refunds,
    ancestors: [org, policies],
    pin: { id: 'p1', pageId: 'refunds', audience: ['org:acme'], createdBy: 'host', createdAt: HOURS_AGO(20) },
    notes: [
      note(
        'n1',
        'A customer on the annual plan asked for a partial refund. Handled under the $100 limit.',
        'support',
        5,
      ),
      note('n2', 'Larger refunds now go through [[Escalation process]] first.', 'planner', 2, ['escalation']),
    ],
    activity: [
      {
        id: 'a1',
        action: 'page-updated',
        scopeId: 'org',
        pageId: 'refunds',
        provenance: { author: 'planner' },
        createdAt: HOURS_AGO(3),
      },
      {
        id: 'a2',
        action: 'note-added',
        scopeId: 'org',
        pageId: 'refunds',
        provenance: { author: 'support' },
        createdAt: HOURS_AGO(5),
      },
    ],
  },
};

export const ImportedScope: Story = {
  args: {
    page: linear,
    notes: [],
    activity: [
      {
        id: 'a1',
        action: 'scope-created',
        scopeId: 'lin',
        pageId: 'lin',
        provenance: { author: 'importer:kimp_cbd1e92f-c828-41a8-a118-dc6cbd322a16' },
        createdAt: HOURS_AGO(4),
      },
    ],
  },
};

export const EmptyPage: Story = {
  args: { page: escalation, ancestors: [org, policies], notes: [] },
};

export const Compact: Story = {
  args: { ...PageWithNotes.args, compact: true },
  decorators: [
    Story => (
      <div className="flex h-screen w-96 p-4">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-background">
          <Story />
        </div>
      </div>
    ),
  ],
};

// Imported Linear documents, keyed by their source ids under a connection's scope.
const LINEAR_SCOPE = 'linear:Mastra:lin_01M6M0HHKH3T8VAWTWZ13MKNCE';
const linearScope = page('lin-scope', null, { scopeId: 'lin-scope', name: LINEAR_SCOPE, address: LINEAR_SCOPE });
const linearDocs = page('lin-docs', 'lin-scope', { scopeId: 'lin-scope', name: 'Documents', key: 'linear' });
const investigation = page('mobs', 'lin-docs', {
  scopeId: 'lin-scope',
  name: 'MOBS Investigation',
  key: '464a18f3-2607-4619-b1fa-6820548f0719',
  body: 'Production CPU climbs with each discovery pass; this tracks why.',
});
const benchmarks = page('benchmarks', 'lin-docs', {
  scopeId: 'lin-scope',
  name: 'Incremental discovery benchmarks and production trial decision',
  key: '9c1e0b7d-4e5f-8a6b-3f2a-1d0c9b8a7e6f',
});
const importer = 'importer:kimp_cbd1e92f-c828-41a8-a118-dc6cbd322a16/run:run_1';

/**
 * An importer's relation notes: each names its page by a long `[[scope#path]]` ref and is stamped to the
 * connection's scope. Links show the page titles; the refs and long addresses stay inside their cards.
 */
export const LongImportedRefs: Story = {
  args: {
    // Only the related page is loaded: the open page reaches the notes through its own detail.
    pagesById: new Map([[benchmarks.id, benchmarks]]),
    page: investigation,
    ancestors: [linearScope, linearDocs],
    notes: [
      {
        ...note(
          'n3',
          `Related: [[${LINEAR_SCOPE}#linear/${benchmarks.key}]] — This benchmark quantifies incremental discovery as a potential remedy for the CPU issue.`,
          importer,
          1,
          ['benchmarks'],
        ),
        pageId: 'mobs',
        stampScopeIds: ['lin-scope'],
      },
    ],
    mentionedBy: [
      {
        ...note(
          'm1',
          `Related: [[${LINEAR_SCOPE}#linear/${investigation.key}]] — This benchmark quantifies incremental discovery as a potential remedy for the production CPU issue documented in the MOBS investigation.`,
          importer,
          1,
          ['mobs'],
        ),
        pageId: 'benchmarks',
        stampScopeIds: ['lin-scope'],
      },
    ],
  },
};
