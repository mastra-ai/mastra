// @vitest-environment jsdom
import { MastraClient } from '@mastra/client-js';
import { InMemoryTransport } from '@modelcontextprotocol/client';
import { App } from '@modelcontextprotocol/ext-apps';
import { AppBridge } from '@modelcontextprotocol/ext-apps/app-bridge';
import { afterEach, describe, expect, it } from 'vitest';
import { dashboardContract } from '../../apps/dashboard-renderer/contract';
import { defineMcpAppUi } from '../../define-mcp-app-ui';
import type { McpAppUi } from '../../define-mcp-app-ui';
import type { McpAppDataOutput } from '../../reads';
import { createMcpAppDataFetch } from '../data-fetch';

type UiContract = Pick<McpAppUi, 'name' | 'dataTool' | 'reads'>;

// A UI that reads one trace by its ID, to cover routes with parameters.
const traceUi = defineMcpAppUi({
  uri: 'ui://test/trace',
  name: 'Trace viewer',
  description: 'Shows one trace',
  html: '',
  dataTool: 'traceData',
  input: dashboardContract.input,
  reads: { getTrace: 'GET /observability/traces/:traceId' },
});

const closers: Array<() => Promise<void>> = [];

afterEach(async () => {
  await Promise.all(closers.splice(0).map(close => close()));
});

/** A MastraClient inside an app whose host answers every tool call with `answer`. */
async function clientBehindHost(
  answer: McpAppDataOutput,
  { ui = dashboardContract, projectId }: { ui?: UiContract; projectId?: string } = {},
) {
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
    fetch: createMcpAppDataFetch(app, { ui, projectId }),
  });
  return { client, calls, app };
}

describe('createMcpAppDataFetch', () => {
  describe('when MastraClient posts a read', () => {
    it('sends the read and its body to the data tool and answers with the body', async () => {
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
          name: dashboardContract.dataTool,
          arguments: {
            read: 'getMetricAggregate',
            body: {
              ...args,
              filters: { timestamp: { start: '2026-11-01T00:00:00.000Z', end: '2026-11-02T00:00:00.000Z' } },
            },
          },
        },
      ]);
    });
  });

  describe('when MastraClient lists scores', () => {
    it('sends the query parameters with the read', async () => {
      const scores = { pagination: { total: 0, page: 0, perPage: 100, hasMore: false }, scores: [] };
      const { client, calls } = await clientBehindHost({ status: 200, body: scores });

      const response = await client.listScores({ pagination: { page: 0, perPage: 100 } });

      expect(response).toEqual(scores);
      expect(calls).toEqual([
        {
          name: dashboardContract.dataTool,
          arguments: { read: 'listScores', query: { page: '0', perPage: '100' } },
        },
      ]);
    });
  });

  describe("when the app knows the dashboard's project", () => {
    it('sends the project with every read, posted or listed', async () => {
      const { client, calls } = await clientBehindHost({ status: 200, body: {} }, { projectId: 'proj_1' });

      await client.getMetricAggregate({ name: ['mastra_agent_duration_ms'], aggregation: 'count' });
      await client.listScores({ pagination: { page: 0, perPage: 100 } });

      expect(calls.map(call => call.arguments)).toEqual([
        expect.objectContaining({ read: 'getMetricAggregate', projectId: 'proj_1' }),
        expect.objectContaining({ read: 'listScores', projectId: 'proj_1' }),
      ]);
    });
  });

  describe('when the UI reads a route with a parameter', () => {
    it('sends the decoded parameter with the read', async () => {
      const trace = { traceId: 'trace-1', spans: [] };
      const { client, calls } = await clientBehindHost({ status: 200, body: trace }, { ui: traceUi });

      expect(await client.getTrace('trace-1')).toEqual(trace);
      expect(calls).toEqual([{ name: 'traceData', arguments: { read: 'getTrace', params: { traceId: 'trace-1' } } }]);
    });

    it('decodes an encoded slash instead of reading another path', async () => {
      const { app, calls } = await clientBehindHost({ status: 200, body: {} }, { ui: traceUi });

      const response = await createMcpAppDataFetch(app, { ui: traceUi })(
        'http://mastra.test/observability/traces/a%2Fb',
      );

      expect(response.status).toBe(200);
      expect(calls).toEqual([{ name: 'traceData', arguments: { read: 'getTrace', params: { traceId: 'a/b' } } }]);
    });

    it('fails a malformed encoding with 404 without calling the server', async () => {
      const { app, calls } = await clientBehindHost({ status: 200, body: {} }, { ui: traceUi });

      const response = await createMcpAppDataFetch(app, { ui: traceUi })(
        'http://mastra.test/observability/traces/%E0%A4%A',
      );

      expect(response.status).toBe(404);
      expect(calls).toEqual([]);
    });
  });

  describe('when MastraClient makes a request the dashboard does not read', () => {
    it('fails it with 404 without calling the server', async () => {
      const { client, calls } = await clientBehindHost({ status: 200, body: {} });

      await expect(client.listAgents()).rejects.toThrow(/404/);
      expect(calls).toEqual([]);
    });
  });

  describe('when a read is posted without a JSON object body', () => {
    it('fails it with 400 without calling the server', async () => {
      const { calls, app } = await clientBehindHost({ status: 200, body: {} });

      const response = await createMcpAppDataFetch(app, { ui: dashboardContract })(
        'http://mastra.test/observability/metrics/aggregate',
        {
          method: 'POST',
          body: 'not json',
        },
      );

      expect(response.status).toBe(400);
      expect(calls).toEqual([]);
    });
  });

  describe('when the server refuses the read', () => {
    it("fails the client's request with the server's status", async () => {
      const { client } = await clientBehindHost({ status: 403, body: { error: 'Forbidden' } });

      await expect(client.listScores()).rejects.toThrow(/403/);
    });
  });

  describe('when the tool answers with a status no response can carry a body with', () => {
    it.each([0, 101, 204, 205, 304, 600])('fails the request with 502 instead of throwing on %i', async status => {
      const { app } = await clientBehindHost({ status, body: {} });

      const response = await createMcpAppDataFetch(app, { ui: dashboardContract })(
        'http://mastra.test/observability/scores',
      );

      expect(response.status).toBe(502);
    });
  });
});
