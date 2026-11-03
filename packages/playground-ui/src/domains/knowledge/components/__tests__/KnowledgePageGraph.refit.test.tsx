// @vitest-environment jsdom
import { act, screen } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '../../../../test/render';
import type { KnowledgePagePayload } from '../../pageTypes';
import { KnowledgePageGraph } from '../KnowledgePageGraph';

// jsdom can't lay React Flow out, so only the viewport it is handed is observed; everything else is the
// real library.
const setViewport = vi.fn(async () => true);
vi.mock('@xyflow/react', async importOriginal => {
  const actual = await importOriginal<typeof import('@xyflow/react')>();
  return { ...actual, useReactFlow: () => ({ ...actual.useReactFlow(), setViewport }) };
});

/** A ResizeObserver whose size changes the test drives, per observed element. */
const observers: Array<{ target: Element; callback: ResizeObserverCallback }> = [];
beforeAll(() => {
  window.ResizeObserver = class {
    constructor(private callback: ResizeObserverCallback) {}
    observe(target: Element) {
      observers.push({ target, callback: this.callback });
    }
    unobserve() {}
    disconnect() {
      for (let i = observers.length - 1; i >= 0; i--) {
        if (observers[i]?.callback === this.callback) observers.splice(i, 1);
      }
    }
  };
});

function resize(target: Element, width: number, height: number) {
  Object.defineProperty(target, 'clientWidth', { configurable: true, value: width });
  Object.defineProperty(target, 'clientHeight', { configurable: true, value: height });
  for (const observer of observers.filter(o => o.target === target)) {
    observer.callback([{ target, contentRect: { width, height } } as ResizeObserverEntry], {} as ResizeObserver);
  }
}

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

/** Runs queued animation frames now, so a resize's refit is observable synchronously. */
function flushFrames() {
  vi.runOnlyPendingTimers();
}

describe('KnowledgePageGraph inside a host that hides or resizes it', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame'] });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  async function renderGraph() {
    renderWithProviders(
      <KnowledgePageGraph pages={[page('org', null), page('refunds', 'org')]} edges={[]} onSelect={() => {}} />,
    );
    const container = await screen.findByTestId('knowledge-page-graph');
    setViewport.mockClear();
    return container;
  }

  it('fits the pages into view once the hidden graph is shown', async () => {
    const container = await renderGraph();
    act(() => {
      resize(container, 0, 0);
      flushFrames();
    });
    expect(setViewport).not.toHaveBeenCalled();

    act(() => {
      resize(container, 358, 392);
      flushFrames();
    });
    expect(setViewport).toHaveBeenCalledTimes(1);
  });

  it('fits again when the graph is resized, once per frame', async () => {
    const container = await renderGraph();
    act(() => {
      resize(container, 358, 392);
      flushFrames();
    });
    act(() => {
      resize(container, 800, 600);
      resize(container, 1024, 700);
      flushFrames();
    });
    expect(setViewport).toHaveBeenCalledTimes(2);
  });

  it('leaves the view alone when the size has not changed', async () => {
    const container = await renderGraph();
    act(() => {
      resize(container, 358, 392);
      flushFrames();
    });
    act(() => {
      resize(container, 358, 392);
      flushFrames();
    });
    expect(setViewport).toHaveBeenCalledTimes(1);
  });
});

describe('KnowledgePageGraph labels', () => {
  it('draws every page the same size with its kind and name inside the circle', async () => {
    renderWithProviders(
      <KnowledgePageGraph
        pages={[page('org', null), page('refunds', 'org'), page('billing', 'org')]}
        edges={[]}
        onSelect={() => {}}
      />,
    );
    const nodes = await screen.findAllByTestId('knowledge-page-node');
    const pageNodes = nodes.filter(node => node.getAttribute('data-page-id') !== 'org');
    expect(new Set(pageNodes.map(node => node.style.width)).size).toBe(1);
    for (const node of pageNodes) {
      const circle = node.querySelector('.knowledge-circle');
      expect(circle?.textContent).toContain('Page');
      expect(circle?.textContent).toContain(node.getAttribute('data-page-id') ?? '');
    }
  });
});
