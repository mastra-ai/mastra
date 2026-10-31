// @vitest-environment jsdom
import { screen } from '@testing-library/react';
import { beforeAll, describe, expect, it } from 'vitest';

import { renderWithProviders } from '../../../../test/render';
import type { KnowledgePagePayload } from '../../pageTypes';
import { KnowledgePageGraph } from '../KnowledgePageGraph';

// jsdom never lays anything out, so React Flow's own DOM measurement of each node never lands: the same state a
// production Studio was left in, with every node `visibility: hidden` and the view never fitted.
beforeAll(() => {
  window.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
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

describe('KnowledgePageGraph before React Flow has measured its nodes', () => {
  it('shows every page, sized as laid out, without waiting for a DOM measurement', async () => {
    renderWithProviders(
      <KnowledgePageGraph
        pages={[page('org', null), page('refunds', 'org'), page('roadmap', 'org')]}
        edges={[{ kind: 'mention', source: 'refunds', target: 'roadmap', count: 2 }]}
        onSelect={() => {}}
      />,
    );
    const pages = await screen.findAllByTestId('knowledge-page-node');
    expect(pages).toHaveLength(3);
    for (const node of pages) {
      const wrapper = node.closest<HTMLElement>('.react-flow__node');
      expect(wrapper?.style.visibility).toBe('visible');
      expect(wrapper?.style.width).toBe(node.style.width);
      expect(wrapper?.style.height).toBe(node.style.height);
    }
  });
});
