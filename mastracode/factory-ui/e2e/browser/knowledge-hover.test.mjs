import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { startKnowledgeFixtureServer } from './knowledge-fixture-server.mjs';
import { installRenderProbe } from './knowledge-render-probe.mjs';

const dist = fileURLToPath(new URL('../../dist', import.meta.url));
const noRenders = { canvas: 0, nodes: 0, records: 0, links: 0 };

async function hoverNode(page) {
  const node = page.locator('[data-testid=knowledge-node][data-node-id=node-0]');
  await node.hover();
  await page.waitForTimeout(600);
  return node;
}

async function sampleResize(page) {
  await page.evaluate(() => {
    window.hoverResize = new Promise(resolve => {
      const surface = document.querySelector('.knowledge-hover-surface');
      const widths = new Set();
      const heights = new Set();
      const filters = new Set();
      const observer = new ResizeObserver(entries => {
        for (const entry of entries) {
          widths.add(Math.round(entry.borderBoxSize[0].inlineSize));
          heights.add(Math.round(entry.borderBoxSize[0].blockSize));
        }
      });
      observer.observe(surface);
      const start = performance.now();
      function frame(now) {
        for (const content of document.querySelectorAll('.knowledge-hover-content, .knowledge-hover-outgoing'))
          filters.add(getComputedStyle(content).filter);
        if (now - start < 650) requestAnimationFrame(frame);
        else {
          observer.disconnect();
          resolve({ widths: [...widths], heights: [...heights], filters: [...filters] });
        }
      }
      requestAnimationFrame(frame);
    });
  });
}

test(
  'one hover card follows the pointer, morphs between targets, and leaves the dense canvas untouched',
  { timeout: 45000 },
  async () => {
    const server = await startKnowledgeFixtureServer(dist);
    const browser = await chromium.launch({
      executablePath: process.env.KNOWLEDGE_CHROMIUM_PATH,
      args: ['--no-sandbox'],
    });
    try {
      for (const scenario of [
        { theme: 'light', reducedMotion: 'no-preference' },
        { theme: 'dark', reducedMotion: 'no-preference' },
        { theme: 'light', reducedMotion: 'reduce' },
      ]) {
        const page = await browser.newPage({
          viewport: { width: 1600, height: 1000 },
          reducedMotion: scenario.reducedMotion,
        });
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.addInitScript(installRenderProbe);
        await page.addInitScript(theme => localStorage.setItem('mastracode.theme', theme), scenario.theme);
        await page.goto(server.url);
        await page.getByRole('combobox', { name: 'Find a node' }).waitFor();
        await page.waitForTimeout(1000);
        await page.locator('[data-testid=knowledge-node][data-node-id=node-0]').click();
        await page.getByRole('heading', { name: 'Domain 0', exact: true }).waitFor();
        await page.waitForTimeout(900);
        await page.mouse.move(50, 900);
        await page.waitForTimeout(500);
        await page.evaluate(() => {
          window.hoverCard = document.querySelector('[data-testid=knowledge-hover-card]');
          window.hoverNodes = [...document.querySelectorAll('.react-flow__node')];
          window.hoverGeometry = window.hoverNodes.map(node => [
            node.style.transform,
            node.style.width,
            node.style.height,
          ]);
          window.knowledgeRenders = { canvas: 0, nodes: 0, records: 0, links: 0 };
        });
        const node = await hoverNode(page);
        assert.equal(await node.evaluate(element => getComputedStyle(element).cursor), 'pointer');
        const circle = node.locator('.knowledge-circle');
        const scale = await circle.evaluate(element => new DOMMatrixReadOnly(getComputedStyle(element).transform).a);
        assert.ok(scenario.reducedMotion === 'reduce' ? scale === 1 : scale > 1, `Hover scale: ${scale}`);
        const bounds = await node.boundingBox();
        const initialPosition = await page
          .getByTestId('knowledge-hover-card')
          .evaluate(element => element.getBoundingClientRect().x);
        await page.mouse.move(bounds.x + bounds.width / 2 + 20, bounds.y + bounds.height / 2);
        await page.waitForTimeout(350);
        const movedPosition = await page
          .getByTestId('knowledge-hover-card')
          .evaluate(element => element.getBoundingClientRect().x);
        assert.ok(movedPosition - initialPosition > 15, 'Card follows movement within the same node');
        await sampleResize(page);
        await page.locator('[data-testid=knowledge-record-node][data-record-id=note-0]').hover();
        const resize = await page.evaluate(() => window.hoverResize);
        console.log(JSON.stringify({ scenario, resize }));
        assert.ok(Math.max(...resize.widths) - Math.min(...resize.widths) > 50, 'Content changes card width');
        assert.ok(Math.max(...resize.heights) - Math.min(...resize.heights) > 50, 'Content changes card height');
        if (scenario.reducedMotion === 'no-preference') {
          assert.ok(
            resize.widths.length >= 5 && resize.heights.length >= 5,
            'Dimensions pass through intermediate sizes',
          );
          assert.ok(
            resize.filters.some(filter => filter !== 'none' && filter !== 'blur(0px)'),
            'Text blurs during the crossfade',
          );
        }
        assert.equal(await page.getByTestId('knowledge-hover-card').count(), 1);
        assert.equal(await page.locator('.knowledge-hover-content').textContent(), 'RecordDecisions for Domain 0.');
        // Move across empty canvas and re-enter before the close grace period expires.
        await page.mouse.move(50, 900);
        await node.hover();
        await page.waitForTimeout(600);
        assert.equal(await page.getByTestId('knowledge-hover-card').getAttribute('aria-hidden'), 'false');
        assert.equal(await page.locator('.knowledge-hover-outgoing').count(), 0);
        const invariants = await page.evaluate(() => ({
          sameCard: window.hoverCard === document.querySelector('[data-testid=knowledge-hover-card]'),
          sameNodes: window.hoverNodes.every(
            (node, index) => node === document.querySelectorAll('.react-flow__node')[index],
          ),
          sameGeometry: window.hoverNodes.every(
            (node, index) =>
              JSON.stringify([node.style.transform, node.style.width, node.style.height]) ===
              JSON.stringify(window.hoverGeometry[index]),
          ),
          renders: window.knowledgeRenders,
          cardBounds: document.querySelector('[data-testid=knowledge-hover-card]').getBoundingClientRect().toJSON(),
          activeAnimations: document
            .querySelector('[data-testid=knowledge-hover-card]')
            .getAnimations({ subtree: true }).length,
        }));
        assert.equal(invariants.sameCard, true);
        assert.equal(invariants.sameNodes, true);
        assert.equal(invariants.sameGeometry, true);
        assert.deepEqual(invariants.renders, noRenders);
        assert.ok(invariants.cardBounds.x >= 12 && invariants.cardBounds.right <= 1588);
        assert.ok(invariants.cardBounds.y >= 12 && invariants.cardBounds.bottom <= 988);
        if (scenario.reducedMotion === 'reduce') assert.equal(invariants.activeAnimations, 0);
        await page.mouse.move(50, 900);
        await page.waitForTimeout(450);
        assert.equal(await page.getByTestId('knowledge-hover-card').getAttribute('aria-hidden'), 'true');
        assert.equal(
          await page.getByTestId('knowledge-hover-card').evaluate(element => getComputedStyle(element).visibility),
          'hidden',
        );
        // The cursor becomes grabbing only during an actual drag.
        await node.hover();
        await page.mouse.down();
        await page.mouse.move(bounds.x + bounds.width / 2 + 30, bounds.y + bounds.height / 2 + 30, { steps: 3 });
        assert.equal(await node.evaluate(element => getComputedStyle(element).cursor), 'grabbing');
        await page.mouse.up();
        await node.hover();
        await page.mouse.down();
        await page.mouse.move(1100, 955, { steps: 5 });
        await page.mouse.up();
        await page.mouse.move(50, 900);
        await node.hover();
        await page.waitForTimeout(600);
        const edgeBounds = await page.getByTestId('knowledge-hover-card').boundingBox();
        assert.ok(
          edgeBounds.y >= 12 && edgeBounds.y + edgeBounds.height <= 988,
          'Card flips above a node at the bottom edge',
        );
        assert.deepEqual(errors, []);
        await page.close();
      }
    } finally {
      await browser.close();
      await server.close();
    }
  },
);
