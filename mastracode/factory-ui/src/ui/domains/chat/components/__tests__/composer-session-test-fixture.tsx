import type { AgentControllerEvent, AgentControllerTaskSnapshot } from '@mastra/client-js';
import { MainSidebarProvider } from '@mastra/playground-ui/components/MainSidebar';
import type { QueryClient } from '@tanstack/react-query';
import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { Link, MemoryRouter, Route, Routes, useLocation, useParams } from 'react-router';
import { expect } from 'vitest';

import { server } from '../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL, renderWithProviders, waitForMutationsIdle } from '../../../../../../e2e/ui/render';
import { OverlaysProvider } from '../../../../lib/overlays';
import Chat from '../../Chat';
import { ChatSessionBoundary } from '../../context/ChatSessionProvider';
import { ChatSessionTestProvider } from '../../context/ChatSessionTestProvider';
import { useHandoffPrompt } from '../../hooks/useHandoffPrompt';
import { ActivityLine } from '../ActivityLine';
import { Composer } from '../Composer';
import { TaskPanel } from '../TaskPanel';
import { Transcript } from '../Transcript';

if (typeof globalThis.Element !== 'undefined' && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

const API = `${TEST_BASE_URL}/api/agent-controller/code`;
export const FACTORY_ID = 'fp-preparing';
export const PROJECT_REPOSITORY_ID = 'repo-preparing';
export const SESSION_ID = '20000000-0000-4000-8000-000000000003';

interface PreparingSession {
  finishWorkspace: () => void;
  /** Push an event down the session stream; resolves once the stream is open. */
  emit: (event: AgentControllerEvent) => Promise<void>;
  posted: string[];
  postedFiles: unknown[];
  delivered: string[];
  operations: string[];
  sessionLookups: number;
  controllerCreates: number;
  steerAttempts: number;
}

interface StubPreparingSessionOptions {
  createdSessionTitle?: string;
  tasks?: AgentControllerTaskSnapshot[];
  failDispatch?: boolean;
  failWorkspace?: boolean;
  materialized?: boolean;
  /** Close the turn as soon as a message is delivered. Off when a test drives the turn itself. */
  autoAgentEnd?: boolean;
}

function readSentMessage(body: unknown): string {
  if (typeof body !== 'object' || body === null) return '';
  if ('message' in body && typeof body.message === 'string') return body.message;
  return '';
}

function readSentFiles(body: unknown): unknown[] {
  if (typeof body !== 'object' || body === null || !('files' in body)) return [];
  return Array.isArray(body.files) ? body.files : [];
}

export function stubPreparingSession({
  createdSessionTitle,
  tasks,
  failDispatch = false,
  failWorkspace = false,
  materialized = false,
  autoAgentEnd = true,
}: StubPreparingSessionOptions = {}): PreparingSession {
  let releaseWorkspace = () => {};
  const workspaceReady = new Promise<void>(resolve => {
    releaseWorkspace = resolve;
  });
  let attachSse = (_controller: ReadableStreamDefaultController<Uint8Array>) => {};
  const sseOpen = new Promise<ReadableStreamDefaultController<Uint8Array>>(resolve => {
    attachSse = resolve;
  });
  const encoder = new TextEncoder();
  let sessionPackId: string | null = null;
  const result: PreparingSession = {
    finishWorkspace: releaseWorkspace,
    emit: async event => {
      const controller = await sseOpen;
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
    },
    posted: [],
    postedFiles: [],
    delivered: [],
    operations: [],
    steerAttempts: 0,
    controllerCreates: 0,
    sessionLookups: 0,
  };

  server.use(
    http.get(`${TEST_BASE_URL}/auth/me`, () =>
      HttpResponse.json({ authenticated: true, user: { userId: 'user-1', email: 'user@example.com' } }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects`, () =>
      HttpResponse.json({ projects: [{ id: FACTORY_ID, name: 'Preparing' }] }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}`, () =>
      HttpResponse.json({
        project: { id: FACTORY_ID, name: 'Preparing', defaultModelId: 'openai/gpt-4o-mini' },
      }),
    ),
    http.get(`${TEST_BASE_URL}/web/config/providers`, () =>
      HttpResponse.json({ providers: [{ provider: 'openai', source: 'stored-user' }] }),
    ),
    http.get(`${TEST_BASE_URL}/web/config/models`, () =>
      HttpResponse.json({
        models: [
          { id: 'openai/gpt-4o-mini', provider: 'openai', modelName: 'gpt-4o-mini', hasApiKey: true },
          { id: 'openai/gpt-5.4-mini', provider: 'openai', modelName: 'gpt-5.4-mini', hasApiKey: true },
        ],
      }),
    ),
    http.get(`${TEST_BASE_URL}/web/config/model-packs`, () =>
      HttpResponse.json({
        packs: [
          {
            id: 'balanced',
            name: 'Balanced',
            description: '',
            models: {
              build: 'openai/gpt-4o-mini',
              plan: 'openai/gpt-4o-mini',
              fast: 'openai/gpt-4o-mini',
            },
            custom: false,
            active: true,
          },
          {
            id: 'mine',
            name: 'Mine',
            description: '',
            models: { build: 'openai/gpt-5.4-mini', plan: 'openai/gpt-5.4-mini', fast: 'openai/gpt-5.4-mini' },
            custom: true,
            active: false,
          },
        ],
        activePackId: 'balanced',
        sessionPackId,
      }),
    ),
    http.post(`${TEST_BASE_URL}/web/config/model-packs/:packId/activate`, async ({ params }) => {
      sessionPackId = String(params.packId);
      result.operations.push(`pack:${sessionPackId}`);
      return HttpResponse.json({ ok: true, target: 'session', sessionPackId });
    }),
    http.get(`${TEST_BASE_URL}/web/factory/projects/:factoryProjectId/source-control-connections`, () =>
      HttpResponse.json({
        connections: [
          {
            id: 'conn-1',
            installationId: 'inst-1',
            repositories: [
              {
                id: PROJECT_REPOSITORY_ID,
                branch: 'main',
                sandboxWorkdir: '/workspace/preparing',
                repository: { slug: 'octo/hello', defaultBranch: 'main' },
              },
            ],
          },
        ],
      }),
    ),
    http.get(`${TEST_BASE_URL}/web/user-sessions/:sessionId`, () => {
      result.sessionLookups += 1;
      return HttpResponse.json({
        session: {
          id: createdSessionTitle ? 'row-draft' : 'row-1',
          sessionId: SESSION_ID,
          projectRepositoryId: PROJECT_REPOSITORY_ID,
          orgId: 'org-1',
          userId: 'user-1',
          title: createdSessionTitle,
          branch: createdSessionTitle ? `user/session-${SESSION_ID}` : 'user/session-1',
          baseBranch: 'main',
          sandboxId: null,
          sandboxWorkdir: null,
          materializedAt: materialized ? '2026-07-23T00:00:00.000Z' : null,
          createdAt: '2026-07-23T00:00:00.000Z',
          updatedAt: '2026-07-23T00:00:00.000Z',
        },
      });
    }),
    http.get(`${TEST_BASE_URL}/web/github/projects/:projectRepositoryId/sessions`, () =>
      HttpResponse.json({ sessions: [] }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/:factoryProjectId/work-items`, () =>
      HttpResponse.json({ workItems: [] }),
    ),
    http.get(`${TEST_BASE_URL}/web/github/subscriptions`, () => HttpResponse.json({ subscriptions: [] })),
    http.post(`${API}/sessions`, async () => {
      result.controllerCreates += 1;
      await workspaceReady;
      if (failWorkspace) return HttpResponse.json({ message: 'Clone failed' }, { status: 500 });
      return HttpResponse.json({ controllerId: 'code', resourceId: SESSION_ID, threadId: SESSION_ID });
    }),
    http.get(`${API}/modes`, () => HttpResponse.json({ modes: [{ id: 'build', label: 'Build' }] })),
    http.get(`${API}/models`, () =>
      HttpResponse.json({
        models: [
          { id: 'openai/gpt-4o-mini', provider: 'openai', modelName: 'gpt-4o-mini', hasApiKey: true, useCount: 1 },
        ],
      }),
    ),
    http.get(`${API}/sessions/:resourceId`, ({ params }) =>
      HttpResponse.json({
        controllerId: 'code',
        resourceId: params.resourceId,
        modeId: 'build',
        modelId: 'openai/gpt-4o-mini',
        threadId: SESSION_ID,
        tasks,
        settings: { yolo: false, thinkingLevel: 'medium', notifications: 'bell', smartEditing: true },
      }),
    ),
    http.get(`${API}/sessions/:resourceId/permissions`, () =>
      HttpResponse.json({ categories: { read: 'ask' }, tools: {} }),
    ),
    http.get(`${API}/sessions/:resourceId/threads`, () => HttpResponse.json({ threads: [] })),
    http.get(`${API}/sessions/:resourceId/threads/:threadId/messages`, () => HttpResponse.json({ messages: [] })),
    http.get(
      `${API}/sessions/:resourceId/stream`,
      () =>
        new Response(
          new ReadableStream<Uint8Array>({
            start(controller) {
              attachSse(controller);
            },
            cancel() {},
          }),
          { headers: { 'content-type': 'text/event-stream' } },
        ),
    ),
    http.put(`${API}/sessions/:resourceId/state`, () => HttpResponse.json({})),
    http.post(`${API}/sessions/:resourceId/mode`, async ({ request }) => {
      const body = (await request.json()) as { modeId?: string };
      result.operations.push(`mode:${body.modeId}`);
      return HttpResponse.json({ ok: true });
    }),
    http.post(`${API}/sessions/:resourceId/model`, async ({ request }) => {
      const body = (await request.json()) as { modelId?: string };
      result.operations.push(`model:${body.modelId}`);
      return HttpResponse.json({ ok: true });
    }),
    http.post(`${API}/sessions/:resourceId/messages`, async ({ request }) => {
      const body = await request.json();
      result.operations.push('message');
      result.posted.push(readSentMessage(body));
      result.postedFiles = readSentFiles(body);
      await workspaceReady;
      if (failWorkspace) return HttpResponse.json({ message: 'Clone failed' }, { status: 500 });
      if (failDispatch) return HttpResponse.json({ message: 'Sandbox is gone' }, { status: 500 });
      result.delivered.push(readSentMessage(body));
      if (autoAgentEnd) void result.emit({ type: 'agent_end' });
      return HttpResponse.json({ ok: true });
    }),
    http.post(`${API}/sessions/:resourceId/steer`, () => {
      result.steerAttempts += 1;
      return HttpResponse.json({ ok: true });
    }),
  );

  return result;
}

export async function releaseSession(finishWorkspace: () => void, client: QueryClient) {
  finishWorkspace();
  await waitForMutationsIdle(client);
  await waitFor(() => expect(screen.queryByText('Preparing workspace…')).not.toBeInTheDocument());
}

function ThreadSurface() {
  useHandoffPrompt();
  return (
    <>
      <Link to="/away">go-away</Link>
      <Transcript />
      <TaskPanel />
      <ActivityLine />
      <Composer />
    </>
  );
}

export function renderThread() {
  return renderWithProviders(
    <MemoryRouter initialEntries={[`/factories/${FACTORY_ID}/user/threads/${SESSION_ID}`]}>
      <Routes>
        <Route
          path="/factories/:factoryId/user/threads/:threadId"
          element={
            <MainSidebarProvider storageKey="preparing-test">
              <ChatSessionTestProvider threadId={SESSION_ID} userScoped deferUntilMessagesReady={false}>
                <OverlaysProvider>
                  <ThreadSurface />
                </OverlaysProvider>
              </ChatSessionTestProvider>
            </MainSidebarProvider>
          }
        />
        <Route
          path="/away"
          element={<Link to={`/factories/${FACTORY_ID}/user/threads/${SESSION_ID}`}>go-thread</Link>}
        />
      </Routes>
    </MemoryRouter>,
  );
}

function PathnameProbe() {
  return <output data-testid="pathname">{useLocation().pathname}</output>;
}

function DraftRouteSurface() {
  return (
    <ChatSessionBoundary deferUntilMessagesReady={false}>
      <ThreadSurface />
    </ChatSessionBoundary>
  );
}

function UserThreadRouteSurface() {
  const { threadId } = useParams<{ threadId: string }>();
  return (
    <ChatSessionBoundary threadId={threadId} deferUntilMessagesReady={false}>
      <ThreadSurface />
    </ChatSessionBoundary>
  );
}

export function renderDraft() {
  return renderWithProviders(
    <MemoryRouter initialEntries={[`/factories/${FACTORY_ID}/user/new/${SESSION_ID}`]}>
      <Routes>
        <Route path="/factories/:factoryId/user/new/:draftSessionId" element={<Chat />}>
          <Route index element={<DraftRouteSurface />} />
        </Route>
        <Route path="/factories/:factoryId/user/threads/:threadId" element={<Chat />}>
          <Route index element={<UserThreadRouteSurface />} />
        </Route>
      </Routes>
      <PathnameProbe />
    </MemoryRouter>,
  );
}

export function createdDraftSession(title: string) {
  return {
    id: 'row-draft',
    sessionId: SESSION_ID,
    projectRepositoryId: PROJECT_REPOSITORY_ID,
    orgId: 'org-1',
    userId: 'user-1',
    title,
    branch: `user/session-${SESSION_ID}`,
    baseBranch: 'main',
    sandboxId: null,
    sandboxWorkdir: null,
    materializedAt: null,
    createdAt: '2026-07-23T00:00:00.000Z',
    updatedAt: '2026-07-23T00:00:00.000Z',
  };
}
