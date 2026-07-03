// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { HoverCard, HoverCardContent, HoverCardTrigger } from './hover-card';

afterEach(() => {
  cleanup();
});

describe('HoverCard', () => {
  it('renders the trigger', () => {
    render(
      <HoverCard>
        <HoverCardTrigger>Hover me</HoverCardTrigger>
        <HoverCardContent>Card content</HoverCardContent>
      </HoverCard>,
    );

    expect(screen.getByText('Hover me')).toBeTruthy();
  });

  it('keeps the content unmounted while closed', () => {
    render(
      <HoverCard>
        <HoverCardTrigger>Hover me</HoverCardTrigger>
        <HoverCardContent>Card content</HoverCardContent>
      </HoverCard>,
    );

    expect(screen.queryByText('Card content')).toBeNull();
  });

  it('renders the content when open', () => {
    render(
      <HoverCard defaultOpen>
        <HoverCardTrigger>Hover me</HoverCardTrigger>
        <HoverCardContent>Card content</HoverCardContent>
      </HoverCard>,
    );

    expect(screen.getByText('Card content')).toBeTruthy();
  });

  it('accepts Base UI positioning props through content', () => {
    render(
      <HoverCard defaultOpen>
        <HoverCardTrigger>Hover me</HoverCardTrigger>
        <HoverCardContent
          align="start"
          alignOffset={4}
          arrowPadding={6}
          collisionAvoidance={{ side: 'shift', align: 'shift', fallbackAxisSide: 'none' }}
          collisionBoundary={document.body}
          collisionPadding={8}
          positionMethod="fixed"
          sticky
        >
          Positioned content
        </HoverCardContent>
      </HoverCard>,
    );

    expect(screen.getByText('Positioned content')).toBeTruthy();
  });

  it('forwards className to the content popup', () => {
    render(
      <HoverCard defaultOpen>
        <HoverCardTrigger>Hover me</HoverCardTrigger>
        <HoverCardContent className="custom-content">Card content</HoverCardContent>
      </HoverCard>,
    );

    expect(screen.getByText('Card content').classList.contains('custom-content')).toBe(true);
  });

  it('projects the trigger onto an existing element via render', () => {
    render(
      <HoverCard>
        <HoverCardTrigger render={<button type="button">Custom trigger</button>} />
        <HoverCardContent>Card content</HoverCardContent>
      </HoverCard>,
    );

    expect(screen.getByRole('button', { name: 'Custom trigger' })).toBeTruthy();
  });
});
