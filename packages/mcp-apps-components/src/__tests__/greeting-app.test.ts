// The built package, as consumers install it.
import { greetingApp } from '@mastra/mcp-apps-components';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { GREETING_URI, greetingServer, serveAndConnect } from './greeting-server';

let host: Awaited<ReturnType<typeof serveAndConnect>>;
beforeAll(async () => {
  host = await serveAndConnect(greetingServer({ [GREETING_URI]: greetingApp }));
});
afterAll(() => host.close());

// Hosts load an app's HTML into a sandboxed iframe that can't fetch sibling files.
it('serves the greeting app as one self-contained page', async () => {
  const { contents } = await host.client.readResource({ uri: GREETING_URI });
  const [page] = contents;
  const html = page && 'text' in page ? page.text : '';

  expect(page?.mimeType).toBe('text/html;profile=mcp-app');
  expect(html).toContain('<div id="root"></div>');
  expect(html).toMatch(/<script type="module"[^>]*>\S/);
  expect(html).not.toMatch(/<script[^>]*\ssrc=/);
  expect(html).not.toMatch(/<link[^>]*rel="stylesheet"/);
});
