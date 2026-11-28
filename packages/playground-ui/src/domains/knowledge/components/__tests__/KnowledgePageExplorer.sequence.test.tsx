// @vitest-environment jsdom
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '../../../../test/render';
import type { KnowledgePagePayload } from '../../pageTypes';
import type {
  KnowledgeExplorerQueryState,
  KnowledgeExplorerSource,
  KnowledgeExplorerSequence,
  KnowledgeExplorerSequenceInfo,
  KnowledgeExplorerSequenceItem,
  KnowledgeExplorerSequenceRequest,
} from '../KnowledgePageExplorer';
import { KnowledgePageExplorer } from '../KnowledgePageExplorer';

function page(id: string, parentId: string | null, extra: Partial<KnowledgePagePayload> = {}): KnowledgePagePayload {
  return {
    id,
    scopeId: parentId === null ? id : 'org',
    parentId,
    isScope: parentId === null,
    position: 'a0',
    name: id,
    version: 1,
    createdBy: { author: 'host' },
    updatedBy: { author: 'host' },
    createdAt: '2026-10-28T00:00:00.000Z',
    updatedAt: '2026-10-28T00:00:00.000Z',
    ...extra,
  };
}

function item(
  id: string,
  occurredAt: string,
  body: string,
  extra: Partial<KnowledgeExplorerSequenceItem> = {},
): KnowledgeExplorerSequenceItem {
  return {
    id,
    sequenceId: 'general',
    externalId: id,
    occurredAt,
    writtenAt: occurredAt,
    editedAt: null,
    deletedAt: null,
    position: null,
    author: { sourceId: 'U1', name: 'Ada' },
    externalParentId: null,
    type: null,
    title: null,
    body,
    links: [],
    properties: null,
    pageId: null,
    version: 1,
    writtenBy: 'importer:slack',
    ...extra,
  };
}

const org = page('org', null, { name: 'Acme', address: 'org:acme' });
const general = page('general', 'org', { name: '#general', key: 'general' });
const plain = page('plain', 'org', { name: 'Plain', key: 'plain', body: 'Just a page' });
const runbook = page('runbook', 'org', { name: 'Runbook', key: 'runbook' });

const root = item('e1', '2026-11-01T09:00:00.000Z', 'Deploy is starting');
const reply = item('e2', '2026-11-01T09:05:00.000Z', 'Deploy finished', {
  externalParentId: 'e1',
  author: { sourceId: 'U2', name: 'Grace' },
  editedAt: '2026-11-01T09:06:00.000Z',
});
const removed = item('e3', '2026-11-01T10:00:00.000Z', '', { body: null, deletedAt: '2026-11-01T10:01:00.000Z' });
const older = item('e0', '2026-10-31T08:00:00.000Z', 'Yesterday standup');

const ok = <T,>(data: T): KnowledgeExplorerQueryState<T> => ({ data, isPending: false, isError: false, error: null });
const idle: KnowledgeExplorerQueryState<never> = { isPending: false, isError: false, error: null };

const timeline: KnowledgeExplorerSequenceInfo = { orderBy: 'timeline', propertiesSchema: null, itemTypes: null };

const deploy = item('d1', '2026-11-02T12:00:00.000Z', '', {
  body: null,
  type: 'deploy',
  title: 'Deploy 1.84',
  links: [{ url: 'https://ci.example.com/run/7', title: 'CI run 7' }, { url: 'https://example.com/raw' }],
  properties: { notes: 'smooth', env: 'prod', durationMs: 4200 },
});
const incident = item('i1', '2026-11-02T13:00:00.000Z', 'Pager went off', {
  type: 'incident',
  properties: { severity: 2 },
});
const typedInfo: KnowledgeExplorerSequenceInfo = {
  orderBy: 'timeline',
  propertiesSchema: null,
  itemTypes: {
    deploy: {
      label: 'Deploy',
      propertiesSchema: {
        type: 'object',
        properties: { env: { type: 'string' }, durationMs: { type: 'number' } },
      },
    },
  },
};

const stepOne = item('s1', '', '', { occurredAt: null, position: 'a', title: 'Check the order', body: null });
const stepPage = item('page:approve', '', '', {
  occurredAt: null,
  position: 'b',
  title: 'Approve the refund',
  body: null,
  pageId: 'approve',
});
const steps: KnowledgeExplorerSequenceInfo = { orderBy: 'position', propertiesSchema: null, itemTypes: null };

function respond(request: KnowledgeExplorerSequenceRequest): KnowledgeExplorerSequence {
  if (request.q) return { items: [reply, root].filter(item => /deploy/i.test(item.body ?? '')), nextCursor: null };
  if (request.parent) return { items: [reply, root], nextCursor: null };
  if (request.cursor === 'older') return { items: [older], nextCursor: null };
  return { items: [removed, reply, root], nextCursor: 'older' };
}

function setup(generalInfo: KnowledgeExplorerSequenceInfo = timeline) {
  const calls: Array<{ pageId: string; requests: KnowledgeExplorerSequenceRequest[] }> = [];
  const source: KnowledgeExplorerSource = {
    usePage: pageId => {
      if (!pageId) return idle;
      if (pageId === 'general')
        return ok({ page: general, notes: [], ancestors: [org], related: [], sequence: generalInfo });
      if (pageId === 'runbook') return ok({ page: runbook, notes: [], ancestors: [org], related: [], sequence: steps });
      return ok({ page: plain, notes: [], ancestors: [org], related: [] });
    },
    useSearch: () => ({ data: { results: [] } }),
    useSequence: (pageId, requests) => {
      calls.push({ pageId, requests });
      return requests.map(request => ok(respond(request)));
    },
  };
  return { source, calls };
}

const graph = { pages: [org, general, plain, runbook], edges: [], pinnedIds: [], truncated: false };

function renderPage(
  source: KnowledgeExplorerSource,
  pageId: string,
  onSelect: (pageId: string | null) => void = () => {},
) {
  return renderWithProviders(
    <KnowledgePageExplorer
      graph={graph}
      source={source}
      selectedPageId={pageId}
      onSelect={onSelect}
      view="page"
      onViewChange={() => {}}
    />,
  );
}

beforeAll(() => {
  window.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

const itemTexts = () =>
  within(screen.getByRole('list', { name: 'Sequence items' }))
    .getAllByRole('listitem')
    .map(item => item.textContent ?? '');

describe('KnowledgePageExplorer sequence', () => {
  it("lists a sequence page's items newest first, with author, edits and deletions", () => {
    const { source, calls } = setup();
    renderPage(source, 'general');
    expect(calls.at(-1)).toEqual({ pageId: 'general', requests: [{}] });
    const texts = itemTexts();
    expect(texts).toHaveLength(3);
    expect(texts[0]).toContain('Deleted');
    expect(texts[1]).toContain('Grace');
    expect(texts[1]).toContain('Deploy finished');
    expect(texts[1]).toContain('edited');
    expect(texts[2]).toContain('Ada');
    expect(texts[2]).toContain('Deploy is starting');
  });

  it('loads older items with the cursor', async () => {
    const { source, calls } = setup();
    renderPage(source, 'general');
    await userEvent.click(screen.getByRole('button', { name: 'Load older items' }));
    expect(calls.at(-1)?.requests).toEqual([{}, { cursor: 'older' }]);
    expect(itemTexts()).toHaveLength(4);
    expect(itemTexts()[3]).toContain('Yesterday standup');
    expect(screen.queryByRole('button', { name: 'Load older items' })).toBeNull();
  });

  it('reanchors loaded pages when polling shifts the first page', async () => {
    const { source } = setup();
    let polled = false;
    source.useSequence = (_pageId, requests) =>
      requests.map(request =>
        ok(
          !polled
            ? respond(request)
            : request.cursor === 'shifted'
              ? { items: [root, older], nextCursor: null }
              : request.cursor === 'older'
                ? { items: [older], nextCursor: null }
                : { items: [removed, reply], nextCursor: 'shifted' },
        ),
      );
    const view = renderPage(source, 'general');
    await userEvent.click(screen.getByRole('button', { name: 'Load older items' }));
    polled = true;
    view.rerender(
      <KnowledgePageExplorer
        graph={graph}
        source={source}
        selectedPageId="general"
        onSelect={() => {}}
        view="page"
        onViewChange={() => {}}
      />,
    );
    expect(screen.getByText('Deploy is starting')).toBeTruthy();
    expect(itemTexts()).toHaveLength(4);
  });

  it('leaves the nested view when searching the whole sequence', async () => {
    const { source, calls } = setup();
    renderPage(source, 'general');
    const nested = screen.getAllByRole('button', { name: 'Show nested items' })[0];
    expect(nested).toBeDefined();
    if (nested) await userEvent.click(nested);
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search items' }), 'deploy{Enter}');
    expect(calls.at(-1)?.requests[0]).not.toHaveProperty('parent');
    expect(screen.queryByText(/^Under /)).toBeNull();
  });

  it('labels ascending pagination as newer items', async () => {
    const { source } = setup();
    renderPage(source, 'general');
    await userEvent.click(screen.getByRole('button', { name: 'Oldest first' }));
    expect(screen.getByRole('button', { name: 'Load newer items' })).toBeTruthy();
  });

  it('opens the nested items from a nested one and goes back to every item', async () => {
    const { source, calls } = setup();
    renderPage(source, 'general');
    const replyItem = screen.getAllByRole('listitem').find(item => item.textContent?.includes('Deploy finished'));
    expect(replyItem).toBeDefined();
    expect(replyItem?.textContent).toContain('Nested');
    await userEvent.click(within(replyItem as HTMLElement).getByRole('button', { name: 'Show nested items' }));
    expect(calls.at(-1)?.requests).toEqual([{ order: 'asc', parent: 'e1' }]);
    expect(screen.getByText('Under e1')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'All items' }));
    expect(calls.at(-1)?.requests).toEqual([{}]);
  });

  it('reads a date range as ISO times and oldest first when asked', async () => {
    const { source, calls } = setup();
    renderPage(source, 'general');
    await userEvent.type(screen.getByLabelText('From'), '2026-11-01T00:00');
    await userEvent.type(screen.getByLabelText('To'), '2026-11-02T00:00');
    await userEvent.click(screen.getByRole('button', { name: 'Oldest first' }));
    expect(calls.at(-1)?.requests).toEqual([
      {
        order: 'asc',
        since: new Date('2026-11-01T00:00').toISOString(),
        until: new Date('2026-11-02T00:00').toISOString(),
      },
    ]);
  });

  it('searches items by keyword', async () => {
    const { source, calls } = setup();
    renderPage(source, 'general');
    await userEvent.type(screen.getByLabelText('Search items'), 'deploy{Enter}');
    expect(calls.at(-1)?.requests).toEqual([{ q: 'deploy' }]);
    expect(itemTexts()).toHaveLength(2);
  });

  it("shows an item's type, title, links and properties, declared ones first", () => {
    const { source } = setup(typedInfo);
    source.useSequence = (_pageId, requests) => requests.map(() => ok({ items: [incident, deploy], nextCursor: null }));
    renderPage(source, 'general');
    const list = screen.getByRole('list', { name: 'Sequence items' });
    const [incidentItem, deployItem] = Array.from(list.children);
    expect(within(deployItem as HTMLElement).getByText('Deploy')).toBeTruthy();
    expect(within(deployItem as HTMLElement).getByText('Deploy 1.84')).toBeTruthy();
    expect(
      within(deployItem as HTMLElement)
        .getByRole('link', { name: 'CI run 7' })
        .getAttribute('href'),
    ).toBe('https://ci.example.com/run/7');
    expect(within(deployItem as HTMLElement).getByRole('link', { name: 'https://example.com/raw' })).toBeTruthy();
    const keys = within(deployItem as HTMLElement)
      .getAllByRole('term')
      .map(term => term.textContent);
    expect(keys).toEqual(['env', 'durationMs', 'notes']);
    expect(within(deployItem as HTMLElement).getByText('4200')).toBeTruthy();
    // An undeclared type shows its raw key.
    expect(within(incidentItem as HTMLElement).getByText('incident')).toBeTruthy();
    expect(within(incidentItem as HTMLElement).getByText('severity')).toBeTruthy();
  });

  it('filters by a declared type or by untyped items', async () => {
    const { source, calls } = setup(typedInfo);
    source.useSequence = (pageId, requests) => {
      calls.push({ pageId, requests });
      return requests.map(() => ok({ items: [incident, deploy], nextCursor: null }));
    };
    renderPage(source, 'general');
    await userEvent.click(screen.getByRole('button', { name: 'Deploy' }));
    expect(calls.at(-1)?.requests).toEqual([{ types: ['deploy'] }]);
    await userEvent.click(screen.getByRole('button', { name: 'Untyped' }));
    expect(calls.at(-1)?.requests).toEqual([{ untyped: true }]);
    await userEvent.click(screen.getByRole('button', { name: 'All types' }));
    expect(calls.at(-1)?.requests).toEqual([{}]);
  });

  it('reads a position sequence in order, without a date range, and opens child pages', async () => {
    const { source, calls } = setup();
    source.useSequence = (pageId, requests) => {
      calls.push({ pageId, requests });
      return requests.map(() => ok({ items: [stepOne, stepPage], nextCursor: 'more' }));
    };
    const onSelect = vi.fn();
    renderPage(source, 'runbook', onSelect);
    expect(calls.at(-1)?.requests).toEqual([{}]);
    expect(itemTexts()[0]).toContain('Check the order');
    expect(screen.queryByLabelText('From')).toBeNull();
    expect(screen.queryByLabelText('To')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Show nested items' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Load more items' })).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Last first' }));
    expect(calls.at(-1)?.requests).toEqual([{ order: 'desc' }]);
    await userEvent.click(screen.getByRole('button', { name: 'Approve the refund' }));
    expect(onSelect).toHaveBeenCalledWith('approve');
  });

  it('shows no sequence on an ordinary page', () => {
    const { source, calls } = setup();
    renderPage(source, 'plain');
    expect(screen.queryByRole('list', { name: 'Sequence items' })).toBeNull();
    expect(calls).toHaveLength(0);
  });
});
