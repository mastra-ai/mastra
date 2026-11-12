import { createServer } from 'node:http';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MastraClient } from '../client';

const cases = [
  { method: 'deleteTraces', httpMethod: 'POST', path: '/traces/delete', body: { traceIds: ['abc', 'def'] } },
  {
    method: 'deleteScores',
    httpMethod: 'DELETE',
    path: '/scores',
    body: { scoreIds: ['score-1', 'score-2'], organizationId: 'org-1', resourceId: 'resource-1' },
  },
  {
    method: 'deleteFeedback',
    httpMethod: 'DELETE',
    path: '/feedback',
    body: { feedbackIds: ['feedback-1', 'feedback-2'], organizationId: 'org-1', resourceId: 'resource-1' },
  },
] as const;

// OBS-889: exercise the public client over HTTP, including DELETE bodies.
describe.each(cases)('$method', operation => {
  let client: MastraClient;
  let close: () => Promise<void>;
  let status: number;
  let response: object;
  let requests: { method?: string; path?: string; body: unknown; contentType?: string; authorization?: string }[];

  beforeEach(async () => {
    status = 200;
    response = { success: true };
    requests = [];
    const server = createServer(async (req, res) => {
      let body = '';
      for await (const chunk of req) body += chunk.toString();
      requests.push({
        method: req.method,
        path: req.url,
        body: JSON.parse(body),
        contentType: req.headers['content-type'],
        authorization: req.headers.authorization,
      });
      res.writeHead(status, { 'content-type': 'application/json' });
      res.end(JSON.stringify(response));
    });
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Expected a TCP address');
    client = new MastraClient({
      baseUrl: `http://127.0.0.1:${address.port}`,
      apiPrefix: '/custom/api',
      headers: { authorization: 'Bearer test-token' },
      retries: 0,
    });
    close = () => new Promise<void>((resolve, reject) => server.close(error => (error ? reject(error) : resolve())));
  });

  afterEach(async () => close());

  const remove = () => {
    switch (operation.method) {
      case 'deleteTraces':
        return client.deleteTraces({ ...operation.body, traceIds: [...operation.body.traceIds] });
      case 'deleteScores':
        return client.deleteScores({ ...operation.body, scoreIds: [...operation.body.scoreIds] });
      case 'deleteFeedback':
        return client.deleteFeedback({ ...operation.body, feedbackIds: [...operation.body.feedbackIds] });
    }
  };

  it.each([
    { status: 200, response: { success: true } },
    { status: 202, response: { accepted: true } },
  ])('preserves the $status response and sends the complete JSON request', async fixture => {
    status = fixture.status;
    response = fixture.response;
    expect(await remove()).toEqual(fixture.response);
    expect(requests).toEqual([
      {
        method: operation.httpMethod,
        path: `/custom/api/observability${operation.path}`,
        body: operation.body,
        contentType: 'application/json',
        authorization: 'Bearer test-token',
      },
    ]);
  });

  it.each([400, 500])('rejects an unsuccessful %s response', async failureStatus => {
    status = failureStatus;
    response = { error: 'Deletion request failed' };
    await expect(remove()).rejects.toMatchObject({ status: failureStatus });
  });
});
