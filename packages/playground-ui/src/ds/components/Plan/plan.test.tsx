// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Button } from '../Button';
import { TooltipProvider } from '../Tooltip';
import { Plan } from './plan-compound';

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
  it('renders a composed title, filename, and markdown body', () => {
    renderPlan(
      <Plan>
        <Plan.Header>
          <Plan.Label />
        </Plan.Header>
        <Plan.Body>
          <Plan.Intro>
            <Plan.Title>Review migration plan</Plan.Title>
            <Plan.Path>/workspace/plans/migration.md</Plan.Path>
          </Plan.Intro>
          <Plan.Main>
            <Plan.Content>{'## Steps\n\n- Move data\n- Verify output'}</Plan.Content>
          </Plan.Main>
        </Plan.Body>
      </Plan>,
    );

    expect(screen.getByText('Review migration plan')).toBeTruthy();
    expect(screen.getByText('migration.md')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Steps' })).toBeTruthy();
    expect(screen.getByText('Move data')).toBeTruthy();
    expect(screen.queryByText('/workspace/plans/migration.md')).toBeNull();
  });

  it('renders code spans in string titles', () => {
    renderPlan(
      <Plan>
        <Plan.Body>
          <Plan.Title>Approve `submit_plan` output</Plan.Title>
        </Plan.Body>
      </Plan>,
    );

    const code = screen.getByText('submit_plan');

    expect(code.tagName).toBe('CODE');
  });

  it('copies the configured content from a composed header action', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    mockClipboard(writeText);

    renderPlan(
      <Plan>
        <Plan.Header>
          <Plan.Label />
          <Plan.HeaderActions>
            <Plan.CopyButton content={'Review migration plan\n\nFile: /workspace/plans/migration.md\n\n## Steps'} />
          </Plan.HeaderActions>
        </Plan.Header>
        <Plan.Body>
          <Plan.Content>{'## Steps'}</Plan.Content>
        </Plan.Body>
      </Plan>,
    );

    fireEvent.click(screen.getByRole('button', { name: /copy plan/i }));

    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith(
        'Review migration plan\n\nFile: /workspace/plans/migration.md\n\n## Steps',
      ),
    );
  });

  it('renders the path fallback when markdown content is unavailable', () => {
    renderPlan(
      <Plan>
        <Plan.Body>
          <Plan.Title>Submitted plan</Plan.Title>
          <Plan.File>/workspace/.mastra/plans/review.md</Plan.File>
        </Plan.Body>
      </Plan>,
    );

    expect(screen.getByText('Submitted plan')).toBeTruthy();
    expect(screen.getByText('Plan file')).toBeTruthy();
    expect(screen.getByText('/workspace/.mastra/plans/review.md')).toBeTruthy();
  });

  it('renders composed status and action slots', () => {
    renderPlan(
      <Plan>
        <Plan.Header>
          <Plan.Label />
          <Plan.HeaderActions>
            <Plan.Status variant="success">Approved</Plan.Status>
          </Plan.HeaderActions>
        </Plan.Header>
        <Plan.Body>
          <Plan.Main>
            <Plan.Content>{'Plan'}</Plan.Content>
            <Plan.Controls>
              <Plan.ActionGroup className="justify-end">
                <Button aria-label="Reject plan">Reject</Button>
              </Plan.ActionGroup>
              <Plan.ExpandButton />
              <Plan.ActionGroup>
                <Button aria-label="Approve plan">Approve</Button>
              </Plan.ActionGroup>
            </Plan.Controls>
          </Plan.Main>
        </Plan.Body>
      </Plan>,
    );

    expect(screen.getByText('Approved')).toBeTruthy();
    expect(screen.getByRole('button', { name: /reject plan/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /approve plan/i })).toBeTruthy();
  });

  it('expands from the clipped content click target', async () => {
    vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(260);

    renderPlan(
      <Plan>
        <Plan.Body>
          <Plan.Main>
            <Plan.Content>{'## Steps\n\n- Move data'}</Plan.Content>
            <Plan.Controls />
          </Plan.Main>
        </Plan.Body>
      </Plan>,
    );

    await waitFor(() => {
      const content = document.querySelector<HTMLElement>('[data-slot="plan-content"]');
      expect(content?.getAttribute('aria-label')).toBe('Expand plan');
    });

    const content = document.querySelector<HTMLElement>('[data-slot="plan-content"]');
    if (!content) throw new Error('Expected plan content to render.');
    fireEvent.click(content);

    expect(screen.getByRole('button', { name: /collapse plan/i })).toBeTruthy();
  });
});
