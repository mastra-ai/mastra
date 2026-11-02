// @vitest-environment jsdom
import { fireEvent, screen, within } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '../../../../test/render';
import { KNOWLEDGE_COUNTED_DOT_SIZE, KNOWLEDGE_DOT_HIT_MARGIN, KNOWLEDGE_DOT_SIZE } from '../../lib/graphShape';
import type { KnowledgePagePayload } from '../../pageTypes';
import { KnowledgePageGraph } from '../KnowledgePageGraph';

function page(id: string, parentId: string | null, extra: Partial<KnowledgePagePayload> = {}) {
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
  } satisfies KnowledgePagePayload;
}

const pages = [page('org', null, { name: 'Acme' }), page('refunds', 'org', { name: 'Refunds' })];

function renderGraph(props: Partial<Parameters<typeof KnowledgePageGraph>[0]> = {}) {
  return renderWithProviders(
    <div style={{ width: 800, height: 600 }}>
      <KnowledgePageGraph pages={pages} edges={[]} onSelect={() => {}} {...props} />
    </div>,
  );
}

// jsdom has no ResizeObserver, which React Flow uses to measure its viewport.
beforeAll(() => {
  window.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

describe('KnowledgePageGraph', () => {
  describe('when there are no pages', () => {
    it('says there are none', () => {
      renderWithProviders(<KnowledgePageGraph pages={[]} edges={[]} onSelect={() => {}} />);
      expect(screen.getByText('No pages yet.')).toBeTruthy();
    });
  });

  describe('when a page is pinned', () => {
    it('marks only that page as pinned', async () => {
      renderWithProviders(
        <div style={{ width: 800, height: 600 }}>
          <KnowledgePageGraph pages={pages} edges={[]} pinnedIds={['refunds']} onSelect={() => {}} />
        </div>,
      );
      const nodes = await screen.findAllByTestId('knowledge-page-node');
      const pinned = nodes.filter(node => node.querySelector('[aria-label="Pinned"]'));
      expect(pinned.map(node => node.dataset.pageId)).toEqual(['refunds']);
    });
  });

  describe('when the pages include a scope', () => {
    it('draws the scope apart from ordinary pages', async () => {
      renderWithProviders(
        <div style={{ width: 800, height: 600 }}>
          <KnowledgePageGraph pages={pages} edges={[]} onSelect={() => {}} />
        </div>,
      );
      const nodes = await screen.findAllByTestId('knowledge-page-node');
      expect(Object.fromEntries(nodes.map(node => [node.dataset.pageId, node.dataset.pageType]))).toEqual({
        org: 'scope',
        refunds: 'page',
      });
    });
  });

  describe('when a page is selected', () => {
    it('rings it in its own colour, which every circle sets for knowledge.css', async () => {
      renderWithProviders(
        <div style={{ width: 800, height: 600 }}>
          <KnowledgePageGraph pages={pages} edges={[]} selectedPageId="refunds" onSelect={() => {}} />
        </div>,
      );
      const nodes = await screen.findAllByTestId('knowledge-page-node');
      const circles = Object.fromEntries(
        nodes.map(node => [node.dataset.pageId, node.querySelector<HTMLElement>('.knowledge-circle')]),
      );
      expect(circles.org?.style.getPropertyValue('--knowledge-color')).toBe('var(--chart-blue)');
      expect(circles.refunds?.style.getPropertyValue('--knowledge-color')).toBe('var(--border-strong)');
      expect(circles.refunds?.dataset.selected).toBe('true');
      expect(circles.org?.dataset.selected).toBeUndefined();
    });
  });

  describe('pin badge', () => {
    it('sits on the circle’s rim, sized to the circle', async () => {
      renderGraph({ pinnedIds: ['refunds'] });
      const nodes = await screen.findAllByTestId('knowledge-page-node');
      const node = nodes.find(n => n.dataset.pageId === 'refunds');
      if (!node) throw new Error('refunds node not drawn');
      const size = Number.parseFloat(node.style.width);
      const badge = within(node).getByTestId('knowledge-pin-badge');
      const badgeSize = Number.parseFloat(badge.style.width);
      expect(badgeSize).toBeLessThanOrEqual(Math.max(10, size * 0.22) + 0.5);
      // Its centre is the circle's top-right point at 45°: inset from the box corner by r(1 - 1/√2).
      const inset = (size / 2) * (1 - Math.SQRT1_2);
      expect(Number.parseFloat(badge.style.top)).toBeCloseTo(inset, 1);
      expect(Number.parseFloat(badge.style.right)).toBeCloseTo(inset, 1);
      expect(badge.style.transform).toBe('translate(50%, -50%)');
    });
  });

  describe('scope labels', () => {
    it('captions scopes as scopes and leaves pages uncaptioned', async () => {
      renderGraph();
      const nodes = await screen.findAllByTestId('knowledge-page-node');
      const captioned = nodes.filter(n => within(n).queryByTestId('knowledge-scope-caption'));
      expect(captioned.map(n => n.dataset.pageId)).toEqual(['org']);
      expect(captioned.map(n => within(n).getByTestId('knowledge-scope-caption').textContent)).toEqual(['Scope']);
    });

    it("captions a scope with its declaration's display label", async () => {
      renderGraph({ pages: pages.map(page => (page.isScope ? { ...page, displayLabel: 'Organization' } : page)) });
      const nodes = await screen.findAllByTestId('knowledge-page-node');
      const captions = nodes.flatMap(n => within(n).queryAllByTestId('knowledge-scope-caption'));
      expect(captions.map(caption => caption.textContent)).toEqual(['Organization']);
    });
  });

  describe("the focused page's parent", () => {
    const line = (id: string) => document.querySelector(`[data-id="${id}"]`);

    it('is labelled Parent on its circle, with the up icon', async () => {
      renderGraph({ selectedPageId: 'refunds' });
      const nodes = await screen.findAllByTestId('knowledge-page-node');
      const parent = nodes.find(n => n.dataset.pageId === 'org');
      if (!parent) throw new Error('parent not drawn');
      expect(within(parent).getByTestId('knowledge-scope-caption').textContent).toBe('Parent scope');
      const child = nodes.find(n => n.dataset.pageId === 'refunds');
      expect(child && within(child).getByTestId('knowledge-page-caption').textContent).toBe('Page');
    });

    it('is joined to the focus by its own solid line, not the dashed child line, and the legend says so', async () => {
      renderGraph({ selectedPageId: 'refunds' });
      await screen.findAllByTestId('knowledge-page-node');
      const up = line('parent:org->refunds') as SVGElement | null;
      expect(up).toBeTruthy();
      const path = up?.querySelector('path');
      expect(path?.getAttribute('stroke-dasharray') ?? path?.style.strokeDasharray ?? '').toBe('');
      expect(screen.getByTestId('knowledge-legend-up').textContent).toBe('Parent of the focused page');
    });

    it('is not singled out when nothing above the focus is drawn', async () => {
      renderGraph({ selectedPageId: 'org' });
      await screen.findAllByTestId('knowledge-page-node');
      expect(screen.queryByTestId('knowledge-legend-up')).toBeNull();
    });
  });

  describe('legend', () => {
    it('explains circles, lines and the pin', () => {
      renderGraph();
      const legend = screen.getByRole('list', { name: 'Legend' });
      expect(
        within(legend)
          .getAllByRole('listitem')
          .map(item => item.textContent),
      ).toEqual(['Scope', 'Scope, above its pages', 'Page', 'Parent → child', 'Pinned']);
    });
  });

  describe('lines', () => {
    const mention = [{ source: 'refunds', target: 'billing', kind: 'mention' as const, count: 2 }];
    const withBilling = [...pages, page('billing', 'org', { name: 'Billing' })];

    it('draws parent lines as faint dashed foreground lines', async () => {
      const { container } = renderGraph();
      await screen.findAllByTestId('knowledge-page-node');
      const parent = container.querySelector<SVGPathElement>(
        '[data-id="parent:org->refunds"] path.react-flow__edge-path',
      );
      expect(parent?.style.stroke).toBe('var(--foreground)');
      expect(parent?.style.strokeDasharray).toBe('4 4');
    });

    it('points each parent line at the child with an open arrowhead unlike a mention head', async () => {
      const { container } = renderGraph({ pages: withBilling, edges: mention });
      await screen.findAllByTestId('knowledge-page-node');
      const markerOf = (edgeId: string) => {
        const path = container.querySelector<SVGPathElement>(`[data-id="${edgeId}"] path.react-flow__edge-path`);
        const ref = path?.getAttribute('marker-end')?.match(/^url\('#(.*)'\)$/)?.[1];
        return [...container.querySelectorAll('marker')].find(marker => marker.id === ref) ?? null;
      };
      const parent = markerOf('parent:org->refunds');
      const mentionHead = markerOf('mention:refunds->billing');
      if (!parent || !mentionHead) throw new Error('arrowheads not drawn');
      const chevron = parent.querySelector('polyline');
      expect(chevron?.getAttribute('style')).toContain('var(--muted-foreground)');
      expect(chevron?.getAttribute('fill')).toBe('none');
      expect(mentionHead.id).not.toBe(parent.id);
      expect(
        within(screen.getByRole('list', { name: 'Legend' })).getByTestId('knowledge-legend-parent-arrow'),
      ).toBeTruthy();
    });

    it('reports both ends and where it was clicked when a mention line is clicked', async () => {
      const onMentionSelect = vi.fn();
      const { container } = renderGraph({ pages: withBilling, edges: mention, onMentionSelect });
      await screen.findAllByTestId('knowledge-page-node');
      const line = container.querySelector('[data-id="mention:refunds->billing"]');
      if (!line) throw new Error('mention line not drawn');
      fireEvent.click(line);
      expect(onMentionSelect).toHaveBeenCalledWith({
        source: expect.objectContaining({ id: 'refunds' }),
        target: expect.objectContaining({ id: 'billing' }),
        point: { x: expect.any(Number), y: expect.any(Number) },
        pane: { width: expect.any(Number), height: expect.any(Number) },
      });
    });
  });

  describe('higher-level circles', () => {
    const legend = () => within(screen.getByRole('list', { name: 'Legend' }));
    const nested = [
      page('org', null, { name: 'Acme', address: 'org:acme' }),
      page('support', 'org', { name: 'Support', key: 'support' }),
      page('ticket', 'support', { name: 'Ticket', key: 'ticket' }),
    ];

    it('marks a scope with a layers icon and says so in the legend', () => {
      renderGraph();
      const org = document.querySelector('[data-page-id="org"]') as HTMLElement;
      expect(within(org).getByTestId('knowledge-level-icon-scope')).toBeTruthy();
      expect(legend().getByTestId('knowledge-legend-level-scope')).toBeTruthy();
      expect(legend().queryByTestId('knowledge-legend-level-ancestor')).toBeNull();
    });

    it('marks the pages above the focus with an up icon, and leaves the focus and its children bare', () => {
      renderGraph({ pages: nested, selectedPageId: 'ticket' });
      const support = document.querySelector('[data-page-id="support"]') as HTMLElement;
      expect(within(support).getByTestId('knowledge-level-icon-ancestor')).toBeTruthy();
      const ticket = document.querySelector('[data-page-id="ticket"]') as HTMLElement;
      expect(within(ticket).queryByTestId('knowledge-level-icon-ancestor')).toBeNull();
      expect(legend().getByTestId('knowledge-legend-level-ancestor')).toBeTruthy();
    });
  });

  describe('the focused page', () => {
    const width = (id: string) =>
      Number.parseFloat(document.querySelector<HTMLElement>(`.react-flow__node[data-id="${id}"]`)?.style.width ?? '');

    it('is drawn larger than the circles around it and named in the legend', () => {
      renderGraph({ selectedPageId: 'refunds' });
      expect(width('refunds')).toBeGreaterThan(108);
      expect(width('org')).toBe(124);
      expect(
        within(screen.getByRole('list', { name: 'Legend' })).getByTestId('knowledge-legend-focused').textContent,
      ).toBe('Focused page');
    });

    it('is not singled out when nothing is focused', () => {
      renderGraph();
      expect(width('refunds')).toBe(108);
      expect(screen.queryByTestId('knowledge-legend-focused')).toBeNull();
    });
  });

  describe('dots', () => {
    // Acme at the centre, Support one ring out, and Support's thread scopes collapsed into one dot further on.
    const deep = [
      page('org', null, { name: 'Acme' }),
      page('support', 'org', { name: 'Support', isScope: true }),
      page('group:support:thread', 'support', { name: '3 thread scopes', isScope: true, childCount: 3 }),
      page('ticket', 'support', { name: 'Ticket', childCount: 4 }),
    ];
    const hoverDot = (id: string) => {
      const dot = document.querySelector<HTMLElement>(`[data-testid="knowledge-page-dot"][data-page-id="${id}"]`);
      if (!dot) throw new Error(`no ${id} dot`);
      fireEvent.pointerEnter(dot);
      return within(dot).getByRole('tooltip').textContent;
    };

    it('draws its tooltip on a solid background with a tail pointing down at the dot', () => {
      renderGraph({ pages: deep });
      hoverDot('ticket');
      const tip = screen.getByRole('tooltip');
      expect(tip.className).toContain('bg-card');
      expect(tip.className).not.toMatch(/bg-surface-overlay|bg-card\//);
      const tail = within(tip).getByTestId('knowledge-tooltip-tail');
      expect(tail.className).toContain('top-full');
      expect(tail.className).toContain('bg-card');
    });

    it('keeps its tooltip at least full size, whatever the zoom', () => {
      renderGraph({ pages: deep });
      hoverDot('ticket');
      expect(screen.getByRole('tooltip').style.transform).toMatch(/^translateX\(-50%\) scale\((1|[1-3](\.\d+)?)\)$/);
    });

    it('draws the child count badge on a solid background', () => {
      renderGraph({ pages: [page('org', null, { name: 'Acme', childCount: 4 }), page('a', 'org')] });
      const badge = screen.getByTestId('knowledge-child-count-badge');
      expect(badge.className).toContain('bg-card');
    });

    it('says in the legend which circle each dot colour hangs under', () => {
      renderGraph({ pages: deep });
      const rows = within(screen.getByRole('list', { name: 'Legend' })).getAllByTestId('knowledge-legend-branch');
      expect(rows.map(row => row.textContent)).toEqual(['Under Support']);
    });

    it('leaves colours out of the legend when there are no dots', () => {
      renderGraph();
      expect(screen.queryAllByTestId('knowledge-legend-branch')).toHaveLength(0);
    });

    it('names a farther page, its path and how many children it has on hover', () => {
      renderGraph({ pages: deep });
      expect(hoverDot('ticket')).toBe('TicketPageAcme › Support4 children');
    });

    it('tells how to open a collapsed group of scopes rather than counting it twice', () => {
      renderGraph({ pages: deep });
      expect(hoverDot('group:support:thread')).toBe('3 thread scopesAcme › Support · Click to show them');
    });

    describe('when a dot has links', () => {
      const linked = [
        page('org', null, { name: 'Acme', address: 'org:acme' }),
        page('support', 'org', { name: 'Support', isScope: true, address: 'team:support' }),
        page('ticket', 'support', { name: 'Ticket', key: 'ticket' }),
        page('faq', 'support', { name: 'FAQ', key: 'faq' }),
        page('other', 'support', { name: 'Other', key: 'other' }),
      ];
      const known = [
        { kind: 'link' as const, source: 'ticket', target: 'faq', count: 1 },
        { kind: 'mention' as const, source: 'other', target: 'ticket', count: 2 },
        { kind: 'link' as const, source: 'faq', target: 'other', count: 1 },
      ];
      const line = (id: string) => document.querySelector(`[data-id="${id}"]`);
      const dot = (id: string) =>
        document.querySelector<HTMLElement>(`[data-testid="knowledge-page-dot"][data-page-id="${id}"]`) as HTMLElement;

      it('shows its kind, address and how many links go in and out', () => {
        renderGraph({ pages: linked, knownLinks: known });
        expect(hoverDot('ticket')).toBe('TicketPage · team:support#ticketorg:acme › team:support1 link in, 1 link out');
      });

      it("draws no body-link lines until a dot is hovered, then draws that dot's own", () => {
        renderGraph({ pages: linked, knownLinks: known });
        expect(line('link:ticket->faq')).toBeNull();
        fireEvent.mouseEnter(dot('ticket'));
        expect(line('link:ticket->faq')).toBeTruthy();
        expect(line('mention:other->ticket')).toBeTruthy();
        expect(line('link:faq->other')).toBeNull();
      });

      it('writes the total of its links in and out inside each dot, only when asked, and not on a dot with none', () => {
        const withFar = [...linked, page('far', 'support', { name: 'Far', key: 'far' })];
        const { unmount } = renderGraph({ pages: withFar, knownLinks: known });
        expect(document.querySelector('[data-testid="knowledge-dot-count"]')).toBeNull();
        unmount();
        renderGraph({ pages: withFar, knownLinks: known, showCounts: true });
        expect(within(dot('ticket')).getByTestId('knowledge-dot-count').textContent).toBe('2');
        expect(within(dot('far')).queryByTestId('knowledge-dot-count')).toBeNull();
      });

      it('keeps a dot with no links small when counts are on, and grows only the dots that carry one', () => {
        const withFar = [...linked, page('far', 'support', { name: 'Far', key: 'far' })];
        renderGraph({ pages: withFar, knownLinks: known, showCounts: true });
        expect(Number.parseFloat(dot('far').style.width)).toBe(KNOWLEDGE_DOT_SIZE);
        expect(Number.parseFloat(dot('ticket').style.width)).toBe(KNOWLEDGE_COUNTED_DOT_SIZE);
      });

      it('explains the line styles drawn while hovering it, and only those', () => {
        renderGraph({ pages: linked, knownLinks: known });
        const legend = within(screen.getByRole('list', { name: 'Legend' }));
        expect(legend.queryByTestId('knowledge-legend-link')).toBeNull();
        expect(legend.queryByTestId('knowledge-legend-mention')).toBeNull();
        expect(legend.getByTestId('knowledge-legend-dot-parent')).toBeTruthy();
        // Lines touching the hovered page read by direction, so they get the in/out rows, not the plain ones.
        fireEvent.mouseEnter(dot('ticket'));
        expect(legend.getByTestId('knowledge-legend-out')).toBeTruthy();
        expect(legend.getByTestId('knowledge-legend-in')).toBeTruthy();
        expect(legend.queryByTestId('knowledge-legend-link')).toBeNull();
        fireEvent.mouseLeave(dot('ticket'));
        expect(legend.queryByTestId('knowledge-legend-out')).toBeNull();
        expect(legend.queryByTestId('knowledge-legend-in')).toBeNull();
      });

      it('gives every dot a hit area wider than the dot, and draws the dot at least 20px', () => {
        renderGraph({ pages: linked, knownLinks: known });
        const target = dot('ticket');
        expect(Number.parseFloat(target.style.width)).toBeGreaterThanOrEqual(20);
        const hit = within(target).getByTestId('knowledge-dot-hit-area');
        expect(hit.style.inset).toBe(`-${KNOWLEDGE_DOT_HIT_MARGIN}px`);
      });

      it('puts the tooltip on the side that does not cover the focused page', () => {
        renderGraph({ pages: linked, knownLinks: known });
        const target = dot('ticket');
        const focusNode = document.querySelector<HTMLElement>('[data-testid="knowledge-page-node"]') as HTMLElement;
        const rect = (left: number, top: number, w: number, h: number) =>
          ({
            left,
            top,
            right: left + w,
            bottom: top + h,
            width: w,
            height: h,
            x: left,
            y: top,
            toJSON: () => ({}),
          }) as DOMRect;
        const spies = [
          vi.spyOn(target, 'getBoundingClientRect').mockReturnValue(rect(500, 400, 14, 14)),
          vi.spyOn(focusNode, 'getBoundingClientRect').mockReturnValue(rect(450, 280, 100, 100)),
          vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(200),
          vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(80),
        ];
        const graph = target.closest('.knowledge-graph') as HTMLElement;
        vi.spyOn(graph, 'getBoundingClientRect').mockReturnValue(rect(0, 0, 1000, 800));
        fireEvent.mouseEnter(target);
        fireEvent.pointerEnter(target);
        expect(within(target).getByRole('tooltip').dataset.side).toBe('bottom');
        for (const spy of spies) spy.mockRestore();
      });

      it('fades dots it is not connected to, and puts them back when the pointer leaves', () => {
        const withFar = [...linked, page('far', 'support', { name: 'Far', key: 'far' })];
        renderGraph({ pages: withFar, knownLinks: known });
        fireEvent.mouseEnter(dot('ticket'));
        expect(dot('faq').style.opacity).toBe('1');
        expect(dot('far').style.opacity).toBe('0.35');
        fireEvent.mouseLeave(dot('ticket'));
        expect(dot('far').style.opacity).toBe('1');
        expect(line('link:ticket->faq')).toBeNull();
      });
    });
  });
});
