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
        <SubmitPlanTool {...props} />
      </ToolCallProvider>
    </TooltipProvider>,
  );
  return { ...utils, approveToolcall };
};

afterEach(() => cleanup());

describe('SubmitPlanTool', () => {
  describe('when metadata.suspendedTools is keyed by toolCallId', () => {
    it('renders the submit-plan badge with the submitted plan body', () => {
      const metadata: MessageMetadata = {
        suspendedTools: {
          'call-1': {
            suspendPayload: {
              path: '/tmp/plan.md',
              title: 'Review migration plan',
              plan: '## Steps\n\n- Move data\n- Verify output',
            },
          },
        },
      };

      renderTool({ toolName: 'submit_plan', toolCallId: 'call-1', output: undefined, metadata });

      expect(screen.getByTestId('submit-plan-badge')).toBeTruthy();
      expect(screen.getByText('Review migration plan')).toBeTruthy();
      expect(screen.getByRole('heading', { name: 'Steps' })).toBeTruthy();
      expect(screen.getByText('Move data')).toBeTruthy();
    });
  });

  describe('when metadata.suspendedTools has both toolCallId and toolName keys', () => {
    it('prefers the toolCallId-keyed payload', () => {
      const metadata: MessageMetadata = {
        suspendedTools: {
          submit_plan: {
            suspendPayload: {
              path: '/tmp/wrong.md',
              title: 'Wrong plan',
              plan: 'Wrong body',
            },
          },
          'call-2': {
            suspendPayload: {
              path: '/tmp/right.md',
              title: 'Right plan',
              plan: 'Right body',
            },
          },
        },
      };

      renderTool({ toolName: 'submit_plan', toolCallId: 'call-2', output: undefined, metadata });

      expect(screen.getByText('Right plan')).toBeTruthy();
      expect(screen.getByText('Right body')).toBeTruthy();
      expect(screen.queryByText('Wrong plan')).toBeNull();
      expect(screen.queryByText('Wrong body')).toBeNull();
    });
  });

  describe('when metadata.suspendedTools is keyed by toolName', () => {
    it('renders the toolName-keyed payload as a compatibility fallback', () => {
      const metadata: MessageMetadata = {
        suspendedTools: {
          submit_plan: {
            suspendPayload: {
              path: '/tmp/compat-plan.md',
              plan: 'Compatibility plan body',
            },
          },
        },
      };

      renderTool({ toolName: 'submit_plan', toolCallId: 'call-3', output: undefined, metadata });

      expect(screen.getByTestId('submit-plan-badge')).toBeTruthy();
      expect(screen.getByText('Submitted plan')).toBeTruthy();
      expect(screen.getByText('Compatibility plan body')).toBeTruthy();
    });
  });

  describe('when only a path is present', () => {
    it('renders a path-only review card', () => {
      const metadata: MessageMetadata = {
        suspendedTools: {
          'call-4': {
            suspendPayload: {
              path: '/workspace/.mastra/plans/plan.md',
            },
          },
        },
      };

      renderTool({ toolName: 'submit_plan', toolCallId: 'call-4', output: undefined, metadata });

      expect(screen.getByText('Submitted plan')).toBeTruthy();
      expect(screen.getByText('Plan file')).toBeTruthy();
      expect(screen.getByText('/workspace/.mastra/plans/plan.md')).toBeTruthy();
    });
  });

  describe('when the suspend payload is malformed', () => {
    it('renders nothing when path is missing but plan is present', () => {
      const metadata: MessageMetadata = {
        suspendedTools: {
          'call-5': {
            suspendPayload: {
              title: 'Missing path',
              plan: 'Body',
            },
          },
        },
      };

      renderTool({ toolName: 'submit_plan', toolCallId: 'call-5', output: undefined, metadata });

      expect(screen.queryByTestId('submit-plan-badge')).toBeNull();
    });

    it('renders nothing when both path and plan are missing', () => {
      const metadata: MessageMetadata = {
        suspendedTools: {
          'call-missing-content': {
            suspendPayload: {
              title: 'Missing content',
            },
          },
        },
      };

      renderTool({ toolName: 'submit_plan', toolCallId: 'call-missing-content', output: undefined, metadata });

      expect(screen.queryByTestId('submit-plan-badge')).toBeNull();
    });

    it('renders nothing when path and plan are empty strings', () => {
      const metadata: MessageMetadata = {
        suspendedTools: {
          'call-empty-content': {
            suspendPayload: {
              path: '',
              plan: '',
            },
          },
        },
      };

      renderTool({ toolName: 'submit_plan', toolCallId: 'call-empty-content', output: undefined, metadata });

      expect(screen.queryByTestId('submit-plan-badge')).toBeNull();
    });

    it('renders nothing when optional fields are invalid', () => {
      const metadata: MessageMetadata = {
        suspendedTools: {
          'call-6': {
            suspendPayload: {
              path: '/tmp/plan.md',
              title: 42,
            },
          },
        },
      };

      renderTool({ toolName: 'submit_plan', toolCallId: 'call-6', output: undefined, metadata });

      expect(screen.queryByTestId('submit-plan-badge')).toBeNull();
    });
  });
});
