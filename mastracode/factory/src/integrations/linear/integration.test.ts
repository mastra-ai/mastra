import { afterEach, describe, expect, it, vi } from 'vitest';

import { TASK_CONTEXT_LIMITS } from '../../capabilities/task-context';
import { LinearGraphqlOperationError, LinearIntegration, LinearProviderRequestError } from './integration';
import type { LinearIssue, LinearIssueDetail } from './integration';

function integration(): LinearIntegration {
  return new LinearIntegration({ clientId: 'linear-client', clientSecret: 'linear-secret' });
}

const issue: LinearIssue = {
  id: 'issue-1',
  projectId: 'project-1',
  identifier: 'ENG-42',
  title: 'Fix intake',
  url: 'https://linear.app/acme/issue/ENG-42',
  state: 'Todo',
  stateType: 'unstarted',
  priorityLabel: 'High',
  assignee: 'Ada',
  team: 'ENG',
  labels: ['bug'],
  createdAt: '2026-07-01T00:00:00Z',
  updatedAt: '2026-07-02T00:00:00Z',
};

const connection = { type: 'oauth' as const, accessToken: 'linear-token' };

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('LinearIntegration capability surface', () => {
  it('normalizes Linear issues through the shared Intake contract', async () => {
    const linear = integration();
    const listActiveIssues = vi
      .spyOn(linear, 'listActiveIssues')
      .mockResolvedValue({ issues: [issue], nextCursor: 'cursor-2' });

    await expect(
      linear.intake.listIssues({
        connection,
        sourceIds: ['project-1'],
        cursor: 'cursor-1',
        labels: ['bug', 'urgent'],
      }),
    ).resolves.toEqual({
      issues: [
        expect.objectContaining({
          id: 'issue-1',
          identifier: 'ENG-42',
          source: 'ENG',
          priority: 'High',
          labels: ['bug'],
        }),
      ],
      nextCursor: 'cursor-2',
    });
    expect(listActiveIssues).toHaveBeenCalledWith('linear-token', 'cursor-1', ['project-1'], ['bug', 'urgent']);
  });

  it('passes label filters to Linear GraphQL', async () => {
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        new Response(
          JSON.stringify({ data: { issues: { nodes: [], pageInfo: { hasNextPage: false, endCursor: null } } } }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
    );
    vi.stubGlobal('fetch', fetchMock);
    const linear = integration();

    await linear.listActiveIssues('linear-token', 'cursor-1', ['project-1'], ['bug', 'urgent']);

    const request = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as {
      query: string;
      variables: Record<string, unknown>;
    };
    expect(request.query).toContain('labels: { name: { in: $labels } }');
    expect(request.variables).toMatchObject({ labels: ['bug', 'urgent'] });
  });

  it('fetches issue details and creates comments through the shared Intake contract', async () => {
    const linear = integration();
    const detail: LinearIssueDetail = {
      ...issue,
      description: 'Issue body',
      comments: [{ author: 'Grace', body: 'Looking now', createdAt: '2026-07-03T00:00:00Z' }],
    };
    vi.spyOn(linear, 'fetchIssueDetail').mockResolvedValue(detail);
    vi.spyOn(linear, 'createIssueComment').mockResolvedValue({
      id: 'comment-1',
      url: 'https://linear.app/acme/issue/ENG-42#comment-comment-1',
    });

    await expect(linear.intake.getIssue({ connection, issueId: 'ENG-42' })).resolves.toMatchObject({
      description: 'Issue body',
      commentCount: 1,
      comments: [{ author: 'Grace', body: 'Looking now' }],
    });
    await expect(linear.intake.createComment({ connection, issueId: 'ENG-42', body: 'Done' })).resolves.toEqual({
      id: 'comment-1',
      url: 'https://linear.app/acme/issue/ENG-42#comment-comment-1',
    });
  });

  it('reads bounded Linear task context with one query and no comments', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            issue: {
              identifier: 'ENG-42',
              title: 'Fix intake',
              description: 'Issue body',
              url: 'https://linear.app/acme/issue/ENG-42',
              state: { name: 'In Progress' },
              assignee: { name: 'Ada' },
              labels: { nodes: [{ name: 'bug' }] },
            },
          },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);
    const linear = integration();

    await expect(linear.taskContext.getIssue?.({ connection, issueId: 'ENG-42' })).resolves.toEqual({
      identifier: 'ENG-42',
      title: 'Fix intake',
      description: 'Issue body',
      state: 'In Progress',
      labels: ['bug'],
      assignees: ['Ada'],
      url: 'https://linear.app/acme/issue/ENG-42',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const request = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as {
      query: string;
      variables: Record<string, unknown>;
    };
    expect(request.query).toContain('query TaskContextIssue');
    expect(request.query).not.toContain('comments');
    expect(request.query).not.toContain('pageInfo');
    expect(request.variables).toEqual({ id: 'ENG-42' });
  });

  it('bounds Linear task-context fields at the provider capability', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            issue: {
              identifier: 'ENG-42',
              title: 't'.repeat(TASK_CONTEXT_LIMITS.title + 10),
              description: 'd'.repeat(TASK_CONTEXT_LIMITS.description + 10),
              url: `https://linear.app/${'u'.repeat(TASK_CONTEXT_LIMITS.url)}`,
              state: { name: 's'.repeat(TASK_CONTEXT_LIMITS.state + 10) },
              assignee: { name: 'a'.repeat(TASK_CONTEXT_LIMITS.listItem + 10) },
              labels: {
                nodes: Array.from({ length: TASK_CONTEXT_LIMITS.listItems + 10 }, (_, index) => ({
                  name: `${index}-${'l'.repeat(TASK_CONTEXT_LIMITS.listItem + 10)}`,
                })),
              },
            },
          },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);
    const linear = integration();

    const detail = await linear.taskContext.getIssue?.({ connection, issueId: 'ENG-42' });

    expect(detail?.title).toHaveLength(TASK_CONTEXT_LIMITS.title);
    expect(detail?.description).toHaveLength(TASK_CONTEXT_LIMITS.description);
    expect(detail?.state).toHaveLength(TASK_CONTEXT_LIMITS.state);
    expect(detail?.labels).toHaveLength(TASK_CONTEXT_LIMITS.listItems);
    expect(detail?.labels[0]).toHaveLength(TASK_CONTEXT_LIMITS.listItem);
    expect(detail?.assignees[0]).toHaveLength(TASK_CONTEXT_LIMITS.listItem);
    expect(detail?.url).toBeNull();
  });

  it('classifies external GraphQL errors as provider failures and query errors as internal', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            errors: [{ message: 'Not authorized', extensions: { code: 'AUTHENTICATION_ERROR' } }],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            errors: [
              {
                message: 'Cannot query field "missing" on type "Issue".',
                extensions: { code: 'GRAPHQL_VALIDATION_FAILED' },
              },
            ],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ errors: [{ message: 'Entity not found: Issue' }] }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            errors: [{ message: 'Not authorized', extensions: { code: 'AUTHENTICATION_ERROR' } }],
          }),
          { status: 400, headers: { 'content-type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            errors: [
              {
                message: 'Cannot query field "missing" on type "Issue".',
                extensions: { code: 'GRAPHQL_VALIDATION_FAILED' },
              },
            ],
          }),
          { status: 400, headers: { 'content-type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ errors: [{ message: 'Entity not found: Issue' }] }), {
          status: 400,
          headers: { 'content-type': 'application/json' },
        }),
      );
    vi.stubGlobal('fetch', fetchMock);
    const linear = integration();
    const input = { connection, issueId: 'ENG-42' };

    await expect(linear.taskContext.getIssue?.(input)).rejects.toBeInstanceOf(LinearProviderRequestError);
    await expect(linear.taskContext.getIssue?.(input)).rejects.toBeInstanceOf(LinearGraphqlOperationError);
    await expect(linear.taskContext.getIssue?.(input)).resolves.toBeNull();
    await expect(linear.taskContext.getIssue?.(input)).rejects.toBeInstanceOf(LinearProviderRequestError);
    await expect(linear.taskContext.getIssue?.(input)).rejects.toBeInstanceOf(LinearGraphqlOperationError);
    await expect(linear.taskContext.getIssue?.(input)).resolves.toBeNull();
  });

  it('sanitizes task-context request failures without hiding response mapping bugs', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('network token must not leak'))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: { issue: { identifier: 'ENG-42', labels: null } } }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      );
    vi.stubGlobal('fetch', fetchMock);
    const linear = integration();
    const input = { connection, issueId: 'ENG-42' };

    const providerError = await linear.taskContext.getIssue?.(input).catch(error => error);
    expect(providerError).toBeInstanceOf(LinearProviderRequestError);
    expect(providerError).toHaveProperty('message', 'Linear API request failed.');
    expect(providerError.message).not.toContain('network token must not leak');
    await expect(linear.taskContext.getIssue?.(input)).rejects.toBeInstanceOf(TypeError);
  });

  it('sanitizes Linear intake request failures without hiding response mapping bugs', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('network token must not leak'))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: { issue: { id: 'issue-1' } } }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      );
    vi.stubGlobal('fetch', fetchMock);
    const linear = integration();
    const input = { connection, issueId: 'ENG-42' };

    const providerError = await linear.intake.getIssue(input).catch(error => error);
    expect(providerError).toBeInstanceOf(LinearProviderRequestError);
    expect(providerError).toHaveProperty('message', 'Linear API request failed.');
    expect(providerError.message).not.toContain('network token must not leak');
    await expect(linear.intake.getIssue(input)).rejects.toBeInstanceOf(TypeError);
  });

  it('rejects an installation connection instead of silently misusing it', async () => {
    const linear = integration();
    await expect(
      linear.intake.listIssues({
        connection: { type: 'app-installation', installationId: 7 },
        sourceIds: [],
      }),
    ).rejects.toThrow('Linear capabilities require an OAuth connection.');
  });

  it('provides intake without claiming source-control support', () => {
    const linear = integration();

    expect(linear.id).toBe('linear');
    expect(linear.intake).toBeDefined();
    expect('versionControl' in linear).toBe(false);
  });

  it('throws listing every missing required field', () => {
    expect(() => new LinearIntegration({ clientId: '', clientSecret: '' })).toThrow(/clientId, clientSecret/);
  });
});
