import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { startKnowledgeFixtureServer } from './knowledge-fixture-server.mjs';
import { installRenderProbe } from './knowledge-render-probe.mjs';

// The package script builds Factory first. Set KNOWLEDGE_CHROMIUM_PATH to a local Chromium binary,
// or install Playwright's Chromium. No GitHub connection or live backend needed.
const dist = fileURLToPath(new URL('../../dist', import.meta.url));

async function settleCamera(page) {
  await page.evaluate(
    () =>
      new Promise(resolve => {
        let previous,
          stable = 0;
        function frame() {
          const transform = document.querySelector('.react-flow__viewport').style.transform;
          stable = transform === previous ? stable + 1 : 0;
          previous = transform;
          if (stable >= 12) resolve();
          else requestAnimationFrame(frame);
        }
        requestAnimationFrame(frame);
      }),
  );
}

async function measureClick(page) {
  await page.evaluate(() => {
    // Traversing React's tree belongs in the profiling pass, not timed clicks.
    window.profileKnowledgeRenders = false;
    const viewport = document.querySelector('.react-flow__viewport');
    const originalTransform = viewport.style.transform;
    const nodes = [...document.querySelectorAll('.react-flow__node')];
    const edges = [...document.querySelectorAll('.react-flow__edge')];
    const originalGeometry = nodes.map(node => [node.style.transform, node.style.width, node.style.height]);
    const search = document.querySelector('[role=combobox]');
    const searchBounds = search.getBoundingClientRect().toJSON();
    const graph = document.querySelector('[data-testid=knowledge-graph]');
    const graphBounds = graph.getBoundingClientRect().toJSON();
    window.knowledgeLatency = new Promise(resolve => {
      document.addEventListener(
        'click',
        () => {
          const start = performance.now();
          const gaps = [],
            longTasks = [],
            shifts = [];
          let cameraFrames = 0;
          const headerHeights = new Set();
          const panelSizes = new Set();
          const resizeObserver = new ResizeObserver(entries => {
            for (const entry of entries) {
              const size = entry.borderBoxSize[0];
              if (entry.target.tagName === 'HEADER') headerHeights.add(size.blockSize);
              else panelSizes.add(`${size.inlineSize}:${size.blockSize}`);
            }
          });
          let observedPanel = false;
          let lastFrame = start,
            firstFeedback,
            lastCameraChange = start,
            lastTransform = originalTransform;
          const observer = new PerformanceObserver(list => {
            for (const entry of list.getEntries()) {
              if (entry.entryType === 'longtask') longTasks.push(entry.duration);
              // Include shifts after input, which normal CLS excludes.
              if (entry.entryType === 'layout-shift') shifts.push(entry.value);
            }
          });
          observer.observe({ entryTypes: ['longtask', 'layout-shift'] });
          function frame(now) {
            gaps.push(now - lastFrame);
            lastFrame = now;
            const transform = viewport.style.transform;
            if (transform !== originalTransform && firstFeedback === undefined)
              firstFeedback = performance.now() - start;
            if (transform !== lastTransform) {
              cameraFrames++;
              lastCameraChange = performance.now();
              lastTransform = transform;
            }
            const panel = document.querySelector('[data-testid=knowledge-flyout]');
            if (panel && !observedPanel) {
              observedPanel = true;
              resizeObserver.observe(panel.querySelector('header'));
              resizeObserver.observe(panel);
            }
            if (now - start < 1100) {
              requestAnimationFrame(frame);
              return;
            }
            observer.disconnect();
            resizeObserver.disconnect();
            resolve({
              feedbackMs: firstFeedback,
              cameraMotionMs: lastCameraChange - start,
              cameraFrames,
              headerHeights: [...headerHeights],
              panelSizes: [...panelSizes],
              maxFrameGapMs: Math.max(...gaps),
              p95FrameGapMs: gaps.toSorted((a, b) => a - b)[Math.floor(gaps.length * 0.95)],
              longTasks,
              layoutShift: shifts.reduce((sum, shift) => sum + shift, 0),
              canvasSame: document.querySelector('[data-testid=knowledge-graph]') === graph,
              nodesSame: nodes.every((node, index) => node === document.querySelectorAll('.react-flow__node')[index]),
              edgesSame: edges.every((edge, index) => edge === document.querySelectorAll('.react-flow__edge')[index]),
              geometrySame: nodes.every(
                (node, index) =>
                  JSON.stringify([node.style.transform, node.style.width, node.style.height]) ===
                  JSON.stringify(originalGeometry[index]),
              ),
              searchSame: JSON.stringify(search.getBoundingClientRect().toJSON()) === JSON.stringify(searchBounds),
              boundsSame: JSON.stringify(graph.getBoundingClientRect().toJSON()) === JSON.stringify(graphBounds),
            });
          }
          requestAnimationFrame(frame);
        },
        { capture: true, once: true },
      );
    });
  });
  await page.locator('[data-testid=knowledge-node][data-node-id=node-0]').click();
  return page.evaluate(() => window.knowledgeLatency);
}

test(
  'dense knowledge selection paints promptly, animates smoothly, and preserves the canvas',
  { timeout: 90000 },
  async () => {
    const server = await startKnowledgeFixtureServer(dist);
    const browser = await chromium.launch({
      executablePath: process.env.KNOWLEDGE_CHROMIUM_PATH,
      args: ['--no-sandbox'],
    });
    try {
      for (const scenario of [
        { count: 180, theme: 'light', width: 1600 },
        { count: 240, theme: 'dark', width: 1600 },
        { count: 180, theme: 'light', width: 390 },
      ]) {
        const page = await browser.newPage({ viewport: { width: scenario.width, height: 1000 } });
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page
          .context()
          .addCookies([{ name: 'latency-nodes', value: String(scenario.count), url: new URL(server.url).origin }]);
        await page.addInitScript(installRenderProbe);
        await page.addInitScript(theme => localStorage.setItem('mastracode.theme', theme), scenario.theme);
        await page.goto(server.url);
        await page.getByRole('combobox', { name: 'Find a node' }).waitFor();
        await settleCamera(page);
        assert.equal(await page.getByTestId('knowledge-node').count(), scenario.count);
        const initialRenders = await page.evaluate(() => window.knowledgeRenders);
        assert.ok(
          initialRenders.canvas > 0 &&
            initialRenders.nodes >= scenario.count &&
            initialRenders.records > 0 &&
            initialRenders.links > 0,
          'Render probe must observe the mounted renderers',
        );
        const samples = [];
        for (let index = 0; index < 5; index++) {
          samples.push(await measureClick(page));
          await page.getByRole('button', { name: 'Close details' }).click();
          await page.getByTestId('knowledge-flyout').waitFor({ state: 'detached' });
          await settleCamera(page);
        }
        console.log(JSON.stringify({ scenario, samples }));
        for (const sample of samples) {
          assert.ok(sample.feedbackMs < 150, `Click-to-camera feedback ${sample.feedbackMs}ms exceeds 150ms`);
          assert.ok(
            sample.cameraMotionMs >= 600 && sample.cameraMotionMs < 1000,
            `Camera motion ${sample.cameraMotionMs}ms should be gradual`,
          );
          assert.ok(sample.maxFrameGapMs < 100, `Blocked frame: ${sample.maxFrameGapMs}ms`);
          assert.ok(sample.cameraFrames >= 12, `Only ${sample.cameraFrames} camera frames`);
          assert.deepEqual(sample.headerHeights, [80]);
          assert.equal(sample.panelSizes.length, 1);
          // Allow headless software rasterization while rejecting sustained stalls.
          assert.ok(sample.p95FrameGapMs < 75, `Frame p95: ${sample.p95FrameGapMs}ms`);
          assert.ok(
            sample.longTasks.every(duration => duration < 100),
            `Long tasks: ${sample.longTasks}`,
          );
          assert.equal(sample.layoutShift, 0);
          for (const invariant of ['canvasSame', 'nodesSame', 'edgesSame', 'geometrySame', 'searchSame', 'boundsSame'])
            assert.equal(sample[invariant], true, invariant);
        }
        // Profile a separate real click and search, so counting renders does not
        // inflate the latency/frame measurements above.
        await page.evaluate(() => {
          window.knowledgeRenders = { canvas: 0, nodes: 0, records: 0, links: 0 };
          window.profileKnowledgeRenders = true;
        });
        await page.locator('[data-testid=knowledge-node][data-node-id=node-0]').click();
        await page.getByRole('heading', { name: 'Domain 0', exact: true }).waitFor();
        await page.waitForTimeout(900);
        const clickRenders = await page.evaluate(() => window.knowledgeRenders);
        assert.deepEqual(clickRenders, { canvas: 0, nodes: 0, records: 0, links: 0 });
        await page.getByRole('button', { name: 'Close details' }).click();
        await page.getByTestId('knowledge-flyout').waitFor({ state: 'detached' });
        await settleCamera(page);
        await page.evaluate(() => {
          window.knowledgeRenders = { canvas: 0, nodes: 0, records: 0, links: 0 };
        });
        const search = page.getByRole('combobox', { name: 'Find a node' });
        await search.fill('Domain 1');
        await search.press('Enter');
        await page.getByRole('heading', { name: 'Domain 1', exact: true }).waitFor();
        await page.waitForTimeout(900);
        const searchRenders = await page.evaluate(() => window.knowledgeRenders);
        assert.deepEqual(searchRenders, { canvas: 0, nodes: 0, records: 0, links: 0 });
        console.log(JSON.stringify({ scenario, profile: { clickRenders, searchRenders } }));
        assert.deepEqual(errors, []);
        await page.close();
      }
    } finally {
      await browser.close();
      await server.close();
    }
  },
);
