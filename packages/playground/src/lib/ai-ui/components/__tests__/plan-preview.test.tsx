import { Button } from '@mastra/playground-ui/components/Button';
import { TooltipProvider } from '@mastra/playground-ui/components/Tooltip';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PlanPreview } from '../plan-preview';

const renderPreview = (element: ReactNode) => render(<TooltipProvider>{element}</TooltipProvider>);

const mockClipboard = (writeText: ReturnType<typeof vi.fn>) => {
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText },
  });
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  Reflect.deleteProperty(navigator, 'clipboard');
});

describe('PlanPreview', () => {
  describe('when a markdown plan is provided', () => {
    it('renders the plan title, filename, and markdown body', () => {
      renderPreview(
        <PlanPreview
          title="Review migration plan"
          path="/workspace/plans/migration.md"
          plan="## Steps\n\n- Move data\n- Verify output"
        />,
      );

      expect(screen.getByText('Review migration plan')).toBeTruthy();
      expect(screen.getByText('migration.md')).toBeTruthy();
      expect(screen.getByRole('heading', { name: 'Steps' })).toBeTruthy();
      expect(screen.getByText('Move data')).toBeTruthy();
      expect(screen.queryByText('/workspace/plans/migration.md')).toBeNull();
    });

    it('copies the configured plan content', async () => {
      const writeText = vi.fn().mockResolvedValue(undefined);
      mockClipboard(writeText);

      renderPreview(
        <PlanPreview
          title="Review migration plan"
          path="/workspace/plans/migration.md"
          plan="## Steps"
          copyContent={'Review migration plan\n\nFile: /workspace/plans/migration.md\n\n## Steps'}
        />,
      );

      fireEvent.click(screen.getByRole('button', { name: /copy plan/i }));

      await waitFor(() =>
        expect(writeText).toHaveBeenCalledWith(
          'Review migration plan\n\nFile: /workspace/plans/migration.md\n\n## Steps',
        ),
      );
    });
  });

  describe('when only a path is provided', () => {
    it('renders the path as the reviewed plan file', () => {
      renderPreview(<PlanPreview title="Submitted plan" path="/workspace/.mastra/plans/review.md" />);

      expect(screen.getByText('Submitted plan')).toBeTruthy();
      expect(screen.getByText('Plan file')).toBeTruthy();
      expect(screen.getByText('/workspace/.mastra/plans/review.md')).toBeTruthy();
    });
  });

  describe('when status and action slots are provided', () => {
    it('renders the composed status and actions', () => {
      renderPreview(
        <PlanPreview
          title="Review migration plan"
          plan="Plan"
          status={{ label: 'Approved', variant: 'success' }}
          leftActions={<Button aria-label="Reject plan">Reject</Button>}
          rightActions={<Button aria-label="Approve plan">Approve</Button>}
        />,
      );

      expect(screen.getByText('Approved')).toBeTruthy();
      expect(screen.getByRole('button', { name: /reject plan/i })).toBeTruthy();
      expect(screen.getByRole('button', { name: /approve plan/i })).toBeTruthy();
    });
  });

  describe('when the plan is clipped', () => {
    it('expands from the content click target', async () => {
      vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(260);

      renderPreview(<PlanPreview title="Review migration plan" plan="## Steps\n\n- Move data" />);

      await waitFor(() => {
        expect(screen.getByTestId('plan-preview-content').getAttribute('aria-label')).toBe('Expand plan');
      });

      fireEvent.click(screen.getByTestId('plan-preview-content'));

      expect(screen.getByRole('button', { name: /collapse plan/i })).toBeTruthy();
    });
  });
});
