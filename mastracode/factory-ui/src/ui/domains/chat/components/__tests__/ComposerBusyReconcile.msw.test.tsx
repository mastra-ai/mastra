/**
 * BDD coverage for the composer's busy latch against server truth. Sending a
 * message arms `pending` until an `agent_end` arrives; when the stream loses
 * that event, only a session-state snapshot fetched after the send can say the
 * run is over. In production that fetch comes from the disconnect poll or the
 * reconnect invalidation — here the test invalidates the state query directly.
 */
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL } from '../../../../../../e2e/ui/render';
import { SESSION_ID, releaseSession, renderThread, stubPreparingSession } from './composer-session-test-fixture';

const API = `${TEST_BASE_URL}/api/agent-controller/code`;

describe('Composer busy reconcile', () => {
  it('given a send whose agent_end never arrives, when a fresh snapshot says the run is over, then the composer returns to idle', async () => {
    const session = stubPreparingSession({ autoAgentEnd: false });
    let stateReads = 0;
    server.use(
      http.get(`${API}/sessions/:resourceId`, ({ params }) => {
        stateReads += 1;
        return HttpResponse.json({
          controllerId: 'code',
          resourceId: params.resourceId,
          modeId: 'build',
          modelId: 'openai/gpt-4o-mini',
          threadId: SESSION_ID,
          running: false,
          settings: { yolo: false, thinkingLevel: 'medium', notifications: 'bell', smartEditing: true },
        });
      }),
    );

    const user = userEvent.setup();
    const { client } = renderThread();
    await releaseSession(session.finishWorkspace, client);

    const composer = await screen.findByRole('textbox', { name: 'Message' });
    await waitFor(() => expect(composer).toHaveAttribute('placeholder', 'Ask Mastra Code…'));

    await user.type(composer, 'Check the failing build');
    await user.keyboard('{Enter}');
    await waitFor(() => expect(session.delivered).toEqual(['Check the failing build']));
    await waitFor(() => expect(composer).toHaveAttribute('placeholder', 'Steer the agent…'));

    await client.invalidateQueries({ queryKey: ['agent-controller', 'code', 'connection', SESSION_ID] });
    await waitFor(() => expect(stateReads).toBeGreaterThanOrEqual(2));

    await waitFor(() => expect(composer).toHaveAttribute('placeholder', 'Ask Mastra Code…'));
  });

  it('given an idle snapshot no newer than the send, then the composer stays busy until a newer one lands', async () => {
    const session = stubPreparingSession({ autoAgentEnd: false });
    let stateReads = 0;
    let stateVersion = 3;
    server.use(
      http.get(`${API}/sessions/:resourceId`, ({ params }) => {
        stateReads += 1;
        return HttpResponse.json({
          controllerId: 'code',
          resourceId: params.resourceId,
          modeId: 'build',
          modelId: 'openai/gpt-4o-mini',
          threadId: SESSION_ID,
          running: false,
          stateVersion,
          stateEpoch: 'epoch-live',
          settings: { yolo: false, thinkingLevel: 'medium', notifications: 'bell', smartEditing: true },
        });
      }),
    );

    const user = userEvent.setup();
    const { client } = renderThread();
    await releaseSession(session.finishWorkspace, client);

    const composer = await screen.findByRole('textbox', { name: 'Message' });
    await waitFor(() => expect(composer).toHaveAttribute('placeholder', 'Ask Mastra Code…'));
    await waitFor(() => expect(stateReads).toBeGreaterThanOrEqual(1));

    await user.type(composer, 'Check the failing build');
    await user.keyboard('{Enter}');
    await waitFor(() => expect(session.delivered).toEqual(['Check the failing build']));
    await waitFor(() => expect(composer).toHaveAttribute('placeholder', 'Steer the agent…'));

    // A snapshot at the send's own version proves nothing about the run's fate.
    await client.invalidateQueries({ queryKey: ['agent-controller', 'code', 'connection', SESSION_ID] });
    await waitFor(() => expect(stateReads).toBeGreaterThanOrEqual(2));
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(composer).toHaveAttribute('placeholder', 'Steer the agent…');

    // A strictly newer idle snapshot is proof, and releases the latch.
    stateVersion = 5;
    await client.invalidateQueries({ queryKey: ['agent-controller', 'code', 'connection', SESSION_ID] });
    await waitFor(() => expect(composer).toHaveAttribute('placeholder', 'Ask Mastra Code…'));
  });

  it('given the server restarted since the send, then an idle snapshot from the new epoch releases the latch', async () => {
    const session = stubPreparingSession({ autoAgentEnd: false });
    let snapshot = { stateVersion: 90, stateEpoch: 'epoch-before-restart' };
    server.use(
      http.get(`${API}/sessions/:resourceId`, ({ params }) =>
        HttpResponse.json({
          controllerId: 'code',
          resourceId: params.resourceId,
          modeId: 'build',
          modelId: 'openai/gpt-4o-mini',
          threadId: SESSION_ID,
          running: false,
          ...snapshot,
          settings: { yolo: false, thinkingLevel: 'medium', notifications: 'bell', smartEditing: true },
        }),
      ),
    );

    const user = userEvent.setup();
    const { client } = renderThread();
    await releaseSession(session.finishWorkspace, client);

    const composer = await screen.findByRole('textbox', { name: 'Message' });
    await waitFor(() => expect(composer).toHaveAttribute('placeholder', 'Ask Mastra Code…'));

    await user.type(composer, 'Check the failing build');
    await user.keyboard('{Enter}');
    await waitFor(() => expect(session.delivered).toEqual(['Check the failing build']));
    await waitFor(() => expect(composer).toHaveAttribute('placeholder', 'Steer the agent…'));

    // The server restarts: versions reset, but the fresh epoch says idle — the run is gone.
    snapshot = { stateVersion: 1, stateEpoch: 'epoch-after-restart' };
    await client.invalidateQueries({ queryKey: ['agent-controller', 'code', 'connection', SESSION_ID] });
    await waitFor(() => expect(composer).toHaveAttribute('placeholder', 'Ask Mastra Code…'));
  });

  it('given a run on another thread of the session, then the composer stays idle', async () => {
    const session = stubPreparingSession({ autoAgentEnd: false });
    let stateReads = 0;
    server.use(
      http.get(`${API}/sessions/:resourceId`, ({ params }) => {
        stateReads += 1;
        return HttpResponse.json({
          controllerId: 'code',
          resourceId: params.resourceId,
          modeId: 'build',
          modelId: 'openai/gpt-4o-mini',
          threadId: SESSION_ID,
          running: true,
          runningThreadId: 'thread-elsewhere',
          settings: { yolo: false, thinkingLevel: 'medium', notifications: 'bell', smartEditing: true },
        });
      }),
    );

    const { client } = renderThread();
    await releaseSession(session.finishWorkspace, client);

    const composer = await screen.findByRole('textbox', { name: 'Message' });
    await waitFor(() => expect(stateReads).toBeGreaterThanOrEqual(1));
    // settle: let the loaded snapshot reach the composer before judging it
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(composer).toHaveAttribute('placeholder', 'Ask Mastra Code…');
  });
});
