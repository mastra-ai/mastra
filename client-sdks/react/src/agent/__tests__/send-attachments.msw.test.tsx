// @vitest-environment jsdom
import { MastraClient } from '@mastra/client-js';
import type { ListMemoryThreadMessagesResponse, StreamParams } from '@mastra/client-js';
import { act, cleanup } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';
import { server } from '../../test/msw-server';
import { renderHookWithProviders, TEST_BASE_URL } from '../../test/render';
import { useChat } from '../hooks';
import { attachmentTurn, persistAttachmentTurn } from './fixtures/attachment-turn';

afterEach(cleanup);

describe('useChat attachment persistence', () => {
  describe.each(['Hey, do you see this?', ''])(
    'when submitting text %j with attachments through the legacy route',
    text => {
      it('restores the same single multipart user message after reloading', async () => {
        let history: ListMemoryThreadMessagesResponse = { messages: [], uiMessages: null };
        server.use(
          http.post<never, StreamParams>(`${TEST_BASE_URL}/api/agents/agent-1/stream`, async ({ request }) => {
            const { messages } = await request.json();
            history = persistAttachmentTurn(messages);
            return new HttpResponse('data: {"type":"finish","payload":{}}\n\n', {
              headers: { 'content-type': 'text/event-stream' },
            });
          }),
          http.get(`${TEST_BASE_URL}/api/memory/threads/thread-1/messages`, () => HttpResponse.json(history)),
        );

        const live = renderHookWithProviders(() =>
          useChat({ agentId: 'agent-1', threadId: 'thread-1', enableThreadSignals: false }),
        );
        await act(async () => {
          await live.result.current.sendMessage({
            message: text,
            coreUserMessages: attachmentTurn,
            threadId: 'thread-1',
          });
        });
        const optimistic = live.result.current.messages.filter(message => message.role === 'user');
        expect(optimistic).toHaveLength(1);
        live.unmount();

        const client = new MastraClient({ baseUrl: TEST_BASE_URL });
        const stored = await client.getMemoryThread({ threadId: 'thread-1', agentId: 'agent-1' }).listMessages();
        const restored = renderHookWithProviders(() =>
          useChat({
            agentId: 'agent-1',
            threadId: 'thread-1',
            enableThreadSignals: false,
            initialMessages: stored.messages,
          }),
        );
        const messages = restored.result.current.messages.filter(message => message.role === 'user');
        expect(messages).toHaveLength(1);
        expect(messages[0]?.content.parts).toMatchObject(optimistic[0]?.content.parts ?? []);
      });
    },
  );
});
