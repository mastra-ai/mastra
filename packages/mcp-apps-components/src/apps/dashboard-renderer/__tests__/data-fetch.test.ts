// @vitest-environment jsdom
import { MastraClient } from '@mastra/client-js';
import { InMemoryTransport } from '@modelcontextprotocol/client';
import { App } from '@modelcontextprotocol/ext-apps';
import { AppBridge } from '@modelcontextprotocol/ext-apps/app-bridge';
import { afterEach, describe, expect, it } from 'vitest';
import { DASHBOARD_DATA_TOOL_NAME } from '../data';
import type { DashboardDataOutput } from '../data';
import { createDashboardDataFetch } from '../data-fetch';

const closers: Array<() => Promise<void>> = [];

afterEach(async () => {
  await Promise.all(closers.splice(0).map(close => close()));
});

/** A MastraClient inside an app whose host answers every tool call with `answer`. */
async function clientBehindHost(answer: DashboardDataOutput) {
  const [appTransport, hostTransport] = InMemoryTransport.createLinkedPair();
  const bridge = new AppBridge(null, { name: 'test-host', version: '1.0.0' }, { serverTools: {} });
  const calls: Array<{ name: string; arguments?: Record<string, unknown> }> = [];
  bridge.oncalltool = async ({ name, arguments: args }) => {
    calls.push({ name, arguments: args });
    return { content: [{ type: 'text', text: JSON.stringify(answer) }], structuredContent: answer };
  };
  // Without auto-resize, no size report fires after the connection closes.
  const app = new App({ name: 'test-app', version: '1.0.0' }, {}, { autoResize: false });
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
    fetch: createDashboardDataFetch(app),
  });
  return { client, calls };
}

describe('createDashboardDataFetch', () => {
  describe('when MastraClient posts a read', () => {
    it('sends the operation and its body to the data tool and answers with the body', async () => {
      const aggregate = { value: 3 };
      const { client, calls } = await clientBehindHost({ status: 200, body: aggregate });
      const args = {
        name: ['mastra_agent_duration_ms'],
        aggregation: 'count' as const,
        filters: {
          timestamp: { start: new Date('2026-11-01T00:00:00.000Z'), end: new Date('2026-11-02T00:00:00.000Z') },
        },
      };

      const response = await client.getMetricAggregate(args);

      expect(response).toEqual(aggregate);
      expect(calls).toEqual([
        {
          name: DASHBOARD_DATA_TOOL_NAME,
          arguments: {
            operation: 'getMetricAggregate',
            args: {
              ...args,
              filters: { timestamp: { start: '2026-11-01T00:00:00.000Z', end: '2026-11-02T00:00:00.000Z' } },
            },
          },
        },
      ]);
    });
  });

  describe('when MastraClient lists scores', () => {
    it('sends the query parameters as the operation arguments', async () => {
      const scores = { pagination: { total: 0, page: 0, perPage: 100, hasMore: false }, scores: [] };
      const { client, calls } = await clientBehindHost({ status: 200, body: scores });

      const response = await client.listScores({ pagination: { page: 0, perPage: 100 } });

      expect(response).toEqual(scores);
      expect(calls).toEqual([
        { name: DASHBOARD_DATA_TOOL_NAME, arguments: { operation: 'listScores', args: { page: '0', perPage: '100' } } },
      ]);
    });
  });

  describe('when MastraClient makes a request the dashboard does not read', () => {
    it('fails it with 404 without calling the server', async () => {
      const { client, calls } = await clientBehindHost({ status: 200, body: {} });

      await expect(client.listAgents()).rejects.toThrow(/404/);
      expect(calls).toEqual([]);
    });
  });

  describe('when the server refuses the read', () => {
    it("fails the client's request with the server's status", async () => {
      const { client } = await clientBehindHost({ status: 403, body: { error: 'Forbidden' } });

      await expect(client.listScores()).rejects.toThrow(/403/);
    });
  });
});
