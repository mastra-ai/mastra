// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ToolCallContextValue } from '../../../context/tool-call-context';
import { ToolCallProvider } from '../../../context/tool-call-context';
import { ToolApprovalButtons } from '../tool-approval-buttons';

afterEach(() => cleanup());

const contextValue = (): ToolCallContextValue => ({
  approveToolcall: vi.fn(),
  declineToolcall: vi.fn(),
  approveToolcallGenerate: vi.fn(),
  declineToolcallGenerate: vi.fn(),
  approveNetworkToolcall: vi.fn(),
  declineNetworkToolcall: vi.fn(),
  isRunning: false,
  toolCallApprovals: {},
  networkToolCallApprovals: {},
});

const renderButtons = (
  props: Partial<React.ComponentProps<typeof ToolApprovalButtons>>,
  ctx: ToolCallContextValue = contextValue(),
) => {
  render(
    <ToolCallProvider {...ctx}>
      <ToolApprovalButtons
        toolCallId="call-1"
        toolName="write_file"
        toolCalled={false}
        isNetwork={false}
        toolApprovalMetadata={{ toolCallId: 'call-1', toolName: 'write_file', args: {} }}
        {...props}
      />
    </ToolCallProvider>,
  );
  return ctx;
};

describe('ToolApprovalButtons', () => {
  it('submits the rendered tool call id when it matches the approval entry', () => {
    const ctx = renderButtons({});

    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));

    expect(ctx.approveToolcall).toHaveBeenCalledWith('call-1');
  });

  describe('when a sub-agent delegation suspends on a child tool', () => {
    // The card renders the child's inner call, but the server suspended the parent run on the
    // outer `agent-*` call and wrote that id into the approval entry (mastra-ai/mastra#24065).
    const nested = {
      toolCallId: 'inner-child-call',
      toolName: 'refund',
      toolApprovalMetadata: { toolCallId: 'outer-delegation-call', toolName: 'refund', args: {} },
    };

    it('approves with the outer id from the approval entry', () => {
      const ctx = renderButtons(nested);

      fireEvent.click(screen.getByRole('button', { name: 'Approve' }));

      expect(ctx.approveToolcall).toHaveBeenCalledWith('outer-delegation-call');
    });

    it('declines with the outer id from the approval entry', () => {
      const ctx = renderButtons(nested);

      fireEvent.click(screen.getByRole('button', { name: 'Decline' }));

      expect(ctx.declineToolcall).toHaveBeenCalledWith('outer-delegation-call');
    });

    it('uses the outer id in generate mode too', () => {
      const ctx = renderButtons({ ...nested, isGenerateMode: true });

      fireEvent.click(screen.getByRole('button', { name: 'Approve' }));

      expect(ctx.approveToolcallGenerate).toHaveBeenCalledWith('outer-delegation-call');
    });

    it('reads the submitted status back under the outer id', () => {
      renderButtons(nested, {
        ...contextValue(),
        toolCallApprovals: { 'outer-delegation-call': { status: 'approved' } },
      });

      expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Approve' }).disabled).toBe(true);
      expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Decline' }).disabled).toBe(true);
    });
  });
});
