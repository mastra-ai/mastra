// @vitest-environment jsdom
import { MastraClient } from '@mastra/client-js';
import { useQuery } from '@tanstack/react-query';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { server } from '../../../../test/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../../test/render';
import { bodyHeadings } from '../../lib/bodyHeadings';
import type { KnowledgeNotePayload, KnowledgePagePayload } from '../../pageTypes';
import { KnowledgePageDetail } from '../KnowledgePageDetail';
import { KnowledgePageTree } from '../KnowledgePageTree';
import { emptyScopeGraph, labeledScopeGraph, scopeLabelsGraph } from './fixtures/scope-labels';

const client = new MastraClient({ baseUrl: TEST_BASE_URL });

function RouteTree() {
  const { data } = useQuery({ queryKey: ['scope-labels'], queryFn: () => client.getKnowledge('company').graph() });
  return (
    <KnowledgePageTree
      pages={data?.pages ?? []}
      initiallyExpanded={scopeLabelsGraph.pages.map(page => page.id)}
      onSelect={() => {}}
    />
  );
}

function page(id: string, parentId: string | null, position: string, extra: Partial<KnowledgePagePayload> = {}) {
  return {
    id,
    scopeId: parentId === null ? id : 'org',
    parentId,
    isScope: parentId === null,
    position,
    name: id,
    version: 1,
    createdBy: { author: 'host' },
    updatedBy: { author: 'host' },
    createdAt: '2026-10-28T00:00:00.000Z',
    updatedAt: '2026-10-28T00:00:00.000Z',
    ...extra,
  } satisfies KnowledgePagePayload;
}

const orgPage = page('org', null, 'a0', { name: 'Acme', address: 'org:acme' });
const refundsPage = page('refunds', 'org', 'a1', { name: 'Refunds' });
const billingPage = page('billing', 'org', 'a2', { name: 'Billing' });
const pages = [orgPage, refundsPage, page('policy', 'refunds', 'a0', { name: 'Refund policy' }), billingPage];

function ControlledTree({ initial, onSelect }: { initial?: string; onSelect?: (id: string) => void }) {
  const [selected, setSelected] = useState(initial);
  return (
    <>
      <KnowledgePageTree
        pages={pages}
        selectedPageId={selected}
        onSelect={next => {
          setSelected(next.id);
          onSelect?.(next.id);
        }}
      />
      <button type="button" onClick={() => setSelected('policy')}>
        Select from graph
      </button>
    </>
  );
}

const names = () => screen.getAllByRole('treeitem').map(item => item.textContent);

describe('KnowledgePageTree', () => {
  it('opens roots by default and shows siblings in stored order', () => {
    renderWithProviders(<ControlledTree />);
    expect(names()).toEqual(['Acmeorg:acme', 'Refunds', 'Billing']);
    expect(screen.getByRole('treeitem', { name: /Acme/ }).getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('treeitem', { name: /Refunds/ }).getAttribute('aria-expanded')).toBe('false');
  });

  it('expands with the chevron without selecting, and selects on click', async () => {
    const onSelect = vi.fn();
    renderWithProviders(<ControlledTree onSelect={onSelect} />);
    await userEvent.click(screen.getByRole('button', { name: 'Expand Refunds' }));
    expect(names()).toContain('Refund policy');
    expect(onSelect).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('treeitem', { name: 'Refund policy' }));
    expect(onSelect).toHaveBeenCalledWith('policy');
    expect(screen.getByRole('treeitem', { name: 'Refund policy' }).getAttribute('aria-selected')).toBe('true');
  });

  it('reveals a page selected elsewhere by opening its ancestors', async () => {
    renderWithProviders(<ControlledTree />);
    expect(names()).not.toContain('Refund policy');
    await userEvent.click(screen.getByRole('button', { name: 'Select from graph' }));
    expect(screen.getByRole('treeitem', { name: 'Refund policy' }).getAttribute('aria-level')).toBe('3');
  });

  it('moves with the arrow keys and selects with Enter', async () => {
    const onSelect = vi.fn();
    renderWithProviders(<ControlledTree onSelect={onSelect} />);
    screen.getByRole('treeitem', { name: /Acme/ }).focus();
    await userEvent.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(screen.getByRole('treeitem', { name: 'Refunds' }));
    await userEvent.keyboard('{ArrowRight}');
    expect(names()).toContain('Refund policy');
    await userEvent.keyboard('{ArrowRight}');
    expect(document.activeElement).toBe(screen.getByRole('treeitem', { name: 'Refund policy' }));
    await userEvent.keyboard('{ArrowLeft}');
    expect(document.activeElement).toBe(screen.getByRole('treeitem', { name: 'Refunds' }));
    await userEvent.keyboard('{Enter}');
    expect(onSelect).toHaveBeenCalledWith('refunds');
  });

  it('says so when there are no pages', () => {
    renderWithProviders(<KnowledgePageTree pages={[]} onSelect={() => {}} />);
    expect(screen.getByText('No pages yet.')).toBeTruthy();
  });
});

describe('KnowledgePageTree scope rows and pins', () => {
  it('renders declared labels and accessible expansion names from real route payloads', async () => {
    server.use(http.get(`${TEST_BASE_URL}/api/knowledge/company/graph`, () => HttpResponse.json(scopeLabelsGraph)));
    renderWithProviders(<RouteTree />);
    expect(await screen.findByRole('treeitem', { name: /Acme/ })).toBeTruthy();
    expect(screen.getByRole('treeitem', { name: /Roadmap/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Collapse Acme' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Collapse Roadmap' })).toBeTruthy();
    expect(screen.getByText('org:org-1')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Collapse Acme' }));
    expect(screen.queryByRole('treeitem', { name: /Roadmap/ })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Expand Acme' }));
    expect(screen.getByRole('treeitem', { name: /Roadmap/ })).toBeTruthy();
  });

  it('renders API scope labels without losing the canonical address', async () => {
    server.use(http.get(`${TEST_BASE_URL}/api/knowledge/company/graph`, () => HttpResponse.json(labeledScopeGraph)));
    renderWithProviders(<RouteTree />);
    const row = await screen.findByRole('treeitem', { name: /Acme/ });
    expect(row.textContent).toBe('Acmeorg:acme');
  });

  it('gives an empty scope a folder icon without making it expandable', async () => {
    server.use(http.get(`${TEST_BASE_URL}/api/knowledge/company/graph`, () => HttpResponse.json(emptyScopeGraph)));
    renderWithProviders(<RouteTree />);
    const row = await screen.findByRole('treeitem', { name: /empty/ });
    expect(row.querySelector('[data-central-icon="IconFolder1"]')).toBeTruthy();
    expect(row.querySelector('[data-central-icon="IconFileText"]')).toBeNull();
    expect(row.hasAttribute('aria-expanded')).toBe(false);
    expect(within(row).queryByRole('button')).toBeNull();
  });

  it('names a scope that only has its address by its kind', () => {
    const named = page('org', null, 'a0', { name: 'org:acme', address: 'org:acme' });
    renderWithProviders(<KnowledgePageTree pages={[named]} onSelect={() => {}} />);
    expect(screen.getByRole('treeitem', { name: /Organization/ })).toBeTruthy();
  });

  it('shows the address beside a scope with its own name', () => {
    renderWithProviders(<KnowledgePageTree pages={pages} onSelect={() => {}} />);
    const row = screen.getByRole('treeitem', { name: /Acme/ });
    expect(within(row).getByText('org:acme')).toBeTruthy();
  });

  it('lets a long address shrink so the scope name keeps its room', () => {
    const project = page('project', null, 'a0', {
      name: 'Support desk',
      address: 'project:9efdb859-2ce6-4e4b-83ce-971a7e41bec5',
    });
    renderWithProviders(<KnowledgePageTree pages={[project]} onSelect={() => {}} />);
    const address = screen.getByTestId('knowledge-tree-address');
    expect(address.className).not.toMatch(/\bshrink-0\b/);
    expect(address.className).toMatch(/\bmin-w-0\b/);
    expect(address.className).toMatch(/\bmax-w-1\/2\b/);
  });

  it('marks pinned pages', () => {
    renderWithProviders(<KnowledgePageTree pages={pages} pinnedIds={['refunds']} onSelect={() => {}} />);
    const pinned = screen.getAllByRole('treeitem').filter(row => within(row).queryByLabelText('Pinned'));
    expect(pinned.map(row => row.getAttribute('aria-level') + ':' + row.textContent)).toEqual(['2:Refunds']);
  });
});

describe('KnowledgePageDetail', () => {
  const pagesById = new Map(pages.map(entry => [entry.id, entry]));
  const note = (extra: Partial<KnowledgeNotePayload>): KnowledgeNotePayload => ({
    id: 'n1',
    pageId: 'refunds',
    text: '',
    stampScopeIds: ['org'],
    mentions: [],
    provenance: { author: 'agent:alex' },
    createdAt: '2026-10-28T00:00:00.000Z',
    updatedAt: '2026-10-28T00:00:00.000Z',
    ...extra,
  });

  it('shows home scope, body, pin audience and notes with stamps and author', () => {
    renderWithProviders(
      <KnowledgePageDetail
        page={{ ...refundsPage, description: 'How refunds work', body: 'Line one\nLine two' }}
        notes={[note({ text: 'Refunds take 5 days' })]}
        pin={{ id: 'p1', pageId: 'refunds', audience: ['org:acme'], createdBy: 'host', createdAt: '' }}
        pagesById={pagesById}
        onPageClick={() => {}}
      />,
    );
    const detail = screen.getByRole('article', { name: 'Refunds' });
    expect(within(within(detail).getByRole('region', { name: 'Details' })).getByText('Acme')).toBeTruthy();
    expect(within(detail).getByText('How refunds work')).toBeTruthy();
    expect(within(detail).getByText('Pinned for org:acme')).toBeTruthy();
    expect(within(detail).getByText('Refunds take 5 days')).toBeTruthy();
    expect(within(detail).getByText('agent:alex')).toBeTruthy();
    expect(within(within(detail).getByLabelText('Stamped to')).getByText('org:acme')).toBeTruthy();
  });

  it('lists the body’s headings, and the pages its body links to', () => {
    const onPageClick = vi.fn();
    renderWithProviders(
      <KnowledgePageDetail
        page={{
          ...refundsPage,
          body: '# Refunds\nSee [[Billing]].\n## Retries\nAgain [[Billing]] and [[Nowhere]].\n```\n## Not a heading\n```',
        }}
        notes={[]}
        pagesById={pagesById}
        onPageClick={onPageClick}
      />,
    );
    const toc = within(screen.getByRole('region', { name: 'On this page' }));
    expect(toc.getAllByRole('button').map(button => button.textContent)).toEqual(['Refunds', 'Retries']);
    const links = within(screen.getByRole('region', { name: 'Links to' }));
    expect(links.getByRole('button', { name: 'Billing' })).toBeTruthy();
    expect(links.getByText('×2')).toBeTruthy();
    expect(links.queryByText('Nowhere')).toBeNull();
  });

  it('peeks with counts, a preview and only the latest note', () => {
    const onOpenPage = vi.fn();
    renderWithProviders(
      <KnowledgePageDetail
        compact
        onOpenPage={onOpenPage}
        page={{ ...refundsPage, body: 'See [[Billing]].' }}
        notes={[
          note({ id: 'old', text: 'Older note', updatedAt: '2026-10-01T00:00:00.000Z' }),
          note({ id: 'new', text: 'Newest note', updatedAt: '2026-11-01T00:00:00.000Z' }),
        ]}
        mentionedBy={[note({ id: 'm', pageId: 'billing', text: 'About [[Refunds]]', mentions: ['refunds'] })]}
        pagesById={pagesById}
        onPageClick={() => {}}
      />,
    );
    const counts = within(screen.getByLabelText('Links and notes'));
    expect(counts.getAllByRole('definition').map(value => value.textContent)).toEqual(['1', '1', '2']);
    const latest = within(screen.getByRole('region', { name: 'Latest note' }));
    expect(latest.getByText('Newest note')).toBeTruthy();
    expect(latest.queryByText('Older note')).toBeNull();
    latest.getByRole('button', { name: 'All 2 notes' }).click();
    expect(onOpenPage).toHaveBeenCalled();
    expect(screen.queryByRole('region', { name: 'On this page' })).toBeNull();
  });

  it('reads only the top three heading levels outside code', () => {
    expect(bodyHeadings('# One\n#### Four\n### Three **bold**\n~~~\n# code\n~~~\n## [[Two]] ##')).toEqual([
      { depth: 1, text: 'One' },
      { depth: 3, text: 'Three bold' },
      { depth: 2, text: 'Two' },
    ]);
  });

  it('links resolved mentions and leaves unresolved ones as text', async () => {
    const onPageClick = vi.fn();
    renderWithProviders(
      <KnowledgePageDetail
        page={refundsPage}
        notes={[note({ text: 'See [[Billing]] and [[Nowhere]]', mentions: ['billing'] })]}
        pagesById={pagesById}
        onPageClick={onPageClick}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Nowhere' })).toBeNull();
    expect(screen.getByText('Nowhere')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Billing' }));
    expect(onPageClick).toHaveBeenCalledWith(billingPage);
  });

  it('marks the notes that mention a page, when asked to', () => {
    renderWithProviders(
      <KnowledgePageDetail
        page={refundsPage}
        notes={[
          note({ id: 'n1', text: 'Plain note' }),
          note({ id: 'n2', text: 'See [[Billing]]', mentions: ['billing'] }),
        ]}
        pagesById={pagesById}
        onPageClick={() => {}}
        highlightMentionOf="billing"
      />,
    );
    const marked = screen.getAllByRole('listitem').filter(item => item.dataset.highlighted === 'true');
    expect(marked.map(item => item.textContent)).toEqual([expect.stringContaining('See Billing')]);
  });

  it('keeps the notes section when the first batch is empty but more notes follow', () => {
    renderWithProviders(
      <KnowledgePageDetail
        page={orgPage}
        notes={[]}
        notesMore={<button type="button">Load more notes</button>}
        pagesById={pagesById}
        onPageClick={() => {}}
      />,
    );
    const notes = within(screen.getByRole('region', { name: 'Notes' }));
    expect(notes.getByRole('button', { name: 'Load more notes' })).toBeTruthy();
  });

  it('leaves out the notes section when a page has none', () => {
    renderWithProviders(<KnowledgePageDetail page={orgPage} notes={[]} pagesById={pagesById} onPageClick={() => {}} />);
    expect(screen.getByText('Scope')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Acme' })).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'Notes' })).toBeNull();
  });
});
