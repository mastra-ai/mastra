import type { MastraDBMessage } from '@mastra/core/agent/message-list';
import type { MastraTextPart } from '@mastra/react';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

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

const streamingText = (text: string): MastraTextPart => ({ type: 'text', text, state: 'streaming' });

const omPart = (name: string, data: Record<string, unknown>) => ({
  type: `data-${name}`,
  data,
});

const completedToolPart = (toolName: string, toolCallId: string) =>
  ({
    type: 'tool-invocation',
    toolInvocation: {
      toolName,
      toolCallId,
      state: 'result',
      args: {},
      result: { ok: true },
    },
  }) as never;

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

  // The reveal only paces if the factory keeps the text part mounted as the
  // reply grows; a remount would show every chunk whole again.
  describe('when a streaming reply grows', () => {
    it('reveals it gradually', () => {
      vi.useFakeTimers();
      const reply = `Ready. ${Array.from({ length: 40 }, (_, index) => `word${index}`).join(' ')}`;
      const growing = (text: string) => baseMessage({ content: { format: 2, parts: [streamingText(text)] } });

      const { container, rerender } = render(<MessageRow message={growing('Ready.')} />, { wrapper: Providers });
      rerender(<MessageRow message={growing(reply)} />);

      expect(container.textContent).not.toContain('word39');

      for (let frames = 0; frames < 300 && !container.textContent?.includes('word39'); frames++) {
        act(() => void vi.advanceTimersByTime(16));
      }

      expect(container.textContent).toContain('word39');
    });
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
    expect(document.querySelector('[data-tool-call-rail]')).toBeNull();
  });

  it('adds the vertical tool rail to every rendered tool call in one message except the last one', () => {
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
                toolName: 'firstTool',
                toolCallId: 'call-first',
                state: 'result',
                args: { first: true },
                result: { ok: true },
              },
            } as never,
            {
              type: 'tool-secondTool',
              toolName: 'secondTool',
              toolCallId: 'call-second',
              state: 'output-available',
              input: { second: true },
              output: { ok: true },
            } as never,
          ],
        },
      }),
    );

    const [firstTool, lastTool] = screen.getAllByTestId('tool-badge');
    const rail = document.querySelector('[data-tool-call-rail]');

    expect(rail).toBeTruthy();
    expect(rail?.getAttribute('aria-hidden')).toBe('true');
    expect(rail?.classList.contains('w-px')).toBe(true);
    expect(firstTool.compareDocumentPosition(rail!) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
    expect(rail!.compareDocumentPosition(lastTool) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
  });

  it('does not count hidden tool parts when deciding whether to render a vertical rail', () => {
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
                toolName: 'visibleTool',
                toolCallId: 'call-visible',
                state: 'result',
                args: {},
                result: { ok: true },
              },
            } as never,
            {
              type: 'tool-invocation',
              toolInvocation: {
                toolName: 'updateWorkingMemory',
                toolCallId: 'call-hidden',
                state: 'result',
                args: {},
                result: 'ok',
              },
            } as never,
          ],
        },
      }),
    );

    expect(screen.getAllByTestId('tool-badge')).toHaveLength(1);
    expect(document.querySelector('[data-tool-call-rail]')).toBeNull();
  });

  describe('when visible content separates two tool calls', () => {
    it('does not connect tools across assistant prose', () => {
      renderRow(
        baseMessage({
          role: 'assistant',
          content: {
            format: 2,
            metadata: { mode: 'stream' },
            parts: [
              completedToolPart('firstTool', 'call-first'),
              { type: 'text', text: 'The first result needs explanation.' },
              completedToolPart('secondTool', 'call-second'),
            ],
          },
        }),
      );

      expect(screen.getAllByTestId('tool-badge')).toHaveLength(2);
      expect(document.querySelector('[data-tool-call-rail]')).toBeNull();
    });

    it('does not connect tools across reasoning', () => {
      renderRow(
        baseMessage({
          role: 'assistant',
          content: {
            format: 2,
            metadata: { mode: 'stream' },
            parts: [
              completedToolPart('firstTool', 'call-first'),
              { type: 'reasoning', reasoning: 'Checking whether another tool is needed.' } as never,
              completedToolPart('secondTool', 'call-second'),
            ],
          },
        }),
      );

      expect(screen.getAllByTestId('tool-badge')).toHaveLength(2);
      expect(document.querySelector('[data-tool-call-rail]')).toBeNull();
    });
  });

  describe('when only non-rendered content separates two tool calls', () => {
    it('connects the visible tools across a hidden tool part', () => {
      renderRow(
        baseMessage({
          role: 'assistant',
          content: {
            format: 2,
            metadata: { mode: 'stream' },
            parts: [
              completedToolPart('firstTool', 'call-first'),
              completedToolPart('updateWorkingMemory', 'call-hidden'),
              completedToolPart('secondTool', 'call-second'),
            ],
          },
        }),
      );

      expect(screen.getAllByTestId('tool-badge')).toHaveLength(2);
      expect(document.querySelectorAll('[data-tool-call-rail]')).toHaveLength(1);
    });
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

  describe('when every assistant part is hidden', () => {
    it('removes a task-tool-only message instead of leaving an empty row', () => {
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
                  toolName: 'task_write',
                  toolCallId: 'call-task',
                  state: 'result',
                  args: { tasks: [] },
                  result: { tasks: [] },
                },
              } as never,
              { type: 'step-start' } as never,
            ],
          },
        }),
      );

      expect(container.innerHTML).toBe('');
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
      expect(container.innerHTML).toBe('');
    });
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

  it('reveals approval buttons without requiring the pending tool to be opened', () => {
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
    expect(screen.getByRole('button', { name: 'DangerousTool' }).getAttribute('aria-expanded')).toBe('true');
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
    it('removes the message row because tasks render in the docked TaskPanel', () => {
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
      expect(container.innerHTML).toBe('');
    });
  });

  describe('when a persisted task signal contains display text', () => {
    it('does not leave a read-aloud or copy action bar behind', () => {
      const { container } = render(
        <MessageRow
          message={baseMessage({
            id: 'task-signal',
            role: 'signal' as MastraDBMessage['role'],
            type: 'task-list-update' as MastraDBMessage['type'],
            content: {
              format: 2,
              parts: [{ type: 'text', text: '✓ Completed task' }],
              metadata: {
                signal: {
                  type: 'state',
                  tagName: 'task-list-update',
                  metadata: {
                    value: {
                      tasks: [
                        {
                          id: 'task-1',
                          content: 'Verify tool UI',
                          status: 'completed',
                          activeForm: 'Verifying tool UI',
                        },
                      ],
                    },
                  },
                },
              },
            } as never,
          })}
          onReadAloud={() => {}}
        />,
        { wrapper: Providers },
      );

      expect(container.innerHTML).toBe('');
      expect(screen.queryByRole('button', { name: 'Read aloud' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Copy' })).toBeNull();
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
