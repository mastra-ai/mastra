// @vitest-environment jsdom
import { fireEvent, screen } from '@testing-library/react';
import type { Viewport } from '@xyflow/react';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '../../../../test/render';
import type { KnowledgePageEdge, KnowledgePagePayload } from '../../pageTypes';
import { KnowledgePageGraph } from '../KnowledgePageGraph';

// jsdom can't lay React Flow out, so only the viewport it is handed is observed; everything else is the
// real library.
const setViewport = vi.fn(async (_viewport: Viewport, _options?: { duration?: number }) => true);
vi.mock('@xyflow/react', async importOriginal => {
  const actual = await importOriginal<typeof import('@xyflow/react')>();
  return { ...actual, useReactFlow: () => ({ ...actual.useReactFlow(), setViewport }) };
});

const WIDTH = 800;
const HEIGHT = 600;
beforeAll(() => {
  window.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  // A laid-out graph pane; jsdom reports 0×0 for everything.
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => WIDTH });
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, get: () => HEIGHT });
});
afterAll(() => {
  // @ts-expect-error restore jsdom's own getters from Element.prototype
  delete HTMLElement.prototype.clientWidth;
  // @ts-expect-error restore jsdom's own getters from Element.prototype
  delete HTMLElement.prototype.clientHeight;
});

const page = (id: string, parentId: string | null): KnowledgePagePayload => ({
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
});

// org ─ refunds ─(mention)→ billing; roadmap sits apart under org too.
const pages = [page('org', null), page('refunds', 'org'), page('billing', 'org'), page('roadmap', 'org')];
const mentions: KnowledgePageEdge[] = [{ source: 'refunds', target: 'billing', kind: 'mention', count: 1 }];

/** Where the given pages' circles land on screen under the last viewport set: their bounding box. */
function screenBox(ids: string[]) {
  const viewport = setViewport.mock.calls.at(-1)?.[0];
  if (!viewport) throw new Error('no viewport was set');
  const boxes = screen
    .getAllByTestId('knowledge-page-node')
    .filter(element => ids.includes(element.dataset.pageId ?? ''))
    .map(element => {
      const node = element.closest<HTMLElement>('.react-flow__node');
      const [, x = '0', y = '0'] = /translate\((-?[\d.]+)px, ?(-?[\d.]+)px\)/.exec(node?.style.transform ?? '') ?? [];
      const size = Number.parseFloat(element.style.width) * viewport.zoom;
      const left = Number(x) * viewport.zoom + viewport.x;
      const top = Number(y) * viewport.zoom + viewport.y;
      return { left, top, right: left + size, bottom: top + size };
    });
  expect(boxes).toHaveLength(ids.length);
  return {
    left: Math.min(...boxes.map(box => box.left)),
    top: Math.min(...boxes.map(box => box.top)),
    right: Math.max(...boxes.map(box => box.right)),
    bottom: Math.max(...boxes.map(box => box.bottom)),
  };
}

describe('KnowledgePageGraph focus on the selected page', () => {
  beforeEach(() => setViewport.mockClear());

  describe('when a page is selected outside the graph (tree, search, link)', () => {
    it('frames that page and the pages one line away from it', async () => {
      const { rerender } = renderWithProviders(
        <KnowledgePageGraph pages={pages} edges={mentions} selectedPageId={null} onSelect={() => {}} />,
      );
      await screen.findAllByTestId('knowledge-page-node');
      setViewport.mockClear();

      rerender(<KnowledgePageGraph pages={pages} edges={mentions} selectedPageId="refunds" onSelect={() => {}} />);

      expect(setViewport).toHaveBeenCalledTimes(1);
      // Refunds, its parent and the page it mentions are centred in the pane and fully inside it.
      const box = screenBox(['refunds', 'org', 'billing']);
      expect((box.left + box.right) / 2).toBeCloseTo(WIDTH / 2, 0);
      expect((box.top + box.bottom) / 2).toBeCloseTo(HEIGHT / 2, 0);
      expect(box.left).toBeGreaterThanOrEqual(0);
      expect(box.right).toBeLessThanOrEqual(WIDTH);
      // Roadmap is not one of its neighbours, so the frame is not the whole graph's.
      const all = screenBox(['refunds', 'org', 'billing', 'roadmap']);
      expect([all.left, all.top, all.right, all.bottom]).not.toEqual([box.left, box.top, box.right, box.bottom]);
    });

    it('does not move the view again when the same data is refetched', async () => {
      const { rerender } = renderWithProviders(
        <KnowledgePageGraph pages={pages} edges={mentions} selectedPageId="refunds" onSelect={() => {}} />,
      );
      await screen.findAllByTestId('knowledge-page-node');
      setViewport.mockClear();

      rerender(
        <KnowledgePageGraph pages={[...pages]} edges={[...mentions]} selectedPageId="refunds" onSelect={() => {}} />,
      );

      expect(setViewport).not.toHaveBeenCalled();
    });
  });

  describe('when the user clicks a page in the graph', () => {
    it('selects it and leaves the view where the user put it', async () => {
      const onSelect = vi.fn();
      const { rerender } = renderWithProviders(
        <KnowledgePageGraph pages={pages} edges={mentions} selectedPageId={null} onSelect={onSelect} />,
      );
      const nodes = await screen.findAllByTestId('knowledge-page-node');
      setViewport.mockClear();

      // React Flow's pane handlers need a real window on mousedown, so dispatch the click alone.
      const roadmap = nodes.find(node => node.dataset.pageId === 'roadmap');
      if (!roadmap) throw new Error('roadmap node not drawn');
      fireEvent.click(roadmap);
      expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'roadmap' }));
      rerender(<KnowledgePageGraph pages={pages} edges={mentions} selectedPageId="roadmap" onSelect={onSelect} />);

      expect(setViewport).not.toHaveBeenCalled();
    });
  });
});
