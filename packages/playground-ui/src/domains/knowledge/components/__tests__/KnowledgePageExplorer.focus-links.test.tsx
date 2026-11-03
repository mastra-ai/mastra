// @vitest-environment jsdom
import { screen } from '@testing-library/react';
import { beforeAll, describe, expect, it } from 'vitest';

import { renderWithProviders } from '../../../../test/render';
import type { KnowledgeNotePayload, KnowledgePagePayload } from '../../pageTypes';
import type {
  KnowledgeExplorerGraph,
  KnowledgeExplorerPageDetail,
  KnowledgeExplorerQueryState,
  KnowledgeExplorerSource,
} from '../KnowledgePageExplorer';
import { FOCUS_LINK_CAP, KnowledgePageExplorer } from '../KnowledgePageExplorer';

function page(id: string, parentId: string | null, extra: Partial<KnowledgePagePayload> = {}): KnowledgePagePayload {
  return {
    id,
    scopeId: 'site',
    parentId,
    isScope: false,
    position: id,
    name: id,
    version: 1,
    createdBy: { author: 'a' },
    updatedBy: { author: 'a' },
    createdAt: '2026-11-01T00:00:00.000Z',
    updatedAt: '2026-11-01T00:00:00.000Z',
    ...extra,
  };
}

function note(id: string, pageId: string, mentions: string[]): KnowledgeNotePayload {
  return {
    id,
    pageId,
    text: 'note',
    stampScopeIds: [],
    mentions,
    provenance: { author: 'a' },
    createdAt: '2026-11-01T00:00:00.000Z',
    updatedAt: '2026-11-01T00:00:00.000Z',
  };
}

const site = page('site', null, { isScope: true, name: 'Site', address: 'site:mastra' });
const authors = page('authors', 'site');
const ward = page('ward', 'authors', {
  body: 'Wrote [[site:mastra#blog/far-out-post]] and mentions [[site:mastra#blog/other-post]].',
});
const abhi = page('abhi', 'authors');
// None of these are in the graph: they sit under a blog the graph has not loaded.
const farOut = page('far-out', 'blog', { key: 'far-out-post' });
const otherOut = page('other-out', 'blog', { key: 'other-post' });
const noteTarget = page('note-target', 'blog');
const noteSource = page('note-source', 'blog');
const loaded = [site, authors, ward, abhi];

const ok = <T,>(data: T): KnowledgeExplorerQueryState<T> => ({ data, isPending: false, isError: false, error: null });
const idle: KnowledgeExplorerQueryState<never> = { isPending: false, isError: false, error: null };
const missing: KnowledgeExplorerQueryState<never> = { isPending: false, isError: true, error: new Error('404') };

function render(options: {
  wardPage?: KnowledgePagePayload;
  notes?: KnowledgeNotePayload[];
  mentionedBy?: KnowledgeNotePayload[];
  reachable: Record<string, KnowledgePagePayload>;
  requested?: string[][];
  linksIn?: string[];
}) {
  const focus = options.wardPage ?? ward;
  const detail: KnowledgeExplorerPageDetail = {
    page: focus,
    notes: options.notes ?? [],
    ancestors: [site, authors],
    related: [],
    mentionedBy: options.mentionedBy ?? [],
  };
  const source: KnowledgeExplorerSource = {
    usePage: pageId => (pageId === focus.id ? ok(detail) : idle),
    useSearch: () => ({ data: { results: [] } }),
    usePageLinks: pageId =>
      pageId === focus.id && options.linksIn
        ? ok({
            edges: options.linksIn.map(from => ({
              fromPageId: from,
              toPageId: focus.id,
              kind: 'body' as const,
              count: 1,
            })),
            pages: [],
            truncated: false,
          })
        : idle,
    useLinkedPages: keys => {
      options.requested?.push(keys);
      return keys.map(key => {
        const found = options.reachable[key];
        return found ? ok({ page: found, notes: [], ancestors: [], related: [] }) : missing;
      });
    },
  };
  const graph: KnowledgeExplorerGraph = { pages: loaded, edges: [], pinnedIds: [], truncated: false };
  return renderWithProviders(
    <KnowledgePageExplorer
      graph={graph}
      source={source}
      selectedPageId={focus.id}
      onSelect={() => {}}
      view="graph"
      onViewChange={() => {}}
    />,
  );
}

const edgeIds = (container: HTMLElement) =>
  [...container.querySelectorAll('.react-flow__edge')].map(edge => edge.getAttribute('data-id') ?? '');
const drawnIds = (container: HTMLElement) =>
  [...container.querySelectorAll('.react-flow__node [data-page-id]')].map(node => node.getAttribute('data-page-id'));

beforeAll(() => {
  window.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

describe('KnowledgePageExplorer focused page links to pages the graph has not loaded', () => {
  const reachable = {
    'site:mastra#blog/far-out-post': farOut,
    'site:mastra#blog/other-post': otherOut,
    'note-target': noteTarget,
    'note-source': noteSource,
  };

  it('fetches each unloaded link end by its ref or id', () => {
    const requested: string[][] = [];
    render({
      notes: [note('n1', 'ward', ['note-target'])],
      mentionedBy: [note('m1', 'note-source', ['ward'])],
      reachable,
      requested,
    });
    const last = requested[requested.length - 1] ?? [];
    expect(last.sort()).toEqual(
      ['note-source', 'note-target', 'site:mastra#blog/far-out-post', 'site:mastra#blog/other-post'].sort(),
    );
  });

  it('does not fetch a [[Name]] link, which the page route cannot resolve, but still fetches a page id or scope ref', () => {
    const requested: string[][] = [];
    render({
      wardPage: page('ward', 'authors', {
        body: 'See [[Pricing]], [[01M6DDVVE4E0CKBVC6KCDCPTDF]] and [[site:mastra#blog/far-out-post]].',
      }),
      reachable,
      requested,
    });
    expect(requested.flat()).not.toContain('Pricing');
    expect((requested[requested.length - 1] ?? []).sort()).toEqual(
      ['01M6DDVVE4E0CKBVC6KCDCPTDF', 'site:mastra#blog/far-out-post'].sort(),
    );
  });

  it('draws the pages it links to and the pages that link to it, with their edges', () => {
    const { container } = render({
      notes: [note('n1', 'ward', ['note-target'])],
      mentionedBy: [note('m1', 'note-source', ['ward'])],
      reachable,
    });
    expect(drawnIds(container)).toEqual(expect.arrayContaining(['far-out', 'other-out', 'note-target', 'note-source']));
    const edges = edgeIds(container);
    expect(edges).toContain('link:ward->far-out');
    expect(edges).toContain('link:ward->other-out');
    expect(edges.some(id => id.includes('ward') && id.includes('note-target'))).toBe(true);
    expect(edges.some(id => id.includes('note-source') && id.includes('ward'))).toBe(true);
  });

  it('draws each link end as a named circle, not a bare dot', () => {
    const { container } = render({
      notes: [note('n1', 'ward', ['note-target'])],
      mentionedBy: [note('m1', 'note-source', ['ward'])],
      reachable,
    });
    for (const id of ['far-out', 'other-out', 'note-target', 'note-source']) {
      const circle = container.querySelector(`[data-testid="knowledge-page-node"][data-page-id="${id}"]`);
      expect(circle, id).not.toBeNull();
      expect(circle?.querySelector('[data-testid="knowledge-circle-name"]')?.textContent).toBeTruthy();
    }
    expect(container.querySelector('[data-testid="knowledge-page-dot"][data-page-id="far-out"]')).toBeNull();
  });

  it('draws link ends in the faded farther-page style, and the focus and its children in the regular one', () => {
    const { container } = render({
      notes: [note('n1', 'ward', ['note-target'])],
      mentionedBy: [note('m1', 'note-source', ['ward'])],
      reachable,
    });
    const circle = (id: string) =>
      container.querySelector(`[data-testid="knowledge-page-node"][data-page-id="${id}"] .knowledge-circle`);
    for (const id of ['far-out', 'other-out', 'note-target', 'note-source']) {
      expect(circle(id)?.getAttribute('data-far'), id).toBe('true');
      // The farther-page variant: the legend dot's solid grey, no "Page" caption, no fade, name readable on it.
      expect((circle(id) as HTMLElement).style.background, id).toBe('var(--muted-foreground)');
      expect((circle(id) as HTMLElement).style.opacity, id).toBe('');
      expect(circle(id)?.querySelector('[data-testid="knowledge-page-caption"]'), id).toBeNull();
      expect((circle(id)?.querySelector('[data-testid="knowledge-circle-name"]') as HTMLElement).style.color, id).toBe(
        'var(--background)',
      );
      // Long names are cut to fit the circle, so only the start is compared.
      expect(circle(id)?.querySelector('[data-testid="knowledge-circle-name"]')?.textContent, id).toContain(
        id.slice(0, 4),
      );
    }
    for (const id of ['ward', 'authors']) {
      expect(circle(id)?.getAttribute('data-far'), id).toBeNull();
      expect(circle(id)?.querySelector('[data-testid="knowledge-page-caption"]'), id).not.toBeNull();
    }
  });

  it('draws link ends smaller than the focus and its neighbours', () => {
    const { container } = render({
      notes: [note('n1', 'ward', ['note-target'])],
      mentionedBy: [note('m1', 'note-source', ['ward'])],
      reachable,
    });
    const width = (id: string) =>
      Number.parseFloat(
        container.querySelector<HTMLElement>(`[data-testid="knowledge-page-node"][data-page-id="${id}"]`)?.style
          .width ?? '',
      );
    expect(width('authors')).toBeGreaterThan(0);
    for (const id of ['far-out', 'other-out', 'note-target', 'note-source']) {
      expect(width(id), id).toBeLessThan(width('authors'));
    }
  });

  it('lists the farther-page style in the legend when link ends use it and no far dots are drawn', () => {
    const { container } = render({
      notes: [note('n1', 'ward', ['note-target'])],
      mentionedBy: [note('m1', 'note-source', ['ward'])],
      reachable,
    });
    expect(container.querySelector('[data-testid="knowledge-page-dot"]')).toBeNull();
    expect(container.querySelector('[data-testid="knowledge-legend-dot"]')?.textContent).toBe('Page in another branch');
  });

  it('says nothing is left out when every link end is drawn', () => {
    renderWithProviders(<div />);
    const { container } = render({ reachable });
    expect(container.textContent ?? '').not.toMatch(/not drawn/);
  });

  it('draws what it can when one end cannot be fetched', () => {
    const { container } = render({ reachable: { 'site:mastra#blog/far-out-post': farOut } });
    expect(drawnIds(container)).toContain('far-out');
    expect(drawnIds(container)).not.toContain('other-out');
  });

  it(`draws at most ${FOCUS_LINK_CAP} links each way and counts the rest as more`, () => {
    const many = Array.from({ length: FOCUS_LINK_CAP + 5 }, (_, index) => `site:mastra#blog/ref-${index}`);
    const heavy = page('ward', 'authors', { body: many.map(ref => `[[${ref}]]`).join(' ') });
    const requested: string[][] = [];
    const reachableMany = Object.fromEntries(many.map(ref => [ref, page(`id-${ref}`, 'blog')]));
    const { container } = render({ wardPage: heavy, reachable: reachableMany, requested });
    expect((requested[requested.length - 1] ?? []).length).toBe(FOCUS_LINK_CAP + 5);
    expect(screen.queryByTestId('knowledge-graph-more-links')).toBeNull();
    expect(container.textContent ?? '').not.toMatch(/more links of this page not drawn/);
  });

  it('counts a page linked by both a note and the body once, not once per kind', () => {
    const targets = Array.from({ length: 12 }, (_, index) => page(`t${index}`, 'blog', { key: `post-${index}` }));
    const heavy = page('ward', 'authors', { body: targets.map(t => `[[site:mastra#blog/${t.key}]]`).join(' ') });
    const both = Object.fromEntries(
      targets.flatMap(t => [[t.id, t] as const, [`site:mastra#blog/${t.key}`, t] as const]),
    );
    const { container } = render({
      wardPage: heavy,
      notes: [
        note(
          'n1',
          'ward',
          targets.map(t => t.id),
        ),
      ],
      reachable: both,
    });
    expect(drawnIds(container)).toEqual(expect.arrayContaining(targets.map(t => t.id)));
    expect(container.textContent ?? '').not.toMatch(/not drawn/);
  });

  it('draws pages whose bodies link to the focus when the host lists its links', () => {
    const { container } = render({
      reachable: { 'body-author': page('body-author', 'blog') },
      linksIn: ['body-author'],
    });
    expect(drawnIds(container)).toContain('body-author');
    expect(edgeIds(container).some(id => id.includes('body-author') && id.includes('ward'))).toBe(true);
  });
  it('draws a body that links in as one link line, not a mention as well', () => {
    const { container } = render({
      reachable: { 'body-author': page('body-author', 'blog') },
      linksIn: ['body-author'],
    });
    const lines = edgeIds(container).filter(id => id.includes('body-author') && id.includes('ward'));
    expect(lines).toEqual(['link:body-author->ward']);
  });
});
