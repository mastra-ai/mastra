import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockNetworkChoiceMetadataDialogTrigger = vi.fn(() => null);
const mockToolApprovalButtons = vi.fn(() => null);

vi.mock('../badges/network-choice-metadata-dialog', () => ({
  NetworkChoiceMetadataDialogTrigger: mockNetworkChoiceMetadataDialogTrigger,
}));

vi.mock('../badges/tool-approval-buttons', () => ({
  ToolApprovalButtons: mockToolApprovalButtons,
}));

vi.mock('@mastra/playground-ui/components/CodeEditor', () => ({
  CodeEditor: () => null,
}));

vi.mock('@mastra/playground-ui/icons/AgentIcon', () => ({
  AgentIcon: () => null,
}));

vi.mock('../badges/badge-wrapper', () => ({
  BadgeWrapper: ({ extraInfo }: { extraInfo: ReactNode }) => {
    return extraInfo;
  },
}));

vi.mock('../badges/background-task-metadata-dialog', () => ({
  BackgroundTaskMetadataDialogTrigger: () => null,
}));

vi.mock('../tool-card', () => ({
  ToolCard: () => null,
}));

vi.mock('react-markdown', () => ({
  default: () => null,
}));

describe('AgentBadge routing decision', () => {
  beforeEach(() => {
    mockNetworkChoiceMetadataDialogTrigger.mockClear();
    mockToolApprovalButtons.mockClear();
  });

  it('prefers routingDecision.selectionReason and passes the parsed decision as input', async () => {
    const { AgentBadge } = await import('../badges/agent-badge');

    const routingDecision = {
      isNetwork: true,
      agentId: 'weather',
      selectionReason: 'User asked about weather',
    };

    renderToStaticMarkup(
      AgentBadge({
        agentId: 'weather',
        messages: [],
        metadata: {
          mode: 'network',
          selectionReason: 'fallback reason',
          agentInput: 'fallback input',
          routingDecision,
        },
        toolCallId: 'tool-call-1',
        toolName: 'agent-call',
        isNetwork: true,
        toolApprovalMetadata: undefined,
      }),
    );

    expect(mockNetworkChoiceMetadataDialogTrigger).toHaveBeenCalledWith(
      expect.objectContaining({
        selectionReason: 'User asked about weather',
        input: routingDecision,
      }),
      undefined,
    );
  });

  it('falls back to metadata.selectionReason when no routingDecision is present', async () => {
    const { AgentBadge } = await import('../badges/agent-badge');

    renderToStaticMarkup(
      AgentBadge({
        agentId: 'weather',
        messages: [],
        metadata: {
          mode: 'network',
          selectionReason: 'fallback reason',
          agentInput: { foo: 'bar' },
        },
        toolCallId: 'tool-call-1',
        toolName: 'agent-call',
        isNetwork: true,
        toolApprovalMetadata: undefined,
      }),
    );

    expect(mockNetworkChoiceMetadataDialogTrigger).toHaveBeenCalledWith(
      expect.objectContaining({
        selectionReason: 'fallback reason',
        input: { foo: 'bar' },
      }),
      undefined,
    );
  });
});
