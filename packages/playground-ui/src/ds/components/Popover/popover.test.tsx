// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Popover, PopoverContent, PopoverTrigger } from './popover';
import { Button } from '@/ds/components/Button';
import { StatusDot } from '@/ds/components/StatusIndicators/status-dot';
import type { StatusPresentation } from '@/ds/components/StatusIndicators/status-dot-styles';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('PopoverTrigger', () => {
  it('renders a design-system Button by default', () => {
    render(
      <Popover>
        <PopoverTrigger>Open</PopoverTrigger>
      </Popover>,
    );

    const trigger = screen.getByRole('button', { name: 'Open' });
    expect(trigger.tagName).toBe('BUTTON');
    expect(trigger.getAttribute('data-variant')).toBe('default');
  });

  it('forwards variant and size to the Button', () => {
    render(
      <Popover>
        <PopoverTrigger variant="ghost" size="sm">
          Open
        </PopoverTrigger>
      </Popover>,
    );

    expect(screen.getByRole('button', { name: 'Open' }).getAttribute('data-variant')).toBe('ghost');
  });

  it('lets a custom render element own the look', () => {
    render(
      <Popover>
        <PopoverTrigger variant="ghost" render={<Button variant="outline">Open</Button>} />
      </Popover>,
    );

    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Open' }).getAttribute('data-variant')).toBe('outline');
  });

  it('still supports the legacy asChild prop', () => {
    render(
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline">Open</Button>
        </PopoverTrigger>
      </Popover>,
    );

    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Open' }).getAttribute('data-variant')).toBe('outline');
  });

  it('uses tooltip as the accessible name of an icon-only trigger', () => {
    render(
      <Popover>
        <PopoverTrigger size="icon-sm" tooltip="Pick a date">
          <svg />
        </PopoverTrigger>
      </Popover>,
    );

    expect(screen.getByRole('button', { name: 'Pick a date' })).toBeTruthy();
  });
});

describe('Popover', () => {
  it('accepts Base UI positioning props through content', () => {
    render(
      <Popover defaultOpen>
        <PopoverTrigger>Open</PopoverTrigger>
        <PopoverContent
          align="start"
          alignOffset={4}
          arrowPadding={6}
          collisionAvoidance={{ side: 'shift', align: 'shift', fallbackAxisSide: 'none' }}
          collisionBoundary={document.body}
          collisionPadding={8}
          positionMethod="fixed"
          sticky
        >
          Positioned popover
        </PopoverContent>
      </Popover>,
    );

    expect(screen.getByText('Positioned popover')).toBeTruthy();
  });
});

const RUNNING_STATUS: StatusPresentation = {
  label: 'Running',
  tone: 'success',
  description: 'The server is live.',
};

describe('StatusDot popover', () => {
  it('stays open when the pointer enters its content before the leave delay', () => {
    vi.useFakeTimers();
    const view = render(<StatusDot status="running" presentation={() => RUNNING_STATUS} />);
    const hoverTarget = view.container.firstElementChild;

    expect(hoverTarget).not.toBeNull();
    if (!hoverTarget) throw new Error('Status dot hover target was not rendered');

    fireEvent.mouseEnter(hoverTarget);
    expect(screen.getByText('The server is live.')).toBeTruthy();

    fireEvent.mouseLeave(hoverTarget);
    act(() => vi.advanceTimersByTime(119));
    expect(screen.getByText('The server is live.')).toBeTruthy();

    fireEvent.mouseEnter(screen.getByText('The server is live.'));
    act(() => vi.advanceTimersByTime(1));
    expect(screen.getByText('The server is live.')).toBeTruthy();

    fireEvent.mouseLeave(screen.getByText('The server is live.'));
    act(() => vi.advanceTimersByTime(120));
    expect(screen.queryByText('The server is live.')).toBeNull();
  });
});
