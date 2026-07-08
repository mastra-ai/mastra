import type { MastraDBMessage } from '@mastra/core/agent/message-list';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { MessageRow } from '../message-row';
import { buildGlobalOmPartsByCycleId, convertOmPartsInMastraMessage } from '@/services/om-parts-converter';
import { ToolCallProvider } from '@/services/tool-call-provider';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';

const mcpEmptyHandlers = [
  http.get(`${BASE_URL}/api/mcp/v0/servers`, () => HttpResponse.json({ servers: [], totalCount: 0 })),
];

beforeEach(() => {
  server.use(...mcpEmptyHandlers);
});

afterEach(() => cleanup());

const Providers = ({ children }: { children: ReactNode }) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <ToolCallProvider
            approveToolcall={() => {}}
            declineToolcall={() => {}}
            approveToolcallGenerate={() => {}}
            declineToolcallGenerate={() => {}}
            approveNetworkToolcall={() => {}}
            declineNetworkToolcall={() => {}}
            isRunning={false}
            toolCallApprovals={{}}
            networkToolCallApprovals={{}}
          >
            {children}
          </ToolCallProvider>
        </MemoryRouter>
      </QueryClientProvider>
    </MastraReactProvider>
  );
};

const renderRow = (message: MastraDBMessage) => render(<MessageRow message={message} />, { wrapper: Providers });

const omPart = (name: string, data: Record<string, unknown>) => ({
  type: `data-${name}`,
  data,
});

const baseMessage = (over: Partial<MastraDBMessage>): MastraDBMessage =>
  ({
    id: 'msg-1',
    role: 'assistant',
    createdAt: new Date(),
    content: { format: 2, parts: [] },
    ...over,
  }) as MastraDBMessage;

describe('MessageRow', () => {
  it('renders assistant text as markdown', () => {
    renderRow(
      baseMessage({
        role: 'assistant',
        content: { format: 2, parts: [{ type: 'text', text: 'Hello **world**' }] },
      }),
    );
    expect(screen.getByText('world')).toBeTruthy();
  });

  it('renders user text', () => {
    renderRow(
      baseMessage({
        role: 'user',
        content: { format: 2, parts: [{ type: 'text', text: 'a user line' }] },
      }),
    );
    expect(screen.getByText('a user line')).toBeTruthy();
  });

  it('drops messages with no displayable role', () => {
    const { container } = renderRow(
      baseMessage({
        role: 'tool' as MastraDBMessage['role'],
        content: { format: 2, parts: [{ type: 'text', text: 'hidden' }] },
      }),
    );
    expect(container.textContent).toBe('');
  });

  it('renders a signal data badge', () => {
    renderRow(
      baseMessage({
        role: 'assistant',
        content: {
          format: 2,
          parts: [
            {
              type: 'data-signal',
              data: { type: 'state', contents: 'signal body', metadata: { state: { id: 'cart' } } },
            } as never,
          ],
        },
      }),
    );
    expect(screen.getByText('cart')).toBeTruthy();
  });

  // Regression: a persisted reactive (non-user) `signal` row must render a
  // SignalBadge on read-back. This conversion existed at 1.41.0 and was lost
  // when the chat renderer was rewritten (PR #17774); the row was dropped.
  it('renders a persisted reactive signal row as a signal badge on read-back', () => {
    const { container } = renderRow(
      baseMessage({
        id: 'sig-1',
        role: 'signal' as MastraDBMessage['role'],
        type: 'reactive' as MastraDBMessage['type'],
        content: {
          format: 2,
          metadata: { signal: { type: 'reactive', tagName: 'system-reminder' } },
          parts: [{ type: 'text', text: 'reactive signal body' }],
        } as never,
      }),
    );
    expect(container.textContent).toContain('system-reminder');
    expect(container.textContent).toContain('reactive signal body');
  });

  // A non-user signal whose payload is not a renderable signal shape must be
  // dropped, not rendered as an empty assistant bubble.
  it('drops a non-user signal whose payload is not a renderable signal shape', () => {
    const { container } = renderRow(
      baseMessage({
        id: 'sig-unknown',
        role: 'signal' as MastraDBMessage['role'],
        type: 'internal' as MastraDBMessage['type'],
        content: {
          format: 2,
          parts: [{ type: 'text', text: 'internal signal body' }],
        } as never,
      }),
    );
    expect(container.textContent).toBe('');
  });

  it('renders a persisted user signal row as a user message on read-back', () => {
    renderRow(
      baseMessage({
        id: 'sig-user',
        role: 'signal' as MastraDBMessage['role'],
        type: 'user' as MastraDBMessage['type'],
        content: { format: 2, parts: [{ type: 'text', text: 'echoed user signal' }] },
      }),
    );
    expect(screen.getByText('echoed user signal')).toBeTruthy();
  });

  it('routes a tool-invocation part into ToolCard (generic tool badge)', () => {
    renderRow(
      baseMessage({
        role: 'assistant',
        content: {
          format: 2,
          metadata: { mode: 'stream' },
          parts: [
            {
              type: 'tool-invocation',
              toolInvocation: {
                toolName: 'genericTool',
                toolCallId: 'call-1',
                state: 'result',
                args: { q: 'x' },
                result: { ok: true },
              },
            } as never,
          ],
        },
      }),
    );
    expect(document.querySelector('[data-testid="tool-badge"]')).toBeTruthy();
  });

  it('routes an OM observation tool into the observation marker badge', () => {
    renderRow(
      baseMessage({
        role: 'assistant',
        content: {
          format: 2,
          metadata: { mode: 'stream' },
          parts: [
            {
              type: 'tool-invocation',
              toolInvocation: {
                toolName: 'mastra-memory-om-observation',
                toolCallId: 'call-om',
                state: 'call',
                args: { cycleId: 'cycle-1' },
              },
            } as never,
          ],
        },
      }),
    );
    expect(document.querySelector('[data-om-badge="cycle-1"]')).toBeTruthy();
  });

  it('hides updateWorkingMemory tool calls', () => {
    const { container } = renderRow(
      baseMessage({
        role: 'assistant',
        content: {
          format: 2,
          metadata: { mode: 'stream' },
          parts: [
            {
              type: 'tool-invocation',
              toolInvocation: {
                toolName: 'updateWorkingMemory',
                toolCallId: 'call-wm',
                state: 'result',
                args: {},
                result: 'ok',
              },
            } as never,
          ],
        },
      }),
    );
    expect(container.querySelector('[data-testid="tool-badge"]')).toBeNull();
  });

  it('renders approval buttons when requireApprovalMetadata is present for the tool', () => {
    renderRow(
      baseMessage({
        role: 'assistant',
        content: {
          format: 2,
          metadata: {
            mode: 'stream',
            requireApprovalMetadata: {
              dangerousTool: { toolCallId: 'call-appr', toolName: 'dangerousTool', args: {} },
            },
          },
          parts: [
            {
              type: 'tool-invocation',
              toolInvocation: {
                toolName: 'dangerousTool',
                toolCallId: 'call-appr',
                state: 'call',
                args: {},
              },
            } as never,
          ],
        },
      }),
    );
    expect(screen.getByText('Approve')).toBeTruthy();
    expect(screen.getByText('Decline')).toBeTruthy();
  });

  it('routes a reasoning part through MessageFactory into the reasoning body', () => {
    renderRow(
      baseMessage({
        role: 'assistant',
        content: {
          format: 2,
          parts: [{ type: 'reasoning', reasoning: 'thinking out loud' } as never],
        },
      }),
    );
    expect(screen.getByText('thinking out loud')).toBeTruthy();
  });

  it('routes a dynamic-tool part into ToolCard (generic tool badge)', () => {
    renderRow(
      baseMessage({
        role: 'assistant',
        content: {
          format: 2,
          metadata: { mode: 'stream' },
          parts: [
            {
              type: 'tool-dynamicGenericTool',
              toolName: 'dynamicGenericTool',
              toolCallId: 'call-dyn',
              state: 'output-available',
              input: { q: 'x' },
              output: { ok: true },
            } as never,
          ],
        },
      }),
    );
    expect(document.querySelector('[data-testid="tool-badge"]')).toBeTruthy();
  });

  it('renders live streamed OM extraction output from a dynamic-tool part', () => {
    renderRow(
      baseMessage({
        role: 'assistant',
        content: {
          format: 2,
          metadata: { mode: 'stream' },
          parts: [
            {
              type: 'dynamic-tool',
              toolName: 'mastra-memory-om-observation',
              toolCallId: 'om-observation-cycle-live',
              state: 'output-available',
              input: { cycleId: 'cycle-live', _state: 'loading', operationType: 'observation' },
              output: {
                status: 'complete',
                omData: {
                  cycleId: 'cycle-live',
                  _state: 'complete',
                  operationType: 'observation',
                  extractedValues: { workingMemory: { name: 'Tyler' } },
                },
              },
            } as never,
          ],
        },
      }),
    );

    expect(screen.getByRole('button', { name: /observed/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /extractions \(1\)/i })).toBeTruthy();
  });

  it('renders buffered OM extraction output when activation and completion are both present', () => {
    const rawMessage = baseMessage({
      role: 'assistant',
      content: {
        format: 2,
        metadata: { mode: 'stream' },
        parts: [
          omPart('om-buffering-start', { cycleId: 'cycle-buffer-live', operationType: 'observation' }),
          omPart('om-activation', {
            cycleId: 'cycle-buffer-live',
            operationType: 'observation',
            tokensActivated: 42,
          }),
          omPart('om-buffering-end', {
            cycleId: 'cycle-buffer-live',
            operationType: 'observation',
            tokensBuffered: 42,
            bufferedTokens: 8,
            extractedValues: { workingMemory: { name: 'Tyler' } },
          }),
        ] as never,
      },
    });
    const globalParts = buildGlobalOmPartsByCycleId([rawMessage]);
    const message = convertOmPartsInMastraMessage(rawMessage, globalParts);

    renderRow(message);

    expect(screen.getByRole('button', { name: /buffered observations/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /extractions \(1\)/i })).toBeTruthy();
  });

  it('routes a user file part into an in-message attachment preview', () => {
    const { container } = renderRow(
      baseMessage({
        role: 'user',
        content: {
          format: 2,
          parts: [{ type: 'file', mimeType: 'image/png', data: 'https://example.com/a.png' } as never],
        },
      }),
    );
    const img = container.querySelector('img');
    expect(img).toBeTruthy();
    expect(img?.getAttribute('src')).toBe('https://example.com/a.png');
  });

  it('renders a message-level error notice via the status.Error slot', () => {
    renderRow(
      baseMessage({
        role: 'assistant',
        content: {
          format: 2,
          metadata: { status: 'error' },
          parts: [{ type: 'text', text: 'boom went wrong' }],
        },
      }),
    );
    expect(screen.getByText('boom went wrong')).toBeTruthy();
    expect(screen.getByText('Error')).toBeTruthy();
  });

  describe('when an assistant message contains a step-start part', () => {
    it('does not render the debug "Fallback:" text and still renders the text part', () => {
      const { container } = renderRow(
        baseMessage({
          role: 'assistant',
          content: {
            format: 2,
            parts: [{ type: 'step-start' } as never, { type: 'text', text: 'real content' }],
          },
        }),
      );

      expect(screen.getByText('real content')).toBeTruthy();
      expect(container.textContent).not.toContain('Fallback:');
      expect(container.textContent).not.toContain('step-start');
    });
  });

  describe('when a task signal carries an empty task snapshot', () => {
    it('hides the signal badge (tasks render in the docked TaskPanel)', () => {
      const { container } = renderRow(
        baseMessage({
          role: 'assistant',
          content: {
            format: 2,
            parts: [
              {
                type: 'data-signal',
                data: { type: 'state', tagName: 'current-task-list', metadata: { value: { tasks: [] } } },
              } as never,
            ],
          },
        }),
      );
      expect(container.textContent).toBe('');
    });
  });

  describe('when a task signal carries an item with an invalid status', () => {
    it('rejects the task shape and falls back to the generic state badge', () => {
      renderRow(
        baseMessage({
          role: 'assistant',
          content: {
            format: 2,
            parts: [
              {
                type: 'data-signal',
                data: {
                  type: 'state',
                  tagName: 'current-task-list',
                  metadata: {
                    state: { id: 'current-task-list' },
                    value: {
                      tasks: [{ id: 't1', content: 'Do thing', status: 'bogus', activeForm: 'Doing thing' }],
                    },
                  },
                },
              } as never,
            ],
          },
        }),
      );
      expect(screen.getByText('current-task-list')).toBeTruthy();
    });
  });
});
