import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { startKnowledgeFixtureServer } from './knowledge-fixture-server.mjs';
import { installRenderProbe } from './knowledge-render-probe.mjs';

const dist = fileURLToPath(new URL('../../dist', import.meta.url));

test(
  'focus preserves connected context, survives interrupted motion, and restores the overview',
  { timeout: 30000 },
  async () => {
    const server = await startKnowledgeFixtureServer(dist);
    const browser = await chromium.launch({
      executablePath: process.env.KNOWLEDGE_CHROMIUM_PATH,
      args: ['--no-sandbox'],
    });
    try {
      for (const reducedMotion of ['no-preference', 'reduce']) {
        const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, reducedMotion });
        await page.addInitScript(installRenderProbe);
        await page.goto(server.url);
        const search = page.getByRole('combobox', { name: 'Find a node' });
        await search.waitFor();
        await page.waitForTimeout(800);
        await page.evaluate(() => {
          window.focusNodes = [...document.querySelectorAll('.react-flow__node')];
          window.focusGeometry = window.focusNodes.map(node => node.style.transform);
          window.knowledgeRenders = { canvas: 0, nodes: 0, records: 0, links: 0 };
        });
        await search.fill('Domain 0');
        await page.evaluate(() => {
          window.focusMotionSamples = [];
          const node = document.querySelector('.react-flow__node[data-id="node-18"]');
          const observer = new MutationObserver(() => {
            if (!node.hasAttribute('data-knowledge-hidden')) return;
            observer.disconnect();
            const start = performance.now();
            function sample() {
              window.focusMotionSamples.push({
                opacity: Number(getComputedStyle(node).opacity),
                offset: new DOMMatrixReadOnly(getComputedStyle(node.firstElementChild).transform).f,
              });
              if (performance.now() - start < 300) requestAnimationFrame(sample);
            }
            requestAnimationFrame(sample);
          });
          observer.observe(node, { attributes: true, attributeFilter: ['data-knowledge-hidden'] });
        });
        await search.press('Enter');
        await page.waitForTimeout(80);
        if (reducedMotion === 'no-preference') {
          assert.equal(
            await page.evaluate(() =>
              window.focusMotionSamples.some(sample => sample.opacity > 0 && sample.opacity < 1 && sample.offset > 0),
            ),
            true,
            'Unrelated context should fade and move through intermediate values',
          );
        }
        // Interrupt the fade while its unrelated nodes are still on their way out.
        await search.fill('Domain 2');
        await search.press('Enter');
        await page.getByRole('heading', { name: 'Domain 2', exact: true }).waitFor();
        await page.waitForTimeout(650);
        const neighborhood = await page.evaluate(() => {
          const nodes = [...document.querySelectorAll('.react-flow__node')];
          const node = id => document.querySelector(`.react-flow__node[data-id="${id}"]`);
          const visible = element =>
            getComputedStyle(element).opacity === '1' && getComputedStyle(element).visibility === 'visible';
          return {
            focusVisible: visible(node('node-18')),
            relatedVisible: visible(node('node-19')),
            recordVisible: visible(node('record:note-18')),
            previousHidden: getComputedStyle(node('node-0')).visibility === 'hidden',
            unrelatedHidden: getComputedStyle(node('node-45')).visibility === 'hidden',
            sameNodes: nodes.every((node, index) => node === window.focusNodes[index]),
            sameGeometry: nodes.every((node, index) => node.style.transform === window.focusGeometry[index]),
            renders: window.knowledgeRenders,
          };
        });
        assert.deepEqual(neighborhood, {
          focusVisible: true,
          relatedVisible: true,
          recordVisible: true,
          previousHidden: true,
          unrelatedHidden: true,
          sameNodes: true,
          sameGeometry: true,
          renders: { canvas: 0, nodes: 0, records: 0, links: 0 },
        });
        // Scope filters continue to constrain the focused neighborhood.
        await page.getByRole('button', { name: 'Org', exact: true }).click();
        await page.waitForTimeout(600);
        assert.equal(
          await page
            .locator('.react-flow__node[data-id="node-19"]')
            .evaluate(element => getComputedStyle(element).visibility),
          'hidden',
        );
        await page.getByRole('button', { name: 'Close details' }).click();
        await page.getByTestId('knowledge-flyout').waitFor({ state: 'detached' });
        await page.waitForTimeout(650);
        // Remove the scope restriction to recover the full overview.
        await page.getByRole('button', { name: 'Org', exact: true }).click();
        await page.waitForFunction(() =>
          [...document.querySelectorAll('.react-flow__node')].every(
            node => getComputedStyle(node).opacity === '1' && getComputedStyle(node).visibility === 'visible',
          ),
        );
        const restored = await page.evaluate(() => ({
          visible: [...document.querySelectorAll('.react-flow__node')].every(
            node =>
              getComputedStyle(node).opacity === '1' &&
              getComputedStyle(node).visibility === 'visible' &&
              !node.hasAttribute('inert'),
          ),
          sameNodes: [...document.querySelectorAll('.react-flow__node')].every(
            (node, index) => node === window.focusNodes[index],
          ),
          renders: window.knowledgeRenders,
        }));
        assert.equal(restored.visible, true);
        assert.equal(restored.sameNodes, true);
        assert.deepEqual(restored.renders, { canvas: 0, nodes: 0, records: 0, links: 0 });
        await page.close();
      }
    } finally {
      await browser.close();
      await server.close();
    }
  },
);
