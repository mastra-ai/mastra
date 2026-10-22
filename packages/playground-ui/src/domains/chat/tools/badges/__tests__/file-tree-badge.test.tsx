// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TooltipProvider } from '../../../../../ds/components/Tooltip';
import { ToolCallProvider } from '../../../context/tool-call-context';
import { FileTreeBadge } from '../file-tree-badge';

afterEach(() => cleanup());

describe('FileTreeBadge', () => {
  describe('when the listing awaits approval', () => {
    it('shows the listing arguments and the approval buttons without a click', () => {
      render(
        <TooltipProvider>
          <ToolCallProvider
            approveToolcall={vi.fn()}
            declineToolcall={vi.fn()}
            approveToolcallGenerate={vi.fn()}
            declineToolcallGenerate={vi.fn()}
            approveNetworkToolcall={vi.fn()}
            declineNetworkToolcall={vi.fn()}
            isRunning={false}
            toolCallApprovals={{}}
            networkToolCallApprovals={{}}
          >
            <FileTreeBadge
              toolName="mastra_workspace_list_files"
              args={{ path: 'src', maxDepth: 2 }}
              result={undefined}
              toolCallId="call-tree"
              toolApprovalMetadata={{
                toolCallId: 'call-tree',
                toolName: 'mastra_workspace_list_files',
                args: {},
                runId: 'run-1',
              }}
              isNetwork={false}
            />
          </ToolCallProvider>
        </TooltipProvider>,
      );

      expect(screen.getByTestId('tool-args').textContent).toContain('"maxDepth": 2');
      expect(screen.getByRole('button', { name: 'Approve mastra_workspace_list_files' })).toBeTruthy();
    });
  });
});
