// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';

import { InfoTooltip } from './info-tooltip';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './tooltip';

afterEach(() => {
  cleanup();
});

describe('Tooltip', () => {
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

  it('opens on a tap and closes on the next tap or Escape, since touch has no hover', async () => {
    const user = userEvent.setup();
    render(
      <TooltipProvider delay={0}>
        <InfoTooltip aria-label="Version information">Each save creates a version.</InfoTooltip>
      </TooltipProvider>,
    );
    const icon = screen.getByRole('button', { name: 'Version information' });

    await user.pointer({ keys: '[TouchA]', target: icon });
    expect((await screen.findByRole('tooltip')).textContent).toContain('Each save creates a version.');

    await user.pointer({ keys: '[TouchA]', target: icon });
    await waitFor(() => expect(screen.queryByRole('tooltip')).toBeNull());

    await user.pointer({ keys: '[TouchA]', target: icon });
    await screen.findByRole('tooltip');
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('tooltip')).toBeNull());
  });

  it('does not open on a mouse click, which keeps hover as the only pointer trigger', async () => {
    const user = userEvent.setup({ skipHover: true });
    render(
      <TooltipProvider delay={0}>
        <InfoTooltip aria-label="Version information">Each save creates a version.</InfoTooltip>
      </TooltipProvider>,
    );

    await user.pointer({ keys: '[MouseLeft]', target: screen.getByRole('button', { name: 'Version information' }) });

    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('describes an illustrated tooltip by its titles and captions, never its drawings', async () => {
    const user = userEvent.setup();
    render(
      <TooltipProvider delay={0}>
        <InfoTooltip aria-label="About alerting for each" variant="illustrated">
          <InfoTooltip.Panel title="All traffic" caption="One failing agent can be hidden by healthy ones.">
            <span data-testid="drawing" />
          </InfoTooltip.Panel>
          <InfoTooltip.Panel title="Each agent" caption="The failing agent gets its own alert.">
            <span />
          </InfoTooltip.Panel>
        </InfoTooltip>
      </TooltipProvider>,
    );

    expect(
      screen.getByRole('button', {
        name: 'About alerting for each',
        description:
          'All traffic One failing agent can be hidden by healthy ones. Each agent The failing agent gets its own alert.',
      }),
    ).toBeTruthy();

    await user.tab();
    await screen.findByRole('tooltip');
    expect(screen.getByTestId('drawing').closest('[aria-hidden="true"]')).not.toBeNull();
  });
});
