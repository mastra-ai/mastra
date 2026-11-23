// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { TooltipProvider } from '../Tooltip/tooltip';
import { Notice } from './Notice';

afterEach(cleanup);

describe('NoticeRoot', () => {
  it('renders numeric titles, messages and actions', () => {
    render(
      <Notice variant="info" title={0} action={0}>
        {0}
      </Notice>,
    );
    expect(screen.getAllByText('0')).toHaveLength(3);
  });

  it('renders no text or icon without content', () => {
    const { container } = render(<Notice variant="info" action={[false, undefined, '']} />);
    expect(container.textContent).toBe('');
    expect(container.querySelector('svg')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('keeps the distinct semantic icons for every supported tone', () => {
    const icons = (['success', 'destructive', 'warning', 'info', 'note'] as const).map(variant => {
      const { container, unmount } = render(<Notice variant={variant}>A message</Notice>);
      const icon = container.querySelector('svg')?.innerHTML;
      unmount();
      return icon;
    });
    expect(icons.every(Boolean)).toBe(true);
    expect(new Set(icons).size).toBe(5);
  });

  it('lets the caller replace the decorative icon', () => {
    render(
      <Notice variant="info" icon={<span data-testid="my-icon">!</span>}>
        A message
      </Notice>,
    );
    expect(screen.getByTestId('my-icon').closest('[aria-hidden]')).toBeTruthy();
    expect(document.querySelectorAll('svg')).toHaveLength(0);
  });

  it('leaves announcement semantics to the caller', () => {
    render(
      <Notice variant="destructive" role="alert">
        Couldn’t load scorers
      </Notice>,
    );
    expect(screen.getAllByRole('alert')).toHaveLength(1);
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('dismisses from the keyboard without submitting its form', async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    const onSubmit = vi.fn();
    render(
      <TooltipProvider>
        <form onSubmit={onSubmit}>
          <Notice variant="info" onDismiss={onDismiss}>
            Connection restored
          </Notice>
        </form>
      </TooltipProvider>,
    );
    screen.getByRole('button', { name: 'Dismiss notice' }).focus();
    await user.keyboard('{Enter}');
    expect(onDismiss).toHaveBeenCalledOnce();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
