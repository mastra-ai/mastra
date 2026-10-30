// @vitest-environment jsdom
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '../../../../test/render';
import type { KnowledgeNotePayload, KnowledgePagePayload } from '../../pageTypes';
import { KnowledgePageDetail } from '../KnowledgePageDetail';
import { KnowledgePageTree } from '../KnowledgePageTree';

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
  it('shows a scope named by its address once', () => {
    const named = page('org', null, 'a0', { name: 'org:acme', address: 'org:acme' });
    renderWithProviders(<KnowledgePageTree pages={[named]} onSelect={() => {}} />);
    expect(screen.getAllByText('org:acme')).toHaveLength(1);
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
    expect(within(detail).getByText('in org:acme')).toBeTruthy();
    expect(within(detail).getByText('How refunds work')).toBeTruthy();
    expect(within(detail).getByText('Pinned for org:acme')).toBeTruthy();
    expect(within(detail).getByText('Refunds take 5 days')).toBeTruthy();
    expect(within(detail).getByText('agent:alex')).toBeTruthy();
    expect(within(within(detail).getByLabelText('Stamped to')).getByText('org:acme')).toBeTruthy();
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

  it('says so when a page has no notes', () => {
    renderWithProviders(<KnowledgePageDetail page={orgPage} notes={[]} pagesById={pagesById} onPageClick={() => {}} />);
    expect(screen.getByText('Scope')).toBeTruthy();
    expect(screen.getByText('org:acme')).toBeTruthy();
    expect(screen.getByText('No notes on this page.')).toBeTruthy();
  });
});
