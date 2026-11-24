// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ToolCallProvider } from '../../../context/tool-call-context';
import type { ToolCallContextValue } from '../../../context/tool-call-context';
import { ToolApprovalBadge } from '../tool-approval-badge';
import type { ToolApprovalRequest } from '../tool-approval-badge';

function approvalTree(request: Partial<ToolApprovalRequest> = {}, overrides: Partial<ToolCallContextValue> = {}) {
  const callbacks = {
    approveToolcall: vi.fn(),
    declineToolcall: vi.fn(),
    approveToolcallGenerate: vi.fn(),
    declineToolcallGenerate: vi.fn(),
    approveNetworkToolcall: vi.fn(),
    declineNetworkToolcall: vi.fn(),
  };
  const approval = {
    toolCallId: 'call-1',
    toolName: 'write_file',
    toolCalled: false,
    toolApprovalMetadata: { toolCallId: 'call-1', toolName: 'write_file', args: {}, runId: 'run-1' },
    isNetwork: false,
    ...request,
  };
  const tree = (
    <ToolCallProvider
      {...callbacks}
      isRunning={false}
      toolCallApprovals={{}}
      networkToolCallApprovals={{}}
      {...overrides}
    >
      <ToolApprovalBadge approval={approval} title="Write file" initialCollapsed data-testid="activity">
        <p>Review the requested change</p>
      </ToolApprovalBadge>
    </ToolCallProvider>
  );
  return { tree, callbacks };
}

function renderApproval(request: Partial<ToolApprovalRequest> = {}, overrides: Partial<ToolCallContextValue> = {}) {
  const { tree, callbacks } = approvalTree(request, overrides);
  render(tree);
  return callbacks;
}

function queryDecisionButtons() {
  return screen.queryAllByRole<HTMLButtonElement>('button', { name: /^(Approve|Decline) write_file$/ });
}

afterEach(cleanup);

describe('ToolApprovalBadge', () => {
  describe('when a tool needs approval', () => {
    it.each([
      ['stream', {}, 'approveToolcall', 'declineToolcall', ['call-1']],
      ['generate', { isGenerateMode: true }, 'approveToolcallGenerate', 'declineToolcallGenerate', ['call-1']],
      ['network', { isNetwork: true }, 'approveNetworkToolcall', 'declineNetworkToolcall', ['write_file', 'run-1']],
    ] as const)('routes both decisions through the %s callbacks', (_mode, request, approve, decline, expected) => {
      const callbacks = renderApproval(request);

      fireEvent.click(screen.getByRole('button', { name: 'Approve write_file' }));
      fireEvent.click(screen.getByRole('button', { name: 'Decline write_file' }));

      expect(callbacks[approve]).toHaveBeenCalledExactlyOnceWith(...expected);
      expect(callbacks[decline]).toHaveBeenCalledExactlyOnceWith(...expected);
      for (const [name, callback] of Object.entries(callbacks)) {
        if (name !== approve && name !== decline) expect(callback).not.toHaveBeenCalled();
      }
    });

    it('keeps the request expanded so the decision controls cannot be hidden', () => {
      renderApproval();

      expect(screen.getByText('Review the requested change')).not.toBeNull();
      expect(screen.getByRole('status').textContent).toBe('Approval required');
      expect(screen.queryByRole('button', { expanded: true })).toBeNull();
      expect(screen.queryByRole('button', { expanded: false })).toBeNull();
    });

    it('prevents another decision while a run is in flight', () => {
      const callbacks = renderApproval({}, { isRunning: true });

      const buttons = queryDecisionButtons();
      expect(buttons).toHaveLength(2);
      for (const button of buttons) {
        expect(button.disabled).toBe(true);
        fireEvent.click(button);
      }
      expect(callbacks.approveToolcall).not.toHaveBeenCalled();
      expect(callbacks.declineToolcall).not.toHaveBeenCalled();
    });
  });

  describe('once decided', () => {
    it.each(['approved', 'declined'] as const)('keeps %s in the header when the details collapse', status => {
      renderApproval({}, { toolCallApprovals: { 'call-1': { status } } });

      expect(queryDecisionButtons()).toHaveLength(0);
      const trigger = screen.getByRole('button', { expanded: false });
      fireEvent.click(trigger);
      expect(screen.getByRole('button', { expanded: true })).toBe(trigger);
      fireEvent.click(trigger);
      expect(screen.getByRole('status').textContent?.toLowerCase()).toBe(status);
    });

    it('keeps the status after the tool has run', () => {
      renderApproval({ toolCalled: true }, { toolCallApprovals: { 'call-1': { status: 'approved' } } });

      expect(screen.getByRole('status').textContent).toBe('Approved');
      expect(queryDecisionButtons()).toHaveLength(0);
    });
  });

  describe('when a network repeats the same tool in different runs', () => {
    it('keeps the new run actionable despite the older decision', () => {
      const callbacks = renderApproval(
        { isNetwork: true },
        { networkToolCallApprovals: { 'run-0-write_file': { status: 'declined' } } },
      );

      fireEvent.click(screen.getByRole('button', { name: 'Approve write_file' }));

      expect(callbacks.approveNetworkToolcall).toHaveBeenCalledExactlyOnceWith('write_file', 'run-1');
    });

    it('shows the decision belonging to this run', () => {
      renderApproval({ isNetwork: true }, { networkToolCallApprovals: { 'run-1-write_file': { status: 'approved' } } });

      expect(queryDecisionButtons()).toHaveLength(0);
      expect(screen.getByRole('status').textContent).toBe('Approved');
    });

    it('preserves tool-name approval keys for metadata without a run ID', () => {
      renderApproval(
        { isNetwork: true, toolApprovalMetadata: { toolCallId: 'call-1', toolName: 'write_file', args: {} } },
        { networkToolCallApprovals: { write_file: { status: 'declined' } } },
      );

      expect(queryDecisionButtons()).toHaveLength(0);
      expect(screen.getByRole('status').textContent).toBe('Declined');
    });
  });

  describe('when approval is no longer needed', () => {
    it('hides the request once the tool ran without a recorded decision', () => {
      renderApproval({ toolCalled: true });

      expect(queryDecisionButtons()).toHaveLength(0);
      expect(screen.queryByRole('status')).toBeNull();
    });

    it('renders ordinary tools without an approval provider', () => {
      render(
        <ToolApprovalBadge
          title="Read file"
          approval={{
            toolCallId: 'call-1',
            toolName: 'read_file',
            toolCalled: true,
            toolApprovalMetadata: undefined,
            isNetwork: false,
          }}
        />,
      );

      expect(screen.getByText('Read file')).not.toBeNull();
      expect(screen.queryByRole('button')).toBeNull();
      expect(screen.queryByRole('status')).toBeNull();
    });
  });
});

describe('ToolApprovalBadge across a live stream', () => {
  it('keeps the same activity and the decision while approval metadata arrives and clears', () => {
    const { rerender } = render(approvalTree({ toolApprovalMetadata: undefined }).tree);
    const activity = screen.getByTestId('activity');

    rerender(approvalTree().tree);
    expect(screen.getByTestId('activity')).toBe(activity);
    expect(screen.getByRole('status').textContent).toBe('Approval required');

    rerender(
      approvalTree(
        { toolApprovalMetadata: undefined, toolCalled: true },
        { toolCallApprovals: { 'call-1': { status: 'approved' } } },
      ).tree,
    );
    expect(screen.getByTestId('activity')).toBe(activity);
    expect(screen.getByRole('status').textContent).toBe('Approved');
  });
});
