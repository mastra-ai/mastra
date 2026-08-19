// @vitest-environment jsdom

import { toAISdkV5Messages } from '@mastra/ai-sdk/ui';
import type { MastraDBMessage } from '@mastra/core/agent/message-list';
import { TooltipProvider } from '@mastra/playground-ui/components/Tooltip';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AgentBadge } from '../agent-badge';
import { resolveToChildMessages } from '../resolve-child-messages';
import { ChatAgentContext } from '@/lib/ai-ui/chat/chat-context';
import { ToolCallProvider } from '@/services/tool-call-provider';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';

const renderWithProviders = (node: ReactNode) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return render(
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <ChatAgentContext.Provider value={{ agentId: 'test-agent' }}>
            <TooltipProvider>
              <ToolCallProvider
                approveToolcall={vi.fn()}
                declineToolcall={vi.fn()}
                approveToolcallGenerate={vi.fn()}
                declineToolcallGenerate={vi.fn()}
                approveNetworkToolcall={vi.fn()}
                declineNetworkToolcall={vi.fn()}
                isRunning={false}
                toolCallApprovals={{}}
                networkToolCallApprovals={{}}
              >
                {node}
              </ToolCallProvider>
            </TooltipProvider>
          </ChatAgentContext.Provider>
        </MemoryRouter>
      </QueryClientProvider>
    </MastraReactProvider>,
  );
};

beforeEach(() => {
  server.use(http.get(`${BASE_URL}/api/mcp/v0/servers`, () => HttpResponse.json({ servers: [], totalCount: 0 })));
});

afterEach(() => cleanup());

describe('AgentBadge', () => {
  describe('when a sub-agent call is complete', () => {
    it('renders its custom content in the shared green agent row', () => {
      renderWithProviders(
        <AgentBadge
          agentId="weather-agent"
          messages={[{ type: 'text', content: 'The forecast is clear.' }]}
          toolCallId="call-agent-1"
          toolName="agent-weather-agent"
          toolApprovalMetadata={undefined}
          isNetwork={false}
          isComplete
        />,
      );

      const badge = screen.getByTestId('agent-badge');
      expect(badge.getAttribute('role')).toBe('group');
      expect(badge.getAttribute('aria-label')).toBe('Tool: agent-weather-agent');
      expect(badge.querySelector('svg')?.classList.contains('text-accent1')).toBe(true);
      expect(screen.getByRole('button', { name: /weather-agent/ }).getAttribute('aria-expanded')).toBe('false');
      expect(screen.queryByText('The forecast is clear.')).toBeNull();

      fireEvent.click(screen.getByRole('button', { name: /weather-agent/ }));

      expect(screen.getByRole('button', { name: /weather-agent/ }).getAttribute('aria-expanded')).toBe('true');
      expect(screen.getByText('The forecast is clear.')).toBeTruthy();
      const response = screen.getByTestId('agent-text-message');
      expect(response.classList.contains('text-ui-sm')).toBe(true);
      expect(response.classList.contains('text-neutral3')).toBe(true);
      expect(screen.getByTestId('agent-text-icon').classList.contains('lucide-type')).toBe(true);
      expect(response.closest('.pl-6')).not.toBeNull();
    });
  });

  describe('when a persisted sub-agent transcript contains multiple assistant messages', () => {
    it('renders tool calls from every assistant message', () => {
      const persistedMessages: MastraDBMessage[] = [
        {
          id: 'assistant-1',
          role: 'assistant',
          createdAt: new Date(),
          content: {
            format: 2,
            parts: [
              {
                type: 'tool-invocation',
                toolInvocation: {
                  state: 'result',
                  toolName: 'lookup_weather',
                  toolCallId: 'child-call-1',
                  args: { location: 'Paris' },
                  result: { temperature: 20 },
                },
              },
              { type: 'text', text: 'Weather lookup complete' },
            ],
          },
        },
        {
          id: 'assistant-2',
          role: 'assistant',
          createdAt: new Date(),
          content: {
            format: 2,
            parts: [
              {
                type: 'tool-invocation',
                toolInvocation: {
                  state: 'result',
                  toolName: 'format_weather',
                  toolCallId: 'child-call-2',
                  args: { temperature: 20 },
                  result: { summary: '20°C' },
                },
              },
            ],
          },
        },
      ];
      const messages = resolveToChildMessages(toAISdkV5Messages(persistedMessages));

      renderWithProviders(
        <AgentBadge
          agentId="weather-agent"
          messages={messages}
          toolCallId="call-agent-1"
          toolName="agent-weather-agent"
          toolApprovalMetadata={undefined}
          isNetwork={false}
          isComplete
        />,
      );

      fireEvent.click(screen.getByRole('button', { name: /weather-agent/ }));

      expect(screen.getAllByTestId('tool-badge')).toHaveLength(2);
      expect(screen.getByRole('group', { name: 'Tool: lookup_weather' })).toBeTruthy();
      expect(screen.getByText('Weather lookup complete')).toBeTruthy();
      expect(screen.getByRole('group', { name: 'Tool: format_weather' })).toBeTruthy();
    });
  });

  describe('when a sub-agent is streaming', () => {
    it('starts streamed child content collapsed and opens it on demand', () => {
      renderWithProviders(
        <AgentBadge
          agentId="weather-agent"
          messages={[{ type: 'text', content: 'Checking the forecast…' }]}
          toolCallId="call-agent-1"
          toolName="agent-weather-agent"
          toolApprovalMetadata={undefined}
          isNetwork={false}
          isComplete={false}
        />,
      );

      const trigger = screen.getByRole('button', { name: /weather-agent/ });
      expect(trigger.getAttribute('aria-expanded')).toBe('false');
      expect(screen.queryByText('Checking the forecast…')).toBeNull();

      fireEvent.click(trigger);

      expect(trigger.getAttribute('aria-expanded')).toBe('true');
      expect(screen.getByText('Checking the forecast…')).toBeTruthy();
    });

    it('aligns nested tools with the agent name and connects every item except the last', () => {
      renderWithProviders(
        <AgentBadge
          agentId="weather-agent"
          messages={[
            {
              type: 'tool',
              toolName: 'lookup-weather',
              toolCallId: 'child-call-1',
            },
            {
              type: 'tool',
              toolName: 'format-weather',
              toolCallId: 'child-call-2',
            },
          ]}
          toolCallId="call-agent-1"
          toolName="agent-weather-agent"
          toolApprovalMetadata={undefined}
          isNetwork
          isComplete={false}
        />,
      );

      fireEvent.click(screen.getByRole('button', { name: /weather-agent/ }));

      const nestedTools = [
        screen.getByRole('group', { name: 'Tool: lookup-weather' }),
        screen.getByRole('group', { name: 'Tool: format-weather' }),
      ];
      expect(nestedTools.every(tool => tool.closest('.pl-6') !== null)).toBe(true);
      expect(screen.getByTestId('agent-badge').querySelectorAll('[data-tool-call-rail]')).toHaveLength(1);
    });
  });

  describe('when a child tool returns a falsy value', () => {
    it('treats the child tool as complete instead of requesting approval again', () => {
      renderWithProviders(
        <AgentBadge
          agentId="weather-agent"
          messages={[
            {
              type: 'tool',
              toolName: 'has-rain',
              toolCallId: 'child-call-1',
              toolOutput: false,
            },
          ]}
          toolCallId="call-agent-1"
          toolName="agent-weather-agent"
          toolApprovalMetadata={{
            toolCallId: 'call-agent-1',
            toolName: 'agent-weather-agent',
            args: {},
          }}
          isNetwork={false}
          isComplete
        />,
      );

      expect(screen.queryByRole('button', { name: 'Approve' })).toBeNull();
    });
  });

  describe('when the sub-agent requires approval', () => {
    it('exposes the approval controls without another user action', () => {
      renderWithProviders(
        <AgentBadge
          agentId="billing-agent"
          messages={[]}
          toolCallId="call-agent-approval"
          toolName="agent-billing-agent"
          toolApprovalMetadata={{
            toolCallId: 'call-agent-approval',
            toolName: 'agent-billing-agent',
            args: {},
          }}
          isNetwork={false}
        />,
      );

      expect(screen.getByRole('button', { name: /billing-agent/ }).getAttribute('aria-expanded')).toBe('true');
      expect(screen.getByRole('button', { name: 'Approve' })).toBeTruthy();
    });
  });

  describe('when the sub-agent is suspended', () => {
    it('exposes the suspension payload without another user action', () => {
      renderWithProviders(
        <AgentBadge
          agentId="billing-agent"
          messages={[]}
          toolCallId="call-agent-suspended"
          toolName="agent-billing-agent"
          toolApprovalMetadata={undefined}
          isNetwork={false}
          suspendPayload="Confirm refund order-1"
        />,
      );

      expect(screen.getByRole('button', { name: /billing-agent/ }).getAttribute('aria-expanded')).toBe('true');
      expect(screen.getByText('Agent suspend payload')).toBeTruthy();
      expect(screen.getByText('Confirm refund order-1')).toBeTruthy();
    });
  });
});
