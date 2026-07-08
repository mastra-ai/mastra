import { TooltipProvider } from '@mastra/playground-ui/components/Tooltip';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SubmitPlanBadge } from '../submit-plan-badge';
import type { SubmitPlanResult, SubmitPlanSuspendPayload } from '../types';
import { ToolCallProvider } from '@/services/tool-call-provider';

type ProviderOverrides = {
  approveToolcall?: (toolCallId: string, resumeData?: unknown) => void;
  isRunning?: boolean;
  toolCallApprovals?: { [toolCallId: string]: { status: 'approved' | 'declined' } };
};

const renderBadge = (
  props: { toolCallId: string; suspendPayload: SubmitPlanSuspendPayload; result: SubmitPlanResult | undefined },
  overrides: ProviderOverrides = {},
) => {
  const approveToolcall = overrides.approveToolcall ?? vi.fn();
  const utils = render(
    <TooltipProvider>
      <ToolCallProvider
        approveToolcall={approveToolcall}
        declineToolcall={vi.fn()}
        approveToolcallGenerate={vi.fn()}
        declineToolcallGenerate={vi.fn()}
        approveNetworkToolcall={vi.fn()}
        declineNetworkToolcall={vi.fn()}
        isRunning={overrides.isRunning ?? false}
        toolCallApprovals={overrides.toolCallApprovals ?? {}}
        networkToolCallApprovals={{}}
      >
        <SubmitPlanBadge {...props} />
      </ToolCallProvider>
    </TooltipProvider>,
  );
  return { ...utils, approveToolcall };
};

const mockClipboard = (writeText: ReturnType<typeof vi.fn>) => {
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText },
  });
};

const badge = () => screen.getByTestId('submit-plan-badge');

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  Reflect.deleteProperty(navigator, 'clipboard');
});

describe('SubmitPlanBadge', () => {
  describe('when title and plan are present', () => {
    const suspendPayload: SubmitPlanSuspendPayload = {
      path: '/workspace/plan.md',
      title: 'Review the migration',
      plan: '## Migration\n\n- Backfill users\n- Flip reads',
    };

    it('renders the markdown plan body', () => {
      renderBadge({ toolCallId: 'call-1', suspendPayload, result: undefined });

      expect(screen.getByText('Review the migration')).toBeTruthy();
      expect(screen.getByText('plan.md')).toBeTruthy();
      expect(screen.getByRole('heading', { name: 'Migration' })).toBeTruthy();
      expect(screen.getByText('Backfill users')).toBeTruthy();
      expect(screen.queryByText('/workspace/plan.md')).toBeNull();
    });

    it('copies the submitted title, path, and plan body', async () => {
      const writeText = vi.fn().mockResolvedValue(undefined);
      mockClipboard(writeText);

      renderBadge({ toolCallId: 'call-1', suspendPayload, result: undefined });

      fireEvent.click(within(badge()).getByRole('button', { name: /copy plan/i }));

      await waitFor(() =>
        expect(writeText).toHaveBeenCalledWith(
          'Review the migration\n\nFile: /workspace/plan.md\n\n## Migration\n\n- Backfill users\n- Flip reads',
        ),
      );
    });

    it('approves with custom submit_plan resume data', () => {
      const { approveToolcall } = renderBadge({ toolCallId: 'call-1', suspendPayload, result: undefined });

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
      const { approveToolcall } = renderBadge({ toolCallId: 'call-1', suspendPayload, result: undefined });

      fireEvent.click(within(badge()).getByRole('button', { name: /reject/i }));

      expect(approveToolcall).toHaveBeenCalledTimes(1);
      expect(approveToolcall).toHaveBeenCalledWith('call-1', {
        action: 'rejected',
        path: '/workspace/plan.md',
        title: 'Review the migration',
        plan: '## Migration\n\n- Backfill users\n- Flip reads',
      });
    });

    it('requests changes with feedback', () => {
      const { approveToolcall } = renderBadge({ toolCallId: 'call-1', suspendPayload, result: undefined });

      fireEvent.click(within(badge()).getByRole('button', { name: /open request changes/i }));

      expect(screen.getByRole<HTMLButtonElement>('button', { name: /^request changes$/i }).disabled).toBe(true);

      fireEvent.change(screen.getByPlaceholderText('Describe requested changes...'), {
        target: { value: '  Add rollback steps.  ' },
      });

      fireEvent.click(screen.getByRole('button', { name: /^request changes$/i }));

      expect(approveToolcall).toHaveBeenCalledTimes(1);
      expect(approveToolcall).toHaveBeenCalledWith('call-1', {
        action: 'rejected',
        feedback: 'Add rollback steps.',
        path: '/workspace/plan.md',
        title: 'Review the migration',
        plan: '## Migration\n\n- Backfill users\n- Flip reads',
      });
    });

    it('does not attach requested-changes feedback when approving', () => {
      const { approveToolcall } = renderBadge({ toolCallId: 'call-1', suspendPayload, result: undefined });

      fireEvent.click(within(badge()).getByRole('button', { name: /open request changes/i }));

      fireEvent.change(screen.getByPlaceholderText('Describe requested changes...'), {
        target: { value: '  Keep the rollout narrow.  ' },
      });

      fireEvent.click(within(badge()).getByRole('button', { name: /approve/i }));

      expect(approveToolcall).toHaveBeenCalledTimes(1);
      expect(approveToolcall).toHaveBeenCalledWith('call-1', {
        action: 'approved',
        path: '/workspace/plan.md',
        title: 'Review the migration',
        plan: '## Migration\n\n- Backfill users\n- Flip reads',
      });
    });

    it('expands the clipped plan when the plan content is clicked', async () => {
      vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(260);

      renderBadge({ toolCallId: 'call-1', suspendPayload, result: undefined });

      await waitFor(() => {
        expect(screen.getByTestId('submit-plan-content').getAttribute('aria-label')).toBe('Expand plan');
      });

      fireEvent.click(screen.getByTestId('submit-plan-content'));

      expect(within(badge()).getByRole('button', { name: /collapse plan/i })).toBeTruthy();
    });
  });

  describe('when only the submitted path is present', () => {
    const suspendPayload: SubmitPlanSuspendPayload = {
      path: '/workspace/.mastra/plans/review.md',
    };

    it('renders an unavailable plan file state', () => {
      renderBadge({ toolCallId: 'call-2', suspendPayload, result: undefined });

      expect(screen.getByText('Plan file unavailable')).toBeTruthy();
      expect(screen.getByText(/Could not read the plan file/)).toBeTruthy();
      expect(within(badge()).queryByRole('button', { name: /approve plan/i })).toBeNull();
      expect(within(badge()).getByRole('button', { name: /reject plan/i })).toBeTruthy();
      expect(within(badge()).getByRole('button', { name: /open request changes/i })).toBeTruthy();
    });

    it('rejects without fake plan content', () => {
      const { approveToolcall } = renderBadge({ toolCallId: 'call-2', suspendPayload, result: undefined });

      fireEvent.click(within(badge()).getByRole('button', { name: /reject plan/i }));

      expect(approveToolcall).toHaveBeenCalledTimes(1);
      expect(approveToolcall).toHaveBeenCalledWith('call-2', {
        action: 'rejected',
        path: '/workspace/.mastra/plans/review.md',
      });
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
        result: {
          content: 'Plan approved',
          isError: false,
          action: 'approved',
        },
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
        result: {
          content: 'Plan was not approved. The user wants revisions.',
          isError: false,
          action: 'rejected',
        },
      });

      expect(screen.getByText('Rejected')).toBeTruthy();
      expect(screen.queryByText('Resolved')).toBeNull();
      expect(within(badge()).queryByRole('button', { name: /approve/i })).toBeNull();
    });
  });
});
