// @vitest-environment jsdom
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it } from 'vitest';

import { renderWithProviders } from '../../../../test/render';
import type { KnowledgePagePayload } from '../../pageTypes';
import type {
  KnowledgeExplorerQueryState,
  KnowledgeExplorerSource,
  KnowledgeExplorerSequence,
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
    author: { sourceId: 'U1', name: 'Ada' },
    externalParentId: null,
    body,
    version: 1,
    writtenBy: 'importer:slack',
    ...extra,
  };
}

const org = page('org', null, { name: 'Acme', address: 'org:acme' });
const general = page('general', 'org', { name: '#general', key: 'general' });
const plain = page('plain', 'org', { name: 'Plain', key: 'plain', body: 'Just a page' });

const root = item('e1', '2026-11-01T09:00:00.000Z', 'Deploy is starting');
const reply = item('e2', '2026-11-01T09:05:00.000Z', 'Deploy finished', {
  externalParentId: 'e1',
  author: { sourceId: 'U2', name: 'Grace' },
  editedAt: '2026-11-01T09:06:00.000Z',
});
const removed = item('e3', '2026-11-01T10:00:00.000Z', '', { deletedAt: '2026-11-01T10:01:00.000Z' });
const older = item('e0', '2026-10-31T08:00:00.000Z', 'Yesterday standup');

const ok = <T,>(data: T): KnowledgeExplorerQueryState<T> => ({ data, isPending: false, isError: false, error: null });
const idle: KnowledgeExplorerQueryState<never> = { isPending: false, isError: false, error: null };

function respond(request: KnowledgeExplorerSequenceRequest): KnowledgeExplorerSequence {
  if (request.q) return { items: [reply, root].filter(item => /deploy/i.test(item.body)), nextCursor: null };
  if (request.thread) return { items: [reply, root], nextCursor: null };
  if (request.cursor === 'older') return { items: [older], nextCursor: null };
  return { items: [removed, reply, root], nextCursor: 'older' };
}

function setup() {
  const calls: Array<{ pageId: string; requests: KnowledgeExplorerSequenceRequest[] }> = [];
  const source: KnowledgeExplorerSource = {
    usePage: pageId => {
      if (!pageId) return idle;
      if (pageId === 'general') return ok({ page: general, notes: [], ancestors: [org], related: [], sequence: true });
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

const graph = { pages: [org, general, plain], edges: [], pinnedIds: [], truncated: false };

function renderPage(source: KnowledgeExplorerSource, pageId: string) {
  return renderWithProviders(
    <KnowledgePageExplorer
      graph={graph}
      source={source}
      selectedPageId={pageId}
      onSelect={() => {}}
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
    expect(calls.at(-1)).toEqual({ pageId: 'general', requests: [{ order: 'desc' }] });
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
    expect(calls.at(-1)?.requests).toEqual([{ order: 'desc' }, { order: 'desc', cursor: 'older' }]);
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

  it('leaves thread view when searching the whole sequence', async () => {
    const { source, calls } = setup();
    renderPage(source, 'general');
    const thread = screen.getAllByRole('button', { name: 'Open thread' })[0];
    expect(thread).toBeDefined();
    if (thread) await userEvent.click(thread);
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search items' }), 'deploy{Enter}');
    expect(calls.at(-1)?.requests[0]).not.toHaveProperty('thread');
    expect(screen.queryByText(/^Thread /)).toBeNull();
  });

  it('labels ascending pagination as newer items', async () => {
    const { source } = setup();
    renderPage(source, 'general');
    await userEvent.click(screen.getByRole('button', { name: 'Oldest first' }));
    expect(screen.getByRole('button', { name: 'Load newer items' })).toBeTruthy();
  });

  it('opens a thread from a reply and goes back to every item', async () => {
    const { source, calls } = setup();
    renderPage(source, 'general');
    const replyItem = screen.getAllByRole('listitem').find(item => item.textContent?.includes('Deploy finished'));
    expect(replyItem).toBeDefined();
    await userEvent.click(within(replyItem as HTMLElement).getByRole('button', { name: 'Open thread' }));
    expect(calls.at(-1)?.requests).toEqual([{ order: 'asc', thread: 'e1' }]);
    expect(screen.getByText(/Thread/)).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'All items' }));
    expect(calls.at(-1)?.requests).toEqual([{ order: 'desc' }]);
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
    expect(calls.at(-1)?.requests).toEqual([{ order: 'desc', q: 'deploy' }]);
    expect(itemTexts()).toHaveLength(2);
  });

  it('shows no sequence on an ordinary page', () => {
    const { source, calls } = setup();
    renderPage(source, 'plain');
    expect(screen.queryByRole('list', { name: 'Sequence items' })).toBeNull();
    expect(calls).toHaveLength(0);
  });
});
