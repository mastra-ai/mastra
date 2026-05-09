import type * as MastraReact from '@mastra/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockUseAgentMessages = vi.fn();
const mockResolveToChildMessages = vi.fn();
const mockAgentBadge = vi.fn(() => null);

vi.mock('@/hooks/use-agent-messages', () => ({
  useAgentMessages: mockUseAgentMessages,
}));

vi.mock('@mastra/react', async () => {
  const actual = await vi.importActual<typeof MastraReact>('@mastra/react');

  return {
    ...actual,
    resolveToChildMessages: mockResolveToChildMessages,
  };
});

vi.mock('../badges/agent-badge', () => ({
  AgentBadge: mockAgentBadge,
}));

vi.mock('../badges/loading-badge', () => ({
  LoadingBadge: () => null,
}));

describe('agent badge regressions', () => {
  beforeEach(() => {
    mockUseAgentMessages.mockReset();
    mockResolveToChildMessages.mockReset();
    mockAgentBadge.mockReset();

    mockUseAgentMessages.mockReturnValue({
      data: { messages: [] },
      isLoading: false,
    });
  });

  it('falls back to resolved child messages when the streamed childMessages array is empty', async () => {
    const fallbackMessages = [{ type: 'text', content: 'resolved from thread' }];
    mockResolveToChildMessages.mockReturnValue(fallbackMessages);

    const { AgentBadgeWrapper } = await import('../badges/agent-badge-wrapper');

    renderToStaticMarkup(
      AgentBadgeWrapper({
        agentId: 'agent-1',
        result: {
          childMessages: [],
          subAgentThreadId: 'thread-1',
        },
        toolCallId: 'tool-call-1',
        toolName: 'subagent-tool',
        toolApprovalMetadata: undefined,
        isNetwork: false,
      }),
    );

    expect(mockResolveToChildMessages).toHaveBeenCalledWith([]);
    expect(mockAgentBadge).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: fallbackMessages,
      }),
      undefined,
    );
  });
});
