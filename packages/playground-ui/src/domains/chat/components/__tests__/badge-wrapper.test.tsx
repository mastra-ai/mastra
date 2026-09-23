// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { ChatRunningContext } from '../../context/chat-context';
import { BadgeWrapper } from '../badge-wrapper';

afterEach(() => cleanup());

describe('BadgeWrapper', () => {
  it('reveals the body when the trigger is clicked', () => {
    render(
      <BadgeWrapper title="Ran tool">
        <span>tool output</span>
      </BadgeWrapper>,
    );

    fireEvent.click(screen.getByRole('button', { name: /ran tool/i }));
    expect(screen.getByText('tool output')).toBeTruthy();
  });

  it('keeps the body of a badge that cannot be collapsed visible', () => {
    render(
      <BadgeWrapper title="Working" collapsible={false}>
        <span>live output</span>
      </BadgeWrapper>,
    );

    expect(screen.getByText('live output')).toBeTruthy();
  });

  it('hides the body of a collapsible badge until it is opened', () => {
    render(
      <BadgeWrapper title="Ran tool">
        <span>tool output</span>
      </BadgeWrapper>,
    );

    expect(screen.queryByText('tool output')).toBeNull();
  });

  it('starts open when initialCollapsed is false and follows later changes', () => {
    const { rerender } = render(
      <BadgeWrapper title="Ran tool" initialCollapsed={false}>
        <span>tool output</span>
      </BadgeWrapper>,
    );
    expect(screen.getByText('tool output')).toBeTruthy();

    rerender(
      <BadgeWrapper title="Ran tool" initialCollapsed={true}>
        <span>tool output</span>
      </BadgeWrapper>,
    );
    expect(screen.queryByText('tool output')).toBeNull();
  });

  it('shows the detail next to the title only when provided', () => {
    const { rerender } = render(<BadgeWrapper title="Read file" detail="src/index.ts" />);
    expect(screen.getByText('src/index.ts')).toBeTruthy();

    rerender(<BadgeWrapper title="Read file" />);
    expect(screen.queryByText('src/index.ts')).toBeNull();
  });

  it('renders extraInfo outside the collapse trigger', () => {
    render(<BadgeWrapper title="Ran tool" extraInfo={<button type="button">Extra</button>} />);

    const extra = screen.getByRole('button', { name: 'Extra' });
    const trigger = screen.getByRole('button', { name: /ran tool/i });
    expect(trigger.contains(extra)).toBe(false);
  });

  it('uses the header override instead of the assembled title', () => {
    render(<BadgeWrapper title="Hidden title" header={<span>Custom header</span>} />);

    expect(screen.getByText('Custom header')).toBeTruthy();
    expect(screen.queryByText('Hidden title')).toBeNull();
  });

  it('shows the failure marker when the status is error', () => {
    render(<BadgeWrapper title="Ran tool" status="error" />);

    expect(screen.getByRole('img', { name: 'Failed' })).toBeTruthy();
  });

  it('does not show the failure marker for a non-error status', () => {
    render(<BadgeWrapper title="Ran tool" />);

    expect(screen.queryByRole('img', { name: 'Failed' })).toBeNull();
  });

  it('plays the enter animation only for badges that arrive while the chat is running', () => {
    render(
      <ChatRunningContext.Provider value={{ isRunning: true, cancelRun: () => {}, canSendWhileStreaming: false }}>
        <BadgeWrapper title="Live tool" data-testid="live-badge" />
      </ChatRunningContext.Provider>,
    );
    render(<BadgeWrapper title="Loaded tool" data-testid="loaded-badge" />);

    expect(screen.getByTestId('live-badge').className).toContain('animate-in');
    expect(screen.getByTestId('loaded-badge').className).not.toContain('animate-in');
  });
});
