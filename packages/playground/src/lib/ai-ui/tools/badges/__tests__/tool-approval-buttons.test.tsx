// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ToolApprovalButtons } from '../tool-approval-buttons';
import { ToolCallProvider } from '@/services/tool-call-provider';

afterEach(cleanup);

const renderApproval = (
  props: Partial<ComponentProps<typeof ToolApprovalButtons>> = {},
  state: Partial<ComponentProps<typeof ToolCallProvider>> = {},
) => {
  const handlers = {
    approveToolcall: vi.fn(),
    declineToolcall: vi.fn(),
    approveToolcallGenerate: vi.fn(),
    declineToolcallGenerate: vi.fn(),
    approveNetworkToolcall: vi.fn(),
    declineNetworkToolcall: vi.fn(),
  };
  render(
    <ToolCallProvider {...handlers} isRunning={false} toolCallApprovals={{}} networkToolCallApprovals={{}} {...state}>
      <ToolApprovalButtons
        toolCallId="call-1"
        toolName="transfer"
        toolCalled={false}
        toolApprovalMetadata={{ toolCallId: 'call-1', toolName: 'transfer', args: {}, runId: 'run-1' }}
        isNetwork={false}
        {...props}
      />
    </ToolCallProvider>,
  );
  return handlers;
};

describe('ToolApprovalButtons', () => {
  describe('when a streaming tool needs approval', () => {
    it('approves the requested tool call', () => {
      const handlers = renderApproval();
      fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
      expect(handlers.approveToolcall).toHaveBeenCalledExactlyOnceWith('call-1');
      expect(handlers.approveToolcallGenerate).not.toHaveBeenCalled();
      expect(handlers.approveNetworkToolcall).not.toHaveBeenCalled();
    });

    it('declines the requested tool call', () => {
      const handlers = renderApproval();
      fireEvent.click(screen.getByRole('button', { name: 'Decline' }));
      expect(handlers.declineToolcall).toHaveBeenCalledExactlyOnceWith('call-1');
      expect(handlers.declineToolcallGenerate).not.toHaveBeenCalled();
      expect(handlers.declineNetworkToolcall).not.toHaveBeenCalled();
    });
  });

  describe('when a generated tool needs approval', () => {
    it('routes approval to generate mode', () => {
      const handlers = renderApproval({ isGenerateMode: true });
      fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
      expect(handlers.approveToolcallGenerate).toHaveBeenCalledExactlyOnceWith('call-1');
      expect(handlers.approveToolcall).not.toHaveBeenCalled();
    });

    it('routes refusal to generate mode', () => {
      const handlers = renderApproval({ isGenerateMode: true });
      fireEvent.click(screen.getByRole('button', { name: 'Decline' }));
      expect(handlers.declineToolcallGenerate).toHaveBeenCalledExactlyOnceWith('call-1');
      expect(handlers.declineToolcall).not.toHaveBeenCalled();
    });
  });

  describe('when a network tool needs approval', () => {
    it('approves by tool name and run ID even if generate mode is also set', () => {
      const handlers = renderApproval({ isNetwork: true, isGenerateMode: true });
      fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
      expect(handlers.approveNetworkToolcall).toHaveBeenCalledExactlyOnceWith('transfer', 'run-1');
      expect(handlers.approveToolcallGenerate).not.toHaveBeenCalled();
      expect(handlers.approveToolcall).not.toHaveBeenCalled();
    });

    it('declines by tool name and run ID', () => {
      const handlers = renderApproval({ isNetwork: true });
      fireEvent.click(screen.getByRole('button', { name: 'Decline' }));
      expect(handlers.declineNetworkToolcall).toHaveBeenCalledExactlyOnceWith('transfer', 'run-1');
    });
  });

  describe('when the agent is running', () => {
    it('prevents approval and refusal', () => {
      const handlers = renderApproval({}, { isRunning: true });
      fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
      fireEvent.click(screen.getByRole('button', { name: 'Decline' }));
      expect(handlers.approveToolcall).not.toHaveBeenCalled();
      expect(handlers.declineToolcall).not.toHaveBeenCalled();
    });
  });

  describe('when a tool call already has a decision', () => {
    it.each(['approved', 'declined'] as const)('prevents changing a %s decision', status => {
      const handlers = renderApproval({}, { toolCallApprovals: { 'call-1': { status } } });
      fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
      fireEvent.click(screen.getByRole('button', { name: 'Decline' }));
      expect(handlers.approveToolcall).not.toHaveBeenCalled();
      expect(handlers.declineToolcall).not.toHaveBeenCalled();
    });
  });

  describe('when a network run already has a decision', () => {
    it('prevents resubmitting the decision for that run', () => {
      const handlers = renderApproval(
        { isNetwork: true },
        { networkToolCallApprovals: { 'run-1-transfer': { status: 'approved' } } },
      );
      fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
      expect(handlers.approveNetworkToolcall).not.toHaveBeenCalled();
    });
  });

  describe('when the tool has already been called', () => {
    it('hides the approval request', () => {
      renderApproval({ toolCalled: true });
      expect(screen.queryByText('Approval required')).toBeNull();
      expect(screen.queryByRole('button')).toBeNull();
    });
  });

  describe('when no approval was requested', () => {
    it('hides the approval request', () => {
      renderApproval({ toolApprovalMetadata: undefined });
      expect(screen.queryByText('Approval required')).toBeNull();
      expect(screen.queryByRole('button')).toBeNull();
    });
  });
});
