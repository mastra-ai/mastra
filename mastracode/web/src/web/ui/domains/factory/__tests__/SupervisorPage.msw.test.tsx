/**
 * Product coverage for the shared Factory supervisor page.
 *
 * The tests drive the real route, React Query hooks, AgentController chat
 * providers, and approval mutations. Only HTTP is mocked through MSW.
 */
import { QueryClient } from '@tanstack/react-query';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../../../e2e/web-ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../../../../e2e/web-ui/render';
import { createAppRoutes } from '../../../router';
import type { FactorySupervisorApproval, FactorySupervisorState } from '../services/supervisor';

const API = `${TEST_BASE_URL}/api/agent-controller/code`;
const FACTORY_PROJECT_ID = '9f5345e2-c44d-4e4e-a063-c5590f27d344';
const SUPERVISOR_THREAD_ID = `${FACTORY_PROJECT_ID}-supervisor`;
const SUPERVISOR_RESOURCE_ID = `${FACTORY_PROJECT_ID}-supervisor`;

const pendingApproval: FactorySupervisorApproval = {
  id: '1ed5b84f-f21e-47c6-a859-1bfbd4f44fe6',
  workItemId: 'work-item-1',
  transitionId: 'transition-1',
  board: 'work',
  stage: 'execute',
  expectedRevision: 4,
  requestingRole: 'plan',
  reason: 'The plan agent requested execution.',
  summary: 'Move approved plan to execution',
  status: 'pending',
  resolvedBy: null,
  resolutionReason: null,
  resolvedAt: null,
  createdAt: '2026-07-22T18:00:00.000Z',
  updatedAt: '2026-07-22T18:00:00.000Z',
};

const initialState: FactorySupervisorState = {
  factoryProjectId: FACTORY_PROJECT_ID,
  totalItems: 3,
  counts: {
    byBoard: { work: 3, review: 0 },
    byStage: { intake: 1, plan: 1, execute: 1 },
  },
  pendingApprovals: [
    {
      id: '1ed5b84f-f21e-47c6-a859-1bfbd4f44fe6',
      workItemId: 'work-item-1',
      board: 'work',
      stage: 'execute',
      expectedRevision: 4,
      requestingRole: 'plan',
      workItemTitle: 'Approved plan',
      reason: 'The plan agent requested execution.',
      summary: 'Move approved plan to execution',
      ageSeconds: 30,
      createdAt: '2026-07-22T18:00:00.000Z',
    },
  ],
  pendingApprovalCount: 1,
  snapshotAt: '2026-07-22T18:00:30.000Z',
};

function emptySse(): Response {
  return new Response(
    new ReadableStream<Uint8Array>({
      start() {},
      cancel() {},
    }),
    { headers: { 'content-type': 'text/event-stream' } },
  );
}

function useChatHandlers(options?: {
  user?: { userId: string; name?: string };
  onMessage?: (body: unknown) => void;
  onSessionRequest?: (kind: 'supervisor' | 'controller') => void;
  supervisorGate?: Promise<void>;
}) {
  server.use(
    http.get(`${TEST_BASE_URL}/auth/me`, () =>
      HttpResponse.json({
        authenticated: true,
        authEnabled: true,
        user: options?.user ?? { userId: 'user-1' },
      }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects`, () =>
      HttpResponse.json({ projects: [{ id: FACTORY_PROJECT_ID, name: 'Mastra Factory' }] }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_PROJECT_ID}/source-control-connections`, () =>
      HttpResponse.json({ connections: [] }),
    ),
    http.get(`${TEST_BASE_URL}/web/github/status`, () =>
      HttpResponse.json({ enabled: true, connected: false, installations: [] }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_PROJECT_ID}/work-items`, () =>
      HttpResponse.json({ workItems: [] }),
    ),
    http.post(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_PROJECT_ID}/supervisor/session`, async () => {
      options?.onSessionRequest?.('supervisor');
      await options?.supervisorGate;
      return HttpResponse.json({
        session: {
          sessionId: SUPERVISOR_RESOURCE_ID,
          resourceId: SUPERVISOR_RESOURCE_ID,
          threadId: SUPERVISOR_THREAD_ID,
          factoryProjectId: FACTORY_PROJECT_ID,
        },
      });
    }),
    http.post(`${API}/sessions`, () => {
      options?.onSessionRequest?.('controller');
      return HttpResponse.json({
        controllerId: 'code',
        resourceId: SUPERVISOR_RESOURCE_ID,
        threadId: SUPERVISOR_THREAD_ID,
      });
    }),
    http.get(`${API}/modes`, () => HttpResponse.json({ modes: [{ id: 'build', label: 'Build' }] })),
    http.get(`${API}/models`, () => HttpResponse.json({ models: [] })),
    http.get(`${API}/sessions/:resourceId`, ({ params }) => {
      options?.onSessionRequest?.('controller');
      return HttpResponse.json({
        controllerId: 'code',
        resourceId: params.resourceId,
        modeId: 'build',
        modelId: 'openai/gpt-4o-mini',
        threadId: SUPERVISOR_THREAD_ID,
        settings: { yolo: false, thinkingLevel: 'medium', notifications: 'bell', smartEditing: true },
      });
    }),
    http.put(`${API}/sessions/:resourceId/state`, ({ params }) =>
      HttpResponse.json({
        controllerId: 'code',
        resourceId: params.resourceId,
        modeId: 'build',
        modelId: 'openai/gpt-4o-mini',
        threadId: SUPERVISOR_THREAD_ID,
        settings: { yolo: false, thinkingLevel: 'medium', notifications: 'bell', smartEditing: true },
      }),
    ),
    http.get(`${API}/sessions/:resourceId/permissions`, () => {
      options?.onSessionRequest?.('controller');
      return HttpResponse.json({ categories: {}, tools: {} });
    }),
    http.get(`${API}/sessions/:resourceId/threads`, () => {
      options?.onSessionRequest?.('controller');
      return HttpResponse.json({
        threads: [{ id: SUPERVISOR_THREAD_ID, resourceId: SUPERVISOR_RESOURCE_ID, title: 'Factory Supervisor' }],
      });
    }),
    http.get(`${API}/sessions/:resourceId/threads/:threadId/messages`, () => HttpResponse.json({ messages: [] })),
    http.get(`${API}/sessions/:resourceId/stream`, () => emptySse()),
    http.post(`${API}/sessions/:resourceId/messages`, async ({ request }) => {
      options?.onMessage?.(await request.json());
      return HttpResponse.json({ ok: true });
    }),
  );
}

function renderSupervisor(options?: {
  user?: { userId: string; name?: string };
  onMessage?: (body: unknown) => void;
  onSessionRequest?: (kind: 'supervisor' | 'controller') => void;
  supervisorGate?: Promise<void>;
  initialEntry?: string;
}) {
  useChatHandlers(options);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const router = createMemoryRouter(createAppRoutes(), {
    initialEntries: [options?.initialEntry ?? `/factories/${FACTORY_PROJECT_ID}/supervisor`],
  });
  renderWithProviders(<RouterProvider router={router} />, client);
  return { client, router };
}

describe('Factory supervisor page', () => {
  describe('when a Factory has a pending approval', () => {
    it('shows the shared supervisor chat with bounded state and the approval', async () => {
      server.use(
        http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_PROJECT_ID}/supervisor/state`, () =>
          HttpResponse.json({ state: initialState }),
        ),
        http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_PROJECT_ID}/approvals`, () =>
          HttpResponse.json({ approvals: [pendingApproval] }),
        ),
      );

      const sessionRequests: Array<'supervisor' | 'controller'> = [];
      let releaseSupervisor!: () => void;
      const supervisorGate = new Promise<void>(resolve => {
        releaseSupervisor = resolve;
      });
      renderSupervisor({
        onSessionRequest: kind => sessionRequests.push(kind),
        supervisorGate,
      });

      await waitFor(() => expect(sessionRequests).toContain('supervisor'));
      await new Promise(resolve => setTimeout(resolve, 50));
      const requestsBeforeSupervisorReady = [...sessionRequests];
      releaseSupervisor();
      expect(requestsBeforeSupervisorReady).toEqual(['supervisor']);
      expect(await screen.findByRole('heading', { name: 'Factory Supervisor' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Supervisor' })).toHaveAttribute(
        'href',
        `/factories/${FACTORY_PROJECT_ID}/supervisor`,
      );
      expect(screen.getByText('3 work items')).toBeInTheDocument();
      expect(screen.getByText('1 pending approval')).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Pending approvals' })).toBeInTheDocument();
      expect(screen.getByText('Move approved plan to execution')).toBeInTheDocument();
      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });
  });

  describe('when an authenticated user sends a supervisor message', () => {
    it('sends attributed content through the deterministic supervisor session', async () => {
      const sent: unknown[] = [];
      server.use(
        http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_PROJECT_ID}/supervisor/state`, () =>
          HttpResponse.json({ state: initialState }),
        ),
        http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_PROJECT_ID}/approvals`, () =>
          HttpResponse.json({ approvals: [pendingApproval] }),
        ),
      );

      renderSupervisor({
        user: { userId: 'user-ada', name: 'Ada Lovelace' },
        onMessage: body => sent.push(body),
      });
      const input = await screen.findByRole('textbox');
      await waitFor(() => expect(input).toBeEnabled());
      await userEvent.type(input, 'Review current Factory state{Enter}');

      await waitFor(() =>
        expect(sent).toContainEqual({
          message: 'Review current Factory state',
          attributes: { name: 'Ada Lovelace', userId: 'user-ada' },
        }),
      );
      expect((await screen.findAllByText('Ada Lovelace')).length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('Review current Factory state')).toBeInTheDocument();
    });
  });

  describe('when a pending transition is approved', () => {
    it('resolves the approval and removes it after invalidation', async () => {
      const user = userEvent.setup();
      let approvals: FactorySupervisorApproval[] = [pendingApproval];
      const decisions: string[] = [];
      server.use(
        http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_PROJECT_ID}/supervisor/state`, () =>
          HttpResponse.json({ state: { ...initialState, pendingApprovalCount: approvals.length } }),
        ),
        http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_PROJECT_ID}/approvals`, () =>
          HttpResponse.json({ approvals }),
        ),
        http.post(
          `${TEST_BASE_URL}/web/factory/projects/${FACTORY_PROJECT_ID}/approvals/:approvalId/resolve`,
          async ({ request, params }) => {
            const body = (await request.json()) as { decision: string };
            decisions.push(body.decision);
            approvals = approvals.filter(approval => approval.id !== params.approvalId);
            return HttpResponse.json({
              result: {
                status: 'approved',
                replayed: false,
                approval: { ...pendingApproval, status: 'approved', resolvedBy: 'user-1' },
                item: { id: 'work-item-1', revision: 5, stages: ['execute'] },
              },
            });
          },
        ),
      );

      renderSupervisor();
      await user.click(await screen.findByRole('button', { name: 'Approve Move approved plan to execution' }));

      await waitFor(() => expect(decisions).toEqual(['approve']));
      expect(await screen.findByText('No pending approvals')).toBeInTheDocument();
      expect(screen.queryByText('Move approved plan to execution')).not.toBeInTheDocument();
    });
  });

  describe('when the work item revision changed before approval', () => {
    it('reports the stale result without moving state optimistically', async () => {
      const user = userEvent.setup();
      server.use(
        http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_PROJECT_ID}/supervisor/state`, () =>
          HttpResponse.json({ state: initialState }),
        ),
        http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_PROJECT_ID}/approvals`, () =>
          HttpResponse.json({ approvals: [pendingApproval] }),
        ),
        http.post(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_PROJECT_ID}/approvals/:approvalId/resolve`, () =>
          HttpResponse.json({
            result: {
              status: 'stale',
              replayed: false,
              approval: { ...pendingApproval, status: 'stale' },
            },
          }),
        ),
      );

      renderSupervisor();
      await user.click(await screen.findByRole('button', { name: 'Approve Move approved plan to execution' }));

      expect(await screen.findByText(/work item changed before approval/i)).toBeInTheDocument();
    });
  });

  describe('when the URL names an unknown Factory', () => {
    it('bounces to the landing route instead of rendering a supervisor', async () => {
      const { router } = renderSupervisor({
        initialEntry: '/factories/00000000-0000-4000-8000-00000000dead/supervisor',
      });

      await waitFor(() => expect(router.state.location.pathname).not.toContain('/supervisor'));
      expect(screen.queryByRole('heading', { name: 'Factory Supervisor' })).not.toBeInTheDocument();
    });
  });
});
