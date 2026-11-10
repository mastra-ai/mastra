// @vitest-environment jsdom
import { fireEvent, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '../../../../test/render';
import type { KnowledgePagePayload, KnowledgeScopeGrantPayload } from '../../pageTypes';
import { KnowledgePageGraph } from '../KnowledgePageGraph';

function scope(id: string, address: string, parentId: string | null = null) {
  return {
    id,
    scopeId: id,
    parentId,
    isScope: true,
    address,
    position: 'a0',
    name: address,
    version: 1,
    createdBy: { author: 'host' },
    updatedBy: { author: 'host' },
    createdAt: '2026-10-28T00:00:00.000Z',
    updatedAt: '2026-10-28T00:00:00.000Z',
  } satisfies KnowledgePagePayload;
}

// Acme: support and admin have scope pages; manager is declared but nothing was written to it.
const pages = [
  scope('org', 'org:acme'),
  scope('policy', 'policy:acme', 'org'),
  scope('runbook', 'runbook:acme', 'org'),
  scope('admin', 'role:acme:admin', 'org'),
  scope('support', 'role:acme:support', 'org'),
];
const grants: KnowledgeScopeGrantPayload[] = [
  { principal: 'role:acme:admin', principalId: 'admin', target: 'policy', role: 'owner' },
  { principal: 'role:acme:admin', principalId: 'admin', target: 'runbook', role: 'owner' },
  { principal: 'role:acme:support', principalId: 'support', target: 'policy', role: 'viewer' },
  { principal: 'role:acme:support', principalId: 'support', target: 'runbook', role: 'viewer' },
  { principal: 'role:acme:manager', principalLabel: 'acme manager', target: 'policy', role: 'owner' },
];

function renderGraph(props: Partial<Parameters<typeof KnowledgePageGraph>[0]> = {}) {
  return renderWithProviders(
    <div style={{ width: 800, height: 600 }}>
      <KnowledgePageGraph pages={pages} edges={[]} grants={grants} onSelect={() => {}} {...props} />
    </div>,
  );
}

const grantEdges = () =>
  [...document.querySelectorAll<SVGPathElement>('[data-testid="knowledge-grant-edge"]')].map(path => ({
    edge: path.closest('.react-flow__edge')?.getAttribute('data-id'),
    role: path.dataset.role,
    title: path.querySelector('title')?.textContent,
  }));

beforeAll(() => {
  window.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

describe('KnowledgePageGraph grants', () => {
  describe('when the server sends grants between scopes', () => {
    it('draws a grant line from each principal scope to the scope it reaches, naming the role', async () => {
      renderGraph();
      await screen.findAllByTestId('knowledge-page-node');
      expect(grantEdges()).toEqual(
        expect.arrayContaining([
          { edge: 'grant:admin->policy', role: 'owner', title: 'Grants owner' },
          { edge: 'grant:admin->runbook', role: 'owner', title: 'Grants owner' },
          { edge: 'grant:support->policy', role: 'viewer', title: 'Grants viewer' },
          { edge: 'grant:support->runbook', role: 'viewer', title: 'Grants viewer' },
          { edge: 'grant:unplaced:role:acme:manager->policy', role: 'owner', title: 'Grants owner' },
        ]),
      );
      expect(grantEdges()).toHaveLength(5);
    });

    it('lists grants in the legend', async () => {
      renderGraph();
      await screen.findAllByTestId('knowledge-page-node');
      expect(screen.getByTestId('knowledge-legend-grant')).toBeTruthy();
      expect(screen.getByText('Grants access (hover for role)')).toBeTruthy();
    });

    it('draws a declared principal with no scope page as a placeholder that does not open', async () => {
      const onSelect = vi.fn();
      renderGraph({ onSelect });
      const nodes = await screen.findAllByTestId('knowledge-page-node');
      const manager = nodes.find(node => node.dataset.pageId === 'unplaced:role:acme:manager');
      if (!manager) throw new Error('manager placeholder not drawn');
      expect(manager.dataset.pageType).toBe('placeholder');
      expect(manager.textContent).toContain('acme manager');
      fireEvent.click(manager);
      expect(onSelect).not.toHaveBeenCalled();
    });
  });

  describe('when a grant names a principal page that is not loaded', () => {
    it('leaves that grant out instead of drawing a placeholder for an existing page', async () => {
      renderGraph({
        grants: [{ principal: 'role:acme:admin', principalId: 'not-loaded', target: 'policy', role: 'owner' }],
      });
      await screen.findAllByTestId('knowledge-page-node');
      expect(grantEdges()).toEqual([]);
      expect(screen.getAllByTestId('knowledge-page-node')).toHaveLength(pages.length);
    });
  });

  describe('when the server sends no grants', () => {
    it('draws no grant lines', async () => {
      renderGraph({ grants: undefined });
      await screen.findAllByTestId('knowledge-page-node');
      expect(grantEdges()).toEqual([]);
    });
  });
});
