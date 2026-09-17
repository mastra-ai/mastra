// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ToolCallProvider } from '../../../context/tool-call-context';
import type { ToolCallContextValue } from '../../../context/tool-call-context';
import { ToolApprovalButtons } from '../tool-approval-buttons';
import type { ToolApprovalButtonsProps } from '../tool-approval-buttons';

function renderApproval(props: Partial<ToolApprovalButtonsProps> = {}, overrides: Partial<ToolCallContextValue> = {}) {
  const callbacks = {
    approveToolcall: vi.fn(),
    declineToolcall: vi.fn(),
    approveToolcallGenerate: vi.fn(),
    declineToolcallGenerate: vi.fn(),
    approveNetworkToolcall: vi.fn(),
    declineNetworkToolcall: vi.fn(),
  };
  render(
    <ToolCallProvider
      {...callbacks}
      isRunning={false}
      toolCallApprovals={{}}
      networkToolCallApprovals={{}}
      {...overrides}
    >
      <ToolApprovalButtons
        toolCallId="call-1"
        toolName="write_file"
        toolCalled={false}
        toolApprovalMetadata={{ toolCallId: 'call-1', toolName: 'write_file', args: {}, runId: 'run-1' }}
        isNetwork={false}
        {...props}
      />
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

      fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
      fireEvent.click(screen.getByRole('button', { name: 'Decline' }));

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

      for (const button of screen.getAllByRole<HTMLButtonElement>('button')) {
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

      fireEvent.click(screen.getByRole('button', { name: 'Approve' }));

      expect(callbacks.approveNetworkToolcall).toHaveBeenCalledExactlyOnceWith('write_file', 'run-1');
    });

    it('disables a decision belonging to this run', () => {
      renderApproval(
        { isNetwork: true },
        {
          networkToolCallApprovals: { 'run-1-write_file': { status: 'approved' } },
        },
      );

      expect(screen.getAllByRole<HTMLButtonElement>('button').every(button => button.disabled)).toBe(true);
    });

    it('preserves tool-name approval keys for metadata without a run ID', () => {
      renderApproval(
        {
          isNetwork: true,
          toolApprovalMetadata: { toolCallId: 'call-1', toolName: 'write_file', args: {} },
        },
        { networkToolCallApprovals: { write_file: { status: 'declined' } } },
      );

      expect(screen.getAllByRole<HTMLButtonElement>('button').every(button => button.disabled)).toBe(true);
    });
  });

  describe('when approval is no longer needed', () => {
    it.each([{ toolCalled: true }, { toolApprovalMetadata: undefined }])('hides actions for %j', props => {
      renderApproval(props);
      expect(screen.queryByRole('button')).toBeNull();
    });
  });
});
