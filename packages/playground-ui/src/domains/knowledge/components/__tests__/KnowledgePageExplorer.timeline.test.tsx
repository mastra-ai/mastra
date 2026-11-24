// @vitest-environment jsdom
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it } from 'vitest';

import { renderWithProviders } from '../../../../test/render';
import type { KnowledgePagePayload } from '../../pageTypes';
import type {
  KnowledgeExplorerQueryState,
  KnowledgeExplorerSource,
  KnowledgeExplorerTimeline,
  KnowledgeExplorerTimelineEntry,
  KnowledgeExplorerTimelineRequest,
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

function entry(
  id: string,
  occurredAt: string,
  body: string,
  extra: Partial<KnowledgeExplorerTimelineEntry> = {},
): KnowledgeExplorerTimelineEntry {
  return {
    id,
    timelineId: 'general',
    externalId: id,
    occurredAt,
    writtenAt: occurredAt,
    editedAt: null,
    deletedAt: null,
    author: { sourceId: 'U1', name: 'Ada' },
    threadExternalId: null,
    body,
    version: 1,
    writtenBy: 'importer:slack',
    ...extra,
  };
}

const org = page('org', null, { name: 'Acme', address: 'org:acme' });
const general = page('general', 'org', { name: '#general', key: 'general' });
const plain = page('plain', 'org', { name: 'Plain', key: 'plain', body: 'Just a page' });

const root = entry('e1', '2026-11-01T09:00:00.000Z', 'Deploy is starting');
const reply = entry('e2', '2026-11-01T09:05:00.000Z', 'Deploy finished', {
  threadExternalId: 'e1',
  author: { sourceId: 'U2', name: 'Grace' },
  editedAt: '2026-11-01T09:06:00.000Z',
});
const removed = entry('e3', '2026-11-01T10:00:00.000Z', '', { deletedAt: '2026-11-01T10:01:00.000Z' });
const older = entry('e0', '2026-10-31T08:00:00.000Z', 'Yesterday standup');

const ok = <T,>(data: T): KnowledgeExplorerQueryState<T> => ({ data, isPending: false, isError: false, error: null });
const idle: KnowledgeExplorerQueryState<never> = { isPending: false, isError: false, error: null };

function respond(request: KnowledgeExplorerTimelineRequest): KnowledgeExplorerTimeline {
  if (request.q) return { entries: [reply, root].filter(item => /deploy/i.test(item.body)), nextCursor: null };
  if (request.thread) return { entries: [reply, root], nextCursor: null };
  if (request.cursor === 'older') return { entries: [older], nextCursor: null };
  return { entries: [removed, reply, root], nextCursor: 'older' };
}

function setup() {
  const calls: Array<{ pageId: string; requests: KnowledgeExplorerTimelineRequest[] }> = [];
  const source: KnowledgeExplorerSource = {
    usePage: pageId => {
      if (!pageId) return idle;
      if (pageId === 'general') return ok({ page: general, notes: [], ancestors: [org], related: [], timeline: true });
      return ok({ page: plain, notes: [], ancestors: [org], related: [] });
    },
    useSearch: () => ({ data: { results: [] } }),
    useTimeline: (pageId, requests) => {
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

const entryTexts = () =>
  within(screen.getByRole('list', { name: 'Timeline entries' }))
    .getAllByRole('listitem')
    .map(item => item.textContent ?? '');

describe('KnowledgePageExplorer timeline', () => {
  it("lists a timeline page's entries newest first, with author, edits and deletions", () => {
    const { source, calls } = setup();
    renderPage(source, 'general');
    expect(calls.at(-1)).toEqual({ pageId: 'general', requests: [{ order: 'desc' }] });
    const texts = entryTexts();
    expect(texts).toHaveLength(3);
    expect(texts[0]).toContain('Deleted');
    expect(texts[1]).toContain('Grace');
    expect(texts[1]).toContain('Deploy finished');
    expect(texts[1]).toContain('edited');
    expect(texts[2]).toContain('Ada');
    expect(texts[2]).toContain('Deploy is starting');
  });

  it('loads older entries with the cursor', async () => {
    const { source, calls } = setup();
    renderPage(source, 'general');
    await userEvent.click(screen.getByRole('button', { name: 'Load older entries' }));
    expect(calls.at(-1)?.requests).toEqual([{ order: 'desc' }, { order: 'desc', cursor: 'older' }]);
    expect(entryTexts()).toHaveLength(4);
    expect(entryTexts()[3]).toContain('Yesterday standup');
    expect(screen.queryByRole('button', { name: 'Load older entries' })).toBeNull();
  });

  it('opens a thread from a reply and goes back to every entry', async () => {
    const { source, calls } = setup();
    renderPage(source, 'general');
    const replyItem = screen.getAllByRole('listitem').find(item => item.textContent?.includes('Deploy finished'));
    expect(replyItem).toBeDefined();
    await userEvent.click(within(replyItem as HTMLElement).getByRole('button', { name: 'Open thread' }));
    expect(calls.at(-1)?.requests).toEqual([{ order: 'asc', thread: 'e1' }]);
    expect(screen.getByText(/Thread/)).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'All entries' }));
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

  it('searches entries by keyword', async () => {
    const { source, calls } = setup();
    renderPage(source, 'general');
    await userEvent.type(screen.getByLabelText('Search entries'), 'deploy{Enter}');
    expect(calls.at(-1)?.requests).toEqual([{ order: 'desc', q: 'deploy' }]);
    expect(entryTexts()).toHaveLength(2);
  });

  it('shows no timeline on an ordinary page', () => {
    const { source, calls } = setup();
    renderPage(source, 'plain');
    expect(screen.queryByRole('list', { name: 'Timeline entries' })).toBeNull();
    expect(calls).toHaveLength(0);
  });
});
