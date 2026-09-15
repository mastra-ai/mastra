// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { Popover, PopoverContent, PopoverTrigger } from './popover';
import { Button } from '@/ds/components/Button';

afterEach(() => {
  cleanup();
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
        <PopoverTrigger variant="ghost" size="xs">
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
