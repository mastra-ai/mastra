// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';

import { InfoTooltip } from './info-tooltip';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './tooltip';

afterEach(() => {
  cleanup();
});

describe('Tooltip', () => {
  it('accepts Base UI positioning props through content', () => {
    render(
      <TooltipProvider>
        <Tooltip defaultOpen>
          <TooltipTrigger>Hover me</TooltipTrigger>
          <TooltipContent
            align="start"
            alignOffset={4}
            arrowPadding={6}
            collisionAvoidance={{ side: 'shift', align: 'shift', fallbackAxisSide: 'none' }}
            collisionBoundary={document.body}
            collisionPadding={8}
            positionMethod="fixed"
            sticky
          >
            Positioned tooltip
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>,
    );

    expect(screen.getByRole('tooltip', { name: 'Positioned tooltip' })).toBeTruthy();
  });
  it('positions the popup with a fixed strategy so stale popups never widen the page', () => {
    render(
      <TooltipProvider>
        <Tooltip defaultOpen>
          <TooltipTrigger>Hover me</TooltipTrigger>
          <TooltipContent>Fixed tooltip</TooltipContent>
        </Tooltip>
      </TooltipProvider>,
    );

    const popup = screen.getByRole('tooltip', { name: 'Fixed tooltip' });
    expect(popup.parentElement?.style.position).toBe('fixed');
  });
});

describe('InfoTooltip', () => {
  it('is a named button described by its text while the tooltip is closed', () => {
    render(
      <TooltipProvider>
        <InfoTooltip aria-label="Version information">Each save creates a version.</InfoTooltip>
      </TooltipProvider>,
    );

    expect(screen.queryByRole('tooltip')).toBeNull();
    expect(
      screen.getByRole('button', { name: 'Version information', description: 'Each save creates a version.' }),
    ).toBeTruthy();
  });

  it('opens the tooltip on keyboard focus and keeps rich content', async () => {
    const user = userEvent.setup();
    render(
      <TooltipProvider delay={0}>
        <InfoTooltip aria-label="What is trace intelligence?">
          <p>Traces are clustered into themes.</p>
          <ul>
            <li>Errors</li>
          </ul>
        </InfoTooltip>
      </TooltipProvider>,
    );

    await user.tab();

    const tooltip = await screen.findByRole('tooltip');
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'What is trace intelligence?' }));
    expect(tooltip.textContent).toContain('Traces are clustered into themes.');
    expect(tooltip.querySelector('li')?.textContent).toBe('Errors');
    // The description reuses the popup instead of a second copy of the content.
    expect(document.querySelectorAll('li')).toHaveLength(1);
    expect(
      screen.getByRole('button', {
        name: 'What is trace intelligence?',
        description: 'Traces are clustered into themes. Errors',
      }),
    ).toBeTruthy();
  });
});
