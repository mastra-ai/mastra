import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';

import { server } from '../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL, renderWithProviders } from '../../../../../../e2e/ui/render';
import {
  OVERLAY_FACTORY_ID,
  OverlayTestProviders,
  useOverlayControllerHandlers,
} from '../../components/__tests__/overlay-test-utils';
import { useChatSessionContext } from '../useChatSessionContext';

const API = `${TEST_BASE_URL}/api/agent-controller/code`;
const SESSION_ID = 'session-overlay';

function SessionAddress() {
  const { sessionId, resourceId } = useChatSessionContext();
  return <span data-testid="address">{`${sessionId}|${resourceId}`}</span>;
}

/** Serves the stored session with the memory resource the server reports for it. */
function stubStoredSession(resourceId: string) {
  const sessionPaths: string[] = [];
  const createBodies: unknown[] = [];
  server.use(
    http.get(`${TEST_BASE_URL}/web/user-sessions/:sessionId`, () =>
      HttpResponse.json({
        session: {
          id: 'row-overlay',
          sessionId: SESSION_ID,
          projectRepositoryId: 'repo-overlay',
          orgId: 'org-overlay',
          userId: 'user-overlay',
          resourceId,
          branch: 'overlay-workspace',
          baseBranch: 'main',
          sandboxId: 'sandbox-overlay',
          sandboxWorkdir: '/workspace/overlay',
          materializedAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      }),
    ),
    http.post(`${API}/sessions`, async ({ request }) => {
      const body = await request.json();
      createBodies.push(body);
      return HttpResponse.json({ controllerId: 'code', sessionId: SESSION_ID, resourceId, threadId: 'thread-test' });
    }),
    http.get(`${API}/sessions/:sessionId/*`, ({ request, params }) => {
      sessionPaths.push(String(params.sessionId));
      return new URL(request.url).pathname.endsWith('/stream')
        ? new Response(new ReadableStream<Uint8Array>({ start() {}, cancel() {} }), {
            headers: { 'content-type': 'text/event-stream' },
          })
        : HttpResponse.json({ threads: [], messages: [], categories: {}, tools: {} });
    }),
  );
  return { sessionPaths, createBodies };
}

function renderSession() {
  renderWithProviders(
    <OverlayTestProviders>
      <SessionAddress />
    </OverlayTestProviders>,
  );
}

describe('opening a Factory session', () => {
  beforeEach(() => {
    useOverlayControllerHandlers();
  });

  it('addresses a user session by its id and creates it under the user', async () => {
    const { sessionPaths, createBodies } = stubStoredSession('user-overlay');
    renderSession();

    expect(await screen.findByTestId('address')).toHaveTextContent(`${SESSION_ID}|user-overlay`);
    await waitFor(() =>
      expect(createBodies).toContainEqual(
        expect.objectContaining({ sessionId: SESSION_ID, resourceId: 'user-overlay' }),
      ),
    );
    await waitFor(() => expect(sessionPaths.length).toBeGreaterThan(0));
    expect(new Set(sessionPaths)).toEqual(new Set([SESSION_ID]));
  });

  it('addresses a run session by its id and creates it under its Factory', async () => {
    const { sessionPaths, createBodies } = stubStoredSession(OVERLAY_FACTORY_ID);
    renderSession();

    expect(await screen.findByTestId('address')).toHaveTextContent(`${SESSION_ID}|${OVERLAY_FACTORY_ID}`);
    await waitFor(() =>
      expect(createBodies).toContainEqual(
        expect.objectContaining({ sessionId: SESSION_ID, resourceId: OVERLAY_FACTORY_ID }),
      ),
    );
    await waitFor(() => expect(sessionPaths.length).toBeGreaterThan(0));
    expect(new Set(sessionPaths)).toEqual(new Set([SESSION_ID]));
  });
});
