// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Button } from '../Button';
import { TooltipProvider } from '../Tooltip';
import { Plan } from './plan';

const renderPlan = (element: ReactNode) => render(<TooltipProvider>{element}</TooltipProvider>);

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

describe('Plan', () => {
  it('renders a title, filename, and markdown body', () => {
    renderPlan(
      <Plan title="Review migration plan" path="/workspace/plans/migration.md">
        {'## Steps\n\n- Move data\n- Verify output'}
      </Plan>,
    );

    expect(screen.getByText('Review migration plan')).toBeTruthy();
    expect(screen.getByText('migration.md')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Steps' })).toBeTruthy();
    expect(screen.getByText('Move data')).toBeTruthy();
    expect(screen.queryByText('/workspace/plans/migration.md')).toBeNull();
  });

  it('renders code spans in string titles', () => {
    renderPlan(<Plan title="Approve `submit_plan` output">{'Plan content'}</Plan>);

    const code = screen.getByText('submit_plan');

    expect(code.tagName).toBe('CODE');
  });

  it('copies the configured content', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    mockClipboard(writeText);

    renderPlan(
      <Plan
        title="Review migration plan"
        path="/workspace/plans/migration.md"
        copyContent={'Review migration plan\n\nFile: /workspace/plans/migration.md\n\n## Steps'}
      >
        {'## Steps'}
      </Plan>,
    );

    fireEvent.click(screen.getByRole('button', { name: /copy plan/i }));

    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith(
        'Review migration plan\n\nFile: /workspace/plans/migration.md\n\n## Steps',
      ),
    );
  });

  it('renders the path when markdown content is unavailable', () => {
    renderPlan(<Plan title="Submitted plan" path="/workspace/.mastra/plans/review.md" />);

    expect(screen.getByText('Submitted plan')).toBeTruthy();
    expect(screen.getByText('Plan file')).toBeTruthy();
    expect(screen.getByText('/workspace/.mastra/plans/review.md')).toBeTruthy();
  });

  it('renders status and action slots', () => {
    renderPlan(
      <Plan
        title="Review migration plan"
        status={{ label: 'Approved', variant: 'success' }}
        leftActions={<Button aria-label="Reject plan">Reject</Button>}
        rightActions={<Button aria-label="Approve plan">Approve</Button>}
      >
        {'Plan'}
      </Plan>,
    );

    expect(screen.getByText('Approved')).toBeTruthy();
    expect(screen.getByRole('button', { name: /reject plan/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /approve plan/i })).toBeTruthy();
  });

  it('expands from the clipped content click target', async () => {
    vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(260);

    renderPlan(<Plan title="Review migration plan">{'## Steps\n\n- Move data'}</Plan>);

    await waitFor(() => {
      expect(screen.getByTestId('plan-content').getAttribute('aria-label')).toBe('Expand plan');
    });

    fireEvent.click(screen.getByTestId('plan-content'));

    expect(screen.getByRole('button', { name: /collapse plan/i })).toBeTruthy();
  });
});
