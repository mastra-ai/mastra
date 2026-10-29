// @vitest-environment jsdom
import { screen } from '@testing-library/react';
import { beforeAll, describe, expect, it } from 'vitest';

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
});
