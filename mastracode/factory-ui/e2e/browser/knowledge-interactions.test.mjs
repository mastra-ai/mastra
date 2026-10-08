import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { startKnowledgeFixtureServer } from './knowledge-fixture-server.mjs';
import { installRenderProbe } from './knowledge-render-probe.mjs';

const dist = fileURLToPath(new URL('../../dist', import.meta.url));
const viewport = page =>
  page.locator('.react-flow__viewport').evaluate(element => {
    const matrix = new DOMMatrixReadOnly(getComputedStyle(element).transform);
    return { x: matrix.e, y: matrix.f, zoom: matrix.a };
  });

test(
  'trackpad gestures, keyboard movement, and record selection preserve existing interactions',
  { timeout: 30000 },
  async () => {
    const server = await startKnowledgeFixtureServer(dist);
    const browser = await chromium.launch({
      executablePath: process.env.KNOWLEDGE_CHROMIUM_PATH,
      args: ['--no-sandbox'],
    });
    try {
      const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, reducedMotion: 'reduce' });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.context().addCookies([{ name: 'latency-nodes', value: '9', url: new URL(server.url).origin }]);
      await page.addInitScript(installRenderProbe);
      await page.goto(server.url);
      await page.getByRole('combobox', { name: 'Find a node' }).waitFor();
      await page.waitForTimeout(500);
      const beforePan = await viewport(page);
      await page.mouse.move(800, 500);
      await page.mouse.wheel(180, 120);
      await page.waitForTimeout(200);
      const afterPan = await viewport(page);
      assert.equal(afterPan.zoom, beforePan.zoom, 'Two-finger scrolling must pan, without zooming');
      assert.ok(Math.abs(afterPan.x - beforePan.x) > 100, 'Horizontal trackpad movement must pan horizontally');
      assert.ok(Math.abs(afterPan.y - beforePan.y) > 80, 'Vertical trackpad movement must pan vertically');
      await page.locator('.react-flow__pane').dispatchEvent('wheel', {
        ctrlKey: true,
        deltaY: -80,
        deltaMode: 0,
        clientX: 800,
        clientY: 500,
        bubbles: true,
        cancelable: true,
      });
      await page.waitForTimeout(200);
      assert.ok((await viewport(page)).zoom > afterPan.zoom, 'A pinch wheel event must zoom');

      const node = page.locator('.react-flow__node[data-id="node-0"]');
      const beforeMove = await node.evaluate(element => element.style.transform);
      await node.focus();
      await node.press('ArrowRight');
      assert.notEqual(
        await node.evaluate(element => element.style.transform),
        beforeMove,
        'Arrow keys must move nodes',
      );
      await page.waitForTimeout(50);
      await page.evaluate(() => {
        window.knowledgeRenders = { canvas: 0, nodes: 0, records: 0, links: 0 };
      });
      await node.press('Enter');
      await page.getByRole('heading', { name: 'Domain 0', exact: true }).waitFor();
      await node.press('Escape');
      await page.getByTestId('knowledge-flyout').waitFor({ state: 'detached' });

      const marker = page.locator('.react-flow__node[data-id="record:note-0"]');
      await marker.focus();
      await marker.press('Enter');
      await page.getByTestId('knowledge-record-detail').waitFor();
      assert.equal(await marker.locator('[data-record-id]').getAttribute('data-knowledge-record-focus'), '');
      await page.getByRole('button', { name: 'Close details' }).click();
      await page.getByTestId('knowledge-flyout').waitFor({ state: 'detached' });

      const edge = page.locator('.react-flow__edge[data-id="record:record-1:0"]');
      await edge.focus();
      await edge.press('Enter');
      await page.getByRole('heading', { name: 'Service 1', exact: true }).waitFor();
      await page.getByTestId('knowledge-record-detail').waitFor();
      assert.equal(await edge.locator('[data-knowledge-record-id]').getAttribute('data-knowledge-record-focus'), '');
      assert.deepEqual(await page.evaluate(() => window.knowledgeRenders), {
        canvas: 0,
        nodes: 0,
        records: 0,
        links: 0,
      });
      assert.deepEqual(errors, []);
      await page.close();
    } finally {
      await browser.close();
      await server.close();
    }
  },
);
