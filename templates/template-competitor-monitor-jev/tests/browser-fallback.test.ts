import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { Mastra } from '@mastra/core/mastra';
import { LibSQLStore } from '@mastra/libsql';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { loadConfig } from '../src/mastra/config';
import { TIMING } from '../src/mastra/config/source-config';
import type { DnsResolver, PinnedTransport } from '../src/mastra/lib/acquisition';
import { MonitorStore } from '../src/mastra/lib/store';
import { createCompetitorMonitorWorkflow } from '../src/mastra/workflows/competitor-monitor-workflow';

const publicDns: DnsResolver = async () => [{ address: '93.184.216.34', family: 4 }];
const pricingText = (price: string) =>
  `The pricing page confirms that the Starter plan costs ${price} each month and includes monitoring, reports, email support, documented limits, exports, onboarding, and reliable change evidence for growing teams. `.repeat(
    3,
  );
const lossText =
  'The pricing page still includes monitoring, reports, email support, and documented limits for growing teams.';
let stores: MonitorStore[] = [];

afterEach(async () => Promise.all(stores.splice(0).map(store => store.close())));

function activeBrowserHandles() {
  const handles = (process as unknown as { _getActiveHandles: () => unknown[] })._getActiveHandles();
  return {
    chromePids: new Set(
      handles.flatMap(handle => {
        const child = handle as { pid?: number; exitCode?: number | null; spawnfile?: string };
        return child.exitCode === null && /Chrome/i.test(child.spawnfile ?? '') && typeof child.pid === 'number'
          ? [child.pid]
          : [];
      }),
    ),
    cdpSockets: new Set(
      handles.flatMap(handle => {
        const socket = handle as { destroyed?: boolean; remoteAddress?: string; remotePort?: number };
        return !socket.destroyed && socket.remoteAddress === '127.0.0.1' && socket.remotePort
          ? [`${socket.remoteAddress}:${socket.remotePort}`]
          : [];
      }),
    ),
  };
}

async function expectBrowserCleanup(before: ReturnType<typeof activeBrowserHandles>) {
  await expect
    .poll(
      () => {
        const after = activeBrowserHandles();
        return {
          chromePids: [...after.chromePids].filter(pid => !before.chromePids.has(pid)).sort(),
          cdpSockets: [...after.cdpSockets].filter(socket => !before.cdpSockets.has(socket)).sort(),
        };
      },
      { timeout: TIMING.browserCleanupMs, interval: 20 },
    )
    .toEqual({ chromePids: [], cdpSockets: [] });
}

function fixtureTransport(state: {
  page: 'good' | 'authenticated' | 'loss';
  price: string;
  delayRender?: boolean;
  onRenderRequested?: () => void;
  onRenderAborted?: () => void;
}): PinnedTransport {
  return async ({ url, abortSignal }) => {
    if (url.pathname === '/robots.txt') {
      return { status: 200, headers: { 'content-type': 'text/plain' }, body: Buffer.from('User-agent: *\nAllow: /') };
    }
    if (url.pathname === '/render.js') {
      state.onRenderRequested?.();
      if (state.delayRender) {
        await new Promise<never>((_resolve, reject) => {
          const abort = () => {
            state.onRenderAborted?.();
            reject(new Error('ACQUISITION_CANCELED'));
          };
          if (abortSignal?.aborted) abort();
          else abortSignal?.addEventListener('abort', abort, { once: true });
        });
      }
      return {
        status: 200,
        headers: { 'content-type': 'application/javascript' },
        body: Buffer.from(
          `document.querySelector('#app').textContent = ${JSON.stringify(state.page === 'loss' ? lossText : pricingText(state.price))};`,
        ),
      };
    }
    const html =
      url.pathname === '/static'
        ? `<main><h1>Pricing</h1><p>${pricingText(state.price)}</p></main>`
        : url.pathname === '/short'
          ? '<main><h1>Notice</h1><p>This concise English notice remains a valid HTTP-only source.</p></main>'
          : url.pathname === '/shell'
            ? '<main><h1>Wait</h1><div id="app"></div><script src="/render.js"></script></main>'
            : state.page === 'authenticated'
              ? '<main><h1>Sign in</h1><form><input type="password"></form></main>'
              : '<main><h1>Pricing</h1><p id="app">Loading</p><script src="/render.js"></script></main>';
    return { status: 200, headers: { 'content-type': 'text/html' }, body: Buffer.from(html) };
  };
}

describe('bounded browser fallback', () => {
  it('static_http_and_rendered_fallback_share_evidence', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'competitor-monitor-browser-'));
    const config = loadConfig({
      MONITOR_DATABASE_URL: `file:${directory}/monitor.db`,
      MASTRA_DATABASE_URL: `file:${directory}/mastra.db`,
      MAX_SOURCES: '4',
    });
    const store = MonitorStore.open(config.storage.monitorUrl);
    stores.push(store);
    const state: { page: 'good' | 'authenticated' | 'loss'; price: string } = { page: 'good', price: '$19' };
    const workflow = createCompetitorMonitorWorkflow({
      store,
      config,
      resolver: publicDns,
      transport: fixtureTransport(state),
    });
    const frameworkStore = new LibSQLStore({ id: 'browser-fallback-framework', url: config.storage.mastraUrl });
    const mastra = new Mastra({ storage: frameworkStore, workflows: { competitorMonitor: workflow } });
    try {
      let run = await mastra.getWorkflow('competitorMonitor').createRun();
      const baseline = await run.start({
        inputData: {
          monitorId: 'browser-monitor',
          profile: { name: 'Browser monitor', interests: ['pricing'] },
          sources: [
            { id: 'static', label: 'Static pricing', url: 'https://public.example/static', kind: 'pricing' },
            { id: 'rendered', label: 'Rendered pricing', url: 'https://public.example/rendered', kind: 'pricing' },
            { id: 'shell', label: 'Rendered shell', url: 'https://public.example/shell', kind: 'pricing' },
            {
              id: 'short',
              label: 'Short notice',
              url: 'https://public.example/short',
              kind: 'other',
              fetchMode: 'http',
              minContentChars: 50,
            },
          ],
        } as any,
      });
      expect(baseline.status).toBe('success');
      state.price = '$29';
      run = await mastra.getWorkflow('competitorMonitor').createRun();
      const changed = await run.start({
        inputData: {
          monitorId: 'browser-monitor',
          profile: { name: 'Browser monitor', interests: ['pricing'] },
          sources: [
            { id: 'static', label: 'Static pricing', url: 'https://public.example/static', kind: 'pricing' },
            { id: 'rendered', label: 'Rendered pricing', url: 'https://public.example/rendered', kind: 'pricing' },
            { id: 'shell', label: 'Rendered shell', url: 'https://public.example/shell', kind: 'pricing' },
            {
              id: 'short',
              label: 'Short notice',
              url: 'https://public.example/short',
              kind: 'other',
              fetchMode: 'http',
              minContentChars: 50,
            },
          ],
        } as any,
      });
      expect(changed).toMatchObject({ status: 'success', result: { status: 'partial' } });
      const evidence = await store.pendingForRun((changed as { result: { runId: string } }).result.runId);
      expect(evidence).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            beforeText: expect.stringContaining('$19'),
            afterText: expect.stringContaining('$29'),
          }),
        ]),
      );
      const chromePath = process.env.CHROME_PATH;
      process.env.CHROME_PATH = '/usr/bin/false';
      try {
        run = await mastra.getWorkflow('competitorMonitor').createRun();
        const unavailable = await run.start({
          inputData: {
            monitorId: 'browser-monitor',
            profile: { name: 'Browser monitor', interests: ['pricing'] },
            sources: [
              { id: 'static', label: 'Static pricing', url: 'https://public.example/static', kind: 'pricing' },
              {
                id: 'unavailable',
                label: 'Browser pricing',
                url: 'https://public.example/unavailable',
                kind: 'pricing',
                fetchMode: 'browser',
              },
            ],
          } as any,
        });
        expect(unavailable).toMatchObject({
          status: 'success',
          result: {
            status: 'partial',
            sources: [
              { sourceId: 'static', status: 'changed' },
              { sourceId: 'unavailable', status: 'failed', error: { code: 'BROWSER_UNAVAILABLE' } },
            ],
          },
        });
      } finally {
        if (chromePath === undefined) delete process.env.CHROME_PATH;
        else process.env.CHROME_PATH = chromePath;
      }
    } finally {
      await frameworkStore.close();
    }
    expect((await store.baseline('browser-monitor', 'static'))?.acquisition).toMatchObject({
      mode: 'http',
      finalUrl: 'https://public.example/static',
      status: 200,
      retries: 0,
    });
    expect((await store.baseline('browser-monitor', 'short'))?.acquisition).toMatchObject({ mode: 'http' });
    expect(await store.baseline('browser-monitor', 'rendered')).toMatchObject({
      acquisition: { mode: 'browser', fallbackReason: 'client_render_placeholder', status: 200, retries: 0 },
      content: { text: expect.stringContaining('$29') },
    });
    expect(await store.baseline('browser-monitor', 'shell')).toMatchObject({
      acquisition: { mode: 'browser', fallbackReason: 'short_content' },
      content: { text: expect.stringContaining('$29') },
    });
  }, 45_000);

  it('browser_cleanup_and_quality_failure_preserve_baseline', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'competitor-monitor-browser-quality-'));
    const config = loadConfig({
      MONITOR_DATABASE_URL: `file:${directory}/monitor.db`,
      MASTRA_DATABASE_URL: `file:${directory}/mastra.db`,
    });
    const store = MonitorStore.open(config.storage.monitorUrl);
    stores.push(store);
    const state: {
      page: 'good' | 'authenticated' | 'loss';
      price: string;
      delayRender?: boolean;
      onRenderRequested?: () => void;
      onRenderAborted?: () => void;
    } = {
      page: 'good',
      price: '$19',
    };
    const sources = [
      {
        id: 'rendered',
        label: 'Rendered pricing',
        url: 'https://public.example/rendered',
        kind: 'pricing',
        fetchMode: 'browser',
      },
    ];
    const workflow = createCompetitorMonitorWorkflow({
      store,
      config,
      resolver: publicDns,
      transport: fixtureTransport(state),
    });
    const frameworkStore = new LibSQLStore({ id: 'browser-quality-framework', url: config.storage.mastraUrl });
    const mastra = new Mastra({ storage: frameworkStore, workflows: { competitorMonitor: workflow } });
    try {
      let run = await mastra.getWorkflow('competitorMonitor').createRun();
      expect(
        (
          await run.start({
            inputData: {
              monitorId: 'browser-monitor',
              profile: { name: 'Browser monitor', interests: ['pricing'] },
              sources,
            } as any,
          })
        ).status,
      ).toBe('success');
      const accepted = (await store.baseline('browser-monitor', 'rendered'))!;
      state.page = 'authenticated';
      run = await mastra.getWorkflow('competitorMonitor').createRun();
      const rejected = await run.start({
        inputData: {
          monitorId: 'browser-monitor',
          profile: { name: 'Browser monitor', interests: ['pricing'] },
          sources,
        } as any,
      });
      expect(rejected).toMatchObject({
        status: 'success',
        result: {
          status: 'failed',
          sources: [{ status: 'failed', error: { code: 'BLOCKED_OR_AUTHENTICATED_CONTENT' } }],
        },
      });
      expect((await store.baseline('browser-monitor', 'rendered'))?.id).toBe(accepted.id);
      state.page = 'good';
      state.delayRender = true;
      let timeoutTransportAborted!: () => void;
      const timeoutTransportAbort = new Promise<void>(resolve => (timeoutTransportAborted = resolve));
      state.onRenderAborted = timeoutTransportAborted;
      const beforeTimeout = activeBrowserHandles();
      const realSetTimeout = global.setTimeout;
      let triggerBrowserTimeout: (() => void) | undefined;
      const browserAttemptTimer = vi
        .spyOn(global, 'setTimeout')
        .mockImplementation((callback, delay, ...arguments_) => {
          if (delay === TIMING.browserAttemptMs && !triggerBrowserTimeout) {
            triggerBrowserTimeout = callback as () => void;
            return realSetTimeout(() => undefined, delay);
          }
          return realSetTimeout(callback, delay, ...arguments_);
        });
      state.onRenderRequested = () => triggerBrowserTimeout?.();
      let timedOut: unknown;
      try {
        run = await mastra.getWorkflow('competitorMonitor').createRun();
        timedOut = await run.start({
          inputData: {
            monitorId: 'browser-monitor',
            profile: { name: 'Browser monitor', interests: ['pricing'] },
            sources,
          } as any,
        });
      } finally {
        browserAttemptTimer.mockRestore();
        state.onRenderRequested = undefined;
      }
      expect(timedOut).toMatchObject({
        status: 'success',
        result: { sources: [{ status: 'failed', error: { code: 'BROWSER_TIMEOUT' } }] },
      });
      await timeoutTransportAbort;
      await expectBrowserCleanup(beforeTimeout);
      expect((await store.baseline('browser-monitor', 'rendered'))?.id).toBe(accepted.id);
      let renderStarted!: () => void;
      const rendering = new Promise<void>(resolve => (renderStarted = resolve));
      let canceledTransportAborted!: () => void;
      const canceledTransportAbort = new Promise<void>(resolve => (canceledTransportAborted = resolve));
      state.page = 'good';
      state.delayRender = true;
      state.onRenderRequested = renderStarted;
      state.onRenderAborted = canceledTransportAborted;
      const beforeCancellation = activeBrowserHandles();
      run = await mastra.getWorkflow('competitorMonitor').createRun();
      const canceled = run.start({
        inputData: {
          monitorId: 'browser-monitor',
          profile: { name: 'Browser monitor', interests: ['pricing'] },
          sources,
        } as any,
      });
      await rendering;
      await run.cancel();
      expect((await canceled).status).toBe('canceled');
      await canceledTransportAbort;
      await expectBrowserCleanup(beforeCancellation);
      expect((await store.baseline('browser-monitor', 'rendered'))?.id).toBe(accepted.id);
      state.delayRender = false;
      state.onRenderRequested = undefined;
      state.onRenderAborted = undefined;
      run = await mastra.getWorkflow('competitorMonitor').createRun();
      expect(
        await run.start({
          inputData: {
            monitorId: 'browser-monitor',
            profile: { name: 'Browser monitor', interests: ['pricing'] },
            sources,
          } as any,
        }),
      ).toMatchObject({ status: 'success' });
      state.page = 'loss';
      run = await mastra.getWorkflow('competitorMonitor').createRun();
      const quarantined = await run.start({
        inputData: {
          monitorId: 'browser-monitor',
          profile: { name: 'Browser monitor', interests: ['pricing'] },
          sources,
        } as any,
      });
      expect(quarantined).toMatchObject({
        status: 'success',
        result: { sources: [{ status: 'failed', error: { code: 'CONTENT_LOSS_QUARANTINED' } }] },
      });
      expect((await store.baseline('browser-monitor', 'rendered'))?.id).toBe(accepted.id);
      const quarantinedOutcome = await store.client.execute({
        sql: 'SELECT status, detail_json FROM source_outcomes WHERE run_id = ? AND source_id = ?',
        args: [(quarantined as { result: { runId: string } }).result.runId, 'rendered'],
      });
      expect(quarantinedOutcome.rows[0]).toMatchObject({ status: 'quarantined' });
      expect(JSON.parse(String(quarantinedOutcome.rows[0]?.detail_json))).toMatchObject({
        code: 'CONTENT_LOSS_QUARANTINED',
      });
    } finally {
      await frameworkStore.close();
    }
  }, 45_000);
});
