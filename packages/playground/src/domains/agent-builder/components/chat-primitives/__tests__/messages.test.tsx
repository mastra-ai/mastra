// @vitest-environment jsdom
import { TooltipProvider } from '@mastra/playground-ui';
import { MastraReactProvider } from '@mastra/react';
import type { MastraUIMessage } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import { AGENT_BUILDER_TOOL_NAME } from '../../agent-builder-edit/hooks/use-agent-builder-tool';
import { CONNECT_CHANNEL_TOOL_NAME } from '../../agent-builder-edit/hooks/use-connect-channel-tool';
import { MessageRow } from '../messages';
import { server } from '@/test/msw-server';

const ChannelsWrapper = ({ children }: { children: ReactNode }) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <MastraReactProvider baseUrl="http://localhost:4111">
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>{children}</TooltipProvider>
      </QueryClientProvider>
    </MastraReactProvider>
  );
};

const buildMessage = (parts: MastraUIMessage['parts']): MastraUIMessage => ({
  id: 'msg-1',
  role: 'assistant',
  parts,
});

describe('MessageRow dynamic-tool rendering', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders tool display names for agent-builder tool calls', () => {
    const { container } = render(
      <MessageRow
        message={buildMessage([
          {
            type: 'dynamic-tool',
            toolCallId: 'call-1',
            toolName: AGENT_BUILDER_TOOL_NAME,
            state: 'output-available',
            input: {
              tools: [
                { id: 'web-search', name: 'Web Search' },
                { id: 'weather-lookup', name: 'Weather Lookup' },
              ],
            },
            output: { success: true },
          } as MastraUIMessage['parts'][number],
        ])}
      />,
    );

    expect(container.textContent).toContain('Web Search');
    expect(container.textContent).toContain('Weather Lookup');
    expect(container.textContent).not.toContain('web-search');
    expect(container.textContent).not.toContain('weather-lookup');
  });

  it('renders the generic shimmer for non-builder dynamic tools', () => {
    const { container } = render(
      <MessageRow
        message={buildMessage([
          {
            type: 'dynamic-tool',
            toolCallId: 'call-5',
            toolName: 'some-other-tool',
            state: 'output-available',
            input: { tools: [{ id: 'web-search', name: 'Web Search' }] },
            output: { success: true },
          } as MastraUIMessage['parts'][number],
        ])}
      />,
    );

    // Generic shimmer ends with "..." — don't pin the exact word since it's random.
    expect(container.textContent?.endsWith('...')).toBe(true);
    expect(container.textContent).not.toContain('Web Search');
  });

  it('renders the inline Slack connect widget for the connectChannel tool', async () => {
    server.use(
      http.get('*/api/channels/platforms', () =>
        HttpResponse.json([{ id: 'slack', name: 'Slack', isConfigured: true }]),
      ),
      http.get('*/api/channels/:platform/installations', () => HttpResponse.json([])),
    );

    render(
      <ChannelsWrapper>
        <MessageRow
          agentId="agent-1"
          message={buildMessage([
            {
              type: 'dynamic-tool',
              toolCallId: 'call-2',
              toolName: CONNECT_CHANNEL_TOOL_NAME,
              state: 'output-available',
              input: { platform: 'slack' },
              output: { success: true },
            } as MastraUIMessage['parts'][number],
          ])}
        />
      </ChannelsWrapper>,
    );

    const widget = await screen.findByTestId('agent-builder-chat-connect-channel-slack');
    expect(widget.textContent).toContain('Slack');
    // Generic ToolExecutionMessage shimmer would end with "..." — confirm we don't fall through.
    await waitFor(() => {
      expect(widget.textContent?.endsWith('...')).toBe(false);
    });
  });

  it('renders tool display names for persisted agent-builder tool parts (post-reload shape)', () => {
    const { container } = render(
      <MessageRow
        message={buildMessage([
          {
            type: `tool-${AGENT_BUILDER_TOOL_NAME}`,
            toolCallId: 'call-3',
            state: 'output-available',
            input: {
              tools: [
                { id: 'web-search', name: 'Web Search' },
                { id: 'weather-lookup', name: 'Weather Lookup' },
              ],
            },
            output: { success: true },
          } as MastraUIMessage['parts'][number],
        ])}
      />,
    );

    expect(container.textContent).toContain('Web Search');
    expect(container.textContent).toContain('Weather Lookup');
  });

  it('renders the inline Slack connect widget for persisted connectChannel tool parts (post-reload shape)', async () => {
    server.use(
      http.get('*/api/channels/platforms', () =>
        HttpResponse.json([{ id: 'slack', name: 'Slack', isConfigured: true }]),
      ),
      http.get('*/api/channels/:platform/installations', () => HttpResponse.json([])),
    );

    render(
      <ChannelsWrapper>
        <MessageRow
          agentId="agent-1"
          message={buildMessage([
            {
              type: `tool-${CONNECT_CHANNEL_TOOL_NAME}`,
              toolCallId: 'call-4',
              state: 'output-available',
              input: { platform: 'slack' },
              output: { success: true },
            } as MastraUIMessage['parts'][number],
          ])}
        />
      </ChannelsWrapper>,
    );

    const widget = await screen.findByTestId('agent-builder-chat-connect-channel-slack');
    expect(widget.textContent).toContain('Slack');
    await waitFor(() => {
      expect(widget.textContent?.endsWith('...')).toBe(false);
    });
  });
});
