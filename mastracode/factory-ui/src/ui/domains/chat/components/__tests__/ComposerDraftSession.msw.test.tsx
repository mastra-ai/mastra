import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL, waitForMutationsIdle } from '../../../../../../e2e/ui/render';
import { queryKeys } from '../../../../../api/keys';
import {
  FACTORY_ID,
  PROJECT_REPOSITORY_ID,
  SESSION_ID,
  createdDraftSession,
  renderDraft,
  renderThread,
  stubPreparingSession,
} from './composer-session-test-fixture';

describe('Composer on a lazy user-session draft', () => {
  it('creates the session on the first prompt, then hands that prompt to the thread it opens', async () => {
    const preparation = stubPreparingSession({ createdSessionTitle: 'fix the login bug' });
    let finishCreate = () => {};
    const createFinished = new Promise<void>(resolve => {
      finishCreate = resolve;
    });
    const createBodies: unknown[] = [];
    server.use(
      http.post(
        `${TEST_BASE_URL}/web/source-control/projects/${PROJECT_REPOSITORY_ID}/sessions`,
        async ({ request }) => {
          createBodies.push(await request.json());
          await createFinished;
          return HttpResponse.json({ session: createdDraftSession('fix the login bug') });
        },
      ),
    );
    const user = userEvent.setup();
    const { client } = renderDraft();

    const message = await screen.findByRole('textbox', { name: 'Message' });
    await waitFor(() => expect(message).toBeEnabled());
    expect(createBodies).toEqual([]);
    expect(preparation.controllerCreates).toBe(0);
    expect(preparation.sessionLookups).toBe(0);

    await user.type(message, '  fix the login bug  ');
    await user.keyboard('{Enter}');

    await waitFor(() => expect(createBodies).toEqual([{ sessionId: SESSION_ID, title: 'fix the login bug' }]));
    expect(screen.getByTestId('pathname')).toHaveTextContent(`/factories/${FACTORY_ID}/user/new/${SESSION_ID}`);
    expect(preparation.controllerCreates).toBe(0);

    finishCreate();

    await waitFor(() =>
      expect(screen.getByTestId('pathname')).toHaveTextContent(`/factories/${FACTORY_ID}/user/threads/${SESSION_ID}`),
    );
    await waitFor(() => expect(screen.getByText('fix the login bug')).toBeInTheDocument());
    // The prompt waits for session init to bind the session thread.
    expect(preparation.posted).toEqual([]);
    expect(client.getQueryData(queryKeys.userSession(SESSION_ID))).toEqual(createdDraftSession('fix the login bug'));
    expect(client.getQueryData(queryKeys.sessions(PROJECT_REPOSITORY_ID))).toBeUndefined();

    preparation.finishWorkspace();
    await waitForMutationsIdle(client);
    await waitFor(() => expect(preparation.delivered).toEqual(['fix the login bug']));
    expect(preparation.posted).toEqual(['fix the login bug']);
    expect(screen.getAllByText('fix the login bug')).toHaveLength(1);
  });

  it('restores a first prompt interrupted before the session binds without sending it', async () => {
    const preparation = stubPreparingSession({ createdSessionTitle: 'recover this prompt' });
    server.use(
      http.post(`${TEST_BASE_URL}/web/source-control/projects/${PROJECT_REPOSITORY_ID}/sessions`, () =>
        HttpResponse.json({ session: createdDraftSession('recover this prompt') }),
      ),
    );
    const user = userEvent.setup();
    const firstPage = renderDraft();
    const message = await screen.findByRole('textbox', { name: 'Message' });
    await waitFor(() => expect(message).toBeEnabled());
    await user.type(message, 'recover this prompt');
    await user.keyboard('{Enter}');
    await waitFor(() => expect(screen.getByText('recover this prompt')).toBeInTheDocument());

    // The workspace is still preparing, so the session has not bound its
    // thread. A page reload must restore the prompt, never send it on its own.
    firstPage.unmount();
    const recoveredPage = renderThread();
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Message' })).toHaveValue('recover this prompt'));
    expect(await screen.findByText(/Check the transcript before retrying/)).toBeInTheDocument();
    recoveredPage.unmount();
    renderThread();
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Message' })).toHaveValue('recover this prompt'));
    expect(preparation.posted).toEqual([]);
  });

  it('gives the first prompt back when the session cannot start', async () => {
    const preparation = stubPreparingSession({ createdSessionTitle: 'never sent', failWorkspace: true });
    server.use(
      http.post(`${TEST_BASE_URL}/web/source-control/projects/${PROJECT_REPOSITORY_ID}/sessions`, () =>
        HttpResponse.json({ session: createdDraftSession('never sent') }),
      ),
    );
    const user = userEvent.setup();
    const { client, unmount } = renderDraft();
    const message = await screen.findByRole('textbox', { name: 'Message' });
    await waitFor(() => expect(message).toBeEnabled());
    await user.type(message, 'never sent');
    await user.keyboard('{Enter}');
    await waitFor(() =>
      expect(screen.getByTestId('pathname')).toHaveTextContent(`/factories/${FACTORY_ID}/user/threads/${SESSION_ID}`),
    );

    preparation.finishWorkspace();
    await waitForMutationsIdle(client);

    expect(await screen.findByText(/The session could not start, so the message was not sent/)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Message' })).toHaveValue('never sent'));
    expect(preparation.posted).toEqual([]);

    // The failed session blocks the composer and asks for a reload, which
    // must bring the unsent prompt back.
    unmount();
    renderThread();
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Message' })).toHaveValue('never sent'));
    expect(preparation.posted).toEqual([]);
  });

  it('applies a draft-selected model before dispatching the first prompt', async () => {
    const preparation = stubPreparingSession({ createdSessionTitle: 'use my model' });
    server.use(
      http.post(`${TEST_BASE_URL}/web/source-control/projects/${PROJECT_REPOSITORY_ID}/sessions`, () =>
        HttpResponse.json({ session: createdDraftSession('use my model') }),
      ),
    );
    const user = userEvent.setup();
    const { client } = renderDraft();

    const modelPicker = await screen.findByLabelText('Session model');
    await waitFor(() => expect(modelPicker).toHaveAttribute('title', expect.stringContaining('gpt-4o-mini')));
    await user.click(modelPicker);
    await user.click(await screen.findByRole('option', { name: /gpt-5.4-mini/ }));
    expect(modelPicker).toHaveAttribute('title', expect.stringContaining('gpt-5.4-mini'));
    expect(preparation.operations).toEqual([]);

    const message = screen.getByRole('textbox', { name: 'Message' });
    await user.type(message, 'use my model');
    await user.keyboard('{Enter}');
    await waitFor(() =>
      expect(screen.getByTestId('pathname')).toHaveTextContent(`/factories/${FACTORY_ID}/user/threads/${SESSION_ID}`),
    );

    preparation.finishWorkspace();
    await waitForMutationsIdle(client);
    await waitFor(() => expect(preparation.delivered).toEqual(['use my model']));
    expect(preparation.operations).toEqual(['model:openai/gpt-5.4-mini', 'message']);
  });

  it('still dispatches the first prompt when the draft model switch fails', async () => {
    const preparation = stubPreparingSession({ createdSessionTitle: 'keep my prompt' });
    server.use(
      http.post(`${TEST_BASE_URL}/web/source-control/projects/${PROJECT_REPOSITORY_ID}/sessions`, () =>
        HttpResponse.json({ session: createdDraftSession('keep my prompt') }),
      ),
      http.post(`${TEST_BASE_URL}/api/agent-controller/code/sessions/${SESSION_ID}/model`, () =>
        HttpResponse.json({ error: 'Model unavailable' }, { status: 500 }),
      ),
    );
    const user = userEvent.setup();
    const { client } = renderDraft();

    const modelPicker = await screen.findByLabelText('Session model');
    await user.click(modelPicker);
    await user.click(await screen.findByRole('option', { name: /gpt-5.4-mini/ }));
    const message = screen.getByRole('textbox', { name: 'Message' });
    await user.type(message, 'keep my prompt');
    await user.keyboard('{Enter}');
    await waitFor(() =>
      expect(screen.getByTestId('pathname')).toHaveTextContent(`/factories/${FACTORY_ID}/user/threads/${SESSION_ID}`),
    );

    preparation.finishWorkspace();
    await waitForMutationsIdle(client);
    await waitFor(() => expect(preparation.delivered).toEqual(['keep my prompt']));
    expect(preparation.operations).toEqual(['message']);
  });

  it('restores the exact prompt after failure and retries with the same route UUID', async () => {
    const preparation = stubPreparingSession({ createdSessionTitle: 'retry this prompt' });
    const createBodies: unknown[] = [];
    let attempts = 0;
    server.use(
      http.post(
        `${TEST_BASE_URL}/web/source-control/projects/${PROJECT_REPOSITORY_ID}/sessions`,
        async ({ request }) => {
          createBodies.push(await request.json());
          attempts += 1;
          if (attempts === 1) return HttpResponse.json({ message: 'Database unavailable' }, { status: 500 });
          return HttpResponse.json({ session: createdDraftSession('retry this prompt') });
        },
      ),
    );
    const user = userEvent.setup();
    const { client } = renderDraft();
    const draftUrl = `/factories/${FACTORY_ID}/user/new/${SESSION_ID}`;

    const message = await screen.findByRole('textbox', { name: 'Message' });
    await waitFor(() => expect(message).toBeEnabled());
    await user.type(message, '  retry this prompt  ');
    await user.keyboard('{Enter}');

    await waitFor(() => expect(message).toHaveValue('retry this prompt'));
    expect(screen.getByTestId('pathname')).toHaveTextContent(draftUrl);
    expect(await screen.findByText(/Could not create the session: Database unavailable/)).toBeInTheDocument();
    expect(preparation.posted).toEqual([]);

    await user.keyboard('{Enter}');

    await waitFor(() =>
      expect(screen.getByTestId('pathname')).toHaveTextContent(`/factories/${FACTORY_ID}/user/threads/${SESSION_ID}`),
    );
    expect(createBodies).toEqual([
      { sessionId: SESSION_ID, title: 'retry this prompt' },
      { sessionId: SESSION_ID, title: 'retry this prompt' },
    ]);

    preparation.finishWorkspace();
    await waitForMutationsIdle(client);
    await waitFor(() => expect(preparation.delivered).toEqual(['retry this prompt']));
  });

  it('runs local commands and preserves commands that cannot run on a draft', async () => {
    const preparation = stubPreparingSession();
    let sessionPosts = 0;
    server.use(
      http.post(`${TEST_BASE_URL}/web/source-control/projects/${PROJECT_REPOSITORY_ID}/sessions`, () => {
        sessionPosts += 1;
        return HttpResponse.json({ session: createdDraftSession('unused') });
      }),
    );
    const user = userEvent.setup();
    renderDraft();

    const message = await screen.findByRole('textbox', { name: 'Message' });
    await waitFor(() => expect(message).toBeEnabled());
    await user.type(message, '/help');
    await user.keyboard('{Enter}');

    expect(await screen.findByText(/Available commands:/)).toBeInTheDocument();
    expect(message).toHaveValue('');
    expect(sessionPosts).toBe(0);
    expect(preparation.controllerCreates).toBe(0);

    await user.type(message, '/goal ship it');
    await user.keyboard('{Enter}');

    expect(
      await screen.findByText('This command needs a session. Send a prompt to create one first.'),
    ).toBeInTheDocument();
    expect(message).toHaveValue('/goal ship it');
    expect(sessionPosts).toBe(0);
    expect(preparation.controllerCreates).toBe(0);

    await user.clear(message);
    await user.type(message, '/think high');
    await user.keyboard('{Enter}');

    expect(await screen.findAllByText('This command needs a session. Send a prompt to create one first.')).toHaveLength(
      2,
    );
    expect(message).toHaveValue('/think high');
    expect(sessionPosts).toBe(0);
    expect(preparation.controllerCreates).toBe(0);

    await user.clear(message);
    await user.type(message, '/followup keep this');
    await user.keyboard('{Enter}');

    expect(await screen.findByText('Unknown command: /followup')).toBeInTheDocument();
    expect(message).toHaveValue('/followup keep this');
    expect(sessionPosts).toBe(0);
    expect(preparation.controllerCreates).toBe(0);

    await user.clear(message);
    await user.type(message, '/nope try this');
    await user.keyboard('{Enter}');

    expect(await screen.findByText('Unknown command: /nope')).toBeInTheDocument();
    expect(message).toHaveValue('/nope try this');
    expect(sessionPosts).toBe(0);
    expect(preparation.controllerCreates).toBe(0);
  });
});
