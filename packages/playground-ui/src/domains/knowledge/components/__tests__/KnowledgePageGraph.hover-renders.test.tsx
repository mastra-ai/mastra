// @vitest-environment jsdom
import { fireEvent } from '@testing-library/react';
import { createElement } from 'react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '../../../../test/render';
import type { KnowledgePagePayload } from '../../pageTypes';
import { KnowledgePageGraph } from '../KnowledgePageGraph';

// React Flow re-renders every node and line wrapper when a handler it is given changes identity. The real
// library runs; only the props it is handed are recorded, one entry per render of the graph.
const handed: Array<Record<string, unknown>> = [];
vi.mock('@xyflow/react', async importOriginal => {
  const actual = await importOriginal<typeof import('@xyflow/react')>();
  return {
    ...actual,
    ReactFlow: (props: Record<string, unknown>) => {
      handed.push(props);
      return createElement(actual.ReactFlow, props as never);
    },
  };
});

beforeAll(() => {
  window.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});
beforeEach(() => void (handed.length = 0));

const page = (id: string, parentId: string | null): KnowledgePagePayload => ({
  id,
  scopeId: parentId === null ? id : 'org',
  parentId,
  isScope: parentId === null,
  position: id,
  name: id,
  version: 1,
  createdBy: { author: 'host' },
  updatedBy: { author: 'host' },
  createdAt: '2026-11-03T00:00:00.000Z',
  updatedAt: '2026-11-03T00:00:00.000Z',
});

const HANDLERS = ['onNodeMouseEnter', 'onNodeMouseLeave', 'onNodeClick', 'onEdgeClick', 'onPaneClick'];

describe('KnowledgePageGraph when the pointer moves over pages', () => {
  it('hands React Flow the same handlers every render, so no node or line wrapper re-renders for them', () => {
    const pages = [page('org', null), ...['a', 'b', 'c'].map(id => page(id, 'org'))];
    renderWithProviders(
      <div style={{ width: 800, height: 600 }}>
        <KnowledgePageGraph pages={pages} edges={[]} onSelect={() => {}} />
      </div>,
    );
    const first = handed[handed.length - 1] ?? {};
    for (const name of HANDLERS) expect(first[name], name).toBeTypeOf('function');
    const before = handed.length;
    for (const id of ['a', 'b', 'c']) {
      const circle = document.querySelector<HTMLElement>(`[data-page-id="${id}"]`);
      expect(circle).toBeTruthy();
      fireEvent.mouseEnter(circle as HTMLElement);
      fireEvent.mouseLeave(circle as HTMLElement);
    }
    // Hovering re-rendered the graph (its emphasis changed) ...
    expect(handed.length).toBeGreaterThan(before);
    // ... and every render handed React Flow the very same functions.
    for (const props of handed.slice(before)) {
      for (const name of HANDLERS) expect(props[name], name).toBe(first[name]);
    }
  });
});
