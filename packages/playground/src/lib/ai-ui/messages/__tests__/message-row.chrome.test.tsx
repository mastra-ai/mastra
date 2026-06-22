// @vitest-environment jsdom
import type { MastraDBMessage } from '@mastra/core/agent/message-list';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DatasetSaveProvider } from '../../context/dataset-save-context';
import { MessageRow } from '../message-row';
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

const Providers = ({ children, datasetEnabled }: { children: ReactNode; datasetEnabled?: boolean }) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const inner = (
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
  );
  return (
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          {datasetEnabled ? (
            <DatasetSaveProvider enabled threadId="thread-1" agentId="agent-1">
              {inner}
            </DatasetSaveProvider>
          ) : (
            inner
          )}
        </MemoryRouter>
      </QueryClientProvider>
    </MastraReactProvider>
  );
};

const baseMessage = (over: Partial<MastraDBMessage>): MastraDBMessage =>
  ({
    id: 'msg-1',
    role: 'assistant',
    createdAt: new Date(),
    content: { format: 2, parts: [] },
    ...over,
  }) as MastraDBMessage;

describe('MessageRow chrome', () => {
  it('shows a copy action on an assistant text message and copies the text', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    render(
      <MessageRow
        message={baseMessage({
          role: 'assistant',
          content: { format: 2, parts: [{ type: 'text', text: 'copy me please' }] },
        })}
      />,
      { wrapper: Providers },
    );

    const copyButton = screen.getByRole('button', { name: /copy/i });
    fireEvent.click(copyButton);
    expect(writeText).toHaveBeenCalledWith('copy me please');
  });

  it('falls back when the browser blocks async clipboard writes', async () => {
    const writeText = vi.fn().mockRejectedValue(new DOMException('Write permission denied', 'NotAllowedError'));
    const execCommand = vi.fn(() => true);
    Object.assign(navigator, { clipboard: { writeText } });
    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      value: execCommand,
    });

    render(
      <MessageRow
        message={baseMessage({
          role: 'assistant',
          content: { format: 2, parts: [{ type: 'text', text: 'fallback copy text' }] },
        })}
      />,
      { wrapper: Providers },
    );

    const copyButton = screen.getByRole('button', { name: /copy/i });
    fireEvent.click(copyButton);

    expect(writeText).toHaveBeenCalledWith('fallback copy text');
    await waitFor(() => expect(execCommand).toHaveBeenCalledWith('copy'));
    expect(document.querySelector('textarea')).toBeNull();
  });

  it('shows a read-aloud action that calls onReadAloud with the message text', () => {
    const onReadAloud = vi.fn();
    render(
      <MessageRow
        message={baseMessage({
          role: 'assistant',
          content: { format: 2, parts: [{ type: 'text', text: 'speak this' }] },
        })}
        onReadAloud={onReadAloud}
      />,
      { wrapper: Providers },
    );

    const readButton = screen.getByRole('button', { name: /read aloud/i });
    fireEvent.click(readButton);
    expect(onReadAloud).toHaveBeenCalledWith('speak this');
  });

  it('shows a stop action while speaking and calls onStopSpeaking', () => {
    const onStopSpeaking = vi.fn();
    render(
      <MessageRow
        message={baseMessage({
          role: 'assistant',
          content: { format: 2, parts: [{ type: 'text', text: 'speaking now' }] },
        })}
        isSpeaking
        onStopSpeaking={onStopSpeaking}
      />,
      { wrapper: Providers },
    );

    const stopButton = screen.getByRole('button', { name: /stop/i });
    fireEvent.click(stopButton);
    expect(onStopSpeaking).toHaveBeenCalled();
  });

  it('does not show the action bar when the assistant message has no visible text', () => {
    render(
      <MessageRow
        message={baseMessage({
          role: 'assistant',
          content: {
            format: 2,
            metadata: { mode: 'stream' },
            parts: [
              {
                type: 'tool-invocation',
                toolInvocation: { toolName: 'genericTool', toolCallId: 'c1', state: 'result', args: {}, result: {} },
              } as never,
            ],
          },
        })}
      />,
      { wrapper: Providers },
    );

    expect(screen.queryByRole('button', { name: /copy/i })).toBeNull();
  });

  it('renders the dataset save action on user messages when dataset save is enabled', () => {
    render(
      <MessageRow
        message={baseMessage({
          role: 'user',
          content: { format: 2, parts: [{ type: 'text', text: 'save me to a dataset' }] },
        })}
      />,
      { wrapper: ({ children }) => <Providers datasetEnabled>{children}</Providers> },
    );

    expect(screen.getByRole('button', { name: /save to dataset/i })).toBeTruthy();
  });

  it('does not render the dataset save action when dataset save is disabled', () => {
    render(
      <MessageRow
        message={baseMessage({
          role: 'user',
          content: { format: 2, parts: [{ type: 'text', text: 'no dataset here' }] },
        })}
      />,
      { wrapper: Providers },
    );

    expect(screen.queryByRole('button', { name: /save to dataset/i })).toBeNull();
  });

  it('renders a system-reminder badge for user system-reminder text', () => {
    render(
      <MessageRow
        message={baseMessage({
          role: 'user',
          content: {
            format: 2,
            parts: [{ type: 'text', text: '<system-reminder>path/to/file.ts updated</system-reminder>' }],
          },
        })}
      />,
      { wrapper: Providers },
    );

    expect(screen.getAllByText('System reminder').length).toBeGreaterThan(0);
  });

  it('renders an image attachment preview for user image parts', () => {
    render(
      <MessageRow
        message={baseMessage({
          role: 'user',
          content: {
            format: 2,
            parts: [{ type: 'file', mimeType: 'image/png', data: 'https://example.com/cat.png' } as never],
          },
        })}
      />,
      { wrapper: Providers },
    );

    expect(document.querySelector('img')).toBeTruthy();
  });

  it('marks the user message as pending when a part carries pending status', () => {
    const { container } = render(
      <MessageRow
        message={baseMessage({
          role: 'user',
          content: {
            format: 2,
            parts: [{ type: 'text', text: 'optimistic', metadata: { status: 'pending' } } as never],
          },
        })}
      />,
      { wrapper: Providers },
    );

    expect(container.querySelector('[data-message-pending="true"]')).toBeTruthy();
  });
});
