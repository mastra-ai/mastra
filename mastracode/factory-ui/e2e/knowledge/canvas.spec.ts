import type { KnowledgeExplorerGraph } from '@mastra/playground-ui/domains/knowledge/components/KnowledgePageExplorer';
import { expect, test } from '@playwright/test';
import type { BoardCatalogResponse, SessionRowsResponse } from '../../src/api/types';

const project = { id: 'canvas-factory', name: 'Canvas Factory', repositories: [] };
const scope = {
  id: 'organization',
  scopeId: 'organization',
  parentId: null,
  name: 'Organization',
  isScope: true,
  address: 'org:canvas',
  position: 'a0',
  version: 1,
  createdAt: '2026-11-23T00:00:00Z',
  updatedAt: '2026-11-23T00:00:00Z',
  createdBy: { author: 'host' },
  updatedBy: { author: 'host' },
};
const graph: KnowledgeExplorerGraph = { pages: [scope], edges: [], pinnedIds: [], truncated: false };

test.describe('Factory Knowledge canvas', () => {
  test.describe('when the graph and its floating controls are visible', () => {
    test.use({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });

    test('pans in both axes from every canvas edge at the current zoom', async ({ page, baseURL }) => {
      await page.route(
        url => url.origin === baseURL && /^\/(web|auth|api)\//.test(url.pathname),
        async route => {
          const url = new URL(route.request().url());
          switch (url.pathname) {
            case '/auth/me':
              return route.fulfill({ json: { authenticated: true, authEnabled: false } });
            case '/web/config/features':
              return route.fulfill({ json: { knowledge: true } });
            case '/web/factory/projects':
              return route.fulfill({ json: { projects: [project] } });
            case `/web/factory/projects/${project.id}/knowledge/graph`:
              return route.fulfill({ json: graph });
            case `/web/factory/projects/${project.id}/knowledge/tree`:
              return route.fulfill({ json: { pages: url.searchParams.has('parentId') ? [] : [scope] } });
            case `/web/factory/projects/${project.id}/boards`:
              return route.fulfill({ json: { boards: [] } satisfies BoardCatalogResponse });
            case `/web/factory/projects/${project.id}/session-rows`:
              return route.fulfill({
                json: { total: 0, matching: 0, groups: [], boards: [], owners: [] } satisfies SessionRowsResponse,
              });
            case `/web/factory/projects/${project.id}/sessions`:
              return route.fulfill({ json: { sessions: [] } });
            case '/web/github/subscriptions':
              return route.fulfill({ json: { subscriptions: [] } });
            default:
              return route.fulfill({ status: 404, json: { error: 'not_found' } });
          }
        },
      );
      await page.goto(`/factories/${project.id}/knowledge?view=graph`);
      await expect(page.getByRole('button', { name: 'Hide pages' })).toBeVisible();
      await expect(page.getByLabel('Search knowledge')).toBeVisible();
      await expect(page.getByTestId('knowledge-page-node').first()).toBeVisible();

      const frame = await page.locator('[data-slot="page-layout-fixed"]').boundingBox();
      if (!frame) throw new Error('Expected the Knowledge page body to have a visible frame');
      const { x, y, width, height } = frame;
      const viewport = page.locator('.react-flow__viewport');
      const camera = () =>
        viewport.evaluate(element => {
          const transform = new DOMMatrixReadOnly(getComputedStyle(element).transform);
          return { x: transform.e, y: transform.f, zoom: transform.a };
        });

      for (const edge of [
        { name: 'top', x: x + width / 2, y: y + 4 },
        { name: 'right', x: x + width - 4, y: y + height / 2 },
        { name: 'bottom', x: x + width / 2, y: y + height - 4 },
        { name: 'left', x: x + 4, y: y + height / 2 },
      ]) {
        await test.step(`pan from the ${edge.name} edge`, async () => {
          await page.mouse.move(edge.x, edge.y);
          const before = await camera();
          await page.mouse.wheel(90, 60);
          await expect.poll(async () => (await camera()).x).toBeLessThan(before.x);
          const after = await camera();
          expect(after.y).toBeLessThan(before.y);
          expect(after.zoom).toBeCloseTo(before.zoom);
        });
      }
    });
  });
});
