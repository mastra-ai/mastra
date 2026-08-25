import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import assert from 'node:assert';
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
      http.post(`${TEST_BASE_URL}/web/github/projects/${PROJECT_REPOSITORY_ID}/sessions`, async ({ request }) => {
        createBodies.push(await request.json());
        await createFinished;
        return HttpResponse.json({ session: createdDraftSession('fix the login bug') });
      }),
    );
    const user = userEvent.setup();
    const { client, container } = renderDraft();

    const message = await screen.findByRole('textbox', { name: 'Message' });
    await waitFor(() => expect(message).toBeEnabled());
    expect(screen.getByRole('button', { name: 'Attach image' })).toBeDisabled();
    expect(createBodies).toEqual([]);
    expect(preparation.controllerCreates).toBe(0);
    expect(preparation.sessionLookups).toBe(0);
    expect(preparation.ensureRequests).toBe(0);

    const form = container.querySelector('form');
    assert(form);
    fireEvent.drop(form, { dataTransfer: { files: [new File(['png'], 'shot.png', { type: 'image/png' })] } });
    expect(await screen.findByText('Images can be attached once the session is ready.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Remove image' })).not.toBeInTheDocument();
    expect(createBodies).toEqual([]);

    await user.type(message, '  fix the login bug  ');
    await user.keyboard('{Enter}');

    await waitFor(() => expect(createBodies).toEqual([{ sessionId: SESSION_ID, title: 'fix the login bug' }]));
    expect(screen.getByTestId('pathname')).toHaveTextContent(`/factories/${FACTORY_ID}/user/new/${SESSION_ID}`);
    expect(preparation.controllerCreates).toBe(0);

    finishCreate();

    await waitFor(() =>
      expect(screen.getByTestId('pathname')).toHaveTextContent(`/factories/${FACTORY_ID}/user/threads/${SESSION_ID}`),
    );
    await waitFor(() => expect(preparation.posted).toEqual(['fix the login bug']));
    expect(preparation.delivered).toEqual([]);
    await waitFor(() => expect(screen.getByText('fix the login bug')).toBeInTheDocument());
    expect(client.getQueryData(queryKeys.userSession(SESSION_ID))).toEqual(createdDraftSession('fix the login bug'));
    expect(client.getQueryData(queryKeys.sessions(PROJECT_REPOSITORY_ID))).toBeUndefined();

    preparation.finishWorkspace();
    await waitForMutationsIdle(client);
    await waitFor(() => expect(preparation.delivered).toEqual(['fix the login bug']));
    expect(preparation.posted).toEqual(['fix the login bug']);
    expect(screen.getAllByText('fix the login bug')).toHaveLength(1);
  });

  it('applies a draft-selected pack before dispatching the first prompt', async () => {
    const preparation = stubPreparingSession({ createdSessionTitle: 'use my pack' });
    server.use(
      http.post(`${TEST_BASE_URL}/web/github/projects/${PROJECT_REPOSITORY_ID}/sessions`, () =>
        HttpResponse.json({ session: createdDraftSession('use my pack') }),
      ),
    );
    const user = userEvent.setup();
    const { client } = renderDraft();

    const modelPicker = await screen.findByLabelText('Session model');
    await waitFor(() => expect(modelPicker).toHaveAttribute('title', expect.stringContaining('Balanced')));
    await user.click(modelPicker);
    await user.click(await screen.findByRole('option', { name: /Model pack Mine/ }));
    expect(modelPicker).toHaveAttribute('title', expect.stringContaining('Mine'));
    expect(preparation.operations).toEqual([]);

    const message = screen.getByRole('textbox', { name: 'Message' });
    await user.type(message, 'use my pack');
    await user.keyboard('{Enter}');
    await waitFor(() =>
      expect(screen.getByTestId('pathname')).toHaveTextContent(`/factories/${FACTORY_ID}/user/threads/${SESSION_ID}`),
    );

    preparation.finishWorkspace();
    await waitForMutationsIdle(client);
    await waitFor(() => expect(preparation.delivered).toEqual(['use my pack']));
    // Activation applies the pack's models server-side, so no separate model
    // switch is sent for the pack-derived model.
    expect(preparation.operations).toEqual(['mode:build', 'pack:mine', 'message']);
  });

  it('still dispatches the first prompt when draft pack activation fails', async () => {
    const preparation = stubPreparingSession({ createdSessionTitle: 'keep my prompt' });
    server.use(
      http.post(`${TEST_BASE_URL}/web/github/projects/${PROJECT_REPOSITORY_ID}/sessions`, () =>
        HttpResponse.json({ session: createdDraftSession('keep my prompt') }),
      ),
      http.post(`${TEST_BASE_URL}/web/config/model-packs/mine/activate`, () =>
        HttpResponse.json({ error: 'Pack unavailable' }, { status: 500 }),
      ),
    );
    const user = userEvent.setup();
    const { client } = renderDraft();

    const modelPicker = await screen.findByLabelText('Session model');
    await user.click(modelPicker);
    await user.click(await screen.findByRole('option', { name: /Model pack Mine/ }));
    const message = screen.getByRole('textbox', { name: 'Message' });
    await user.type(message, 'keep my prompt');
    await user.keyboard('{Enter}');
    await waitFor(() =>
      expect(screen.getByTestId('pathname')).toHaveTextContent(`/factories/${FACTORY_ID}/user/threads/${SESSION_ID}`),
    );

    preparation.finishWorkspace();
    await waitForMutationsIdle(client);
    await waitFor(() => expect(preparation.delivered).toEqual(['keep my prompt']));
    // The user must learn the pack was not applied.
    expect(await screen.findByText('Pack unavailable')).toBeInTheDocument();
    // The pack failed, so its build model must not be half-applied either —
    // the session keeps its own defaults.
    expect(preparation.operations).toEqual(['mode:build', 'message']);
  });

  it('restores the exact prompt after failure and retries with the same route UUID', async () => {
    const preparation = stubPreparingSession({ createdSessionTitle: 'retry this prompt' });
    const createBodies: unknown[] = [];
    let attempts = 0;
    server.use(
      http.post(`${TEST_BASE_URL}/web/github/projects/${PROJECT_REPOSITORY_ID}/sessions`, async ({ request }) => {
        createBodies.push(await request.json());
        attempts += 1;
        if (attempts === 1) return HttpResponse.json({ message: 'Database unavailable' }, { status: 500 });
        return HttpResponse.json({ session: createdDraftSession('retry this prompt') });
      }),
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
      http.post(`${TEST_BASE_URL}/web/github/projects/${PROJECT_REPOSITORY_ID}/sessions`, () => {
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
