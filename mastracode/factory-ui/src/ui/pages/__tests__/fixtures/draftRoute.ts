import { http, HttpResponse } from 'msw';

import { server } from '../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL } from '../../../../../e2e/ui/render';
import type { FactoryUserSession } from '../../../domains/workspaces/services/user-sessions';

export const FACTORY_ID = 'factory-draft-handoff';
export const DRAFT_SESSION_ID = '30000000-0000-4000-8000-000000000001';
const REPOSITORY_ID = 'repository-draft-handoff';
const AGENT_CONTROLLER_API = `${TEST_BASE_URL}/api/agent-controller/code`;

const createdSession: FactoryUserSession = {
  id: 'row-draft',
  sessionId: DRAFT_SESSION_ID,
  projectRepositoryId: REPOSITORY_ID,
  orgId: 'org-1',
  userId: 'user-1',
  visibility: 'private',
  title: 'fix the login bug',
  branch: `user/session-${DRAFT_SESSION_ID}`,
  baseBranch: 'main',
  sandboxId: null,
  sandboxWorkdir: null,
  materializedAt: null,
  createdAt: '2026-08-07T09:00:00.000Z',
  updatedAt: '2026-08-07T09:00:00.000Z',
};

export interface DraftRoute {
  createBodies: unknown[];
  posted: string[];
  bindings: string[];
  bindingsBeforePrompt: string[];
  finishWorkspace: () => void;
}

interface DraftRouteOptions {
  modelDefaultsGate?: Promise<void>;
  defaultModelId?: string | null;
  /** Messages the session thread holds once it exists. */
  persistedMessages?: unknown[];
  /** The Factory's cards, in the wire shape the work-items route answers with. */
  workItems?: unknown[];
}

function readSentMessage(body: unknown): string {
  if (typeof body !== 'object' || body === null || !('message' in body)) return '';
  return typeof body.message === 'string' ? body.message : '';
}

export function stubDraftRoute({
  modelDefaultsGate,
  defaultModelId = null,
  persistedMessages = [],
  workItems = [],
}: DraftRouteOptions = {}): DraftRoute {
  let releaseWorkspace = () => {};
  // The server creates the session's thread only once the controller session
  // boots, so until then reading its history is a 404, as in production.
  let threadExists = false;
  const workspaceReady = new Promise<void>(resolve => {
    releaseWorkspace = () => {
      threadExists = true;
      resolve();
    };
  });
  const route: DraftRoute = {
    createBodies: [],
    posted: [],
    bindings: [],
    bindingsBeforePrompt: [],
    finishWorkspace: () => releaseWorkspace(),
  };

  function readBody(body: unknown, key: string): string {
    return typeof body === 'object' && body !== null && key in body ? String(Reflect.get(body, key)) : '';
  }

  server.use(
    http.get(`${TEST_BASE_URL}/auth/me`, () =>
      HttpResponse.json({ authenticated: true, authEnabled: true, user: { userId: 'user-1' } }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects`, () =>
      HttpResponse.json({ projects: [{ id: FACTORY_ID, name: 'Acme Factory' }] }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}`, async () => {
      await modelDefaultsGate;
      return HttpResponse.json({
        project: {
          id: FACTORY_ID,
          name: 'Acme Factory',
          modelScope: 'hybrid',
          defaultModelId: 'openai/gpt-4o-mini',
          defaultThinkingLevel: 'medium',
        },
      });
    }),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/source-control-connections`, () =>
      HttpResponse.json({
        connections: [
          {
            id: 'connection-1',
            installationId: 'installation-1',
            repositories: [
              {
                id: REPOSITORY_ID,
                branch: 'main',
                sandboxWorkdir: '/workspace/acme',
                repository: { slug: 'acme/app', defaultBranch: 'main' },
              },
            ],
          },
        ],
      }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/work-items`, () => HttpResponse.json({ workItems })),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/decisions`, () =>
      HttpResponse.json({ decisions: [] }),
    ),
    http.get(`${TEST_BASE_URL}/web/config/default-model`, async () => {
      await modelDefaultsGate;
      return HttpResponse.json({ modelId: defaultModelId, thinkingLevel: null });
    }),
    http.get(`${TEST_BASE_URL}/web/config/models`, () =>
      HttpResponse.json({
        models: [{ id: 'openai/gpt-4o-mini', provider: 'openai', modelName: 'gpt-4o-mini', hasApiKey: true }],
        fallbackModelId: 'openai/gpt-4o-mini',
      }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/sessions`, () => HttpResponse.json({ sessions: [] })),
    http.post(`${TEST_BASE_URL}/web/source-control/projects/${REPOSITORY_ID}/sessions`, async ({ request }) => {
      route.createBodies.push(await request.json());
      return HttpResponse.json({ session: createdSession });
    }),
    http.get(`${TEST_BASE_URL}/web/github/subscriptions`, () => HttpResponse.json({ subscriptions: [] })),
    http.get(`${TEST_BASE_URL}/web/user-sessions/${DRAFT_SESSION_ID}`, () =>
      HttpResponse.json({ session: createdSession }),
    ),
    http.post(`${AGENT_CONTROLLER_API}/sessions`, async () => {
      await workspaceReady;
      return HttpResponse.json({ controllerId: 'code', resourceId: DRAFT_SESSION_ID, threadId: DRAFT_SESSION_ID });
    }),
    http.post(`${AGENT_CONTROLLER_API}/sessions/:resourceId/mode`, async ({ request }) => {
      route.bindings.push(`mode:${readBody(await request.json(), 'modeId')}`);
      return HttpResponse.json({ ok: true });
    }),
    http.get(`${AGENT_CONTROLLER_API}/models`, () => HttpResponse.json({ models: [] })),
    http.get(`${AGENT_CONTROLLER_API}/sessions/:resourceId`, ({ params }) =>
      HttpResponse.json({
        controllerId: 'code',
        resourceId: params.resourceId,
        modeId: 'build',
        modelId: 'openai/gpt-4o-mini',
        threadId: DRAFT_SESSION_ID,
        settings: { yolo: false, thinkingLevel: 'medium', notifications: 'bell', smartEditing: true },
      }),
    ),
    http.put(`${AGENT_CONTROLLER_API}/sessions/:resourceId/state`, () => HttpResponse.json({})),
    http.get(`${AGENT_CONTROLLER_API}/sessions/:resourceId/permissions`, () => HttpResponse.json({})),
    http.get(`${AGENT_CONTROLLER_API}/sessions/:resourceId/threads`, () => HttpResponse.json({ threads: [] })),
    http.get(`${AGENT_CONTROLLER_API}/sessions/:resourceId/threads/:threadId/messages`, () =>
      threadExists
        ? HttpResponse.json({ messages: persistedMessages })
        : HttpResponse.json({ error: 'Thread not found' }, { status: 404 }),
    ),
    http.get(
      `${AGENT_CONTROLLER_API}/sessions/:resourceId/stream`,
      () =>
        new Response(new ReadableStream<Uint8Array>({ start() {}, cancel() {} }), {
          headers: { 'content-type': 'text/event-stream' },
        }),
    ),
    http.post(`${AGENT_CONTROLLER_API}/sessions/:resourceId/model`, async ({ request }) => {
      const body = await request.json();
      const thinkingLevel = readBody(body, 'thinkingLevel');
      const thinkingSuffix = thinkingLevel ? ` thinking:${thinkingLevel}` : '';
      route.bindings.push(`model:${readBody(body, 'modelId')}${thinkingSuffix}`);
      return HttpResponse.json({ ok: true });
    }),
    http.post(`${AGENT_CONTROLLER_API}/sessions/:resourceId/messages`, async ({ request }) => {
      route.bindingsBeforePrompt = [...route.bindings];
      route.posted.push(readSentMessage(await request.json()));
      await workspaceReady;
      return HttpResponse.json({ ok: true });
    }),
    http.get(`${TEST_BASE_URL}/web/workspace/rendered/list`, () =>
      HttpResponse.json({
        workspacePath: `/workspace/${DRAFT_SESSION_ID}`,
        root: '.artifacts',
        rootPath: '',
        entries: [],
      }),
    ),
  );

  return route;
}
