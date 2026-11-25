// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';

import { Button } from '../Button';
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

  it('stays quiet as the pointer passes over, and opens once it rests', async () => {
    const user = userEvent.setup();
    render(
      <Tooltip>
        <TooltipTrigger>Save</TooltipTrigger>
        <TooltipContent>Save changes</TooltipContent>
      </Tooltip>,
    );

    await user.hover(screen.getByRole('button', { name: 'Save' }));
    expect(screen.queryByRole('tooltip')).toBeNull();

    expect((await screen.findByRole('tooltip')).textContent).toBe('Save changes');
  });

  it('opens at once on keyboard focus', async () => {
    const user = userEvent.setup();
    render(
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger>Save</TooltipTrigger>
          <TooltipContent>Save changes</TooltipContent>
        </Tooltip>
      </TooltipProvider>,
    );

    await user.tab();

    expect(screen.getByRole('tooltip').textContent).toBe('Save changes');
  });

  it('opens at once on a neighbor of the tooltip that is open', async () => {
    const user = userEvent.setup();
    render(
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger>Bold</TooltipTrigger>
          <TooltipContent>Make it bold</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger>Italic</TooltipTrigger>
          <TooltipContent>Make it italic</TooltipContent>
        </Tooltip>
      </TooltipProvider>,
    );
    await user.hover(screen.getByRole('button', { name: 'Bold' }));
    await screen.findByText('Make it bold');

    await user.hover(screen.getByRole('button', { name: 'Italic' }));

    expect(screen.getByText('Make it italic')).toBeTruthy();
  });

  it('opens at once with delay="instant"', async () => {
    const user = userEvent.setup();
    render(
      <Tooltip>
        <TooltipTrigger delay="instant">42%</TooltipTrigger>
        <TooltipContent>42 of 100 runs</TooltipContent>
      </Tooltip>,
    );

    await user.hover(screen.getByRole('button', { name: '42%' }));

    expect(screen.getByRole('tooltip').textContent).toBe('42 of 100 runs');
  });

  it('explains a disabled button, which gets no mousemove to start a wait', async () => {
    const user = userEvent.setup();
    render(
      // oxlint-disable-next-line playground-ui/no-hover-delay-numbers -- a published app's delay doesn't apply either
      <TooltipProvider delay={300}>
        <Button disabled tooltip="Save the agent first">
          Run
        </Button>
      </TooltipProvider>,
    );

    await user.hover(screen.getByRole('button', { name: 'Run' }));

    expect((await screen.findByRole('tooltip')).textContent).toBe('Save the agent first');
  });

  it('still takes the deprecated delay of a published app’s provider, through a bare provider inside it', async () => {
    const user = userEvent.setup();
    render(
      // oxlint-disable-next-line playground-ui/no-hover-delay-numbers -- the deprecated form is what this covers
      <TooltipProvider delayDuration={0}>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>Save</TooltipTrigger>
            <TooltipContent>Save changes</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </TooltipProvider>,
    );

    await user.hover(screen.getByRole('button', { name: 'Save' }));

    expect(screen.getByRole('tooltip').textContent).toBe('Save changes');
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
      <TooltipProvider>
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

  it('opens as soon as the pointer reaches the icon', async () => {
    const user = userEvent.setup();
    render(<InfoTooltip aria-label="Version information">Each save creates a version.</InfoTooltip>);

    await user.hover(screen.getByRole('button', { name: 'Version information' }));

    expect(screen.getByRole('tooltip').textContent).toContain('Each save creates a version.');
  });

  it('opens on a tap and closes on the next tap or Escape, since touch has no hover', async () => {
    const user = userEvent.setup();
    render(
      <TooltipProvider>
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
      <TooltipProvider>
        <InfoTooltip aria-label="Version information">Each save creates a version.</InfoTooltip>
      </TooltipProvider>,
    );

    await user.pointer({ keys: '[MouseLeft]', target: screen.getByRole('button', { name: 'Version information' }) });

    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('describes an illustrated tooltip by its titles and captions, never its drawings', async () => {
    const user = userEvent.setup();
    render(
      <TooltipProvider>
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
