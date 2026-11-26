import { once } from 'node:events';
import { createServer } from 'node:http';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import { RequestContext } from '@mastra/core/request-context';
import { isValidationError } from '@mastra/core/tools';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { tools } from '../tools.js';

// The generated Anthropic cancel tool runs through the public `tools()`
// resolver against a real HTTP server standing in for the Mastra platform;
// only Anthropic's answer is scripted, in the shape a live cancel returns.

const connection = {
  id: 'an_test',
  integrationId: 'anthropic',
  status: 'active',
  connectedByUserId: 'user_1',
  connectedAt: '2026-01-01T00:00:00Z',
  createdAt: '2026-01-01T00:00:00Z',
  accountLabel: 'test',
  displayName: null,
  resourceId: null,
};

const integration = {
  id: 'anthropic',
  provider: 'anthropic',
  displayName: 'Anthropic',
  logoUrl: '',
  authType: 'API_KEY',
  authFields: [],
  capabilities: { proxy: true, webhooks: false, mcp: false },
  surfaces: ['tools'],
  comingSoon: false,
  minConnectVersion: null,
};

const PROXY_PREFIX = `/v2/connections/${connection.id}/proxy`;

describe('generated Anthropic tools', () => {
  let server: Server;
  let baseUrl: string;
  const requests: Array<{ method: string | undefined; target: string }> = [];

  beforeAll(async () => {
    server = createServer((request, response) => {
      const target = request.url ?? '/';
      const send = (status: number, body: unknown) => {
        response.writeHead(status, { 'content-type': 'application/json' });
        response.end(JSON.stringify(body));
      };
      if (target.endsWith('/connections')) return send(200, { connections: [connection] });
      if (target.endsWith('/integrations')) return send(200, { integrations: [integration] });
      if (!target.startsWith(PROXY_PREFIX)) return send(404, { error: `unexpected request ${target}` });
      requests.push({ method: request.method, target: target.slice(PROXY_PREFIX.length) });
      send(200, {
        id: 'msgbatch_1',
        type: 'message_batch',
        processing_status: 'canceling',
        request_counts: { processing: 1, succeeded: 0, errored: 0, canceled: 0, expired: 0 },
        created_at: '2026-11-23T15:00:00Z',
        expires_at: '2026-11-24T15:00:00Z',
        cancel_initiated_at: '2026-11-23T15:00:01Z',
        ended_at: null,
        archived_at: null,
        results_url: null,
      });
    });
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    server.close();
    await once(server, 'close');
  });

  it('accepts a cancel answer that has no end time, archive time, or results yet', async () => {
    const resolved = await tools({
      providers: { anthropic: { connectionId: connection.id } },
      allowTools: ['anthropic_cancel_message_batch'],
      projectId: 'proj_test',
      client: { accessToken: 'test-platform-token', baseUrl },
    })();
    const tool = resolved['anthropic_cancel_message_batch'] as unknown as {
      execute: (input: unknown, context: { requestContext: RequestContext }) => Promise<unknown>;
    };

    const result = await tool.execute({ message_batch_id: 'msgbatch_1' }, { requestContext: new RequestContext() });

    expect(isValidationError(result)).toBe(false);
    expect(requests).toEqual([{ method: 'POST', target: '/v1/messages/batches/msgbatch_1/cancel' }]);
    expect(result).toEqual({
      id: 'msgbatch_1',
      type: 'message_batch',
      processing_status: 'canceling',
      request_counts: { processing: 1, succeeded: 0, errored: 0, canceled: 0, expired: 0 },
      created_at: '2026-11-23T15:00:00Z',
      expires_at: '2026-11-24T15:00:00Z',
      cancel_initiated_at: '2026-11-23T15:00:01Z',
    });
  });
});
