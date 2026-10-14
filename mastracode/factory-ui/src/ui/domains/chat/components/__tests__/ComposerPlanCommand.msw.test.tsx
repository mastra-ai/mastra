import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';

import { server } from '../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL, renderWithProviders, waitForMutationsIdle } from '../../../../../../e2e/ui/render';
import { Composer } from '../Composer';
import { Transcript } from '../Transcript';
import {
  PROJECT_REPOSITORY_ID,
  SESSION_ID,
  createdDraftSession,
  releaseSession,
  renderDraft,
  renderThread,
  stubPreparingSession,
} from './composer-session-test-fixture';
import { OverlayTestProviders, useOverlayControllerHandlers } from './overlay-test-utils';

const CREATE_SESSION_URL = `${TEST_BASE_URL}/web/source-control/projects/${PROJECT_REPOSITORY_ID}/sessions`;

describe('/plan in a user session', () => {
  it('creates a draft session titled after the task and hands the whole command to the agent', async () => {
    const preparation = stubPreparingSession({ createdSessionTitle: 'add dark mode' });
    const createBodies: unknown[] = [];
    server.use(
      http.post(CREATE_SESSION_URL, async ({ request }) => {
        createBodies.push(await request.json());
        return HttpResponse.json({ session: createdDraftSession('add dark mode') });
      }),
    );
    const user = userEvent.setup();
    const { client } = renderDraft();

    const message = await screen.findByRole('textbox', { name: 'Message' });
    await waitFor(() => expect(message).toBeEnabled());
    await user.type(message, '/plan add dark mode{enter}');

    await waitFor(() => expect(createBodies).toEqual([{ sessionId: SESSION_ID, title: 'add dark mode' }]));
    preparation.finishWorkspace();
    await waitForMutationsIdle(client);
    await waitFor(() => expect(preparation.delivered).toEqual(['/plan add dark mode']));
    expect(screen.queryByText(/Unknown command/)).not.toBeInTheDocument();
  });

  it('keeps a bare /plan on a draft and asks for the task instead of creating a session', async () => {
    const preparation = stubPreparingSession();
    let sessionPosts = 0;
    server.use(
      http.post(CREATE_SESSION_URL, () => {
        sessionPosts += 1;
        return HttpResponse.json({ session: createdDraftSession('unused') });
      }),
    );
    const user = userEvent.setup();
    renderDraft();

    const message = await screen.findByRole('textbox', { name: 'Message' });
    await waitFor(() => expect(message).toBeEnabled());
    await user.type(message, '/plan{enter}');

    expect(await screen.findByText('Describe the task after /plan.')).toBeInTheDocument();
    expect(message).toHaveValue('/plan');
    expect(sessionPosts).toBe(0);
    expect(preparation.controllerCreates).toBe(0);
  });

  it('sends /plan to the agent like any message once the session is ready', async () => {
    const session = stubPreparingSession({ materialized: true });
    const user = userEvent.setup();
    const { client } = renderThread();
    await releaseSession(session.finishWorkspace, client);

    const message = await screen.findByRole('textbox', { name: 'Message' });
    await waitFor(() => expect(message).toBeEnabled());
    await user.type(message, '/plan add dark mode{enter}');
    await waitForMutationsIdle(client);

    await waitFor(() => expect(session.posted).toEqual(['/plan add dark mode']));
    expect(screen.queryByText(/Unknown command/)).not.toBeInTheDocument();
  });
});

describe('/plan in a workspace thread', () => {
  beforeEach(useOverlayControllerHandlers);

  it('is an unknown command, so it never reaches the agent', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <OverlayTestProviders>
        <Transcript />
        <Composer />
      </OverlayTestProviders>,
    );
    const message = await screen.findByRole('textbox', { name: 'Message' });
    await waitFor(() => expect(message).toBeEnabled());

    await user.type(message, '/plan add dark mode{enter}');

    expect(await screen.findByText('Unknown command: /plan')).toBeInTheDocument();
    expect(message).toHaveValue('/plan add dark mode');
  });
});
