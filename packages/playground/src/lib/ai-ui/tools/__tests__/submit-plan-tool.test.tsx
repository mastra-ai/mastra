import { TooltipProvider } from '@mastra/playground-ui/components/Tooltip';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MessageMetadata } from '../../messages/message-metadata';
import { SubmitPlanTool } from '../submit-plan-tool';
import { ToolCallProvider } from '@/services/tool-call-provider';

type RenderProps = {
  toolName: string;
  toolCallId: string;
  output: unknown;
  metadata?: MessageMetadata;
};

const renderTool = (props: RenderProps) =>
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
        <SubmitPlanTool {...props} />
      </ToolCallProvider>
    </TooltipProvider>,
  );

const metadataWithPayload = (key: string, suspendPayload: unknown): MessageMetadata => ({
  suspendedTools: { [key]: { suspendPayload } },
});

afterEach(() => cleanup());

describe('SubmitPlanTool', () => {
  it('prefers the toolCallId payload and renders its markdown body', () => {
    const metadata: MessageMetadata = {
      suspendedTools: {
        submit_plan: {
          suspendPayload: {
            path: '/tmp/wrong.md',
            title: 'Wrong plan',
            plan: 'Wrong body',
          },
        },
        'call-1': {
          suspendPayload: {
            path: '/tmp/right.md',
            title: 'Review migration plan',
            plan: '## Steps\n\n- Move data\n- Verify output',
          },
        },
      },
    };

    renderTool({ toolName: 'submit_plan', toolCallId: 'call-1', output: undefined, metadata });

    expect(screen.getByText('Review migration plan')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Steps' })).toBeTruthy();
    expect(screen.queryByText('Wrong plan')).toBeNull();
  });

  it('falls back to the toolName payload and renders a path-only review', () => {
    const metadata = metadataWithPayload('submit_plan', {
      path: '/workspace/.mastracode/plans/plan.md',
      plan: '   ',
    });

    renderTool({ toolName: 'submit_plan', toolCallId: 'call-2', output: undefined, metadata });

    expect(screen.getByText('Submitted plan')).toBeTruthy();
    expect(screen.getByText('Plan file')).toBeTruthy();
    expect(screen.getByText('/workspace/.mastracode/plans/plan.md')).toBeTruthy();
  });

  it.each([
    { name: 'missing path', payload: { title: 'Missing path', plan: 'Body' } },
    { name: 'blank path', payload: { path: '   ', plan: 'Body' } },
    { name: 'invalid optional fields', payload: { path: '/tmp/plan.md', title: 42 } },
  ])('renders nothing for a malformed payload with $name', ({ payload }) => {
    const metadata = metadataWithPayload('call-malformed', payload);

    renderTool({ toolName: 'submit_plan', toolCallId: 'call-malformed', output: undefined, metadata });

    expect(screen.queryByTestId('submit-plan-badge')).toBeNull();
  });
});
