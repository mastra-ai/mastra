// @vitest-environment jsdom
import '@/test/jsdom-polyfills';
import { cleanup, render, screen } from '@testing-library/react';
import { forwardRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SandboxExecutionBadge } from '../sandbox-execution-badge';
import type { SandboxExecutionBadgeProps } from '../sandbox-execution-badge';
import { ToolCallProvider } from '@/domains/chat/context/tool-call-context';
import { TooltipProvider } from '@/ds/components/Tooltip';
import type { LinkComponentProviderProps } from '@/lib/framework';
import { LinkComponentProvider } from '@/lib/framework';

const Link = forwardRef<HTMLAnchorElement, React.AnchorHTMLAttributes<HTMLAnchorElement>>(function Link(props, ref) {
  return <a ref={ref} {...props} />;
});

const paths = {} as LinkComponentProviderProps['paths'];

const renderBadge = (props: Partial<SandboxExecutionBadgeProps> = {}) =>
  render(
    <LinkComponentProvider Link={Link} navigate={vi.fn()} paths={paths}>
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
          <SandboxExecutionBadge
            toolName="execute_command"
            args={{ command: 'pnpm test' }}
            result={undefined}
            dataParts={[
              {
                type: 'data',
                name: 'sandbox-exit',
                data: {
                  exitCode: 137,
                  success: false,
                  executionTimeMs: 10,
                  killed: true,
                  timedOut: false,
                  toolCallId: 'call-command',
                },
              },
            ]}
            toolCallId="call-command"
            toolCalled
            {...props}
          />
        </ToolCallProvider>
      </TooltipProvider>
    </LinkComponentProvider>,
  );

afterEach(() => cleanup());

describe('SandboxExecutionBadge', () => {
  describe('when an execute command exit event reports that the process was killed', () => {
    it('shows the killed termination state', () => {
      renderBadge();

      expect(screen.getByText('killed')).not.toBeNull();
      expect(screen.queryByText('exit 137')).toBeNull();
    });
  });

  describe('when a command started but failed before any exit event arrived', () => {
    it('reads as failed rather than still running', () => {
      renderBadge({
        status: 'error',
        dataParts: [
          { type: 'data', name: 'workspace-metadata', data: { id: 'ws', toolCallId: 'call-command' } },
          {
            type: 'data',
            name: 'sandbox-stdout',
            data: { output: 'building\n', timestamp: Date.now() - 5000, toolCallId: 'call-command' },
          },
        ],
      });

      const line = screen.getByTestId('sandbox-execution-badge');
      expect(line.getAttribute('aria-busy')).toBe('false');
      expect(line.getAttribute('aria-invalid')).toBe('true');
    });
  });
});
