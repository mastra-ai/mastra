import { createServer } from 'node:http';
import type { IncomingHttpHeaders, Server, ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Command } from 'commander';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { prepareFeedbackScoreInput, requestFeedbackScoreWrite } from './feedback-score-writes';
import { API_COMMANDS, registerApiCommand } from './index';

type Request = { method: string; url: URL; headers: IncomingHttpHeaders; body: any; raw: string };
let server: Server;
let url: string;
let requests: Request[];
let stdout: string;
let stderr: string;
let respond: (request: Request, response: ServerResponse) => void;

function json(response: ServerResponse, status: number, body: unknown) {
  response.writeHead(status, { 'content-type': 'application/json' });
  response.end(JSON.stringify(body));
}

beforeEach(async () => {
  requests = [];
  stdout = '';
  stderr = '';
  process.exitCode = undefined;
  respond = (_request, response) => json(response, 200, { success: true });
  server = createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const raw = Buffer.concat(chunks).toString();
    const received = {
      method: request.method!,
      url: new URL(request.url!, 'http://localhost'),
      headers: request.headers,
      raw,
      body: raw ? JSON.parse(raw) : undefined,
    };
    requests.push(received);
    respond(received, response);
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  vi.spyOn(process.stdout, 'write').mockImplementation(chunk => {
    stdout += String(chunk);
    return true;
  });
  vi.spyOn(process.stderr, 'write').mockImplementation(chunk => {
    stderr += String(chunk);
    return true;
  });
});

afterEach(async () => {
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) => server.close(error => (error ? reject(error) : resolve())));
  vi.restoreAllMocks();
  process.exitCode = undefined;
});

async function run(command: string[], input?: object, options: string[] = []) {
  const program = new Command().exitOverride();
  registerApiCommand(program);
  await program.parseAsync(['api', '--url', url, ...command, ...options, ...(input ? [JSON.stringify(input)] : [])], {
    from: 'user',
  });
  return stdout ? JSON.parse(stdout) : undefined;
}

const feedback = { traceId: 'trace_123', feedbackType: 'comment', feedbackSource: 'user', value: 'actionable' };
const score = { traceId: 'trace_123', scorerId: 'quality', score: 0.95 };
const identity = { feedbackId: 'feedback_123', timestamp: '2026-11-11T10:00:00.123456Z' };

describe('score and feedback commands over HTTP', () => {
  it.each(['score', 'feedback'] as const)(
    'creates %s with stable identity across missing-anchor retries',
    async kind => {
      respond = (request, response) => {
        if (requests.length < 3) return json(response, 404, { code: 'TRACE_NOT_FOUND' });
        const record = request.body[kind];
        json(response, 200, { success: true, data: { ...record, timestamp: '2026-11-11T10:00:00.123Z' } });
      };
      const output = await run([kind, 'create'], { [kind]: kind === 'feedback' ? feedback : score });
      expect(requests).toHaveLength(3);
      expect(new Set(requests.map(request => request.raw)).size).toBe(1);
      expect(requests[0].body[kind][`${kind}Id`]).toEqual(expect.any(String));
      expect(Number.isNaN(Date.parse(requests[0].body[kind].timestamp))).toBe(false);
      expect(requests[0].body).not.toHaveProperty('contextMode');
      expect(output.data).toMatchObject({ success: true, data: { timestamp: '2026-11-11T10:00:00.123Z' } });
      expect(stderr).toBe('');
    },
  );

  it.each([undefined, 'provided', 'resolve'])(
    'preserves context mode %s and separate author/context user IDs',
    async mode => {
      const body = {
        ...(mode ? { contextMode: mode } : {}),
        feedback: {
          ...feedback,
          ...identity,
          userId: 'span-user',
          feedbackUserId: 'author',
          metadata: { label: 'example' },
        },
      };
      expect(await run(['feedback', 'create'], body)).toEqual({ data: { success: true } });
      expect(requests[0].body).toEqual(body);
    },
  );

  it('does not infer a feedback author from the context user', async () => {
    await run(['feedback', 'create'], { feedback: { ...feedback, userId: 'span-user' } });
    expect(requests[0].body.feedback).not.toHaveProperty('feedbackUserId');
  });

  it.each([undefined, null, '', '  '])('rejects a missing or blank trace ID (%s)', async traceId => {
    await run(['score', 'create'], { score: { ...score, traceId } });
    expect(requests).toHaveLength(0);
    expect(JSON.parse(stderr).error.code).toBe('INVALID_INPUT');
    expect(process.exitCode).toBe(1);
  });

  it('requires the wrapped record instead of crashing on a flat body', async () => {
    await run(['feedback', 'create'], feedback);
    expect(requests).toHaveLength(0);
    expect(JSON.parse(stderr).error.message).toContain('feedback');
  });

  it('replaces feedback without changing its identity, scope, or API prefix', async () => {
    const body = { contextMode: 'provided', feedback: { ...feedback, ...identity, value: 'corrected' } };
    await run(['feedback', 'replace', identity.feedbackId], body, [
      '--server-api-prefix',
      '/api/custom',
      '--header',
      'Authorization: Bearer test-token',
      '--header',
      'X-Mastra-Project-Id: project_123',
      '--header',
      'X-Mastra-Organization-Id: org_123',
    ]);
    expect(requests[0]).toMatchObject({
      method: 'PUT',
      body,
      headers: {
        authorization: 'Bearer test-token',
        'x-mastra-project-id': 'project_123',
        'x-mastra-organization-id': 'org_123',
      },
    });
    expect(requests[0].url.pathname).toBe('/api/custom/observability/feedback/feedback_123');
  });

  it.each(['feedbackId', 'timestamp'] as const)('does not generate missing replacement %s', async field => {
    const record: Record<string, unknown> = { ...feedback, ...identity };
    delete record[field];
    await run(['feedback', 'replace', identity.feedbackId], { feedback: record });
    expect(requests).toHaveLength(0);
    expect(JSON.parse(stderr).error.code).toBe('INVALID_INPUT');
  });

  it('rejects replacement URL/body identity mismatches', async () => {
    await run(['feedback', 'replace', 'another-id'], { feedback: { ...feedback, ...identity } });
    expect(requests).toHaveLength(0);
    expect(JSON.parse(stderr).error.code).toBe('INVALID_INPUT');
  });

  it('updates only review status without a timestamp and preserves missing-record errors', async () => {
    respond = (_request, response) => json(response, 404, { code: 'FEEDBACK_NOT_FOUND', error: 'Feedback not found' });
    await run(['feedback', 'review-status', 'id/with spaces'], { reviewStatus: 'reviewed' });
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({ method: 'PATCH', body: { reviewStatus: 'reviewed' } });
    expect(requests[0].url.pathname).toBe('/api/observability/feedback/id%2Fwith%20spaces/review-status');
    expect(JSON.parse(stderr).error.details).toMatchObject({ status: 404, body: { code: 'FEEDBACK_NOT_FOUND' } });
  });

  it.each(['score', 'feedback'] as const)('preserves missing %s reads as record-or-null', async kind => {
    respond = (_request, response) => json(response, 200, { [kind]: null });
    expect(await run([kind, 'get', 'missing'])).toEqual({ data: { [kind]: null } });
  });

  it.each(['score', 'feedback'] as const)('preserves %s list filters and pagination', async kind => {
    const pagination = { total: 54, page: 1, perPage: 50, hasMore: false };
    respond = (_request, response) =>
      json(response, 200, { [kind === 'score' ? 'scores' : kind]: [{ traceId: 'trace_123' }], pagination });
    expect(await run([kind, 'list'], { traceId: 'trace_123', page: 1, perPage: 50 })).toEqual({
      data: [{ traceId: 'trace_123' }],
      page: pagination,
    });
    expect(Object.fromEntries(requests[0].url.searchParams)).toEqual({
      traceId: 'trace_123',
      page: '1',
      perPage: '50',
    });
  });

  it.each([400, 401, 403, 404, 413, 422])('does not retry terminal create status %s', async status => {
    respond = (_request, response) => json(response, status, { error: 'Rejected' });
    await run(['score', 'create'], { score });
    expect(requests).toHaveLength(1);
    expect(JSON.parse(stderr).error.details.status).toBe(status);
  });

  it.each([405, 501])('reports unsupported replacement (%s) without retrying', async status => {
    respond = (_request, response) => json(response, status, { error: 'Not supported' });
    await run(['feedback', 'replace', identity.feedbackId], { feedback: { ...feedback, ...identity } });
    expect(requests).toHaveLength(1);
    expect(JSON.parse(stderr).error.message).toContain('does not support');
  });
});

describe('write retries and command coverage', () => {
  it('uses the same record after credential fallback and a transient failure', async () => {
    const program = new Command();
    registerApiCommand(program);
    const descriptor = API_COMMANDS.feedbackCreate;
    const input = prepareFeedbackScoreInput(descriptor, { feedback }, {});
    respond = (request, response) => {
      if (request.headers.authorization === 'Bearer expired') return json(response, 401, { error: 'Unauthorized' });
      if (requests.length === 2) return json(response, 503, { code: 'ANCHOR_LOOKUP_UNAVAILABLE' });
      json(response, 200, { success: true });
    };
    await expect(
      requestFeedbackScoreWrite(
        {
          baseUrl: url,
          descriptor,
          headers: { Authorization: 'Bearer expired', 'X-Mastra-Project-Id': 'project_123' },
          timeoutMs: 5000,
          pathParams: {},
          input,
        },
        { Authorization: 'Bearer current', 'X-Mastra-Project-Id': 'project_123' },
      ),
    ).resolves.toEqual({ success: true });
    expect(requests).toHaveLength(3);
    expect(new Set(requests.map(request => request.raw)).size).toBe(1);
    expect(requests.map(request => request.headers.authorization)).toEqual([
      'Bearer expired',
      'Bearer current',
      'Bearer current',
    ]);
    expect(requests.every(request => request.headers['x-mastra-project-id'] === 'project_123')).toBe(true);
  });

  it.each([408, 429, 500, 502, 503, 504])('retries eligible create status %s', async status => {
    respond = (_request, response) =>
      json(response, requests.length === 1 ? status : 200, { success: requests.length > 1 });
    await run(['score', 'create'], { score });
    expect(requests).toHaveLength(2);
    expect(requests[0].raw).toBe(requests[1].raw);
    expect(stderr).toBe('');
  });

  it('retries a connection failure with the same record', async () => {
    respond = (_request, response) => {
      if (requests.length === 1) response.destroy();
      else json(response, 200, { success: true });
    };
    await run(['feedback', 'create'], { feedback });
    expect(requests).toHaveLength(2);
    expect(requests[0].raw).toBe(requests[1].raw);
    expect(stderr).toBe('');
  });

  it('stops after six missing-anchor attempts', async () => {
    respond = (_request, response) => json(response, 404, { code: 'SPAN_NOT_FOUND' });
    await run(['feedback', 'create'], { feedback: { ...feedback, spanId: 'pending-span' } });
    expect(requests).toHaveLength(6);
    expect(new Set(requests.map(request => request.raw)).size).toBe(1);
    expect(JSON.parse(stderr).error.details.body.code).toBe('SPAN_NOT_FOUND');
  }, 15_000);

  it('respects the overall timeout while waiting for an anchor', async () => {
    respond = (_request, response) => json(response, 404, { code: 'TRACE_NOT_FOUND' });
    await run(['score', 'create'], { score }, ['--timeout', '400']);
    expect(requests.length).toBeLessThanOrEqual(1);
    const error = JSON.parse(stderr).error;
    // A busy machine may exhaust the budget before the server receives the request.
    if (error.code !== 'REQUEST_TIMEOUT') expect(error.details.body.code).toBe('TRACE_NOT_FOUND');
  });

  it('times out stalled writes without retrying them', async () => {
    respond = () => {};
    await run(['score', 'create'], { score }, ['--timeout', '500']);
    expect(requests.length).toBeLessThanOrEqual(1);
    expect(JSON.parse(stderr).error.code).toBe('REQUEST_TIMEOUT');
  });

  it('keeps replacement identity stable after a server failure', async () => {
    respond = (_request, response) =>
      json(response, requests.length === 1 ? 500 : 200, { success: requests.length > 1 });
    const body = { feedback: { ...feedback, ...identity, value: 'updated' } };
    await run(['feedback', 'replace', identity.feedbackId], body);
    expect(requests).toHaveLength(2);
    expect(requests.every(request => request.method === 'PUT')).toBe(true);
    expect(requests.map(request => request.body)).toEqual([body, body]);
  });

  it('does not turn review-status into a general PATCH', async () => {
    await run(['feedback', 'review-status', identity.feedbackId], { reviewStatus: 'reviewed', value: 'changed' });
    expect(requests).toHaveLength(0);
    expect(JSON.parse(stderr).error.code).toBe('INVALID_INPUT');
  });

  it('returns the updated record from review-status', async () => {
    const record = { ...feedback, ...identity, reviewStatus: 'reviewed' };
    respond = (_request, response) => json(response, 200, record);
    expect(await run(['feedback', 'review-status', identity.feedbackId], { reviewStatus: 'reviewed' })).toEqual({
      data: record,
    });
  });

  it.each(['score', 'feedback'] as const)('preserves %s delete requests and accepted responses', async kind => {
    const body = { [`${kind}Ids`]: ['record_123'], organizationId: 'org_123', resourceId: 'resource_123' };
    respond = (_request, response) => json(response, 202, { accepted: true });
    expect(await run([kind, 'delete'], body)).toEqual({ data: { accepted: true } });
    expect(requests[0]).toMatchObject({ method: 'DELETE', body });
  });

  it.each(['score', 'feedback'] as const)('preserves %s delta cursors for subsequent reads', async kind => {
    const delta = { limit: 20, hasMore: true };
    respond = (_request, response) =>
      json(response, 200, { [kind === 'score' ? 'scores' : kind]: [], delta, deltaCursor: 'initial_cursor' });
    const output = await run([kind, 'list'], { mode: 'delta', after: 'prior_cursor', limit: 20 });
    expect(output).toMatchObject({ data: [], delta, deltaCursor: 'initial_cursor' });
    expect(Object.fromEntries(requests[0].url.searchParams)).toEqual({
      mode: 'delta',
      after: 'prior_cursor',
      limit: '20',
    });
  });

  it.each(['score', 'feedback'] as const)('serves %s schema without depending on a target manifest', async kind => {
    const output = await run([kind, 'create'], undefined, ['--schema']);
    expect(requests).toHaveLength(0);
    expect(output.input.schema.properties[kind].required).toContain('traceId');
    expect(output.input.schema.properties.contextMode.enum).toEqual(['resolve', 'provided']);
    expect(output.response.schema.properties).toHaveProperty('success');
  });

  for (const kind of ['score', 'feedback'] as const) {
    for (const operation of ['aggregate', 'breakdown', 'timeseries', 'percentiles'] as const) {
      it(`exposes ${kind} ${operation} without losing analytic response fields`, async () => {
        const body = {
          ...(kind === 'score' ? { scorerId: 'quality' } : { feedbackType: 'rating' }),
          ...(operation === 'percentiles' ? { percentiles: [0.5, 0.95] } : { aggregation: 'avg' }),
          ...(operation === 'breakdown' ? { groupBy: ['entityName'] } : {}),
          ...(['timeseries', 'percentiles'].includes(operation) ? { interval: '1d' } : {}),
          filters: { traceId: 'trace_123' },
        };
        const response =
          operation === 'aggregate'
            ? { value: 0.8, count: 4, comparison: { value: 0.7 } }
            : { [operation === 'breakdown' ? 'groups' : 'series']: [] };
        respond = (_request, res) => json(res, 200, response);
        expect(await run([kind, operation], body)).toEqual({ data: response });
        expect(requests[0].url.pathname).toBe(`/api/observability/${kind === 'score' ? 'scores' : kind}/${operation}`);
        expect(requests[0]).toMatchObject({ method: 'POST', body });
      });
    }
  }

  it('does not retry unrelated POST query errors', async () => {
    respond = (_request, response) => json(response, 503, { error: 'Unavailable' });
    await run(['score', 'aggregate'], { scorerId: 'quality', aggregation: 'avg' });
    expect(requests).toHaveLength(1);
  });
});
