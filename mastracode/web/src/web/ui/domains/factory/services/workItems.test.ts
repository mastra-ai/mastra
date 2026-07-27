import { afterEach, describe, expect, it, vi } from 'vitest';

import { createWorkItem, listWorkItems, startFactoryRun, updateWorkItem } from './workItems';

const wireItem = {
  id: 'item-1',
  orgId: 'org-1',
  createdBy: 'user-1',
  factoryProjectId: 'project-1',
  externalSource: {
    integrationId: 'github',
    type: 'issue',
    externalId: 'github-issue:42',
    url: 'https://github.com/mastra-ai/mastra/issues/42',
  },
  parentWorkItemId: null,
  title: 'Fix Factory board',
  stages: ['triage'],
  stageHistory: [],
  sessions: {},
  metadata: null,
  revision: 1,
  createdAt: '2026-07-22T00:00:00.000Z',
  updatedAt: '2026-07-22T00:00:00.000Z',
};

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Factory work item service boundary', () => {
  it('maps provider-neutral server work items to the board source model', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ workItems: [wireItem] })));

    const [item] = await listWorkItems('', 'project-1');

    expect(item).toMatchObject({
      githubProjectId: 'project-1',
      source: 'github-issue',
      sourceKey: 'github-issue:42',
      url: 'https://github.com/mastra-ai/mastra/issues/42',
      metadata: {},
    });
  });

  it('sends provider-neutral external source data when creating a board item', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ workItem: wireItem }));
    vi.stubGlobal('fetch', fetchMock);

    await createWorkItem('', 'project-1', {
      source: 'github-issue',
      sourceKey: 'github-issue:42',
      title: 'Fix Factory board',
      url: 'https://github.com/mastra-ai/mastra/issues/42',
      stages: ['intake'],
    });

    expect(JSON.parse(fetchMock.mock.calls[0]?.[1]?.body)).toEqual({
      externalSource: wireItem.externalSource,
      title: 'Fix Factory board',
      stages: ['intake'],
    });
  });

  it('maps provider-neutral server work items after an update', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ workItem: wireItem })));

    const item = await updateWorkItem('', 'item-1', { title: 'Updated title' });

    expect(item).toMatchObject({
      source: 'github-issue',
      sourceKey: 'github-issue:42',
      url: 'https://github.com/mastra-ai/mastra/issues/42',
    });
  });

  it('sends provider-neutral external source data when starting a run', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        prepared: {
          workItemId: 'item-1',
          bindingId: 'binding-1',
          threadId: 'thread-1',
          resourceId: 'resource-1',
          sessionId: 'session-1',
          branch: 'factory/issue-42',
          revision: 2,
          kickoffStatus: 'sent',
          replayed: false,
        },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await startFactoryRun('', 'project-1', {
      sessionId: 'session-1',
      threadTitle: 'Fix Factory board',
      kickoffKey: 'kickoff-1',
      destinationStage: 'triage',
      workItem: {
        id: 'item-1',
        role: 'triage',
        input: {
          source: 'github-issue',
          sourceKey: 'github-issue:42',
          title: 'Fix Factory board',
          url: 'https://github.com/mastra-ai/mastra/issues/42',
          stages: ['intake'],
        },
      },
    });

    const body = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body);
    expect(body.workItem.input).toEqual({
      externalSource: wireItem.externalSource,
      title: 'Fix Factory board',
      stages: ['intake'],
    });
  });
});
