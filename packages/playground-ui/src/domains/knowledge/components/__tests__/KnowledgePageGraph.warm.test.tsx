// @vitest-environment jsdom
import { screen } from '@testing-library/react';
import { beforeAll, describe, expect, it } from 'vitest';

import { renderWithProviders } from '../../../../test/render';
import type { KnowledgePagePayload } from '../../pageTypes';
import { KnowledgePageGraph } from '../KnowledgePageGraph';

function page(id: string, parentId: string | null): KnowledgePagePayload {
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
  };
}

const pages = () => [page('org', null), ...Array.from({ length: 12 }, (_, i) => page(`p${i}`, 'org'))];

function transforms() {
  return new Map(
    [...document.querySelectorAll<HTMLElement>('.react-flow__node')].map(node => [
      node.getAttribute('data-id'),
      node.style.transform,
    ]),
  );
}

beforeAll(() => {
  window.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

describe('KnowledgePageGraph layout across updates', () => {
  it('keeps every page where it was when a refetch returns the same pages', async () => {
    const view = (list: KnowledgePagePayload[]) => (
      <div style={{ width: 800, height: 600 }}>
        <KnowledgePageGraph pages={list} edges={[]} onSelect={() => {}} />
      </div>
    );
    const { rerender } = renderWithProviders(view(pages()));
    await screen.findAllByTestId('knowledge-page-node');
    const before = transforms();
    expect(before.size).toBe(13);

    // A refetch: new objects, a version bump, same graph.
    rerender(view(pages().map(p => ({ ...p, version: 2 }))));
    await screen.findAllByTestId('knowledge-page-node');
    expect(transforms()).toEqual(before);
  });

  it('keeps other pages where they were when a page is added', async () => {
    const view = (list: KnowledgePagePayload[]) => (
      <div style={{ width: 800, height: 600 }}>
        <KnowledgePageGraph pages={list} edges={[]} onSelect={() => {}} />
      </div>
    );
    const { rerender } = renderWithProviders(view(pages()));
    await screen.findAllByTestId('knowledge-page-node');
    const before = transforms();

    // A live update adds a page under the org scope: only pages it lands on make room.
    rerender(view([...pages(), page('added', 'org')]));
    await screen.findAllByText('added');
    const after = transforms();
    expect(after.size).toBe(14);
    const unmoved = [...before].filter(([id, transform]) => after.get(id) === transform);
    expect(unmoved.length).toBeGreaterThanOrEqual(before.size / 2);
  });
});
