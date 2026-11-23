import { once } from 'node:events';
import { createServer } from 'node:http';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { runSmokeTests } from '../../scripts/smoke-test/runner.js';

// The Zendesk smoke scenario runs against a real HTTP server standing in for
// the Mastra platform. A new Zendesk ticket emails every agent through the
// account's default triggers, so these check that the scenario only creates a
// real ticket when MASTRA_SMOKE_ZENDESK_ALLOW_TICKETS says notifications are
// off, and that it reports the article it leaves in the Help Center archive.

const connection = {
  id: 'zendesk_test',
  integrationId: 'zendesk',
  status: 'active',
  connectedByUserId: 'user_1',
  connectedAt: '2026-01-01T00:00:00Z',
  createdAt: '2026-01-01T00:00:00Z',
  accountLabel: 'test',
  displayName: null,
  resourceId: null,
};

const integration = {
  id: 'zendesk',
  provider: 'zendesk',
  displayName: 'Zendesk',
  logoUrl: '',
  authType: 'OAUTH2',
  authFields: [],
  capabilities: { proxy: true, webhooks: false, mcp: false },
  surfaces: ['tools'],
  comingSoon: false,
  minConnectVersion: null,
};

const PROXY_PREFIX = `/v2/connections/${connection.id}/proxy`;

type Answer = { status: number; body?: unknown; problem?: boolean };

/** Set when the Platform proxy, not Zendesk, should refuse the blank ticket. */
let platformRefusesTicket = false;

const IDS: Record<string, number> = { ticket: 55, category: 66, section: 77, article: 901, user: 88, organization: 99 };

/**
 * Answers just enough of Zendesk for the scenario's creates to succeed: each
 * create echoes what it was sent back with an id and the fields Zendesk adds.
 */
function answer(method: string | undefined, target: string, body: string): Answer {
  const path = target.split('?')[0]!.replace(/\.json$/, '');
  if (method === 'GET' && path === '/api/v2/guide/permission_groups') {
    return { status: 200, body: { permission_groups: [{ id: 5, name: 'Admins' }], meta: { has_more: false } } };
  }
  if (method === 'DELETE') return { status: 204 };
  if (method !== 'POST') return { status: 404, body: { error: 'RecordNotFound', description: 'Not found' } };

  const [key, sent] = Object.entries(JSON.parse(body) as Record<string, Record<string, unknown>>)[0]!;
  if (key === 'ticket' && !sent.subject) {
    return platformRefusesTicket
      ? {
          status: 422,
          problem: true,
          body: { type: 'about:blank', title: 'Unprocessable', detail: 'proxy refused the request' },
        }
      : { status: 422, body: { error: 'RecordInvalid' } };
  }
  const id = IDS[key]!;
  return {
    status: 201,
    body: {
      [key]: {
        ...(key === 'ticket' && {
          description: null,
          type: null,
          requester_id: IDS.user,
          submitter_id: IDS.user,
          assignee_id: null,
          organization_id: null,
          group_id: null,
        }),
        ...sent,
        id,
        comment: undefined,
        category_id: IDS.category,
        section_id: IDS.section,
        status: 'new',
        url: `https://example.zendesk.com/api/v2/${key}s/${id}.json`,
        html_url: `https://example.zendesk.com/hc/${key}s/${id}`,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
    },
  };
}

describe('Zendesk smoke scenario', () => {
  let server: Server;
  let baseUrl: string;
  let requests: Array<{ method: string | undefined; target: string; body: string }>;
  let warnings: string[];
  let errors: string[];
  let projects = 0;

  beforeAll(async () => {
    server = createServer((request, response) => {
      const target = request.url ?? '/';
      let body = '';
      request.on('data', chunk => (body += chunk));
      request.on('end', () => {
        const send = ({ status, body: payload, problem }: Answer) => {
          response.writeHead(status, { 'content-type': problem ? 'application/problem+json' : 'application/json' });
          response.end(payload === undefined ? '' : JSON.stringify(payload));
        };
        if (target.endsWith('/connections')) return send({ status: 200, body: { connections: [connection] } });
        if (target.endsWith('/integrations')) return send({ status: 200, body: { integrations: [integration] } });
        if (!target.startsWith(PROXY_PREFIX)) return send({ status: 404, body: { error: `unexpected ${target}` } });
        const proxied = target.slice(PROXY_PREFIX.length);
        requests.push({ method: request.method, target: proxied, body });
        send(answer(request.method, proxied, body));
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
    warnings = [];
    errors = [];
    platformRefusesTicket = false;
    vi.stubEnv('MASTRA_INTEGRATIONS_API_URL', baseUrl);
    vi.stubEnv('MASTRA_SMOKE_ZENDESK_LOCALE', undefined);
    vi.stubEnv('MASTRA_SMOKE_ZENDESK_ALLOW_TICKETS', undefined);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
      errors.push(args.map(String).join(' '));
    });
    vi.spyOn(console, 'warn').mockImplementation((...args: unknown[]) => {
      warnings.push(args.map(String).join(' '));
    });
  });

  async function runScenario() {
    const result = await runSmokeTests({
      providers: ['zendesk'],
      projectId: `proj_${++projects}`,
      accessToken: 'test-platform-token',
    });
    return result.outcomes[0]!;
  }

  const ticketCreates = () =>
    requests.filter(request => request.method === 'POST' && request.target.split('?')[0] === '/api/v2/tickets.json');

  it('never creates a real ticket unless the account says notifications are off', async () => {
    const outcome = await runScenario();

    expect(ticketCreates().map(request => JSON.parse(request.body).ticket)).toEqual([
      expect.objectContaining({ subject: '', comment: { body: '' } }),
    ]);
    expect(outcome.steps).toContainEqual(expect.objectContaining({ toolId: 'zendesk_create_ticket', status: 'pass' }));
    expect(warnings.some(warning => warning.includes('MASTRA_SMOKE_ZENDESK_ALLOW_TICKETS'))).toBe(true);
  });

  it('fails the refused-ticket check when the Platform, not Zendesk, refused it', async () => {
    platformRefusesTicket = true;

    const outcome = await runScenario();

    expect(outcome.steps).toContainEqual(
      expect.objectContaining({ name: 'refused ticket', toolId: 'zendesk_create_ticket', status: 'fail' }),
    );
  });

  it('creates and deletes a real ticket when MASTRA_SMOKE_ZENDESK_ALLOW_TICKETS=1', async () => {
    vi.stubEnv('MASTRA_SMOKE_ZENDESK_ALLOW_TICKETS', '1');

    await runScenario();

    expect(ticketCreates().map(request => JSON.parse(request.body).ticket.subject)).toEqual([
      expect.stringContaining('mastra-smoke'),
    ]);
    expect(requests).toContainEqual(
      expect.objectContaining({ method: 'DELETE', target: `/api/v2/tickets/${IDS.ticket}.json` }),
    );
  });

  it('reports the archived article it leaves behind as a skipped delete and an error', async () => {
    const outcome = await runScenario();

    expect(requests).toContainEqual(
      expect.objectContaining({ method: 'DELETE', target: `/api/v2/help_center/articles/${IDS.article}` }),
    );
    expect(outcome.steps).toContainEqual(
      expect.objectContaining({
        name: 'delete article',
        status: 'skip',
        detail: expect.stringContaining(`${IDS.article}`),
      }),
    );
    expect(errors.some(error => error.includes(`article ${IDS.article}`) && error.includes('Archive'))).toBe(true);
  });
});
