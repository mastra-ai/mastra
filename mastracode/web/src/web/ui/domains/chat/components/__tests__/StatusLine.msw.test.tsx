/**
 * BDD coverage for `StatusLine` (`domains/chat/components`).
 *
 * The component owns the session status strip below the composer: mode
 * selection, active model, OM budgets, runtime activity, queued follow-ups,
 * and goal state. Driven end-to-end: real fetch/SSE transport, MSW at the
 * network boundary.
 */
import type { AgentControllerEvent, AgentControllerOMProgress, AgentControllerSessionState } from '@mastra/client-js';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ChatSessionTestProvider as ChatSessionProvider } from '../../context/ChatSessionTestProvider';
import { server } from '../../../../../../../e2e/web-ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../../../../../e2e/web-ui/render';
import type { Factory } from '../../../workspaces';
import { ActiveFactoryProvider } from '../../../workspaces';
import { StatusLine } from '../StatusLine';

const API = `${TEST_BASE_URL}/api/agent-controller/code`;
const RESOURCE_ID = 'resource-test';
const SESSION = `${API}/sessions/${RESOURCE_ID}`;
const THREAD_ID = 'thread-test';

afterEach(() => {
  localStorage.clear();
});

function seedFactory(source: 'local' | 'github' = 'local') {
  const project: Factory =
    source === 'github'
      ? {
          id: 'project-test',
          name: 'octo/hello',
          resourceId: RESOURCE_ID,
          createdAt: 1,
          binding: {
            kind: 'factory',
            factoryProjectId: 'fp-test',
            repositories: [
              {
                projectRepositoryId: 'pr-test',
                slug: 'octo/hello',
                gitBranch: 'main',
                sandboxWorkdir: '/tmp/mastracode-test',
                selectedWorktreePath: '/tmp/mastracode-test-worktree',
                worktrees: [{ branch: 'feature', worktreePath: '/tmp/mastracode-test-worktree', baseBranch: 'main' }],
              },
            ],
          },
        }
      : {
          id: 'project-test',
          name: 'MastraCode Test',
          resourceId: RESOURCE_ID,
          createdAt: 1,
          binding: {
            kind: 'local',
            path: '/tmp/mastracode-test',
            gitBranch: 'main',
          },
        };
  localStorage.setItem('mastracode-factories', JSON.stringify([project]));
  localStorage.setItem('mastracode-active-factory', project.id);
}

function sessionState(modeId = 'build'): AgentControllerSessionState {
  return {
    controllerId: 'code',
    resourceId: RESOURCE_ID,
    modeId,
    modelId: 'openai/gpt-4o-mini',
    threadId: THREAD_ID,
    settings: { yolo: false, thinkingLevel: 'medium', notifications: 'bell', smartEditing: true },
  };
}

/**
 * SSE response streaming `first`, then — after a real delay — `delayed`.
 * The delay opens a measurable decode window so tokens/sec can be computed
 * from `usage_update` events.
 */
function sse(first: AgentControllerEvent[] = [], delayed: AgentControllerEvent[] = []): Response {
  const encoder = new TextEncoder();
  const write = (controller: ReadableStreamDefaultController<Uint8Array>, events: AgentControllerEvent[]) => {
    for (const event of events) controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
  };
  return new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        write(controller, first);
        if (delayed.length > 0) setTimeout(() => write(controller, delayed), 30);
      },
      cancel() {},
    }),
    { headers: { 'content-type': 'text/event-stream' } },
  );
}

function useAgentControllerHandlers(events: AgentControllerEvent[] = [], delayedEvents: AgentControllerEvent[] = []) {
  const onMode = vi.fn();
  let activeModeId = 'build';
  server.use(
    http.post(`${API}/sessions`, () =>
      HttpResponse.json({ controllerId: 'code', resourceId: RESOURCE_ID, threadId: THREAD_ID }),
    ),
    http.get(`${API}/modes`, () =>
      HttpResponse.json({
        modes: [
          { id: 'build', name: 'Build' },
          { id: 'plan', name: 'Plan' },
          { id: 'fast', name: 'Explore' },
        ],
      }),
    ),
    http.get(`${API}/models`, () => HttpResponse.json({ models: [] })),
    http.get(SESSION, () => HttpResponse.json(sessionState(activeModeId))),
    http.put(`${SESSION}/state`, () => HttpResponse.json(sessionState(activeModeId))),
    http.get(`${SESSION}/permissions`, () => HttpResponse.json({ categories: {}, tools: {} })),
    http.get(`${SESSION}/threads`, () => HttpResponse.json({ threads: [] })),
    http.get(`${SESSION}/threads/${THREAD_ID}/messages`, () => HttpResponse.json({ messages: [] })),
    http.post(`${SESSION}/mode`, async ({ request }) => {
      const body = (await request.json()) as { modeId: string };
      onMode(body);
      activeModeId = body.modeId;
      return HttpResponse.json({ ok: true });
    }),
    http.get(`${SESSION}/stream`, () => sse(events, delayedEvents)),
  );
  return { onMode };
}

function omProgress(overrides: Partial<AgentControllerOMProgress> = {}): AgentControllerOMProgress {
  return {
    status: 'ok',
    pendingTokens: 0,
    threshold: 0,
    thresholdPercent: 0,
    observationTokens: 0,
    reflectionThreshold: 0,
    reflectionThresholdPercent: 0,
    projectedMessageRemoval: 0,
    projectedReflectionSavings: 0,
    ...overrides,
  };
}

function renderStatusLine() {
  return renderWithProviders(
    <MemoryRouter initialEntries={[`/threads/${THREAD_ID}`]}>
      <Routes>
        <Route
          path="/threads/:threadId"
          element={
            <ActiveFactoryProvider>
              <ChatSessionProvider>
                <StatusLine />
              </ChatSessionProvider>
            </ActiveFactoryProvider>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('StatusLine', () => {
  describe('when the session exposes multiple modes', () => {
    it('marks the active mode as pressed inside the mode group', async () => {
      seedFactory();
      useAgentControllerHandlers();
      renderStatusLine();

      const group = await screen.findByRole('group', { name: 'Session mode' });
      expect(group).toBeInTheDocument();
      await waitFor(() =>
        expect(screen.getByRole('button', { name: 'Build' })).toHaveAttribute('aria-pressed', 'true'),
      );
      expect(screen.getByRole('button', { name: 'Plan' })).toHaveAttribute('aria-pressed', 'false');
      expect(screen.getByRole('button', { name: 'Explore' })).toHaveAttribute('aria-pressed', 'false');
      for (const button of screen.getAllByRole('button', { name: /Build|Plan|Explore/ })) {
        expect(button).toHaveAttribute('data-variant', 'outline');
      }
    });

    it('colors only the active mode background', async () => {
      seedFactory();
      useAgentControllerHandlers();
      renderStatusLine();

      const buildButton = await screen.findByRole('button', { name: 'Build' });
      await waitFor(() => expect(buildButton).toHaveStyle({ backgroundColor: '#16c858', color: '#111827' }));
      expect(screen.getByRole('button', { name: 'Plan' })).not.toHaveAttribute('style');
      expect(screen.getByRole('button', { name: 'Explore' })).not.toHaveAttribute('style');
    });

    it('colors Explore orange when its fast mode is active', async () => {
      seedFactory();
      useAgentControllerHandlers();
      const user = userEvent.setup();
      renderStatusLine();

      const exploreButton = await screen.findByRole('button', { name: 'Explore' });
      await user.click(exploreButton);

      await waitFor(() => expect(exploreButton).toHaveAttribute('aria-pressed', 'true'));
      expect(exploreButton).toHaveStyle({ backgroundColor: '#fdac53', color: '#111827' });
    });

    it('switches modes through the controller mode endpoint before updating the pressed state', async () => {
      seedFactory();
      const { onMode } = useAgentControllerHandlers();
      const user = userEvent.setup();
      renderStatusLine();

      const planButton = await screen.findByRole('button', { name: 'Plan' });
      await user.click(planButton);

      await waitFor(() => expect(onMode).toHaveBeenCalledWith({ modeId: 'plan' }));
      await waitFor(() => expect(planButton).toHaveAttribute('aria-pressed', 'true'));
      expect(planButton).toHaveStyle({ backgroundColor: '#7f45e0', color: '#ffffff' });
      expect(screen.getByRole('button', { name: 'Build' })).toHaveAttribute('aria-pressed', 'false');
    });
  });

  describe('when the session reports its model', () => {
    it('shows the active model id once the session syncs', async () => {
      seedFactory();
      useAgentControllerHandlers();
      renderStatusLine();

      await waitFor(() => expect(screen.getByText('gpt-4o-mini')).toBeInTheDocument());
      expect(screen.queryByText('no model')).not.toBeInTheDocument();
    });

    it('shows the no-model fallback before the session syncs', () => {
      seedFactory();
      useAgentControllerHandlers();
      renderStatusLine();

      expect(screen.getByText('no model')).toBeInTheDocument();
    });
  });

  describe('when the active GitHub thread is subscribed to a pull request', () => {
    it('shows a linked pull request at the right side of the status line', async () => {
      seedFactory('github');
      useAgentControllerHandlers();
      server.use(
        http.get(`${TEST_BASE_URL}/web/github/subscriptions`, ({ request }) => {
          const url = new URL(request.url);
          expect(url.searchParams.get('resourceId')).toBe(RESOURCE_ID);
          expect(url.searchParams.get('threadId')).toBe(THREAD_ID);
          expect(url.searchParams.get('scope')).toBe('/tmp/mastracode-test-worktree');
          return HttpResponse.json({
            subscriptions: [
              {
                id: 'subscription-1',
                repoFullName: 'octo/hello',
                pullRequestNumber: 42,
                status: 'open',
                url: 'https://github.com/octo/hello/pull/42',
              },
            ],
          });
        }),
      );
      renderStatusLine();

      const link = await screen.findByRole('link', { name: 'Open open octo/hello pull request 42' });
      expect(link).toHaveTextContent('PR #42');
      expect(link).toHaveAttribute('href', 'https://github.com/octo/hello/pull/42');
    });

    it('refreshes subscribed pull requests when an agent run completes', async () => {
      seedFactory('github');
      useAgentControllerHandlers([{ type: 'agent_start' }], [{ type: 'agent_end' }]);
      let requests = 0;
      server.use(
        http.get(`${TEST_BASE_URL}/web/github/subscriptions`, () => {
          requests += 1;
          return HttpResponse.json({
            subscriptions:
              requests > 1
                ? [
                    {
                      id: 'subscription-1',
                      repoFullName: 'octo/hello',
                      pullRequestNumber: 42,
                      status: 'open',
                      url: 'https://github.com/octo/hello/pull/42',
                    },
                  ]
                : [],
          });
        }),
      );
      renderStatusLine();

      await waitFor(() => expect(requests).toBeGreaterThan(1));
      expect(await screen.findByRole('link', { name: 'Open open octo/hello pull request 42' })).toBeInTheDocument();
    });

    it('refreshes the pull request status when a notification arrives', async () => {
      seedFactory('github');
      useAgentControllerHandlers(
        [],
        [
          {
            type: 'message_update',
            message: {
              id: 'notification-message',
              role: 'assistant',
              createdAt: new Date(),
              content: {
                format: 2,
                parts: [],
                metadata: {
                  harnessContent: [
                    {
                      type: 'notification',
                      notificationId: 'notification-merged',
                      message: 'octo/hello#42 was merged',
                      source: 'github',
                      kind: 'pull-request-merged',
                      priority: 'urgent',
                    },
                  ],
                },
              },
            },
          },
        ],
      );
      let requests = 0;
      server.use(
        http.get(`${TEST_BASE_URL}/web/github/subscriptions`, () => {
          requests += 1;
          return HttpResponse.json({
            subscriptions: [
              {
                id: 'subscription-1',
                repoFullName: 'octo/hello',
                pullRequestNumber: 42,
                status: requests > 1 ? 'merged' : 'open',
                url: 'https://github.com/octo/hello/pull/42',
              },
            ],
          });
        }),
      );
      renderStatusLine();

      await screen.findByRole('link', { name: 'Open open octo/hello pull request 42' });
      await waitFor(() =>
        expect(screen.getByRole('link', { name: 'Open merged octo/hello pull request 42' })).toBeInTheDocument(),
      );
      expect(requests).toBeGreaterThan(1);
    });
  });

  describe('when display state carries observational memory budgets', () => {
    it('shows the message budget with its projected removal', async () => {
      seedFactory();
      useAgentControllerHandlers([
        {
          type: 'display_state_changed',
          displayState: {
            omProgress: omProgress({
              pendingTokens: 1500,
              threshold: 10000,
              thresholdPercent: 15,
              projectedMessageRemoval: 2000,
            }),
          },
        },
      ]);
      renderStatusLine();

      const msgBudget = await screen.findByTitle('Message window until next observation');
      expect(msgBudget).toHaveTextContent('msg 1.5/10k');
      expect(msgBudget).toHaveTextContent('↓2k');
    });

    it('shows the memory budget with its projected savings', async () => {
      seedFactory();
      useAgentControllerHandlers([
        {
          type: 'display_state_changed',
          displayState: {
            omProgress: omProgress({
              observationTokens: 4000,
              reflectionThreshold: 20000,
              reflectionThresholdPercent: 20,
              projectedReflectionSavings: 3000,
            }),
          },
        },
      ]);
      renderStatusLine();

      const memBudget = await screen.findByTitle('Observations accumulated until next reflection');
      expect(memBudget).toHaveTextContent('mem 4/20k');
      expect(memBudget).toHaveTextContent('↓3k');
    });

    it('hides the memory budget until observations accumulate', async () => {
      seedFactory();
      useAgentControllerHandlers([
        {
          type: 'display_state_changed',
          displayState: {
            omProgress: omProgress({
              pendingTokens: 500,
              threshold: 10000,
              thresholdPercent: 5,
              reflectionThreshold: 20000,
            }),
          },
        },
      ]);
      renderStatusLine();

      await screen.findByTitle('Message window until next observation');
      expect(screen.queryByTitle('Observations accumulated until next reflection')).not.toBeInTheDocument();
    });
  });

  describe('when the agent is actively working', () => {
    it('reports Working in the composer status line', async () => {
      seedFactory();
      useAgentControllerHandlers([{ type: 'agent_start' }]);
      renderStatusLine();

      expect(await screen.findByRole('status')).toHaveTextContent('Working…');
    });

    it('shows the observational memory phase while observing', async () => {
      seedFactory();
      useAgentControllerHandlers([{ type: 'om_observation_start' }]);
      renderStatusLine();

      await waitFor(() => expect(screen.getByText('observing')).toBeInTheDocument());
    });

    it('shows tokens-per-second throughput after a streamed step reports usage', async () => {
      seedFactory();
      useAgentControllerHandlers(
        [
          { type: 'agent_start' },
          {
            type: 'message_update',
            message: {
              id: 'assistant-1',
              role: 'assistant',
              createdAt: new Date(),
              content: { format: 2, parts: [{ type: 'text', text: 'Working…' }] },
            },
          },
        ],
        [{ type: 'usage_update', usage: { completionTokens: 120 } }],
      );
      renderStatusLine();

      await waitFor(() => expect(screen.getByText(/\d+ tok\/s/)).toBeInTheDocument());
    });
  });

  describe('when follow-ups are queued', () => {
    it('shows the queued follow-up count', async () => {
      seedFactory();
      useAgentControllerHandlers([{ type: 'follow_up_queued', count: 2 }]);
      renderStatusLine();

      await waitFor(() => expect(screen.getByText('2 queued')).toBeInTheDocument());
    });
  });

  describe('when a goal is being pursued', () => {
    it('shows the pursuing label for an active goal', async () => {
      seedFactory();
      useAgentControllerHandlers([
        {
          type: 'goal_evaluation',
          payload: { objective: 'Ship the split', iteration: 1, maxRuns: 5, passed: false, status: 'active' },
        },
      ]);
      renderStatusLine();

      await waitFor(() => expect(screen.getByText('pursuing goal')).toBeInTheDocument());
    });

    it('shows the paused label for a paused goal', async () => {
      seedFactory();
      useAgentControllerHandlers([
        {
          type: 'goal_evaluation',
          payload: { objective: 'Ship the split', iteration: 1, maxRuns: 5, passed: false, status: 'paused' },
        },
      ]);
      renderStatusLine();

      await waitFor(() => expect(screen.getByText('goal paused')).toBeInTheDocument());
    });

    it('hides the goal indicator once the goal is done', async () => {
      seedFactory();
      useAgentControllerHandlers([
        {
          type: 'goal_evaluation',
          payload: { objective: 'Ship the split', iteration: 5, maxRuns: 5, passed: true, status: 'done' },
        },
      ]);
      renderStatusLine();

      await waitFor(() => expect(screen.getByText('gpt-4o-mini')).toBeInTheDocument());
      expect(screen.queryByText('pursuing goal')).not.toBeInTheDocument();
      expect(screen.queryByText('goal paused')).not.toBeInTheDocument();
    });
  });

  describe('when the session is idle with no activity data', () => {
    it('omits budgets, activity, queue, and goal indicators', async () => {
      seedFactory();
      useAgentControllerHandlers();
      renderStatusLine();

      await waitFor(() => expect(screen.getByText('gpt-4o-mini')).toBeInTheDocument());
      expect(screen.queryByTitle('Message window until next observation')).not.toBeInTheDocument();
      expect(screen.queryByTitle('Observations accumulated until next reflection')).not.toBeInTheDocument();
      expect(screen.queryByText(/tok\/s/)).not.toBeInTheDocument();
      expect(screen.queryByText(/queued/)).not.toBeInTheDocument();
      expect(screen.queryByText(/goal/)).not.toBeInTheDocument();
    });
  });
});
