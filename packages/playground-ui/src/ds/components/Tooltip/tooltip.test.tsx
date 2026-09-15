// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

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
