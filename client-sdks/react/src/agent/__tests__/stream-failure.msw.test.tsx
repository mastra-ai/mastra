// @vitest-environment jsdom
import type { StreamParams } from '@mastra/client-js';
import { act, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from '../../test/msw-server';
import { renderHookWithProviders, TEST_BASE_URL } from '../../test/render';
import { useChat } from '../hooks';

const PARTIAL_TEXT = 'Here is the first half of';
const FAILURE_MESSAGE = 'upstream 529 overloaded';
const DROP_MESSAGE = 'connection dropped';

const sse = (chunks: unknown[]) => chunks.map(chunk => `data: ${JSON.stringify(chunk)}\n\n`).join('');

// A body that sends some chunks and then fails, like a connection that drops mid-reply.
// No error chunk reaches the client, so only the rejected stream can reset the hook.
const droppingBody = (chunks: unknown[]) =>
  new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(sse(chunks)));
    },
    async pull(controller) {
      await new Promise(resolve => setTimeout(resolve, 20));
      controller.error(new Error(DROP_MESSAGE));
    },
  });

// A model that fails mid-reply used to look like a finished run: the stream resolved
// with the cut-off text, so useChat showed half an answer as if it were complete.
describe('useChat when the reply fails mid-stream', () => {
  it('rejects sendMessage with the failure, keeps the partial text and stops running', async () => {
    server.use(
      http.post<never, StreamParams>(`${TEST_BASE_URL}/api/agents/agent-1/stream`, async ({ request }) => {
        const { runId } = await request.json();
        // Same chunk order the server sends when the model errors partway through a reply.
        const chunks = [
          { type: 'start', runId, from: 'AGENT', payload: {} },
          { type: 'text-start', runId, from: 'AGENT', payload: { id: 'text-1' } },
          { type: 'text-delta', runId, from: 'AGENT', payload: { id: 'text-1', text: PARTIAL_TEXT } },
          { type: 'error', runId, from: 'AGENT', payload: { error: { name: 'Error', message: FAILURE_MESSAGE } } },
          { type: 'finish', runId, from: 'AGENT', payload: { stepResult: { reason: 'error' }, output: {} } },
        ];
        return new HttpResponse(chunks.map(chunk => `data: ${JSON.stringify(chunk)}\n\n`).join(''), {
          headers: { 'content-type': 'text/event-stream' },
        });
      }),
    );

    const { result } = renderHookWithProviders(() => useChat({ agentId: 'agent-1', resourceId: 'resource-1' }));

    let failure: unknown;
    await act(async () => {
      await result.current.sendMessage({ message: 'Write me a long answer' }).catch(error => {
        failure = error;
      });
    });

    expect(failure).toBeInstanceOf(Error);
    expect((failure as Error).message).toContain(FAILURE_MESSAGE);
    await waitFor(() => expect(result.current.isRunning).toBe(false));
    expect(JSON.stringify(result.current.messages)).toContain(PARTIAL_TEXT);
  });

  it('rejects sendMessage and stops running when the connection drops without an error chunk', async () => {
    server.use(
      http.post<never, StreamParams>(`${TEST_BASE_URL}/api/agents/agent-1/stream`, async ({ request }) => {
        const { runId } = await request.json();
        return new HttpResponse(
          droppingBody([
            { type: 'start', runId, from: 'AGENT', payload: {} },
            { type: 'text-start', runId, from: 'AGENT', payload: { id: 'text-1' } },
            { type: 'text-delta', runId, from: 'AGENT', payload: { id: 'text-1', text: PARTIAL_TEXT } },
          ]),
          { headers: { 'content-type': 'text/event-stream' } },
        );
      }),
    );

    const { result } = renderHookWithProviders(() => useChat({ agentId: 'agent-1', resourceId: 'resource-1' }));

    let failure: unknown;
    await act(async () => {
      await result.current.sendMessage({ message: 'Write me a long answer' }).catch(error => {
        failure = error;
      });
    });

    expect((failure as Error)?.message).toContain(DROP_MESSAGE);
    await waitFor(() => expect(result.current.isRunning).toBe(false));
    expect(JSON.stringify(result.current.messages)).toContain(PARTIAL_TEXT);
  });

  it('rejects declineToolCall, stops running and clears the decline when its stream drops', async () => {
    const toolCallId = 'tool-call-1';
    let runId = '';
    server.use(
      http.post<never, StreamParams>(`${TEST_BASE_URL}/api/agents/agent-1/stream`, async ({ request }) => {
        runId = (await request.json()).runId!;
        const tool = { toolName: 'weatherTool', toolCallId, args: { city: 'London' } };
        return new HttpResponse(
          sse([
            { type: 'start', runId, from: 'AGENT', payload: {} },
            { type: 'tool-call', runId, from: 'AGENT', payload: tool },
            { type: 'tool-call-approval', runId, from: 'AGENT', payload: tool },
          ]),
          { headers: { 'content-type': 'text/event-stream' } },
        );
      }),
      http.post(`${TEST_BASE_URL}/api/agents/agent-1/decline-tool-call`, () => {
        return new HttpResponse(droppingBody([{ type: 'start', runId, from: 'AGENT', payload: {} }]), {
          headers: { 'content-type': 'text/event-stream' },
        });
      }),
    );

    const { result } = renderHookWithProviders(() => useChat({ agentId: 'agent-1', resourceId: 'resource-1' }));

    await act(async () => {
      await result.current.sendMessage({ message: 'What is the weather in London?' });
    });

    let failure: unknown;
    await act(async () => {
      await result.current.declineToolCall(toolCallId).catch(error => {
        failure = error;
      });
    });

    expect((failure as Error)?.message).toContain(DROP_MESSAGE);
    await waitFor(() => expect(result.current.isRunning).toBe(false));
    expect(result.current.toolCallApprovals[toolCallId]).toBeUndefined();
  });
});
