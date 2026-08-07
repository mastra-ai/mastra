import { TooltipProvider } from '@mastra/playground-ui/components/Tooltip';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MessageMetadata } from '../../messages/message-metadata';
import { AskUserTool } from '../ask-user-tool';
import { ToolCallProvider } from '@/services/tool-call-provider';

type RenderProps = {
  toolName: string;
  toolCallId: string;
  output: unknown;
  metadata?: MessageMetadata;
};

const renderTool = (props: RenderProps) => {
  const approveToolcall = vi.fn();
  const utils = render(
    <TooltipProvider>
      <ToolCallProvider
        approveToolcall={approveToolcall}
        declineToolcall={vi.fn()}
        approveToolcallGenerate={vi.fn()}
        declineToolcallGenerate={vi.fn()}
        approveNetworkToolcall={vi.fn()}
        declineNetworkToolcall={vi.fn()}
        isRunning={false}
        toolCallApprovals={{}}
        networkToolCallApprovals={{}}
      >
        <AskUserTool {...props} />
      </ToolCallProvider>
    </TooltipProvider>,
  );
  return { ...utils, approveToolcall };
};

afterEach(() => cleanup());

describe('AskUserTool', () => {
  describe('when metadata.suspendedTools is keyed by toolName', () => {
    const metadata: MessageMetadata = {
      suspendedTools: {
        ask_user: { suspendPayload: { question: 'What is your favorite color?' } },
      },
    };

    it('renders the ask-user badge with the question', () => {
      renderTool({ toolName: 'ask_user', toolCallId: 'call-1', output: undefined, metadata });

      expect(screen.getByTestId('ask-user-badge')).toBeTruthy();
      expect(screen.getByText('What is your favorite color?')).toBeTruthy();
    });
  });

  describe('when metadata.suspendedTools is keyed by toolCallId', () => {
    const metadata: MessageMetadata = {
      suspendedTools: {
        'call-2': { suspendPayload: { question: 'Pick one' } },
      },
    };

    it('renders the ask-user badge', () => {
      renderTool({ toolName: 'ask_user', toolCallId: 'call-2', output: undefined, metadata });

      expect(screen.getByTestId('ask-user-badge')).toBeTruthy();
      expect(screen.getByText('Pick one')).toBeTruthy();
    });
  });

  describe('when no suspend payload is present', () => {
    it('renders nothing', () => {
      renderTool({ toolName: 'ask_user', toolCallId: 'call-3', output: undefined, metadata: {} });

      expect(screen.queryByTestId('ask-user-badge')).toBeNull();
    });
  });

  describe('when the suspend payload is malformed', () => {
    it('renders nothing when question is missing', () => {
      const metadata: MessageMetadata = {
        suspendedTools: {
          ask_user: { suspendPayload: { options: [{ label: 'A' }] } },
        },
      };

      renderTool({ toolName: 'ask_user', toolCallId: 'call-4', output: undefined, metadata });

      expect(screen.queryByTestId('ask-user-badge')).toBeNull();
    });

    it('renders nothing when question is not a string', () => {
      const metadata: MessageMetadata = {
        suspendedTools: {
          ask_user: { suspendPayload: { question: 42 } },
        },
      };

      renderTool({ toolName: 'ask_user', toolCallId: 'call-5', output: undefined, metadata });

      expect(screen.queryByTestId('ask-user-badge')).toBeNull();
    });
  });

  describe('when an answer/output is present', () => {
    const metadata: MessageMetadata = {
      suspendedTools: {
        ask_user: { suspendPayload: { question: 'What is your name?' } },
      },
    };

    it('shows the answered state', () => {
      renderTool({
        toolName: 'ask_user',
        toolCallId: 'call-6',
        output: { content: 'User answered: Ada', isError: false },
        metadata,
      });

      expect(screen.getByTestId('ask-user-badge')).toBeTruthy();
      expect(screen.getByText('User answered: Ada')).toBeTruthy();
    });
  });
});
