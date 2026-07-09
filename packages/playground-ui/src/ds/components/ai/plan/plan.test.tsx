// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Button } from '../../Button';
import { TooltipProvider } from '../../Tooltip';
import {
  Plan,
  PlanActionGroup,
  PlanBody,
  PlanContent,
  PlanControls,
  PlanCopyButton,
  PlanExpandButton,
  PlanFile,
  PlanHeader,
  PlanHeaderActions,
  PlanIntro,
  PlanLabel,
  PlanMain,
  PlanPath,
  PlanStatus,
  PlanTitle,
} from './plan';

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
        <PlanHeader>
          <PlanLabel />
        </PlanHeader>
        <PlanBody>
          <PlanIntro>
            <PlanTitle>Review migration plan</PlanTitle>
            <PlanPath>/workspace/plans/migration.md</PlanPath>
          </PlanIntro>
          <PlanMain>
            <PlanContent>{'## Steps\n\n- Move data\n- Verify output'}</PlanContent>
          </PlanMain>
        </PlanBody>
      </Plan>,
    );

    expect(screen.getByText('Review migration plan')).toBeTruthy();
    expect(screen.getByText('migration.md')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Steps' })).toBeTruthy();
    expect(screen.getByText('Move data')).toBeTruthy();
    expect(screen.queryByText('/workspace/plans/migration.md')).toBeNull();
  });

  it('copies the configured content from a composed header action', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    mockClipboard(writeText);

    renderPlan(
      <Plan>
        <PlanHeader>
          <PlanLabel />
          <PlanHeaderActions>
            <PlanCopyButton content={'Review migration plan\n\nFile: /workspace/plans/migration.md\n\n## Steps'} />
          </PlanHeaderActions>
        </PlanHeader>
        <PlanBody>
          <PlanContent>{'## Steps'}</PlanContent>
        </PlanBody>
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
        <PlanBody>
          <PlanTitle>Submitted plan</PlanTitle>
          <PlanFile>/workspace/.mastra/plans/review.md</PlanFile>
        </PlanBody>
      </Plan>,
    );

    expect(screen.getByText('Submitted plan')).toBeTruthy();
    expect(screen.getByText('Plan file')).toBeTruthy();
    expect(screen.getByText('/workspace/.mastra/plans/review.md')).toBeTruthy();
  });

  it('renders composed status and action slots', () => {
    renderPlan(
      <Plan>
        <PlanHeader>
          <PlanLabel />
          <PlanHeaderActions>
            <PlanStatus variant="success">Approved</PlanStatus>
          </PlanHeaderActions>
        </PlanHeader>
        <PlanBody>
          <PlanMain>
            <PlanContent>{'Plan'}</PlanContent>
            <PlanControls>
              <PlanActionGroup className="justify-end">
                <Button aria-label="Reject plan">Reject</Button>
              </PlanActionGroup>
              <PlanExpandButton />
              <PlanActionGroup>
                <Button aria-label="Approve plan">Approve</Button>
              </PlanActionGroup>
            </PlanControls>
          </PlanMain>
        </PlanBody>
      </Plan>,
    );

    expect(screen.getByText('Approved')).toBeTruthy();
    expect(screen.getByRole('button', { name: /reject plan/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /approve plan/i })).toBeTruthy();
  });

  it('expands from the composed expand button', () => {
    renderPlan(
      <Plan>
        <PlanBody>
          <PlanMain>
            <PlanContent>{'## Steps\n\n- Move data'}</PlanContent>
            <PlanControls />
          </PlanMain>
        </PlanBody>
      </Plan>,
    );

    const content = document.querySelector<HTMLElement>('[data-slot="plan-content"]');
    if (!content) throw new Error('Expected plan content to render.');

    expect(content.style.maxHeight).toBe('220px');

    fireEvent.click(screen.getByRole('button', { name: /expand plan/i }));

    expect(screen.getByRole('button', { name: /collapse plan/i })).toBeTruthy();
    expect(content.style.maxHeight).toBe('');
  });
});
