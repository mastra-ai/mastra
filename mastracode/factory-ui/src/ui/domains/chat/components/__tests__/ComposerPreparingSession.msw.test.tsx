import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import assert from 'node:assert';
import { describe, expect, it } from 'vitest';

import { waitForMutationsIdle } from '../../../../../../e2e/ui/render';
import { releaseSession, renderThread, stubPreparingSession } from './composer-session-test-fixture';

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
