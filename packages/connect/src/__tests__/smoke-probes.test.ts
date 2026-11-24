import { once } from 'node:events';
import { createServer } from 'node:http';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { executeScenario, runSmokeTests } from '../../scripts/smoke-test/runner.js';
import { probeTool, toolsForProvider } from '../../scripts/smoke-test/scenario.js';
import type { ResolvedToolset } from '../../scripts/smoke-test/scenario.js';

import { tools } from '../tools.js';

// The smoke runner and the Google Analytics scenario run against a real HTTP
// server standing in for the Mastra platform. A probe's 4xx only proves a tool
// works when the provider sent it: these check that a platform refusal (an
// RFC-7807 problem body from the proxy) fails the step, that a provider
// rejection passes it, and that every Google Analytics call clears its tool's
// input schema and reaches the proxy.

const connection = {
  id: 'ga_test',
  integrationId: 'google-analytics',
  status: 'active',
  connectedByUserId: 'user_1',
  connectedAt: '2026-01-01T00:00:00Z',
  createdAt: '2026-01-01T00:00:00Z',
  accountLabel: 'test',
  displayName: null,
  resourceId: null,
};

const integration = {
  id: 'google-analytics',
  provider: 'google-analytics',
  displayName: 'Google Analytics',
  logoUrl: '',
  authType: 'OAUTH2',
  authFields: [],
  capabilities: { proxy: true, webhooks: false, mcp: false },
  surfaces: ['tools'],
  comingSoon: false,
  minConnectVersion: null,
};

const PROXY_PREFIX = `/v2/connections/${connection.id}/proxy`;

type Answer = { status: number; contentType: string; body: unknown };

const platformRefusal: Answer = {
  status: 400,
  contentType: 'application/problem+json',
  body: {
    type: 'https://mastra.ai/problems/bad-request',
    title: 'Bad Request',
    status: 400,
    detail: 'Proxy base URL override is not allowed for this connection',
  },
};

const universalMetadata: Answer = {
  status: 200,
  contentType: 'application/json',
  body: {
    name: 'properties/0/metadata',
    dimensions: [{ apiName: 'date', uiName: 'Date', description: 'The date of the event.', category: 'Time' }],
    metrics: [
      {
        apiName: 'activeUsers',
        uiName: 'Active users',
        description: 'Distinct users.',
        type: 'TYPE_INTEGER',
        category: 'User',
      },
    ],
  },
};

const METADATA_TARGET = '/v1beta/properties/0/metadata';

const providerRejection: Answer = {
  status: 404,
  contentType: 'application/json',
  body: { error: { code: 404, message: 'Requested entity was not found.', status: 'NOT_FOUND' } },
};

describe('smoke probes', () => {
  let server: Server;
  let baseUrl: string;
  let answer: Answer;
  // Answers for specific proxied targets; everything else gets `answer`.
  let answers: Map<string, Answer>;
  let requests: Array<{ method: string | undefined; target: string; body: string }>;
  let projects = 0;

  beforeAll(async () => {
    server = createServer((request, response) => {
      const target = request.url ?? '/';
      let body = '';
      request.on('data', chunk => (body += chunk));
      request.on('end', () => {
        const send = (status: number, payload: unknown, contentType = 'application/json') => {
          response.writeHead(status, { 'content-type': contentType });
          response.end(JSON.stringify(payload));
        };
        if (target.endsWith('/connections')) return send(200, { connections: [connection] });
        if (target.endsWith('/integrations')) return send(200, { integrations: [integration] });
        if (!target.startsWith(PROXY_PREFIX)) return send(404, { error: `unexpected request ${target}` });
        requests.push({ method: request.method, target: target.slice(PROXY_PREFIX.length), body });
        const reply = answers.get(target.slice(PROXY_PREFIX.length)) ?? answer;
        send(reply.status, reply.body, reply.contentType);
      });
    });
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    vi.unstubAllEnvs();
    server.close();
    await once(server, 'close');
  });

  beforeEach(() => {
    requests = [];
    answers = new Map();
    vi.stubEnv('MASTRA_INTEGRATIONS_API_URL', baseUrl);
    vi.stubEnv('MASTRA_SMOKE_GA_PROPERTY_ID', undefined);
    vi.stubEnv('MASTRA_GOOGLE_ANALYTICS_CONNECTION_ID', undefined);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  async function runGoogleAnalyticsScenario() {
    const result = await runSmokeTests({
      providers: ['google-analytics'],
      projectId: `proj_${++projects}`,
      accessToken: 'test-platform-token',
    });
    return result.outcomes[0]!;
  }

  describe('Google Analytics scenario', () => {
    it('passes each tool when metadata reads and Google rejects the synthetic ids', async () => {
      answer = providerRejection;
      answers.set(METADATA_TARGET, universalMetadata);

      const outcome = await runGoogleAnalyticsScenario();

      expect(outcome.steps.filter(step => step.status !== 'pass')).toEqual([]);
      expect(outcome.status).toBe('pass');
      // A step that failed its tool's input schema never reaches the proxy.
      expect(requests).toHaveLength(11);
    });

    it('sends get_metadata and create_data_stream the inputs their tools take', async () => {
      answer = providerRejection;

      await runGoogleAnalyticsScenario();

      expect(requests).toContainEqual(expect.objectContaining({ method: 'GET', target: METADATA_TARGET }));
      const dataStream = requests.find(request => request.target === '/v1beta/properties/0/dataStreams');
      expect(dataStream?.method).toBe('POST');
      expect(JSON.parse(dataStream!.body)).toMatchObject({
        displayName: expect.stringMatching(/^smoke /),
        type: 'WEB_DATA_STREAM',
        webStreamData: { defaultUri: 'https://example.com' },
      });
    });

    it('sends every report to the property it names', async () => {
      answer = providerRejection;

      await runGoogleAnalyticsScenario();

      const reports = requests.filter(request => request.target.includes(':'));
      expect(reports.map(request => `${request.method} ${request.target}`).sort()).toEqual([
        'POST /v1beta/properties/0:batchRunReports',
        'POST /v1beta/properties/0:runPivotReport',
        'POST /v1beta/properties/0:runRealtimeReport',
        'POST /v1beta/properties/0:runReport',
      ]);
    });

    it('fails the universal metadata read when Google rejects it', async () => {
      answer = providerRejection;

      const outcome = await runGoogleAnalyticsScenario();

      expect(outcome.status).toBe('fail');
      expect(outcome.steps.filter(step => step.status === 'fail').map(step => step.toolId)).toEqual([
        'google_analytics_get_metadata',
      ]);
    });

    it('fails each tool when the platform refuses the call', async () => {
      answer = platformRefusal;

      const outcome = await runGoogleAnalyticsScenario();

      expect(outcome.status).toBe('fail');
      expect(outcome.steps).toHaveLength(11);
      for (const step of outcome.steps) {
        expect(step.status, step.name).toBe('fail');
        expect(step.detail).toContain('Proxy base URL override is not allowed');
      }
    });
  });

  describe('probeTool', () => {
    async function probe() {
      const resolved = (await tools({
        projectId: `proj_${++projects}`,
        client: { accessToken: 'test-platform-token', baseUrl },
      })()) as unknown as ResolvedToolset;
      const providerTools = toolsForProvider(resolved, 'google-analytics');
      const outcome = await executeScenario(
        {
          integrationId: 'google-analytics',
          summary: 'probe',
          run: async ({ call, tools: available }) => [
            await probeTool(call, available, 'get metadata', 'google_analytics_get_metadata', { propertyId: '0' }),
          ],
        },
        providerTools,
        resolved,
        'run_test',
      );
      expect(requests).toHaveLength(1);
      return outcome.steps[0]!;
    }

    it('passes on a provider rejection', async () => {
      answer = providerRejection;

      expect((await probe()).status).toBe('pass');
    });

    it('fails on a platform refusal', async () => {
      answer = platformRefusal;

      const step = await probe();

      expect(step.status).toBe('fail');
      expect(step.detail).toContain('source=platform');
    });
  });
});
