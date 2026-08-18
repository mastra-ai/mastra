// @vitest-environment jsdom

import { TooltipProvider } from '@mastra/playground-ui/components/Tooltip';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { MessageMetadata } from '../../messages/message-metadata';
import { SubmitPlanTool } from '../submit-plan-tool';
import { ToolCallProvider } from '@/services/tool-call-provider';

const renderTool = ({ metadata, output }: { metadata?: MessageMetadata; output?: unknown }) => {
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
        <SubmitPlanTool
          toolName="submit_plan"
          toolCallId="call-plan"
          input={{ path: '.mastracode/plans/ui-demo.md' }}
          output={output}
          metadata={metadata}
        />
      </ToolCallProvider>
    </TooltipProvider>,
  );

  return { ...utils, approveToolcall };
};

afterEach(() => cleanup());

describe('SubmitPlanTool', () => {
  describe('when a plan is suspended for review', () => {
    const metadata: MessageMetadata = {
      suspendedTools: {
        'call-plan': {
          suspendPayload: {
            path: '.mastracode/plans/ui-demo.md',
            title: 'Tool UI cleanup',
            plan: '## Steps\n\n1. Align the tools.\n2. Verify the thread.',
          },
        },
      },
    };

    it('shows the Factory plan UI without another disclosure click', () => {
      renderTool({ metadata });

      expect(screen.getByRole('group', { name: 'Plan approval' })).toBeTruthy();
      expect(screen.getByText('Tool UI cleanup')).toBeTruthy();
      expect(screen.getByText('Align the tools.')).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Approve the plan' })).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Reject the plan' })).toBeTruthy();
    });

    it('resumes the suspended tool with an approved plan payload', () => {
      const { approveToolcall } = renderTool({ metadata });

      fireEvent.click(screen.getByRole('button', { name: 'Approve the plan' }));

      expect(approveToolcall).toHaveBeenCalledWith('call-plan', {
        action: 'approved',
        path: '.mastracode/plans/ui-demo.md',
        title: 'Tool UI cleanup',
        plan: '## Steps\n\n1. Align the tools.\n2. Verify the thread.',
      });
    });

    it('resumes the suspended tool with a rejected plan payload', () => {
      const { approveToolcall } = renderTool({ metadata });

      fireEvent.click(screen.getByRole('button', { name: 'Reject the plan' }));

      expect(approveToolcall).toHaveBeenCalledWith('call-plan', {
        action: 'rejected',
        path: '.mastracode/plans/ui-demo.md',
        title: 'Tool UI cleanup',
        plan: '## Steps\n\n1. Align the tools.\n2. Verify the thread.',
      });
    });
  });

  describe('when only the submitted path is available', () => {
    it('still renders a visible plan-file state', () => {
      renderTool({});

      expect(screen.getByRole('group', { name: 'Plan approval' })).toBeTruthy();
      expect(screen.getByText('.mastracode/plans/ui-demo.md')).toBeTruthy();
    });
  });
});
