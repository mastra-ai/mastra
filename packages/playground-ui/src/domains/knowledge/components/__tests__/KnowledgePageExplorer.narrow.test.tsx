// @vitest-environment jsdom
import { act, fireEvent, screen } from '@testing-library/react';
import type { Viewport } from '@xyflow/react';
import { useState } from 'react';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '../../../../test/render';
import type { KnowledgePagePayload } from '../../pageTypes';
import type { KnowledgeExplorerSource, KnowledgeExplorerView } from '../KnowledgePageExplorer';
import { KnowledgePageExplorer } from '../KnowledgePageExplorer';

// jsdom can't lay React Flow out, so only the viewport it is handed is observed.
const setViewport = vi.fn(async (_viewport: Viewport, _options?: { duration?: number }) => true);
vi.mock('@xyflow/react', async importOriginal => {
  const actual = await importOriginal<typeof import('@xyflow/react')>();
  return { ...actual, useReactFlow: () => ({ ...actual.useReactFlow(), setViewport }) };
});

// A phone-width window: the `hidden` class really hides, so an element inside it measures 0×0, as in a
// browser. A ResizeObserver that never fires stands in for the one that didn't fire in a production build.
const originalMatchMedia = window.matchMedia;
const measure = (element: HTMLElement, size: number) => (element.closest('.hidden') ? 0 : size);
beforeAll(() => {
  window.matchMedia = (query: string) =>
    ({
      matches: query.includes('max-width'),
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
  window.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
    configurable: true,
    get(this: HTMLElement) {
      return measure(this, 358);
    },
  });
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
    configurable: true,
    get(this: HTMLElement) {
      return measure(this, 638);
    },
  });
});
afterAll(() => {
  window.matchMedia = originalMatchMedia;
  // @ts-expect-error restore jsdom's own getters from Element.prototype
  delete HTMLElement.prototype.clientWidth;
  // @ts-expect-error restore jsdom's own getters from Element.prototype
  delete HTMLElement.prototype.clientHeight;
});

const page = (id: string, parentId: string | null, name: string): KnowledgePagePayload => ({
  id,
  scopeId: parentId === null ? id : 'org',
  parentId,
  isScope: parentId === null,
  position: 'a0',
  name,
  version: 1,
  createdBy: { author: 'host' },
  updatedBy: { author: 'host' },
  createdAt: '2026-10-28T00:00:00.000Z',
  updatedAt: '2026-10-28T00:00:00.000Z',
});

const graph = {
  pages: [page('org', null, 'Acme'), page('refunds', 'org', 'Refunds'), page('roadmap', 'org', 'Roadmap')],
  edges: [],
  pinnedIds: [],
  truncated: false,
};

const source: KnowledgeExplorerSource = {
  usePage: () => ({ isPending: true, isError: false, error: null }),
  useSearch: () => ({ data: { results: [] } }),
};

function Host() {
  const [view, setView] = useState<KnowledgeExplorerView>('tree');
  return (
    <KnowledgePageExplorer
      graph={graph}
      source={source}
      selectedPageId={null}
      onSelect={() => {}}
      view={view}
      onViewChange={setView}
    />
  );
}

describe('KnowledgePageExplorer on a narrow screen', () => {
  describe('when the user opens the tree and then switches to the graph', () => {
    it('fits the graph to its pane', async () => {
      renderWithProviders(<Host />);
      // Let a graph mounted behind the tree finish initialising before the user toggles.
      await act(() => new Promise(resolve => setTimeout(resolve, 50)));
      expect(setViewport).not.toHaveBeenCalled();

      fireEvent.click(screen.getByRole('button', { name: 'Graph' }));

      await vi.waitFor(() => expect(setViewport).toHaveBeenCalled());
      const viewport = setViewport.mock.calls.at(-1)?.[0];
      expect(viewport).not.toEqual({ x: 0, y: 0, zoom: 1 });
    });
  });
});
