import { afterEach, describe, expect, it, vi } from 'vitest';

import { LinearIntegration, LinearProviderRequestError } from './integration';

function integration() {
  return new LinearIntegration({ clientId: 'linear-client', clientSecret: 'linear-secret' });
}

function graphqlResponse(data?: unknown, errors?: Array<{ message: string }>) {
  return new Response(JSON.stringify({ data, errors }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('LinearIntegration.fetchIssueContext', () => {
  it('uses one GraphQL request and returns bounded basic fields without comments', async () => {
    const labels = Array.from({ length: 55 }, (_, index) => ({ name: `label-${index}-${'x'.repeat(100)}` }));
    const fetchMock = vi.fn().mockResolvedValue(
      graphqlResponse({
        issue: {
          identifier: `ENG-${'9'.repeat(140)}`,
          title: 't'.repeat(600),
          description: 'd'.repeat(65_000),
          url: 'https://linear.app/mastra/issue/ENG-42/task-context',
          state: { name: 's'.repeat(600) },
          assignee: { name: 'a'.repeat(140) },
          labels: { nodes: labels },
        },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await integration().fetchIssueContext('access-token', 'ENG-42');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://api.linear.app/graphql');
    expect(init.headers).toMatchObject({ authorization: 'Bearer access-token' });
    const body = JSON.parse(init.body as string) as { query: string; variables: Record<string, unknown> };
    expect(body.variables).toEqual({ id: 'ENG-42' });
    expect(body.query).toContain('query IssueContext');
    expect(body.query).not.toContain('comments');
    expect(result).toEqual({
      identifier: `ENG-${'9'.repeat(124)}`,
      title: 't'.repeat(512),
      description: 'd'.repeat(64_000),
      state: 's'.repeat(512),
      labels: labels.slice(0, 50).map(label => label.name.slice(0, 100)),
      assignees: ['a'.repeat(100)],
      url: 'https://linear.app/mastra/issue/ENG-42/task-context',
    });
  });

  it('omits unsafe URLs and empty descriptions', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        graphqlResponse({
          issue: {
            identifier: 'ENG-42',
            title: 'Task context',
            description: '   ',
            url: 'data:text/html,unsafe',
            state: { name: 'In Progress' },
            assignee: null,
            labels: { nodes: [] },
          },
        }),
      ),
    );

    await expect(integration().fetchIssueContext('access-token', 'ENG-42')).resolves.toEqual({
      identifier: 'ENG-42',
      title: 'Task context',
      state: 'In Progress',
      labels: [],
      assignees: [],
    });
  });

  it('returns null for a missing node or Linear entity-not-found response', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(graphqlResponse({ issue: null }))
      .mockResolvedValueOnce(graphqlResponse(undefined, [{ message: 'Entity not found: Issue' }]));
    vi.stubGlobal('fetch', fetchMock);
    const linear = integration();

    await expect(linear.fetchIssueContext('access-token', 'ENG-404')).resolves.toBeNull();
    await expect(linear.fetchIssueContext('access-token', 'ENG-405')).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('types network and HTTP failures as provider request errors', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('network token must not leak'))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ errors: [{ message: 'upstream token must not leak' }] }), {
          status: 503,
          headers: { 'content-type': 'application/json' },
        }),
      );
    vi.stubGlobal('fetch', fetchMock);
    const linear = integration();

    await expect(linear.fetchIssueContext('access-token', 'ENG-42')).rejects.toBeInstanceOf(
      LinearProviderRequestError,
    );
    const httpError = await linear.fetchIssueContext('access-token', 'ENG-42').catch(error => error);
    expect(httpError).toBeInstanceOf(LinearProviderRequestError);
    expect(httpError).toMatchObject({ status: 503 });
  });

  it('does not classify GraphQL operation or successful-response mapping failures as provider failures', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(graphqlResponse(undefined, [{ message: 'Invalid task-context query' }]))
      .mockResolvedValueOnce(
        graphqlResponse({
          issue: {
            identifier: 'ENG-42',
            title: 'Task context',
            description: null,
            url: 'https://linear.app/mastra/issue/ENG-42/task-context',
            state: null,
            assignee: null,
            labels: { nodes: [] },
          },
        }),
      );
    vi.stubGlobal('fetch', fetchMock);
    const linear = integration();

    const operationError = await linear.fetchIssueContext('access-token', 'ENG-42').catch(error => error);
    expect(operationError).toBeInstanceOf(Error);
    expect(operationError).not.toBeInstanceOf(LinearProviderRequestError);
    expect(operationError).toHaveProperty('message', 'Linear API error: Invalid task-context query');

    const mappingError = await linear.fetchIssueContext('access-token', 'ENG-42').catch(error => error);
    expect(mappingError).toBeInstanceOf(TypeError);
    expect(mappingError).not.toBeInstanceOf(LinearProviderRequestError);
  });
});
