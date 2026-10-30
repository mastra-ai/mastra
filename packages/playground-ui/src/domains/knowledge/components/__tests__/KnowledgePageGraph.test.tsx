// @vitest-environment jsdom
import { fireEvent, screen, within } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '../../../../test/render';
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

  describe('legend', () => {
    it('explains circles, lines and the pin', () => {
      renderGraph();
      const legend = screen.getByRole('list', { name: 'Legend' });
      expect(
        within(legend)
          .getAllByRole('listitem')
          .map(item => item.textContent),
      ).toEqual(['Scope', 'Page', 'Mentioned in notes', 'Parent', 'Pinned']);
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
      });
    });
  });
});
