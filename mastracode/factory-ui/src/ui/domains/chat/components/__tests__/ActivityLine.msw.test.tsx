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

    // An ask_user waits on its suspension prompt; until that lands the transcript shows no row,
    // so the line is the only thing standing between the user and a blank screen.
    await session.emit({ type: 'tool_start', toolCallId: 'call-ask', toolName: 'ask_user', args: {} });
    await waitForMutationsIdle(client);

    expect(screen.queryByRole('group', { name: /^Tool: / })).not.toBeInTheDocument();
    expect(screen.getByText('Thinking')).toBeInTheDocument();
  });

  it('steps aside as soon as the run draws its first row', async () => {
    const session = stubPreparingSession({ autoAgentEnd: false });
    const user = userEvent.setup();
    const { client } = renderThread();
    await ready(session.finishWorkspace, client);
    await send(user);

    await session.emit({
      type: 'tool_start',
      toolCallId: 'call-view',
      toolName: 'view',
      args: { path: 'src/index.ts' },
    });

    await screen.findByRole('group', { name: 'Tool: view' }, { timeout: 3000 });
    await waitFor(() => expect(screen.queryByText('Thinking')).not.toBeInTheDocument());
  });

  it('steps aside while the answer streams', async () => {
    const session = stubPreparingSession({ autoAgentEnd: false });
    const user = userEvent.setup();
    const { client } = renderThread();
    await ready(session.finishWorkspace, client);
    await send(user);

    await session.emit({ type: 'message_update', message: assistantText('Auth starts at the composer') });

    // Streamed prose is split into per-word spans to fade in, so match the rendered text as a whole.
    await waitFor(() => expect(document.body).toHaveTextContent('Auth starts at the composer'));
    await waitFor(() => expect(screen.queryByText('Thinking')).not.toBeInTheDocument());
  });

  it('lingers for a beat when output lands, letting its sweep settle instead of vanishing under it', async () => {
    const session = stubPreparingSession({ autoAgentEnd: false });
    const user = userEvent.setup();
    const { client } = renderThread();
    await ready(session.finishWorkspace, client);
    await send(user);
    await screen.findByText('Thinking');

    await session.emit({ type: 'message_update', message: assistantText('Auth starts at the composer') });

    expect(screen.getByText('Thinking')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText('Thinking')).not.toBeInTheDocument());
  });

  it('says nothing when the run is idle', async () => {
    const session = stubPreparingSession();
    const { client } = renderThread();
    await ready(session.finishWorkspace, client);

    expect(screen.queryByText('Thinking')).not.toBeInTheDocument();
  });
});
