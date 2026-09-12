import { MastraClient } from '@mastra/client-js';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import assert from 'node:assert';
import { describe, expect, it, vi } from 'vitest';

import { server } from '../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL, waitForMutationsIdle } from '../../../../../../e2e/ui/render';
import { releaseSession, renderThread, SESSION_ID, stubPreparingSession } from './composer-session-test-fixture';

describe('Composer while a session prepares its workspace', () => {
  it('sends the message straight away and shows it while the workspace comes up', async () => {
    const session = stubPreparingSession();
    const user = userEvent.setup();
    const { client } = renderThread();

    const message = () => screen.getByRole('textbox', { name: 'Message' });
    await waitFor(() => expect(message()).toBeEnabled());
    await waitFor(() => expect(screen.getByText('Preparing workspace…')).toBeInTheDocument());

    await user.type(message(), 'fix the login bug');
    await user.keyboard('{Enter}');

    await waitFor(() => expect(screen.getByText('fix the login bug')).toBeInTheDocument());
    await waitFor(() => expect(session.posted).toEqual(['fix the login bug']));
    expect(session.delivered).toEqual([]);

    session.finishWorkspace();
    await waitForMutationsIdle(client);

    await waitFor(() => expect(session.delivered).toEqual(['fix the login bug']));
    expect(screen.getAllByText('fix the login bug')).toHaveLength(1);

    await user.type(message(), 'follow up');
    await user.keyboard('{Enter}');
    await waitForMutationsIdle(client);

    await waitFor(() => expect(session.delivered).toEqual(['fix the login bug', 'follow up']));
    expect(session.steerAttempts).toBe(0);
  });

  it('blocks the first tab after another tab rebinds its session without fighting to reclaim the thread', async () => {
    const session = stubPreparingSession();
    const user = userEvent.setup();
    const { client } = renderThread();
    await releaseSession(session.finishWorkspace, client);

    const message = screen.getByRole('textbox', { name: 'Message' });
    await waitFor(() => expect(message).toBeEnabled());
    await user.type(message, 'keep this unsent draft');

    const sessionUrl = `${TEST_BASE_URL}/api/agent-controller/code/sessions/${SESSION_ID}`;
    let activeThreadId = SESSION_ID;
    const createdThreads: string[] = [];
    const conflictedReads = vi.fn();
    const onSwitch = vi.fn();
    let releaseConflict: (() => void) | undefined;
    const conflictGate = new Promise<void>(resolve => {
      releaseConflict = resolve;
    });
    server.use(
      http.post<never, { threadId: string }>(
        `${TEST_BASE_URL}/api/agent-controller/code/sessions`,
        async ({ request }) => {
          const body = await request.json();
          activeThreadId = body.threadId;
          createdThreads.push(activeThreadId);
          return HttpResponse.json({ controllerId: 'code', resourceId: SESSION_ID, threadId: activeThreadId });
        },
      ),
      http.get(sessionUrl, async ({ request }) => {
        if (new URL(request.url).searchParams.get('threadId') !== activeThreadId) {
          conflictedReads();
          await conflictGate;
          return HttpResponse.json({ error: 'Thread is not active in this session' }, { status: 409 });
        }
        return HttpResponse.json({ controllerId: 'code', resourceId: SESSION_ID, threadId: activeThreadId });
      }),
      http.post(`${sessionUrl}/thread`, () => {
        onSwitch();
        return HttpResponse.json({ ok: true });
      }),
    );

    const secondTab = new MastraClient({ baseUrl: TEST_BASE_URL, retries: 0 })
      .getAgentController('code')
      .session(SESSION_ID);
    await secondTab.create({ threadId: 'other-tab-thread' });
    await session.emit({ type: 'thread_changed', threadId: 'other-tab-thread', previousThreadId: SESSION_ID });
    await session.emit({
      type: 'display_state_changed',
      displayState: { threadId: 'other-tab-thread', tasks: [] },
    });
    await session.emit({
      type: 'task_updated',
      tasks: [{ id: 'foreign', content: 'Foreign task', status: 'pending', activeForm: 'Working elsewhere' }],
    });
    await waitFor(() => expect(message).toBeDisabled());
    expect(screen.getByText('Reconnecting…')).toBeVisible();
    await waitFor(() => expect(conflictedReads).toHaveBeenCalledTimes(1));
    expect(screen.queryByText('Foreign task')).not.toBeInTheDocument();
    releaseConflict?.();

    expect(await screen.findByText(/Session switched threads/)).toBeVisible();
    expect(screen.getByText(/Continue in the other tab or reload/)).toBeVisible();
    expect(message).toBeDisabled();
    expect(message).toHaveValue('keep this unsent draft');
    expect(screen.getByRole('button', { name: 'Send message' })).toBeDisabled();
    fireEvent.keyDown(message, { key: 'Enter' });
    expect(session.posted).toEqual([]);

    vi.useFakeTimers();
    try {
      await act(() => vi.advanceTimersByTimeAsync(60_000));
      expect(conflictedReads).toHaveBeenCalledTimes(1);
      expect(createdThreads).toEqual(['other-tab-thread']);
      expect(onSwitch).not.toHaveBeenCalled();
      expect(activeThreadId).toBe('other-tab-thread');
      expect(session.posted).toEqual([]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('delivers a message once when the sender navigates away before the workspace is ready', async () => {
    const session = stubPreparingSession();
    const user = userEvent.setup();
    const { client } = renderThread();

    const message = () => screen.getByRole('textbox', { name: 'Message' });
    await waitFor(() => expect(message()).toBeEnabled());
    await waitFor(() => expect(screen.getByText('Preparing workspace…')).toBeInTheDocument());

    await user.type(message(), 'fix the login bug');
    await user.keyboard('{Enter}');
    await waitFor(() => expect(session.posted).toEqual(['fix the login bug']));

    await user.click(screen.getByText('go-away'));
    await user.click(screen.getByText('go-thread'));

    session.finishWorkspace();
    await waitForMutationsIdle(client);

    await waitFor(() => expect(session.delivered).toEqual(['fix the login bug']));
    expect(session.posted).toEqual(['fix the login bug']);
    expect(session.steerAttempts).toBe(0);
  });

  it('keeps messages in order and never steers a session with no run to steer', async () => {
    const session = stubPreparingSession();
    const user = userEvent.setup();
    const { client } = renderThread();

    const message = () => screen.getByRole('textbox', { name: 'Message' });
    await waitFor(() => expect(message()).toBeEnabled());
    await waitFor(() => expect(screen.getByText('Preparing workspace…')).toBeInTheDocument());

    await user.type(message(), 'fix the login bug');
    await user.keyboard('{Enter}');
    await waitFor(() => expect(session.posted).toEqual(['fix the login bug']));

    await user.type(message(), 'and add a test');
    await user.keyboard('{Enter}');
    await waitFor(() => expect(session.posted).toEqual(['fix the login bug', 'and add a test']));

    expect(session.steerAttempts).toBe(0);
    expect(screen.getByText('Preparing workspace…')).toBeInTheDocument();

    session.finishWorkspace();
    await waitForMutationsIdle(client);

    await waitFor(() => expect(session.delivered).toEqual(['fix the login bug', 'and add a test']));
    expect(session.steerAttempts).toBe(0);
  });

  it('says connecting for a session whose workspace already exists', async () => {
    const session = stubPreparingSession({ materialized: true });
    const user = userEvent.setup();
    const { client } = renderThread();

    const message = () => screen.getByRole('textbox', { name: 'Message' });
    await waitFor(() => expect(message()).toBeEnabled());
    await waitFor(() => expect(screen.getByText('Connecting…')).toBeInTheDocument());
    expect(screen.queryByText('Preparing workspace…')).not.toBeInTheDocument();

    await user.type(message(), 'fix the login bug');
    await user.keyboard('{Enter}');

    session.finishWorkspace();
    await waitForMutationsIdle(client);

    await waitFor(() => expect(session.delivered).toEqual(['fix the login bug']));
  });

  it('reports a failed send once', async () => {
    const session = stubPreparingSession({ failDispatch: true });
    const user = userEvent.setup();
    const { client } = renderThread();

    const message = () => screen.getByRole('textbox', { name: 'Message' });
    await waitFor(() => expect(message()).toBeEnabled());
    await waitFor(() => expect(screen.getByText('Preparing workspace…')).toBeInTheDocument());

    await user.type(message(), 'fix the login bug');
    await user.keyboard('{Enter}');

    session.finishWorkspace();
    await waitForMutationsIdle(client);

    await waitFor(() => expect(screen.getAllByText(/Sandbox is gone/)).toHaveLength(1));
    await waitForMutationsIdle(client);
    expect(screen.getAllByText(/Sandbox is gone/)).toHaveLength(1);
    expect(screen.queryByRole('button', { name: 'Abort' })).not.toBeInTheDocument();
  });

  it('surfaces the workspace failure when the session cannot come online', async () => {
    const session = stubPreparingSession({ failWorkspace: true });
    const user = userEvent.setup();
    const { client } = renderThread();

    const message = () => screen.getByRole('textbox', { name: 'Message' });
    await waitFor(() => expect(message()).toBeEnabled());
    await waitFor(() => expect(screen.getByText('Preparing workspace…')).toBeInTheDocument());

    await user.type(message(), 'fix the login bug');
    await user.keyboard('{Enter}');
    session.finishWorkspace();
    await waitForMutationsIdle(client);

    await waitFor(() => expect(screen.getAllByText(/Clone failed/).length).toBeGreaterThan(0));
    expect(screen.getAllByText('fix the login bug')).toHaveLength(1);
    expect(session.delivered).toEqual([]);
  });

  it('carries an image attached while the workspace prepares', async () => {
    const session = stubPreparingSession();
    const user = userEvent.setup();
    const { container, client } = renderThread();

    const message = () => screen.getByRole('textbox', { name: 'Message' });
    await waitFor(() => expect(message()).toBeEnabled());
    await waitFor(() => expect(screen.getByText('Preparing workspace…')).toBeInTheDocument());
    // Drops are ignored while the composer is still initializing (messages
    // loading), so type first and wait for send to come online before attaching.
    await user.type(message(), 'what is wrong here');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Send message' })).toBeEnabled());

    const form = container.querySelector('form');
    assert(form);
    fireEvent.drop(form, { dataTransfer: { files: [new File(['png'], 'shot.png', { type: 'image/png' })] } });
    expect(await screen.findByRole('button', { name: 'Remove image' })).toBeInTheDocument();

    await user.keyboard('{Enter}');

    await waitFor(() => expect(session.posted).toEqual(['what is wrong here']));
    expect(session.postedFiles).toHaveLength(1);

    await releaseSession(session.finishWorkspace, client);
  });

  it('keeps a slash command in the composer while the session prepares', async () => {
    const session = stubPreparingSession();
    const user = userEvent.setup();
    const { client } = renderThread();

    const message = () => screen.getByRole('textbox', { name: 'Message' });
    await waitFor(() => expect(message()).toBeEnabled());
    await waitFor(() => expect(screen.getByText('Preparing workspace…')).toBeInTheDocument());

    await user.type(message(), '/goal ship it');
    await user.keyboard('{Enter}');

    await waitFor(() => expect(screen.getByText('Commands run once the session is ready.')).toBeInTheDocument());
    expect(message()).toHaveValue('/goal ship it');
    expect(session.posted).toEqual([]);

    await releaseSession(session.finishWorkspace, client);
  });

  it('runs local slash commands while preparing', async () => {
    const session = stubPreparingSession();
    const user = userEvent.setup();
    const { client } = renderThread();

    const message = () => screen.getByRole('textbox', { name: 'Message' });
    await waitFor(() => expect(message()).toBeEnabled());
    await waitFor(() => expect(screen.getByText('Preparing workspace…')).toBeInTheDocument());

    await user.type(message(), '/help');
    await user.keyboard('{Enter}');

    expect(await screen.findByText(/Available commands:/)).toBeInTheDocument();
    expect(message()).toHaveValue('');
    expect(session.posted).toEqual([]);

    await releaseSession(session.finishWorkspace, client);
  });
});
