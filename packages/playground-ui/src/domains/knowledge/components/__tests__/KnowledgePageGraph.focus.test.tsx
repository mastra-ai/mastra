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
// The zoom the user has chosen, as React Flow would report it.
let currentZoom = 1;
let currentPan = { x: 0, y: 0 };
vi.mock('@xyflow/react', async importOriginal => {
  const actual = await importOriginal<typeof import('@xyflow/react')>();
  return {
    ...actual,
    useReactFlow: () => ({
      ...actual.useReactFlow(),
      setViewport,
      getViewport: () => ({ ...currentPan, zoom: currentZoom }),
    }),
  };
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

/** A page circle's centre in the graph's own coordinates, before any pan or zoom. */
function flowCentre(id: string) {
  const element = document.querySelector<HTMLElement>(`.react-flow__node [data-page-id="${id}"]`);
  const node = element?.closest<HTMLElement>('.react-flow__node');
  const [, x = '0', y = '0'] = /translate\((-?[\d.]+)px, ?(-?[\d.]+)px\)/.exec(node?.style.transform ?? '') ?? [];
  const half = Number.parseFloat(element?.style.width ?? '0') / 2;
  return { x: Number(x) + half, y: Number(y) + half };
}

/** Where the given pages' circles land on screen under the last viewport set: their bounding box. */
function screenBox(ids: string[]) {
  const viewport = setViewport.mock.calls.at(-1)?.[0];
  if (!viewport) throw new Error('no viewport was set');
  // Labelled circles and dots alike.
  const boxes = [...document.querySelectorAll<HTMLElement>('.react-flow__node [data-page-id]')]
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
  beforeEach(() => {
    setViewport.mockClear();
    currentZoom = 1;
    currentPan = { x: 0, y: 0 };
  });

  describe('when a page is selected outside the graph (tree, search, link)', () => {
    /** Mounts with nothing selected at 0.45 zoom, then selects `refunds`; `panFor` picks the pan the user had. */
    async function selectRefunds(panFor: (centre: { x: number; y: number }) => { x: number; y: number }) {
      const { rerender } = renderWithProviders(
        <KnowledgePageGraph pages={pages} edges={mentions} selectedPageId={null} onSelect={() => {}} />,
      );
      await screen.findAllByTestId('knowledge-page-node');
      currentZoom = 0.45;
      currentPan = panFor(flowCentre('refunds'));
      setViewport.mockClear();
      rerender(<KnowledgePageGraph pages={pages} edges={mentions} selectedPageId="refunds" onSelect={() => {}} />);
    }

    it('leaves pan and zoom alone when the page is already on screen', async () => {
      await selectRefunds(centre => ({ x: WIDTH / 2 - centre.x * 0.45, y: HEIGHT / 2 - centre.y * 0.45 }));

      expect(setViewport).not.toHaveBeenCalled();
    });

    it('nudges a page that would land off screen back in, keeping the zoom', async () => {
      await selectRefunds(() => ({ x: -50000, y: -50000 }));

      expect(setViewport).toHaveBeenCalledTimes(1);
      const viewport = setViewport.mock.calls[0]?.[0];
      expect(viewport?.zoom).toBe(0.45);
      const centre = flowCentre('refunds');
      const x = centre.x * 0.45 + (viewport?.x ?? 0);
      const y = centre.y * 0.45 + (viewport?.y ?? 0);
      expect(x).toBeGreaterThan(0);
      expect(x).toBeLessThan(WIDTH);
      expect(y).toBeGreaterThan(0);
      expect(y).toBeLessThan(HEIGHT);
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

  describe('when the graph is too big to fit at a readable zoom', () => {
    const crowd = [
      page('hub', null),
      ...Array.from({ length: 45 }, (_, index) => ({
        ...page(`c${index}`, 'hub'),
        position: `a${String(index).padStart(2, '0')}`,
      })),
    ];

    it('stops at the readable zoom and centres the page it is built around, cropping the edge instead', async () => {
      renderWithProviders(
        <KnowledgePageGraph pages={crowd} edges={[]} selectedPageId={null} centerId="hub" onSelect={() => {}} />,
      );
      await screen.findAllByTestId('knowledge-page-node');
      const viewport = setViewport.mock.calls.at(-1)?.[0];
      expect(viewport?.zoom).toBe(0.7);
      const box = screenBox(['hub']);
      expect((box.left + box.right) / 2).toBeCloseTo(WIDTH / 2, 0);
      expect((box.top + box.bottom) / 2).toBeCloseTo(HEIGHT / 2, 0);
    });
  });

  describe('Fit view on a page with an outer ring of linked pages', () => {
    const ringIds = Array.from({ length: 12 }, (_, index) => `link${index}`);
    const crowded = [
      page('site', null),
      page('hub', 'site'),
      ...Array.from({ length: 45 }, (_, index) => ({
        ...page(`c${index}`, 'hub'),
        position: `a${String(index).padStart(2, '0')}`,
      })),
      page('other', null),
      ...ringIds.map(id => page(id, 'other')),
    ];
    const ringEdges: KnowledgePageEdge[] = ringIds.map(id => ({ source: 'hub', target: id, kind: 'link', count: 1 }));

    it('zooms out past the readable zoom to frame the whole ring, which a refocus never does', async () => {
      renderWithProviders(
        <KnowledgePageGraph
          pages={crowded}
          edges={ringEdges}
          nearIds={new Set(ringIds)}
          selectedPageId="hub"
          centerId="site"
          onSelect={() => {}}
        />,
      );
      await screen.findAllByTestId('knowledge-page-node');
      setViewport.mockClear();

      fireEvent.click(screen.getByLabelText('Fit view'));

      const viewport = setViewport.mock.calls.at(-1)?.[0];
      expect(viewport?.zoom).toBeLessThan(0.7);
      const box = screenBox(['hub', ...ringIds]);
      expect(box.left).toBeGreaterThanOrEqual(0);
      expect(box.right).toBeLessThanOrEqual(WIDTH);
      expect(box.top).toBeGreaterThanOrEqual(0);
      expect(box.bottom).toBeLessThanOrEqual(HEIGHT);
    });
  });
});
