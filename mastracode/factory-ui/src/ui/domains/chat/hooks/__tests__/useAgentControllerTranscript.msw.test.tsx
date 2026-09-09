import type { AgentControllerEvent, MastraDBMessage } from '@mastra/client-js';
import { defaultDisplayState } from '@mastra/core/agent-controller';
import type { WireDisplayState } from '@mastra/core/agent-controller';
import { act, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { server } from '../../../../../../e2e/ui/msw-server';
import { renderHookWithProviders, TEST_BASE_URL, waitForMutationsIdle } from '../../../../../../e2e/ui/render';
import { useSendAgentControllerMessageMutation } from '../../../../../hooks/useAgentControllerRunMutations';
import { useAgentControllerConnection } from '../useAgentControllerConnection';
import { useAgentControllerTranscript } from '../useAgentControllerTranscript';

const controllerId = 'code';
const resourceId = 'pending-submission';
const sessionUrl = `${TEST_BASE_URL}/api/agent-controller/${controllerId}/sessions/${resourceId}`;
const connectionArgs = {
  agentControllerId: controllerId,
  resourceId,
  sessionThreadId: 'thread-1',
  baseUrl: TEST_BASE_URL,
};
const previousReply: MastraDBMessage = {
  id: 'previous-reply',
  role: 'assistant',
  createdAt: new Date('2026-09-09T10:00:00Z'),
  content: { format: 2, parts: [{ type: 'text', text: 'The previous task finished.' }] },
};
const idleDisplayState: WireDisplayState = {
  ...defaultDisplayState(),
  activeTools: {},
  toolInputBuffers: {},
  pendingSuspensions: {},
  activeSubagents: {},
  modifiedFiles: {},
  currentMessage: previousReply,
};

function connectBeforeInitialSnapshot() {
  let streamController: ReadableStreamDefaultController<Uint8Array> | undefined;
  let acceptMessage: () => void = () => {};
  const pendingMessage = new Promise<void>(resolve => {
    acceptMessage = resolve;
  });

  server.use(
    http.post(`${TEST_BASE_URL}/api/agent-controller/${controllerId}/sessions`, () =>
      HttpResponse.json({ controllerId, resourceId, threadId: 'thread-1' }),
    ),
    http.get(sessionUrl, () => HttpResponse.json({ controllerId, resourceId, threadId: 'thread-1', running: false })),
    http.post(`${sessionUrl}/messages`, async () => {
      await pendingMessage;
      return HttpResponse.json({ ok: true });
    }),
    http.get(
      `${sessionUrl}/stream`,
      () =>
        new Response(
          new ReadableStream<Uint8Array>({
            start(controller) {
              streamController = controller;
            },
          }),
          { headers: { 'content-type': 'text/event-stream' } },
        ),
    ),
  );

  return {
    acceptMessage,
    emitEvent: (event: AgentControllerEvent) => {
      if (!streamController) throw new Error('The session stream has not connected');
      streamController.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(event)}\n\n`));
    },
  };
}

const idleSnapshots: { name: string; event: AgentControllerEvent }[] = [
  {
    name: 'the initial session snapshot',
    event: {
      type: 'session_snapshot',
      displayState: idleDisplayState,
      messages: [previousReply],
      streamingMessageId: null,
    },
  },
  {
    name: 'an idle display update',
    event: {
      type: 'display_state_changed',
      displayState: idleDisplayState,
    },
  },
];

describe('a local submission overtaking a server snapshot', () => {
  it.each(idleSnapshots)('keeps the message pending when $name arrives', async ({ event }) => {
    const { acceptMessage, emitEvent } = connectBeforeInitialSnapshot();
    const receivedEvent = vi.fn();
    const { result, client } = renderHookWithProviders(() => {
      const transcript = useAgentControllerTranscript({
        initialThreadId: 'thread-1',
        initialMessages: [previousReply],
      });
      const connection = useAgentControllerConnection({
        ...connectionArgs,
        onEvent: event => {
          receivedEvent(event);
          transcript.onEvent(event);
        },
      });
      const send = useSendAgentControllerMessageMutation(connectionArgs);

      return {
        status: connection.status,
        busy: connection.state?.running === true || transcript.transcript.pending,
        pending: transcript.transcript.pending,
        sending: send.isPending,
        submit: () => {
          transcript.localUser('Check out this PR');
          return send.mutateAsync('Check out this PR');
        },
      };
    });

    try {
      await waitFor(() => expect(result.current.status).toBe('ready'));
      act(() => {
        void result.current.submit();
      });
      await waitFor(() => expect(result.current.sending).toBe(true));
      expect(result.current.busy).toBe(true);

      act(() => emitEvent(event));
      await waitFor(() => expect(receivedEvent).toHaveBeenCalledWith(expect.objectContaining({ type: event.type })));

      expect(result.current.sending).toBe(true);
      expect(result.current.busy).toBe(true);

      acceptMessage();
      await waitForMutationsIdle(client);
      expect(result.current.busy).toBe(true);

      act(() => emitEvent({ type: 'agent_start' }));
      await waitFor(() => expect(result.current.pending).toBe(false));
      expect(result.current.busy).toBe(true);

      act(() => emitEvent({ type: 'agent_end', reason: 'complete' }));
      await waitFor(() => expect(result.current.busy).toBe(false));
    } finally {
      acceptMessage();
      await waitForMutationsIdle(client);
    }
  });
});
