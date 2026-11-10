// The built package, as consumers (and `@mastra/server`) install it.
import { traceViewerApp } from '@mastra/mcp-apps-components/trace-viewer';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { serveAndConnect } from './greeting-server';
import { TRACE_VIEWER_URI, traceServer } from './trace-server';

let host: Awaited<ReturnType<typeof serveAndConnect>>;
beforeAll(async () => {
  host = await serveAndConnect(traceServer({ appResources: { [TRACE_VIEWER_URI]: traceViewerApp } }).server);
});
afterAll(() => host.close());

// Hosts load an app's HTML into a sandboxed iframe that can't fetch sibling files.
it('serves the trace viewer, styles included, as one self-contained page', async () => {
  const { contents } = await host.client.readResource({ uri: TRACE_VIEWER_URI });
  const [page] = contents;
  const html = page && 'text' in page ? page.text : '';

  expect(page?.mimeType).toBe('text/html;profile=mcp-app');
  expect(html).toContain('<div id="root"></div>');
  expect(html).toMatch(/<script type="module"[^>]*>\S/);
  expect(html).toMatch(/<style[^>]*>\S/);
  expect(html).not.toMatch(/<script[^>]*\ssrc=/);
  expect(html).not.toMatch(/<link[^>]*rel="stylesheet"/);
  // Studio's chat and prettier are swapped for light stand-ins in apps (see scripts/build-apps.ts).
  expect(html.length).toBeLessThan(3_500_000);
});

it('links get_trace to the trace viewer', async () => {
  const { tools } = await host.client.listTools();
  expect(tools.find(tool => tool.name === 'get_trace')?._meta).toMatchObject({ ui: { resourceUri: TRACE_VIEWER_URI } });
});
