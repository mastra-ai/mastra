/**
 * BDD coverage for the Factory Overview page.
 *
 * Drives the real route table through a memory router with the full provider
 * stack, so the specs exercise what a user sees at /factory/overview: the
 * queue-health chart (aggregated client-side from the work-items + threshold
 * endpoints plus the polled workspace activity) and its drill-down task list.
 * Only the network is mocked (MSW).
 */
import { QueryClient } from '@tanstack/react-query';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';

import { server } from '../../../../../../e2e/web-ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../../../../e2e/web-ui/render';
import type { GithubStatus, Factory } from '../../workspaces';
import { createAppRoutes } from '../../../router';
import type { WorkItem } from '../services/workItems';

const API = `${TEST_BASE_URL}/api/agent-controller/code`;
const RESOURCE_ID = 'resource-gh';
const SESSION = `${API}/sessions/${RESOURCE_ID}`;
const THREAD_ID = 'thread-test';
const FACTORY_PROJECT_ID = 'fp-github-project-1';
const PROJECT_REPOSITORY_ID = 'repo-link-1';
// The sandbox workdir is the repo-root checkout (dropped from the workspace
// list); the factory workspace is a distinct feature worktree — this is also
// the path work-item sessions point at for the active-work signal.
const WORKTREE = '/sandbox/mastra/feat-overview';

const HOUR_S = 3600;
// Ages chosen against the default thresholds (4h / 24h / 72h), relative to now
// (the aggregation ages against `new Date()` at render time).
const ago = (seconds: number) => new Date(Date.now() - seconds * 1000).toISOString();

const githubProject: Factory = {
  id: 'project-gh',
  name: 'Mastra',
  resourceId: RESOURCE_ID,
  createdAt: 1,
  binding: {
    kind: 'factory',
    factoryProjectId: FACTORY_PROJECT_ID,
    repositories: [
      {
        projectRepositoryId: PROJECT_REPOSITORY_ID,
        slug: 'mastra-ai/mastra',
        gitBranch: 'main',
        sandboxWorkdir: '/sandbox/mastra',
        selectedWorktreePath: WORKTREE,
        worktrees: [{ branch: 'feat/overview', worktreePath: WORKTREE, baseBranch: 'main' }],
      },
    ],
  },
};

const localProject: Factory = {
  id: 'project-local',
  name: 'Local',
  resourceId: RESOURCE_ID,
  createdAt: 1,
  binding: {
    kind: 'local',
    path: '/projects/local',
  },
};

const connectedStatus: GithubStatus = {
  enabled: true,
  connected: true,
  installations: [{ installationId: 1, accountLogin: 'mastra-ai', accountType: 'Organization' }],
};

/** A full WorkItem row with sensible defaults, as the server returns it. */
function makeWorkItem(overrides: Partial<WorkItem> & Pick<WorkItem, 'id' | 'title'>): WorkItem {
  return {
    orgId: 'org-1',
    createdBy: 'user-1',
    githubProjectId: FACTORY_PROJECT_ID,
    parentWorkItemId: null,
    source: 'manual',
    sourceKey: null,
    url: null,
    stages: ['intake'],
    stageHistory: [],
    sessions: {},
    metadata: {},
    revision: 1,
    createdAt: ago(30 * HOUR_S),
    updatedAt: ago(30 * HOUR_S),
    ...overrides,
  };
}

/** An item entered into `stage` `ageSeconds` ago (open history entry). */
function inStage(
  id: string,
  title: string,
  stage: string,
  ageSeconds: number,
  extra: Partial<WorkItem> = {},
): WorkItem {
  return makeWorkItem({
    id,
    title,
    stages: [stage],
    stageHistory: [{ stage, enteredAt: ago(ageSeconds), by: 'user-1' }],
    createdAt: ago(ageSeconds),
    ...extra,
  });
}

function emptySse(): Response {
  return new Response(
    new ReadableStream<Uint8Array>({
      start() {},
      cancel() {},
    }),
    { headers: { 'content-type': 'text/event-stream' } },
  );
}

function sessionState() {
  return {
    controllerId: 'code',
    resourceId: RESOURCE_ID,
    modeId: 'build',
    modelId: 'openai/gpt-4o-mini',
    threadId: THREAD_ID,
    settings: { yolo: false, thinkingLevel: 'medium', notifications: 'bell', smartEditing: true },
  };
}

interface OverviewHandlers {
  workItems: WorkItem[];
  /** Threads the workspace-activity poll returns (drives the active overlay). */
  activityThreads?: unknown[];
  thresholds?: number[];
}

function useOverviewHandlers({ workItems, activityThreads = [], thresholds }: OverviewHandlers) {
  server.use(
    http.get(`${TEST_BASE_URL}/auth/me`, () => new Response(null, { status: 404 })),
    http.get(`${TEST_BASE_URL}/web/github/status`, () => HttpResponse.json(connectedStatus)),
    http.get(`${TEST_BASE_URL}/web/intake/config`, () =>
      HttpResponse.json({
        config: { github: { enabled: true, projectIds: [] }, linear: { enabled: false, projectIds: [] } },
      }),
    ),
    http.get(`${TEST_BASE_URL}/web/linear/status`, () =>
      HttpResponse.json({ enabled: false, connected: false, workspace: null }),
    ),
    http.post(`${API}/sessions`, () =>
      HttpResponse.json({ controllerId: 'code', resourceId: RESOURCE_ID, threadId: THREAD_ID }),
    ),
    http.get(`${API}/modes`, () => HttpResponse.json({ modes: [{ id: 'build', label: 'Build' }] })),
    http.get(`${API}/models`, () => HttpResponse.json({ models: [] })),
    http.get(SESSION, () => HttpResponse.json(sessionState())),
    http.put(`${SESSION}/state`, () => HttpResponse.json(sessionState())),
    http.get(`${SESSION}/permissions`, () => HttpResponse.json({ categories: {}, tools: {} })),
    http.get(`${SESSION}/threads*`, () => HttpResponse.json({ threads: activityThreads })),
    http.get(`${SESSION}/threads/${THREAD_ID}/messages`, () => HttpResponse.json({ messages: [] })),
    http.get(`${SESSION}/stream`, () => emptySse()),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_PROJECT_ID}/work-items`, () =>
      HttpResponse.json({ workItems }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_PROJECT_ID}/health/thresholds`, () =>
      HttpResponse.json({ thresholds: thresholds ?? [14400, 86400, 259200] }),
    ),
  );
}

function renderAt(initialEntry: string, project: Factory = githubProject) {
  localStorage.setItem('mastracode-factories', JSON.stringify([project]));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const router = createMemoryRouter(createAppRoutes(), {
    initialEntries: [`/factories/${project.id}${initialEntry}`],
  });
  renderWithProviders(<RouterProvider router={router} />, client);
  return { router, client };
}

afterEach(() => {
  localStorage.clear();
});

describe('Factory Overview page', () => {
  it('given work items across age buckets, when the page renders, then the chart shows per-stage bars and the empty-selection hint', async () => {
    useOverviewHandlers({
      workItems: [
        inStage('wi-1', 'Fresh task', 'triage', 1 * HOUR_S), // green (<4h)
        inStage('wi-2', 'Aging task', 'triage', 10 * HOUR_S), // amber (4–24h)
        inStage('wi-3', 'Stale execute', 'execute', 40 * HOUR_S), // orange (24–72h)
        inStage('wi-4', 'Critical review', 'review', 100 * HOUR_S), // red (≥72h)
        inStage('wi-5', 'Intake card', 'intake', 5 * HOUR_S), // hidden: intake not charted
      ],
    });
    renderAt('/overview');

    expect(await screen.findByRole('heading', { name: 'Queue health' })).toBeInTheDocument();

    // One labeled segment per populated (stage, bucket) cohort.
    expect(await screen.findByRole('button', { name: 'Triage Fresh: 1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Triage Aging: 1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Building Stale: 1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Review Critical: 1' })).toBeInTheDocument();
    // Intake is hidden from the chart even when a persisted intake card exists.
    expect(screen.queryByRole('button', { name: /Intake/ })).not.toBeInTheDocument();

    // The drill-down starts with the select-a-segment hint.
    expect(screen.getByText('Select a segment above to see its tasks.')).toBeInTheDocument();
  });

  it('given a selected cohort, when a segment is clicked, then the drill-down lists only that cohort', async () => {
    const user = userEvent.setup();
    useOverviewHandlers({
      workItems: [
        inStage('wi-1', 'Fresh task', 'triage', 1 * HOUR_S),
        inStage('wi-2', 'Aging task', 'triage', 10 * HOUR_S),
        inStage('wi-3', 'Another aging', 'triage', 12 * HOUR_S),
      ],
    });
    renderAt('/overview');

    const aging = await screen.findByRole('button', { name: 'Triage Aging: 2' });
    await user.click(aging);

    const tasks = screen.getByRole('heading', { name: 'Tasks' }).parentElement!;
    expect(await within(tasks).findByText(/Triage · Aging — 2 tasks/)).toBeInTheDocument();
    expect(within(tasks).getByText('Aging task')).toBeInTheDocument();
    expect(within(tasks).getByText('Another aging')).toBeInTheDocument();
    // The other cohort's task is not listed.
    expect(within(tasks).queryByText('Fresh task')).not.toBeInTheDocument();
  });

  it('given an active agent session on a worktree, when the page renders, then the matching stage shows the active overlay', async () => {
    useOverviewHandlers({
      workItems: [
        inStage('wi-1', 'Active build', 'execute', 1 * HOUR_S, {
          sessions: { work: { sessionId: WORKTREE, branch: 'main', threadId: 'thread-run', startedBy: 'user-1' } },
        }),
      ],
      activityThreads: [{ id: 'thread-run', tags: { projectPath: WORKTREE }, state: 'active' }],
    });
    renderAt('/overview');

    // The execute bar carries the stripe overlay for its one active item.
    await waitFor(() => expect(screen.getByRole('img', { name: 'Building: 1 active' })).toBeInTheDocument());
    expect(screen.getByText(/1 active/)).toBeInTheDocument();
  });

  it('given a local project, when visiting Overview, then the local-folder notice renders instead of the chart', async () => {
    useOverviewHandlers({ workItems: [] });
    renderAt('/overview', localProject);

    expect(await screen.findByText(/available for server-backed Factories/)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Queue health' })).not.toBeInTheDocument();
  });
});
