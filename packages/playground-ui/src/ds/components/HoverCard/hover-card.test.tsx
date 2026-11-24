// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';

import { HoverCard, HoverCardContent, HoverCardTrigger } from './hover-card';

afterEach(() => {
  cleanup();
});

describe('HoverCard', () => {
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

  it('waits for the pointer by default, and opens at once with delay="instant"', async () => {
    const user = userEvent.setup();
    render(
      <>
        <HoverCard>
          <HoverCardTrigger>Commit</HoverCardTrigger>
          <HoverCardContent>Commit details</HoverCardContent>
        </HoverCard>
        <HoverCard>
          <HoverCardTrigger delay="instant">Reason</HoverCardTrigger>
          <HoverCardContent>Score reason</HoverCardContent>
        </HoverCard>
      </>,
    );

    await user.hover(screen.getByText('Commit'));
    expect(screen.queryByText('Commit details')).toBeNull();
    await screen.findByText('Commit details');

    await user.hover(screen.getByText('Reason'));
    expect(screen.getByText('Score reason')).toBeTruthy();
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
