// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ToolCallProvider } from '../../../context/tool-call-context';
import type { ToolCallContextValue } from '../../../context/tool-call-context';
import { ToolApprovalBadge, ToolApprovalButtons } from '../tool-approval-buttons';
import type { ToolApprovalButtonsProps } from '../tool-approval-buttons';

function renderApproval(
  props: Partial<ToolApprovalButtonsProps> = {},
  overrides: Partial<ToolCallContextValue> = {},
  framed = false,
) {
  const callbacks = {
    approveToolcall: vi.fn(),
    declineToolcall: vi.fn(),
    approveToolcallGenerate: vi.fn(),
    declineToolcallGenerate: vi.fn(),
    approveNetworkToolcall: vi.fn(),
    declineNetworkToolcall: vi.fn(),
  };
  const approvalProps = {
    toolCallId: 'call-1',
    toolName: 'write_file',
    toolCalled: false,
    toolApprovalMetadata: { toolCallId: 'call-1', toolName: 'write_file', args: {}, runId: 'run-1' },
    isNetwork: false,
    ...props,
  };
  render(
    <ToolCallProvider
      {...callbacks}
      isRunning={false}
      toolCallApprovals={{}}
      networkToolCallApprovals={{}}
      {...overrides}
    >
      {framed ? (
        <ToolApprovalBadge approval={approvalProps} title="Write file" initialCollapsed>
          <p>Review the requested change</p>
        </ToolApprovalBadge>
      ) : (
        <ToolApprovalButtons {...approvalProps} />
      )}
    </ToolCallProvider>,
  );
  return callbacks;
}

afterEach(cleanup);

describe('ToolApprovalButtons', () => {
  describe('when a tool needs approval', () => {
    it.each([
      ['stream', {}, 'approveToolcall', 'declineToolcall', ['call-1']],
      ['generate', { isGenerateMode: true }, 'approveToolcallGenerate', 'declineToolcallGenerate', ['call-1']],
      ['network', { isNetwork: true }, 'approveNetworkToolcall', 'declineNetworkToolcall', ['write_file', 'run-1']],
    ] as const)('routes both decisions through the %s callbacks', (_mode, props, approve, decline, expected) => {
      const callbacks = renderApproval(props);

      fireEvent.click(screen.getByRole('button', { name: 'Approve write_file' }));
      fireEvent.click(screen.getByRole('button', { name: 'Decline write_file' }));

      expect(callbacks[approve]).toHaveBeenCalledExactlyOnceWith(...expected);
      expect(callbacks[decline]).toHaveBeenCalledExactlyOnceWith(...expected);
      for (const [name, callback] of Object.entries(callbacks)) {
        if (name !== approve && name !== decline) expect(callback).not.toHaveBeenCalled();
      }
    });
  });

  describe('when running or already decided', () => {
    it.each([
      { isRunning: true },
      { toolCallApprovals: { 'call-1': { status: 'approved' } } },
      { toolCallApprovals: { 'call-1': { status: 'declined' } } },
    ] satisfies Partial<ToolCallContextValue>[])('prevents another decision for %j', context => {
      const callbacks = renderApproval({}, context);

      for (const button of screen.queryAllByRole<HTMLButtonElement>('button')) {
        expect(button.disabled).toBe(true);
        fireEvent.click(button);
      }
      expect(callbacks.approveToolcall).not.toHaveBeenCalled();
      expect(callbacks.declineToolcall).not.toHaveBeenCalled();
    });
  });

  describe('when a network repeats the same tool in different runs', () => {
    it('keeps the new run actionable despite the older decision', () => {
      const callbacks = renderApproval(
        { isNetwork: true },
        {
          networkToolCallApprovals: { 'run-0-write_file': { status: 'declined' } },
        },
      );

      fireEvent.click(screen.getByRole('button', { name: 'Approve write_file' }));

      expect(callbacks.approveNetworkToolcall).toHaveBeenCalledExactlyOnceWith('write_file', 'run-1');
    });

    it('shows the decision belonging to this run', () => {
      renderApproval(
        { isNetwork: true },
        {
          networkToolCallApprovals: { 'run-1-write_file': { status: 'approved' } },
        },
      );

      expect(screen.queryByRole('button')).toBeNull();
      expect(screen.getByRole('status').textContent).toBe('Approved');
    });

    it('preserves tool-name approval keys for metadata without a run ID', () => {
      renderApproval(
        {
          isNetwork: true,
          toolApprovalMetadata: { toolCallId: 'call-1', toolName: 'write_file', args: {} },
        },
        { networkToolCallApprovals: { write_file: { status: 'declined' } } },
      );

      expect(screen.queryByRole('button')).toBeNull();
      expect(screen.getByRole('status').textContent).toBe('Declined');
    });
  });

  describe('when approval is no longer needed', () => {
    it.each([{ toolCalled: true }, { toolApprovalMetadata: undefined }])('hides actions for %j', props => {
      renderApproval(props);
      expect(screen.queryByRole('button')).toBeNull();
    });
  });
});

describe('ToolApprovalBadge', () => {
  it('keeps pending requests expanded and prevents hiding the decision controls', () => {
    const callbacks = renderApproval({}, {}, true);

    expect(screen.getByText('Review the requested change')).not.toBeNull();
    expect(screen.getByRole('status').textContent).toBe('Approval required');
    expect(screen.queryByRole('button', { expanded: true })).toBeNull();
    expect(screen.queryByRole('button', { expanded: false })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Approve write_file' }));
    expect(callbacks.approveToolcall).toHaveBeenCalledExactlyOnceWith('call-1');
  });

  it.each(['approved', 'declined'] as const)('keeps %s visible when the details collapse', status => {
    renderApproval({}, { toolCallApprovals: { 'call-1': { status } } }, true);

    expect(screen.getByRole('status').textContent?.toLowerCase()).toBe(status);
    const trigger = screen.getByRole('button', { expanded: false });
    fireEvent.click(trigger);
    expect(screen.getByRole('button', { expanded: true })).toBe(trigger);
    fireEvent.click(trigger);
    expect(screen.getByRole('status').textContent?.toLowerCase()).toBe(status);
    expect(screen.queryByRole('button', { name: 'Approve write_file' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Decline write_file' })).toBeNull();
  });

  it('keeps a decided status in the header after execution', () => {
    renderApproval({ toolCalled: true }, { toolCallApprovals: { 'call-1': { status: 'approved' } } }, true);
    expect(screen.getByRole('status').textContent).toBe('Approved');
    expect(screen.queryByRole('button', { name: 'Approve write_file' })).toBeNull();
  });

  it('leaves ordinary tools usable without an approval provider', () => {
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
