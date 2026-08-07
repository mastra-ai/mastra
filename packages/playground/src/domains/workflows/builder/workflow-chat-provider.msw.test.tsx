import type { MastraDBMessage } from '@mastra/core/agent/message-list';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, render, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { WorkflowChatProvider } from './workflow-chat-provider';
import type { WorkflowGenerationFailure } from './workflow-chat-provider';
import { createLoadedWorkflowDraftAuthoringState, createWorkflowDraftAuthoringState } from './workflow-draft';
import type { WorkflowDraftToolResult } from './workflow-draft-tools';
import { createWorkflowDraftTools } from './workflow-draft-tools';
import {
  useStreamCancel,
  useStreamMessages,
  useStreamSend,
} from '@/domains/agent-builder/contexts/stream-chat-context';
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

function SendCapture({ onReady }: { onReady: (send: (message: string) => void) => void }) {
  const send = useStreamSend();
  useEffect(() => {
    onReady(send);
  }, [send, onReady]);
  return null;
}

function MessageCount() {
  const messages = useStreamMessages();
  return <div>{messages.length} messages</div>;
}

function CancelCapture({ onReady }: { onReady: (cancel: () => void) => void }) {
  const cancel = useStreamCancel();
  useEffect(() => {
    onReady(cancel);
  }, [cancel, onReady]);
  return null;
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
        'list-available-agents',
        'list-available-tools',
        'list-available-workflows',
        'submit-workflow-draft',
      ]);
      const serializedTools = JSON.stringify(requestBody?.clientTools);
      expect(serializedTools).toContain('${initData.name}');
      expect(serializedTools).toContain('Default agents consume { prompt: string } and return { text: string }');
      expect(serializedTools).toContain('it does not need to equal workflowId');
      expect(serializedTools).toContain('Each child receives the same preceding input');
      expect(serializedTools).toContain('Each item is passed directly to the child step');
      expect(serializedTools).toContain('The workflow result is exactly the final top-level entry output');
    });

    it('sends per-turn authoring state as additive `system`, not as replacement `instructions`', async () => {
      let requestBody: Record<string, unknown> | undefined;
      registerStreamingHandlers(body => (requestBody = body));
      const state = createWorkflowDraftAuthoringState('additive-state-workflow');

      render(
        <Providers>
          <WorkflowChatProvider
            threadId="workflow-builder-additive-state-workflow"
            authoringState={state}
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

      // Core resolves `options.instructions || getInstructions()`, so sending
      // the per-turn state as `instructions` would replace the hidden agent's
      // shared authoring playbook and Studio surface instructions outright.
      // `system` is appended instead, leaving the base prompt intact.
      expect(requestBody?.instructions).toBeUndefined();
      expect(typeof requestBody?.system).toBe('string');
      expect(requestBody?.system as string).toContain('Workflow construction rules');
    });
  });

  describe('when submitted definitions are rejected', () => {
    async function renderRejectionHarness() {
      registerStreamingHandlers();
      const captured: {
        reportResult?: (event: WorkflowDraftToolResult) => void;
        isCurrent?: () => boolean;
        failureCode?: string;
      } = {};

      render(
        <Providers>
          <WorkflowChatProvider
            threadId="workflow-builder-rejection"
            authoringState={createWorkflowDraftAuthoringState('rejection')}
            initialMessages={[]}
            createTools={(isCurrent, onResult) => {
              captured.isCurrent = isCurrent;
              captured.reportResult = onResult;
              return {};
            }}
            onGenerationFailure={failure => (captured.failureCode = failure?.code)}
          >
            <Composer message="Build a workflow" />
          </WorkflowChatProvider>
        </Providers>,
      );

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 20));
      });
      return captured;
    }

    const rejected: WorkflowDraftToolResult = {
      toolId: 'submit-workflow-draft',
      result: {
        success: false,
        error: 'Invalid definition',
        issues: [{ code: 'invalid-map-config', path: 'graph.0.mapConfig.message', message: 'Invalid source' }],
      },
    };

    it('keeps the submission tool armed so the model can act on the diagnostics', async () => {
      const harness = await renderRejectionHarness();

      act(() => {
        harness.reportResult?.(rejected);
        harness.reportResult?.(rejected);
        harness.reportResult?.(rejected);
      });

      // Repeated rejections must never disarm the tool or fail the turn on the
      // model's behalf. Stopping a run that is going nowhere is the user's call.
      expect(harness.isCurrent?.()).toBe(true);
      expect(harness.failureCode).toBeUndefined();
    });
  });

  describe('when a follow-up chat turn completes after a draft is already accepted', () => {
    it('does not report a generation failure', async () => {
      server.use(
        http.get(`${BASE_URL}/api/auth/me`, () => HttpResponse.json({ id: 'user-1' })),
        http.post(`${BASE_URL}/api/editor/workflow-builder/stream`, async () => {
          return new HttpResponse(
            new ReadableStream({
              start(controller) {
                controller.close();
              },
            }),
            { headers: { 'content-type': 'text/event-stream' } },
          );
        }),
      );

      const acceptedState = {
        ...createWorkflowDraftAuthoringState('followup-workflow'),
        lifecycle: 'ready' as const,
        revision: 1,
        finalizedRevision: 1,
      };

      let failure: WorkflowGenerationFailure | null | undefined;
      render(
        <Providers>
          <WorkflowChatProvider
            threadId="workflow-builder-followup-workflow"
            authoringState={acceptedState}
            initialMessages={[]}
            createTools={() => ({})}
            onGenerationFailure={next => (failure = next)}
          >
            <Composer message="thanks — what did you build?" />
          </WorkflowChatProvider>
        </Providers>,
      );

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 60));
      });

      expect(failure ?? null).toBeNull();
    });
  });

  describe('when a workflow that already has a complete definition is reopened', () => {
    // A draft loaded from a stored workflow is ready at revision 0, so the
    // canvas shows "Ready to save" while nothing has been edited this session.
    async function renderReopenedHarness() {
      // Closes immediately so `onSendComplete` fires within the test.
      server.use(
        http.get(`${BASE_URL}/api/auth/me`, () => HttpResponse.json({ id: 'user-1' })),
        http.post(`${BASE_URL}/api/editor/workflow-builder/stream`, async () => {
          return new HttpResponse(
            new ReadableStream({
              start(controller) {
                controller.close();
              },
            }),
            { headers: { 'content-type': 'text/event-stream' } },
          );
        }),
      );
      const captured: {
        failure?: WorkflowGenerationFailure | null;
      } = {};

      render(
        <Providers>
          <WorkflowChatProvider
            threadId="workflow-builder-reopened"
            authoringState={createLoadedWorkflowDraftAuthoringState({
              id: 'reopened-workflow',
              graph: [{ type: 'mapping', id: 'echo', mapConfig: '{"message":{"initData":true,"path":"message"}}' }],
              inputSchema: { type: 'object', properties: { message: { type: 'string' } }, required: ['message'] },
              outputSchema: { type: 'object', properties: { message: { type: 'string' } }, required: ['message'] },
            })}
            initialMessages={[]}
            createTools={(_isCurrent, onResult) => {
              // The model attempts a submission during the turn and it fails.
              onResult?.({
                toolId: 'submit-workflow-draft',
                result: { success: false, error: 'Invalid definition', issues: [] },
              });
              return {};
            }}
            onGenerationFailure={next => (captured.failure = next)}
          >
            <Composer message="loop through all 50 states" />
          </WorkflowChatProvider>
        </Providers>,
      );

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 40));
      });
      return captured;
    }

    it('never claims there is no accepted draft when a complete one is on the canvas', async () => {
      const harness = await renderReopenedHarness();

      expect(harness.failure?.code).not.toBe('no-accepted-draft');
      expect(harness.failure?.message ?? '').not.toContain('without creating an accepted draft');
    });
  });

  describe('when the request is first typed into an already-open chat', () => {
    it('pins that request to every later turn', async () => {
      const bodies: Record<string, unknown>[] = [];
      server.use(
        http.get(`${BASE_URL}/api/auth/me`, () => HttpResponse.json({ id: 'user-1' })),
        http.post(`${BASE_URL}/api/editor/workflow-builder/stream`, async ({ request }) => {
          bodies.push((await request.json()) as Record<string, unknown>);
          return new HttpResponse(
            new ReadableStream({
              start: controller => controller.close(),
            }),
            { headers: { 'content-type': 'text/event-stream' } },
          );
        }),
      );

      let send: ((message: string) => void) | undefined;
      const captureSend = (fn: (message: string) => void) => {
        send = fn;
      };

      // A workflow created from the editor opens with no starter message and no
      // history, which is exactly the case that used to leave the pin empty.
      render(
        <Providers>
          <WorkflowChatProvider
            threadId="workflow-builder-pin"
            authoringState={createWorkflowDraftAuthoringState('pin')}
            initialMessages={[]}
            createTools={() => ({})}
          >
            <SendCapture onReady={captureSend} />
          </WorkflowChatProvider>
        </Providers>,
      );

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 20));
      });

      await act(async () => {
        send?.('Loop through all 50 US states and greet each one');
        await new Promise(resolve => setTimeout(resolve, 20));
      });
      await act(async () => {
        send?.('keep going');
        await new Promise(resolve => setTimeout(resolve, 20));
      });

      expect(bodies).toHaveLength(2);
      // The opening turn carries the request as the message itself.
      expect(JSON.stringify(bodies[0])).not.toContain('Original workflow request');
      const followUp = JSON.stringify(bodies[1]);
      expect(followUp).toContain('Original workflow request');
      expect(followUp).toContain('Loop through all 50 US states and greet each one');
    });
  });

  describe('when the user stops a generation that is still streaming', () => {
    async function renderStoppedHarness() {
      // Stays open so the run is genuinely in flight when cancel is pressed.
      registerStreamingHandlers();
      const captured: { failure?: WorkflowGenerationFailure | null } = {};
      let send: ((message: string) => void) | undefined;
      let cancel: (() => void) | undefined;

      render(
        <Providers>
          <WorkflowChatProvider
            threadId="workflow-builder-stopped"
            authoringState={createWorkflowDraftAuthoringState('stopped')}
            initialMessages={[]}
            createTools={() => ({})}
            onGenerationFailure={next => (captured.failure = next)}
          >
            <SendCapture onReady={fn => (send = fn)} />
            <CancelCapture onReady={fn => (cancel = fn)} />
          </WorkflowChatProvider>
        </Providers>,
      );

      await act(async () => {
        send?.('Build a workflow that loops through every US state');
        await new Promise(resolve => setTimeout(resolve, 20));
      });
      await act(async () => {
        cancel?.();
        await new Promise(resolve => setTimeout(resolve, 40));
      });
      return captured;
    }

    it('reports that the user stopped it rather than diagnosing the draft', async () => {
      const harness = await renderStoppedHarness();

      expect(harness.failure?.code).toBe('stopped-by-user');
      expect(harness.failure?.message).toContain('You stopped this generation');
    });

    it('never blames the model for a run the user ended', async () => {
      const harness = await renderStoppedHarness();

      expect(harness.failure?.code).not.toBe('no-accepted-draft');
      expect(harness.failure?.code).not.toBe('generation-failed');
      expect(harness.failure?.message ?? '').not.toContain('Retry with more specific workflow steps');
    });

    it('does not let the stopped run report a failure against the next turn', async () => {
      // The abort can settle at any time. If that late settle is still treated
      // as the current turn ending, it fails a turn the user already restarted.
      const controllers: ReadableStreamDefaultController[] = [];
      server.use(
        http.get(`${BASE_URL}/api/auth/me`, () => HttpResponse.json({ id: 'user-1' })),
        http.post(`${BASE_URL}/api/editor/workflow-builder/stream`, () => {
          return new HttpResponse(
            new ReadableStream({
              start: controller => {
                controllers.push(controller);
              },
            }),
            { headers: { 'content-type': 'text/event-stream' } },
          );
        }),
      );

      const captured: { failure?: WorkflowGenerationFailure | null } = {};
      let send: ((message: string) => void) | undefined;
      let cancel: (() => void) | undefined;

      render(
        <Providers>
          <WorkflowChatProvider
            threadId="workflow-builder-stopped-stale"
            authoringState={createWorkflowDraftAuthoringState('stopped-stale')}
            initialMessages={[]}
            createTools={() => ({})}
            onGenerationFailure={next => (captured.failure = next)}
          >
            <SendCapture onReady={fn => (send = fn)} />
            <CancelCapture onReady={fn => (cancel = fn)} />
          </WorkflowChatProvider>
        </Providers>,
      );

      await act(async () => {
        send?.('Build a workflow that loops through every US state');
        await new Promise(resolve => setTimeout(resolve, 20));
      });
      await act(async () => {
        cancel?.();
        await new Promise(resolve => setTimeout(resolve, 20));
      });
      // The user retries, then the abandoned first stream finally settles.
      await act(async () => {
        send?.('try again, keep it simpler');
        await new Promise(resolve => setTimeout(resolve, 20));
      });
      await act(async () => {
        controllers[0]?.close();
        await new Promise(resolve => setTimeout(resolve, 40));
      });

      expect(captured.failure?.code ?? null).not.toBe('no-accepted-draft');
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
