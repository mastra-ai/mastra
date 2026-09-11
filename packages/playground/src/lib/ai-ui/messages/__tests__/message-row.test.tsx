import type { MastraDBMessage } from '@mastra/core/agent/message-list';
import { ArrivalScope } from '@mastra/playground-ui/components/Arrival';
import { ToolCallProvider } from '@mastra/playground-ui/domains/chat/context/tool-call-context';
import { ARRIVING_CLASS } from '@mastra/playground-ui/tokens';
import type { MastraTextPart, ToolInvocationPart } from '@mastra/react';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MessageRow } from '../message-row';
import { buildGlobalOmPartsByCycleId, convertOmPartsInMastraMessage } from '@/services/om-parts-converter';
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

    it('holds a tool row behind the prose written before it', () => {
      vi.useFakeTimers();
      const reply = `Ready. ${Array.from({ length: 40 }, (_, index) => `word${index}`).join(' ')}`;
      const withTool = (text: string) =>
        baseMessage({
          content: {
            format: 2,
            parts: [
              streamingText(text),
              {
                type: 'tool-invocation',
                toolInvocation: {
                  toolName: 'genericTool',
                  toolCallId: 'call-1',
                  state: 'result',
                  args: {},
                  result: { ok: true },
                },
              } as never,
            ],
          },
        });
      const badge = () => container.querySelector('[data-testid="tool-badge"]');

      const { container, rerender } = render(<MessageRow message={withTool('Ready.')} />, { wrapper: Providers });
      rerender(<MessageRow message={withTool(reply)} />);

      expect(badge()).toBeNull();

      for (let frames = 0; frames < 600 && !badge(); frames++) {
        act(() => void vi.advanceTimersByTime(16));
      }

      expect(badge()).toBeTruthy();
    });

    it('finishes one text block before starting the next', () => {
      vi.useFakeTimers();
      const first = `First. ${Array.from({ length: 30 }, (_, index) => `alpha${index}`).join(' ')}`;
      const second = `Second. ${Array.from({ length: 30 }, (_, index) => `beta${index}`).join(' ')}`;
      const twoBlocks = (a: string, b: string) =>
        baseMessage({ content: { format: 2, parts: [streamingText(a), streamingText(b)] } });

      const { container, rerender } = render(<MessageRow message={twoBlocks('First.', '')} />, { wrapper: Providers });
      rerender(<MessageRow message={twoBlocks(first, second)} />);

      for (let frames = 0; frames < 900 && !container.textContent?.includes('beta29'); frames++) {
        if (container.textContent?.includes('beta0')) expect(container.textContent).toContain('alpha29');
        act(() => void vi.advanceTimersByTime(16));
      }

      expect(container.textContent).toContain('beta29');
    });

    it('fades in a tool row that lands while the reader is watching', () => {
      vi.useFakeTimers();
      const reply = `Ready. ${Array.from({ length: 40 }, (_, index) => `word${index}`).join(' ')}`;
      const withTool = (text: string) =>
        baseMessage({
          content: {
            format: 2,
            parts: [
              streamingText(text),
              {
                type: 'tool-invocation',
                toolInvocation: {
                  toolName: 'genericTool',
                  toolCallId: 'call-1',
                  state: 'result',
                  args: {},
                  result: { ok: true },
                },
              } as never,
            ],
          },
        });
      const badge = () => container.querySelector('[data-testid="tool-badge"]');

      const { container, rerender } = render(
        <ArrivalScope>
          <MessageRow message={withTool('Ready.')} />
        </ArrivalScope>,
        { wrapper: Providers },
      );
      rerender(
        <ArrivalScope>
          <MessageRow message={withTool(reply)} />
        </ArrivalScope>,
      );

      for (let frames = 0; frames < 600 && !badge(); frames++) {
        act(() => void vi.advanceTimersByTime(16));
      }

      expect(badge()?.closest(`.${ARRIVING_CLASS}`)).not.toBeNull();
    });

    it('hands over a notice whole instead of pacing it', () => {
      vi.useFakeTimers();
      const reason = `Blocked. ${Array.from({ length: 40 }, (_, index) => `word${index}`).join(' ')}`;
      const failing = (text: string) =>
        baseMessage({
          content: { format: 2, metadata: { status: 'error' }, parts: [streamingText(text)] },
        });

      const { container, rerender } = render(<MessageRow message={failing('Blocked.')} />, { wrapper: Providers });
      rerender(<MessageRow message={failing(reason)} />);

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
  });

  describe('when a completed tool result has image model output', () => {
    it('renders the generated image in the assistant message', () => {
      const toolPart: ToolInvocationPart = {
        type: 'tool-invocation',
        toolInvocation: {
          toolName: 'openai_create_image',
          toolCallId: 'call-image',
          state: 'result',
          args: { prompt: 'A pineapple' },
          result: { data: [{ b64_json: 'iVBORw0KGgo=' }] },
        },
        providerMetadata: {
          mastra: {
            modelOutput: {
              type: 'content',
              value: [{ type: 'media', data: 'iVBORw0KGgo=', mediaType: 'image/png' }],
            },
          },
        },
      };

      renderRow(
        baseMessage({
          role: 'assistant',
          content: { format: 2, metadata: { mode: 'stream' }, parts: [toolPart] },
        }),
      );

      const image = screen.getByRole<HTMLImageElement>('img', { name: 'Preview' });
      expect(image.src).toBe('data:image/png;base64,iVBORw0KGgo=');
    });
  });

  describe('when plain tool calls run back to back', () => {
    const toolCall = (
      toolCallId: string,
      toolName = 'genericTool',
      state: 'result' | 'call' = 'result',
    ): ToolInvocationPart =>
      state === 'result'
        ? {
            type: 'tool-invocation',
            toolInvocation: { state, toolName, toolCallId, args: { q: toolCallId }, result: { ok: true } },
          }
        : { type: 'tool-invocation', toolInvocation: { state, toolName, toolCallId, args: { q: toolCallId } } };
    const withCalls = (parts: MastraDBMessage['content']['parts'], metadata: Record<string, unknown> = {}) =>
      baseMessage({ role: 'assistant', content: { format: 2, metadata: { mode: 'stream', ...metadata }, parts } });

    it('folds three of them into one group row that opens onto the cards', () => {
      const { container } = renderRow(withCalls([toolCall('call-1'), toolCall('call-2'), toolCall('call-3')]));

      const group = screen.getByRole('group', { name: 'Tool group: 3 steps' });
      expect(container.querySelectorAll('[data-testid="tool-badge"]')).toHaveLength(0);

      fireEvent.click(within(group).getByRole('button'));
      expect(container.querySelectorAll('[data-testid="tool-badge"]')).toHaveLength(3);
    });

    it('leaves two of them as their own rows', () => {
      const { container } = renderRow(withCalls([toolCall('call-1'), toolCall('call-2')]));

      expect(screen.queryByRole('group', { name: /Tool group/ })).toBeNull();
      expect(container.querySelectorAll('[data-testid="tool-badge"]')).toHaveLength(2);
    });

    it('keeps a call waiting on approval out of the fold', () => {
      renderRow(
        withCalls([toolCall('call-1'), toolCall('call-2'), toolCall('call-3', 'dangerousTool', 'call')], {
          requireApprovalMetadata: { 'call-3': { toolCallId: 'call-3', toolName: 'dangerousTool', args: {} } },
        }),
      );

      expect(screen.queryByRole('group', { name: /Tool group/ })).toBeNull();
      expect(screen.getByText('Approve')).toBeTruthy();
    });

    it('lets a docked task update sit inside the run without breaking it', () => {
      renderRow(
        withCalls([toolCall('call-1'), toolCall('task-1', 'task_update'), toolCall('call-2'), toolCall('call-3')]),
      );

      expect(screen.getByRole('group', { name: 'Tool group: 3 steps' })).toBeTruthy();
    });

    // A thread read back without its suspend payload draws the question as a plain badge. It is still
    // a question, so it breaks the run rather than folding away with the calls around it.
    it('keeps a question out of the fold even where nothing is left to answer', () => {
      const { container } = render(
        <MessageRow
          readOnly
          message={withCalls([
            toolCall('call-1'),
            toolCall('ask-1', 'ask_user'),
            toolCall('call-2'),
            toolCall('call-3'),
          ])}
        />,
        { wrapper: Providers },
      );

      expect(screen.queryByRole('group', { name: /Tool group/ })).toBeNull();
      expect(container.querySelectorAll('[data-testid="tool-badge"]')).toHaveLength(4);
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
