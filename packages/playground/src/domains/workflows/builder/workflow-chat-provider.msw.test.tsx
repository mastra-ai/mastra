import type { MastraDBMessage } from '@mastra/core/agent/message-list';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, render, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { WorkflowChatProvider } from './workflow-chat-provider';
import {
  checkpointWorkflowDraft,
  createWorkflowDraftAuthoringState,
  finalizeWorkflowDraft,
  mutateWorkflowDraftAuthoringState,
} from './workflow-draft';
import { createWorkflowDraftTools } from './workflow-draft-tools';
import type { WorkflowDraftToolResult } from './workflow-draft-tools';
import { useStreamMessages, useStreamSend } from '@/domains/agent-builder/contexts/stream-chat-context';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';

function Composer({ message }: { message: string }) {
  const send = useStreamSend();
  const fired = useRef(false);
  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    send(message);
  }, [message, send]);
  return null;
}

function MessageCount() {
  const messages = useStreamMessages();
  return <div>{messages.length} messages</div>;
}

function Providers({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </MastraReactProvider>
  );
}

describe('WorkflowChatProvider', () => {
  beforeEach(() => {
    (window as Window & { MASTRA_AGENT_SIGNALS?: string }).MASTRA_AGENT_SIGNALS = 'false';
    server.resetHandlers();
  });

  afterEach(() => {
    delete (window as Window & { MASTRA_AGENT_SIGNALS?: string }).MASTRA_AGENT_SIGNALS;
    cleanup();
  });

  describe('when persisted history arrives after the provider first renders', () => {
    it('hydrates the conversation without replacing later live messages', async () => {
      server.use(http.get(`${BASE_URL}/api/auth/me`, () => HttpResponse.json({ id: 'user-1' })));
      const authoringState = createWorkflowDraftAuthoringState('support-workflow');
      const createTools = () => ({});
      const persistedMessage = {
        id: 'persisted-user-message',
        role: 'user',
        createdAt: new Date('2026-07-23T12:00:00.000Z'),
        content: { format: 2, parts: [{ type: 'text', text: 'Build the saved workflow' }] },
      } satisfies MastraDBMessage;

      const view = render(
        <Providers>
          <WorkflowChatProvider
            threadId="workflow-builder-project-support-workflow"
            authoringState={authoringState}
            initialMessages={[]}
            createTools={createTools}
          >
            <MessageCount />
          </WorkflowChatProvider>
        </Providers>,
      );

      expect(screen.getByText('0 messages')).not.toBeNull();

      view.rerender(
        <Providers>
          <WorkflowChatProvider
            threadId="workflow-builder-project-support-workflow"
            authoringState={authoringState}
            initialMessages={[persistedMessage]}
            createTools={createTools}
          >
            <MessageCount />
          </WorkflowChatProvider>
        </Providers>,
      );

      expect(await screen.findByText('1 messages')).not.toBeNull();
    });
  });

  describe('when the builder exhausts its structured repair budget', () => {
    it('stops the generation after three rejected checkpoints', async () => {
      server.use(
        http.get(`${BASE_URL}/api/auth/me`, () => HttpResponse.json({ id: 'user-1' })),
        http.post(
          `${BASE_URL}/api/editor/workflow-builder/stream`,
          () =>
            new HttpResponse(new ReadableStream({ start: () => {} }), {
              headers: { 'content-type': 'text/event-stream' },
            }),
        ),
      );
      let reportResult: ((event: WorkflowDraftToolResult) => void) | undefined;
      let failureCode: string | undefined;

      render(
        <Providers>
          <WorkflowChatProvider
            threadId="workflow-builder-repair-budget"
            authoringState={createWorkflowDraftAuthoringState('repair-budget')}
            initialMessages={[]}
            createTools={(_, onResult) => {
              reportResult = onResult;
              return {};
            }}
            onGenerationFailure={failure => {
              failureCode = failure?.code;
            }}
          >
            <Composer message="Build a workflow" />
          </WorkflowChatProvider>
        </Providers>,
      );

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 20));
      });
      const rejectedCheckpoint: WorkflowDraftToolResult = {
        toolId: 'checkpoint-workflow-draft',
        result: { success: false, error: 'Invalid draft' },
      };

      act(() => {
        reportResult?.(rejectedCheckpoint);
        reportResult?.(rejectedCheckpoint);
        reportResult?.(rejectedCheckpoint);
      });

      expect(failureCode).toBe('repair-budget-exhausted');
    });
  });

  describe('when a workflow author sends a message', () => {
    it('streams through the hidden editor route with the current draft as hidden instructions', async () => {
      let capturedBody: Record<string, unknown> | undefined;
      server.use(
        http.get(`${BASE_URL}/api/auth/me`, () => HttpResponse.json({ id: 'user-1' })),
        http.post(`${BASE_URL}/api/editor/workflow-builder/stream`, async ({ request }) => {
          capturedBody = (await request.json()) as Record<string, unknown>;
          return new HttpResponse(new ReadableStream({ start: controller => controller.close() }), {
            headers: { 'content-type': 'text/event-stream' },
          });
        }),
      );

      let authoringState = createWorkflowDraftAuthoringState('support-workflow');
      const apply = (result: ReturnType<typeof checkpointWorkflowDraft>) => {
        authoringState = result.state;
        return result;
      };
      const tools = createWorkflowDraftTools({
        getState: () => authoringState,
        checkpoint: (expectedRevision, draft) =>
          apply(checkpointWorkflowDraft(authoringState, expectedRevision, draft)),
        finalize: expectedRevision => apply(finalizeWorkflowDraft(authoringState, expectedRevision)),
        mutateCandidate: (candidateState, expectedRevision, mutation) =>
          mutateWorkflowDraftAuthoringState(candidateState, expectedRevision, mutation),
      });

      await act(async () => {
        render(
          <Providers>
            <WorkflowChatProvider
              threadId="workflow-builder-project-support-workflow"
              authoringState={authoringState}
              validationContext={{ agents: { 'support-agent': {} }, workflowCatalog: 'unavailable' }}
              initialMessages={[]}
              createTools={() => tools}
            >
              <Composer message="Build a support workflow" />
            </WorkflowChatProvider>
          </Providers>,
        );
      });

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
      });

      expect(capturedBody).toBeDefined();
      expect(capturedBody?.instructions).toContain('Current unsaved workflow authoring state');
      expect(capturedBody?.instructions).toContain('Lifecycle: untouched');
      expect(capturedBody?.instructions).toContain('"workflowCatalog": "unavailable"');
      expect(capturedBody?.instructions).toContain('support-agent');
      expect(capturedBody?.instructions).toContain('support-workflow');
      expect(JSON.stringify(capturedBody?.messages)).toContain('Build a support workflow');
      expect(JSON.stringify(capturedBody?.messages)).not.toContain('Current persisted workflow definition');
    });
  });
});
