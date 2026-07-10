import type { SubmitPlanSuspendPayload } from '@mastra/core/tools';
import { TooltipProvider } from '@mastra/playground-ui/components/Tooltip';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SubmitPlanBadge } from '../submit-plan-badge';
import { ToolCallProvider } from '@/services/tool-call-provider';

type ProviderOverrides = {
  approveToolcall?: (toolCallId: string, resumeData?: unknown) => Promise<void> | void;
  isRunning?: boolean;
};

const renderBadge = (props: ComponentProps<typeof SubmitPlanBadge>, overrides: ProviderOverrides = {}) => {
  const approveToolcall = overrides.approveToolcall ?? vi.fn();
  const declineToolcall = vi.fn();
  const utils = render(
    <TooltipProvider>
      <ToolCallProvider
        approveToolcall={approveToolcall}
        declineToolcall={declineToolcall}
        approveToolcallGenerate={vi.fn()}
        declineToolcallGenerate={vi.fn()}
        approveNetworkToolcall={vi.fn()}
        declineNetworkToolcall={vi.fn()}
        isRunning={overrides.isRunning ?? false}
        toolCallApprovals={{}}
        networkToolCallApprovals={{}}
      >
        <SubmitPlanBadge {...props} />
      </ToolCallProvider>
    </TooltipProvider>,
  );
  return { ...utils, approveToolcall, declineToolcall };
};

const badge = () => screen.getByTestId('submit-plan-badge');

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('SubmitPlanBadge', () => {
  describe('when title and plan are present', () => {
    const suspendPayload: SubmitPlanSuspendPayload = {
      path: '/workspace/plan.md',
      title: 'Review the migration',
      plan: '## Migration\n\n- Backfill users\n- Flip reads',
    };

    it('renders the markdown plan body', () => {
      renderBadge({ toolCallId: 'call-1', suspendPayload });

      expect(screen.getByText('Review the migration')).toBeTruthy();
      expect(screen.getByText('plan.md')).toBeTruthy();
      expect(screen.getByRole('heading', { name: 'Migration' })).toBeTruthy();
      expect(screen.getByText('Backfill users')).toBeTruthy();
      expect(screen.queryByText('/workspace/plan.md')).toBeNull();
    });

    it('approves with custom submit_plan resume data', () => {
      const { approveToolcall } = renderBadge({ toolCallId: 'call-1', suspendPayload });

      fireEvent.click(within(badge()).getByRole('button', { name: /approve/i }));

      expect(approveToolcall).toHaveBeenCalledTimes(1);
      expect(approveToolcall).toHaveBeenCalledWith('call-1', {
        action: 'approved',
        path: '/workspace/plan.md',
        title: 'Review the migration',
        plan: '## Migration\n\n- Backfill users\n- Flip reads',
      });
    });

    it('rejects with submit_plan resume data instead of declining the tool call', () => {
      const { approveToolcall, declineToolcall } = renderBadge({ toolCallId: 'call-1', suspendPayload });

      fireEvent.click(within(badge()).getByRole('button', { name: /reject/i }));

      expect(approveToolcall).toHaveBeenCalledTimes(1);
      expect(approveToolcall).toHaveBeenCalledWith('call-1', {
        action: 'rejected',
        path: '/workspace/plan.md',
        title: 'Review the migration',
        plan: '## Migration\n\n- Backfill users\n- Flip reads',
      });
      expect(declineToolcall).not.toHaveBeenCalled();
    });

    it('requests changes with feedback', () => {
      const { approveToolcall } = renderBadge({ toolCallId: 'call-1', suspendPayload });

      fireEvent.click(within(badge()).getByRole('button', { name: /^request changes$/i }));

      const requestChanges = within(screen.getByRole('dialog')).getByRole<HTMLButtonElement>('button', {
        name: /^request changes$/i,
      });
      expect(requestChanges.disabled).toBe(true);

      fireEvent.change(screen.getByPlaceholderText('Describe requested changes...'), {
        target: { value: '  Add rollback steps.  ' },
      });

      fireEvent.click(requestChanges);

      expect(approveToolcall).toHaveBeenCalledTimes(1);
      expect(approveToolcall).toHaveBeenCalledWith('call-1', {
        action: 'rejected',
        feedback: 'Add rollback steps.',
        path: '/workspace/plan.md',
        title: 'Review the migration',
        plan: '## Migration\n\n- Backfill users\n- Flip reads',
      });
    });

    it('restores review actions when resuming fails', async () => {
      const approveToolcall = vi.fn().mockRejectedValue(new Error('resume failed'));
      renderBadge({ toolCallId: 'call-1', suspendPayload }, { approveToolcall });

      fireEvent.click(within(badge()).getByRole('button', { name: /approve/i }));

      await waitFor(() => expect(within(badge()).getByRole('button', { name: /approve/i })).toBeTruthy());
      expect(screen.queryByText('Approved')).toBeNull();
    });
  });

  describe('when only the submitted path is present', () => {
    const suspendPayload: SubmitPlanSuspendPayload = {
      path: '/workspace/.mastracode/plans/review.md',
    };

    it('renders the submitted path with every review action', () => {
      renderBadge({ toolCallId: 'call-2', suspendPayload });

      expect(screen.getByText('Submitted plan')).toBeTruthy();
      expect(screen.getByText('Plan file')).toBeTruthy();
      expect(screen.getByText('/workspace/.mastracode/plans/review.md')).toBeTruthy();
      expect(within(badge()).getByRole('button', { name: /approve plan/i })).toBeTruthy();
      expect(within(badge()).getByRole('button', { name: /reject plan/i })).toBeTruthy();
      expect(within(badge()).getByRole('button', { name: /^request changes$/i })).toBeTruthy();
      expect(within(badge()).queryByRole('button', { name: /expand plan/i })).toBeNull();
    });
  });

  describe('when the plan is already resolved', () => {
    it('shows the approved state and hides actions', () => {
      renderBadge({
        toolCallId: 'call-3',
        suspendPayload: {
          path: '/workspace/plan.md',
          title: 'Reviewed plan',
          plan: 'Plan',
        },
        resultContent: 'Plan approved. Proceed with implementation following the approved plan.',
      });

      expect(screen.getByText('Approved')).toBeTruthy();
      expect(screen.queryByText('Resolved')).toBeNull();
      expect(screen.queryByText('Plan approved')).toBeNull();
      expect(within(badge()).queryByRole('button', { name: /approve/i })).toBeNull();
    });

    it('shows the rejected state when the submitted plan was rejected', () => {
      renderBadge({
        toolCallId: 'call-rejected',
        suspendPayload: {
          path: '/workspace/plan.md',
          title: 'Reviewed plan',
          plan: 'Plan',
        },
        resultContent: 'Plan was not approved. The user wants revisions.',
      });

      expect(screen.getByText('Rejected')).toBeTruthy();
      expect(screen.queryByText('Resolved')).toBeNull();
      expect(within(badge()).queryByRole('button', { name: /approve/i })).toBeNull();
    });
  });
});
