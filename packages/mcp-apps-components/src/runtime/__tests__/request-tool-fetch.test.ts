// @vitest-environment jsdom
import { MastraClient } from '@mastra/client-js';
import { InMemoryTransport } from '@modelcontextprotocol/client';
import { App } from '@modelcontextprotocol/ext-apps';
import { AppBridge } from '@modelcontextprotocol/ext-apps/app-bridge';
import { afterEach, describe, expect, it } from 'vitest';
import { REQUEST_TOOL_NAME } from '../../request-tool';
import type { RequestToolOutput } from '../../request-tool';
import { createRequestToolFetch } from '../request-tool-fetch';

const closers: Array<() => Promise<void>> = [];

afterEach(async () => {
  await Promise.all(closers.splice(0).map(close => close()));
});

/** A MastraClient inside an app whose host answers every tool call with `answer`. */
async function clientBehindHost(answer: RequestToolOutput) {
  const [appTransport, hostTransport] = InMemoryTransport.createLinkedPair();
  const bridge = new AppBridge(null, { name: 'test-host', version: '1.0.0' }, { serverTools: {} });
  const calls: Array<{ name: string; arguments?: Record<string, unknown> }> = [];
  bridge.oncalltool = async ({ name, arguments: args }) => {
    calls.push({ name, arguments: args });
    return { content: [{ type: 'text', text: JSON.stringify(answer) }], structuredContent: answer };
  };
  const app = new App({ name: 'test-app', version: '1.0.0' });
  closers.push(
    () => app.close(),
    () => bridge.close(),
  );
  await bridge.connect(hostTransport);
  await app.connect(appTransport);

  const client = new MastraClient({
    baseUrl: 'http://mastra.test',
    apiPrefix: '',
    retries: 0,
    fetch: createRequestToolFetch(app),
  });
  return { client, calls };
}

describe('createRequestToolFetch', () => {
  describe('when MastraClient makes a GET request', () => {
    it('sends its method, path and query to the request tool and answers with the body', async () => {
      const scores = { pagination: { total: 0, page: 0, perPage: 100, hasMore: false }, scores: [] };
      const { client, calls } = await clientBehindHost({ status: 200, body: scores });

      const response = await client.listScores({ pagination: { page: 0, perPage: 100 } });

      expect(response).toEqual(scores);
      expect(calls).toEqual([
        {
          name: REQUEST_TOOL_NAME,
          arguments: { method: 'GET', path: '/observability/scores', query: { page: '0', perPage: '100' } },
        },
      ]);
    });
  });

  describe('when the server refuses the route', () => {
    it("fails the client's request with the route's status", async () => {
      const { client } = await clientBehindHost({ status: 404, body: { error: 'Not available to MCP Apps' } });

      await expect(client.listScores()).rejects.toThrow(/404/);
    });
  });
});
