// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { Popover, PopoverContent, PopoverTrigger } from './popover';

afterEach(() => {
  cleanup();
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
