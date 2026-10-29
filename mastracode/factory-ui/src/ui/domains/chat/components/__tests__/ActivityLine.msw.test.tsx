import type { QueryClient } from '@tanstack/react-query';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { waitForMutationsIdle } from '../../../../../../e2e/ui/render';
import { renderThread, stubPreparingSession } from './composer-session-test-fixture';

const QUESTION = 'walk me through the auth flow';

type User = ReturnType<typeof userEvent.setup>;

async function send(user: User) {
  const message = () => screen.getByRole('textbox', { name: 'Message' });
  await waitFor(() => expect(message()).toBeEnabled());
  await user.type(message(), QUESTION);
  await user.keyboard('{Enter}');
  await waitFor(() => expect(screen.getByText(QUESTION)).toBeInTheDocument());
}

function assistantText(text: string) {
  return {
    id: 'assistant-1',
    role: 'assistant',
    createdAt: '2026-07-15T10:00:00.000Z',
    content: { format: 2, parts: [{ type: 'text', text }] },
  };
}

/** Let the workspace come up so the session is bound and its stream is open. */
async function ready(finishWorkspace: () => void, client: QueryClient) {
  finishWorkspace();
  await waitForMutationsIdle(client);
}

describe('ActivityLine', () => {
  it('covers the silence between sending and the run drawing anything', async () => {
    stubPreparingSession({ autoAgentEnd: false });
    const user = userEvent.setup();
    renderThread();

    await send(user);

    expect(await screen.findByText('Thinking')).toBeInTheDocument();
  });

  it('keeps covering a call the transcript cannot draw yet', async () => {
    const session = stubPreparingSession({ autoAgentEnd: false });
    const user = userEvent.setup();
    const { client } = renderThread();
    await ready(session.finishWorkspace, client);
    await send(user);
    await session.emit({ type: 'agent_start' });

    await session.emit({ type: 'tool_start', toolCallId: 'call-ask', toolName: 'ask_user', args: {} });
    await waitForMutationsIdle(client);

    expect(document.querySelector('[data-slot="activity-stretch"]')).toBeNull();
    expect(screen.getByText('Thinking')).toBeInTheDocument();
  });

  it('says a tool is running while one runs', async () => {
    const session = stubPreparingSession({ autoAgentEnd: false });
    const user = userEvent.setup();
    const { client } = renderThread();
    await ready(session.finishWorkspace, client);
    await send(user);
    await session.emit({ type: 'agent_start' });

    await session.emit({
      type: 'tool_start',
      toolCallId: 'call-view',
      toolName: 'view',
      args: { path: 'src/index.ts' },
    });

    await screen.findByRole('group', { name: /^Reading/ }, { timeout: 3000 });
    expect(await screen.findByText('Calling a tool')).toBeInTheDocument();
    expect(screen.queryByText('Thinking')).not.toBeInTheDocument();
  });

  it('names a web search while it runs', async () => {
    const session = stubPreparingSession({ autoAgentEnd: false });
    const user = userEvent.setup();
    const { client } = renderThread();
    await ready(session.finishWorkspace, client);
    await send(user);
    await session.emit({ type: 'agent_start' });

    await session.emit({
      type: 'tool_start',
      toolCallId: 'call-web',
      toolName: 'web_search',
      args: { query: 'oauth' },
    });

    expect(await screen.findByText('Searching the web')).toBeInTheDocument();
  });

  it('says it is writing while the answer streams', async () => {
    const session = stubPreparingSession({ autoAgentEnd: false });
    const user = userEvent.setup();
    const { client } = renderThread();
    await ready(session.finishWorkspace, client);
    await send(user);
    await session.emit({ type: 'agent_start' });

    await session.emit({ type: 'message_start', message: assistantText('') });
    await session.emit({
      type: 'message_update',
      id: 'assistant-1',
      event: { type: 'text-delta', delta: 'Auth starts at the composer' },
    });

    await waitFor(() => expect(document.body).toHaveTextContent('Auth starts at the composer'), { timeout: 3000 });
    expect(await screen.findByText('Writing')).toBeInTheDocument();
  });

  it('says the run is saving memory while memory holds it', async () => {
    const session = stubPreparingSession({ autoAgentEnd: false });
    const user = userEvent.setup();
    const { client } = renderThread();
    await ready(session.finishWorkspace, client);
    await send(user);
    await session.emit({ type: 'agent_start' });

    await session.emit({ type: 'om_observation_start' });

    expect(await screen.findByText('Updating memory')).toBeInTheDocument();
  });

  it('waits on the user while an approval is pending', async () => {
    const session = stubPreparingSession({ autoAgentEnd: false });
    const user = userEvent.setup();
    const { client } = renderThread();
    await ready(session.finishWorkspace, client);
    await send(user);
    await session.emit({ type: 'agent_start' });

    await session.emit({
      type: 'tool_start',
      toolCallId: 'call-rm',
      toolName: 'execute_command',
      args: { command: 'rm -rf dist' },
    });
    await session.emit({
      type: 'tool_approval_required',
      toolCallId: 'call-rm',
      toolName: 'execute_command',
      args: { command: 'rm -rf dist' },
    });

    expect(await screen.findByText('Waiting for you')).toBeInTheDocument();
  });

  it('lands on done when the run ends, then leaves', async () => {
    const session = stubPreparingSession({ autoAgentEnd: false });
    const user = userEvent.setup();
    const { client } = renderThread();
    await ready(session.finishWorkspace, client);
    await send(user);
    await session.emit({ type: 'agent_start' });
    await screen.findByText('Thinking');

    await session.emit({ type: 'agent_end' });

    expect(await screen.findByText('Done')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText('Done')).not.toBeInTheDocument(), { timeout: 3000 });
  });

  it('lands on the failure when the run errors', async () => {
    const session = stubPreparingSession({ autoAgentEnd: false });
    const user = userEvent.setup();
    const { client } = renderThread();
    await ready(session.finishWorkspace, client);
    await send(user);
    await session.emit({ type: 'agent_start' });

    await session.emit({ type: 'error', error: { name: 'AI_APICallError', message: 'Bad Request', statusCode: 403 } });
    await session.emit({ type: 'agent_end' });

    expect(await screen.findByText('Something went wrong')).toBeInTheDocument();
    expect(screen.queryByText('Done')).not.toBeInTheDocument();
  });

  it('says nothing when the run is idle', async () => {
    const session = stubPreparingSession();
    const { client } = renderThread();
    await ready(session.finishWorkspace, client);

    expect(screen.queryByText('Thinking')).not.toBeInTheDocument();
    expect(screen.queryByText('Done')).not.toBeInTheDocument();
  });
});
