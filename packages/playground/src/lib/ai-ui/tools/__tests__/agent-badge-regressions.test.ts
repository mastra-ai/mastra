import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockUseAgentMessages = vi.fn();
const mockResolveToChildMessages = vi.fn();
const mockAgentBadge = vi.fn(() => null);

vi.mock('@/hooks/use-agent-messages', () => ({
  useAgentMessages: mockUseAgentMessages,
}));

vi.mock('../badges/resolve-child-messages', () => ({
  resolveToChildMessages: mockResolveToChildMessages,
}));

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
        keepOpenForStreamingChildMessages: true,
        messages: fallbackMessages,
      }),
      undefined,
    );
  });

  it('renders in-progress agent calls before a result is available', async () => {
    mockResolveToChildMessages.mockReturnValue([]);

    const { AgentBadgeWrapper } = await import('../badges/agent-badge-wrapper');

    renderToStaticMarkup(
      AgentBadgeWrapper({
        agentId: 'agent-1',
        result: undefined,
        toolCallId: 'tool-call-1',
        toolName: 'subagent-tool',
        toolApprovalMetadata: undefined,
        isNetwork: false,
      }),
    );

    expect(mockResolveToChildMessages).toHaveBeenCalledWith([]);
    expect(mockAgentBadge).toHaveBeenCalledWith(
      expect.objectContaining({
        keepOpenForStreamingChildMessages: false,
        messages: [],
      }),
      undefined,
    );
  });

  it('renders embedded agent text without fetching a subagent thread', async () => {
    const { AgentBadgeWrapper } = await import('../badges/agent-badge-wrapper');

    renderToStaticMarkup(
      AgentBadgeWrapper({
        agentId: 'agent-1',
        result: {
          text: 'remote A2A response',
          subAgentThreadId: 'thread-that-may-not-exist-locally',
          subAgentToolResults: [],
        },
        toolCallId: 'tool-call-1',
        toolName: 'subagent-tool',
        toolApprovalMetadata: undefined,
        isNetwork: false,
      }),
    );

    expect(mockUseAgentMessages).toHaveBeenCalledWith({
      threadId: undefined,
      agentId: 'agent-1',
      memory: true,
    });
    expect(mockResolveToChildMessages).not.toHaveBeenCalled();
    expect(mockAgentBadge).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: [{ type: 'text', content: 'remote A2A response' }],
      }),
      undefined,
    );
  });
});
