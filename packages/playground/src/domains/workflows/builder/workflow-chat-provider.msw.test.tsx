import type { MastraDBMessage } from '@mastra/core/agent/message-list';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, render, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { WorkflowChatProvider } from './workflow-chat-provider';
import { createWorkflowDraftAuthoringState } from './workflow-draft';
import type { WorkflowDraftToolResult } from './workflow-draft-tools';
import { createWorkflowDraftTools } from './workflow-draft-tools';
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

function registerStreamingHandlers(captureBody?: (body: Record<string, unknown>) => void) {
  server.use(
    http.get(`${BASE_URL}/api/auth/me`, () => HttpResponse.json({ id: 'user-1' })),
    http.post(`${BASE_URL}/api/editor/workflow-builder/stream`, async ({ request }) => {
      captureBody?.((await request.json()) as Record<string, unknown>);
      return new HttpResponse(new ReadableStream({ start: () => {} }), {
        headers: { 'content-type': 'text/event-stream' },
      });
    }),
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
            createTools={() => ({})}
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
            createTools={() => ({})}
          >
            <MessageCount />
          </WorkflowChatProvider>
        </Providers>,
      );

      expect(await screen.findByText('1 messages')).not.toBeNull();
    });
  });

  describe('when a workflow generation starts', () => {
    it('advertises only the two unified authoring tools', async () => {
      let requestBody: Record<string, unknown> | undefined;
      registerStreamingHandlers(body => (requestBody = body));
      const state = createWorkflowDraftAuthoringState('two-tool-workflow');

      render(
        <Providers>
          <WorkflowChatProvider
            threadId="workflow-builder-two-tool-workflow"
            authoringState={state}
            initialMessages={[]}
            createTools={(isCurrent, onResult, candidate, onCandidateChange) =>
              createWorkflowDraftTools({
                getState: () => state,
                checkpoint: () => ({ ok: false, state, error: 'Not used' }),
                finalize: () => ({ ok: false, state, error: 'Not used' }),
                isCurrentGeneration: isCurrent,
                onResult,
                candidate,
                onCandidateChange,
              })
            }
          >
            <Composer message="Build a workflow" />
          </WorkflowChatProvider>
        </Providers>,
      );

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 20));
      });
      expect(Object.keys((requestBody?.clientTools ?? {}) as object)).toEqual([
        'inspect-workflow-resources',
        'submit-workflow-draft',
      ]);
      const serializedTools = JSON.stringify(requestBody?.clientTools);
      expect(serializedTools).toContain('${initData.name}');
      expect(serializedTools).toContain('Default agents consume { prompt: string } and return { text: string }');
      expect(serializedTools).toContain('id must exactly equal workflowId');
      expect(serializedTools).toContain('Each child receives the same preceding input');
      expect(serializedTools).toContain('Each item is passed directly to the child step');
      expect(serializedTools).toContain('The workflow result is exactly the final top-level entry output');
    });
  });

  describe('when equivalent complete definitions are rejected three times', () => {
    it('stops generation with the bounded retry failure', async () => {
      registerStreamingHandlers();
      let reportResult: ((event: WorkflowDraftToolResult) => void) | undefined;
      let failureCode: string | undefined;

      render(
        <Providers>
          <WorkflowChatProvider
            threadId="workflow-builder-retry-budget"
            authoringState={createWorkflowDraftAuthoringState('retry-budget')}
            initialMessages={[]}
            createTools={(_, onResult) => {
              reportResult = onResult;
              return {};
            }}
            onGenerationFailure={failure => (failureCode = failure?.code)}
          >
            <Composer message="Build a workflow" />
          </WorkflowChatProvider>
        </Providers>,
      );

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 20));
      });
      const rejected: WorkflowDraftToolResult = {
        toolId: 'submit-workflow-draft',
        result: {
          success: false,
          error: 'Invalid definition',
          issues: [{ code: 'invalid-map-config', path: 'graph.0.mapConfig.message', message: 'Invalid source' }],
        },
      };
      act(() => {
        reportResult?.(rejected);
        reportResult?.(rejected);
        reportResult?.(rejected);
      });

      expect(failureCode).toBe('repair-budget-exhausted');
    });
  });

  describe('when authoring instructions are sent to the editor route', () => {
    it('describe canonical direct-input mappings and whole-definition retries', async () => {
      let requestBody: Record<string, unknown> | undefined;
      registerStreamingHandlers(body => (requestBody = body));

      render(
        <Providers>
          <WorkflowChatProvider
            threadId="workflow-builder-instructions"
            authoringState={createWorkflowDraftAuthoringState('instructions')}
            initialMessages={[]}
            createTools={() => ({})}
          >
            <Composer message="Build a workflow" />
          </WorkflowChatProvider>
        </Providers>,
      );

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 20));
      });
      const serialized = JSON.stringify(requestBody);
      expect(serialized).toContain('submit-workflow-draft');
      expect(serialized).toContain('\\"initData\\": true');
      expect(serialized).not.toContain('\\"initData\\": \\"prompt\\"');
    });
  });
});
