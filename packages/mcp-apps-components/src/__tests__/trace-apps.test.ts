// The built package, as consumers (and `@mastra/server`) install it.
import { traceListApp } from '@mastra/mcp-apps-components/trace-list';
import { traceViewerApp } from '@mastra/mcp-apps-components/trace-viewer';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { serveAndConnect } from './greeting-server';
import { TRACE_LIST_URI } from './trace-list-server';
import { TRACE_VIEWER_URI, traceServer } from './trace-server';

let host: Awaited<ReturnType<typeof serveAndConnect>>;
beforeAll(async () => {
  host = await serveAndConnect(
    traceServer({ appResources: { [TRACE_VIEWER_URI]: traceViewerApp, [TRACE_LIST_URI]: traceListApp } }).server,
  );
});
afterAll(() => host.close());

// Hosts load an app's HTML into a sandboxed iframe that can't fetch sibling files.
describe.each([
  ['trace viewer', TRACE_VIEWER_URI],
  ['trace list', TRACE_LIST_URI],
])('the %s', (_name, uri) => {
  it('is served, styles included, as one self-contained page', async () => {
    const { contents } = await host.client.readResource({ uri });
    const [page] = contents;
    const html = page && 'text' in page ? page.text : '';

    expect(page?.mimeType).toBe('text/html;profile=mcp-app');
    expect(html).toContain('<div id="root"></div>');
    expect(html).toMatch(/<script type="module"[^>]*>\S/);
    expect(html).toMatch(/<style[^>]*>\S/);
    expect(html).not.toMatch(/<script[^>]*\ssrc=/);
    expect(html).not.toMatch(/<link[^>]*rel="stylesheet"/);
    // Studio's chat and prettier are swapped for light stand-ins in apps (see scripts/build-apps.ts).
    expect(html.length).toBeLessThan(4_500_000);
  });
});

it('links get_trace to the trace viewer', async () => {
  const { tools } = await host.client.listTools();
  expect(tools.find(tool => tool.name === 'get_trace')?._meta).toMatchObject({ ui: { resourceUri: TRACE_VIEWER_URI } });
});
