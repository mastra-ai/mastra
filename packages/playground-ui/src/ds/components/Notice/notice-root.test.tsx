// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef, useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import { Button } from '../Button/Button';
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

  it('ignores empty action content without losing the title or message', () => {
    render(
      <Notice variant="info" title="Heads up" action={[false, undefined, '']}>
        A message
      </Notice>,
    );
    expect(screen.getByText('Heads up')).toBeTruthy();
    expect(screen.getByText('A message')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('renders a title without requiring a message', () => {
    render(<Notice variant="warning" title="Action required" />);
    expect(screen.getByText('Action required')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('renders no text or icon without content', () => {
    const { container } = render(<Notice variant="info" />);
    expect(container.textContent).toBe('');
    expect(container.querySelector('svg')).toBeNull();
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

  it('forwards native semantics and refs without creating an extra live region', () => {
    const ref = createRef<HTMLDivElement>();
    render(
      <Notice
        ref={ref}
        variant="destructive"
        role="alert"
        aria-label="Registry failure"
        id="registry-error"
        className="caller-notice"
      >
        Couldn’t load scorers
      </Notice>,
    );
    expect(screen.getAllByRole('alert')).toHaveLength(1);
    expect(screen.getByRole('alert', { name: 'Registry failure' })).toBe(ref.current);
    expect(ref.current?.id).toBe('registry-error');
    expect(ref.current?.classList.contains('caller-notice')).toBe(true);
  });

  it.each(['below', 'end'] as const)(
    'keeps %s actions keyboard-operable without submitting their form',
    async actionPlacement => {
      const user = userEvent.setup();
      function RetryNotice() {
        const [result, setResult] = useState('Waiting');
        return (
          <form
            onSubmit={event => {
              event.preventDefault();
              setResult('Submitted');
            }}
          >
            <Notice
              variant="destructive"
              title="Couldn’t load scorers"
              actionPlacement={actionPlacement}
              action={
                <>
                  {actionPlacement === 'end' ? (
                    <Button type="button" onClick={() => setResult('Retried')}>
                      Retry
                    </Button>
                  ) : (
                    <Notice.Button onClick={() => setResult('Retried')}>Retry</Notice.Button>
                  )}
                  <Notice.Button render={<a href="#troubleshoot" />}>Troubleshoot</Notice.Button>
                  <Notice.Button disabled onClick={() => setResult('Disabled action ran')}>
                    Unavailable
                  </Notice.Button>
                </>
              }
            >
              Check your connection and retry.
            </Notice>
            <output>{result}</output>
          </form>
        );
      }
      render(<RetryNotice />);
      await user.tab();
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Retry' }));
      await user.keyboard('{Enter}');
      expect(screen.getByRole('status').textContent).toBe('Retried');
      await user.tab();
      expect(document.activeElement).toBe(screen.getByRole('link', { name: 'Troubleshoot' }));
      await user.tab();
      expect(document.activeElement).not.toBe(screen.getByRole('button', { name: 'Unavailable' }));
    },
  );
  it.each(['pointer', 'keyboard'] as const)(
    'dismisses only the requested notice by %s without submitting its form',
    async input => {
      const user = userEvent.setup();
      function DismissibleNotice() {
        const [visible, setVisible] = useState(true);
        const [submitted, setSubmitted] = useState(false);
        return (
          <TooltipProvider>
            <form
              onSubmit={event => {
                event.preventDefault();
                setSubmitted(true);
              }}
            >
              {visible && (
                <Notice variant="info" onDismiss={() => setVisible(false)}>
                  Connection restored
                </Notice>
              )}
              <Notice variant="warning">Keep this notice</Notice>
            </form>
            <output>{submitted ? 'Submitted' : 'Not submitted'}</output>
          </TooltipProvider>
        );
      }
      render(<DismissibleNotice />);
      const dismiss = screen.getByRole('button', { name: 'Dismiss notice' });
      if (input === 'keyboard') {
        await user.tab();
        expect(document.activeElement).toBe(dismiss);
        await user.keyboard('{Enter}');
      } else {
        await user.click(dismiss);
      }
      expect(screen.queryByText('Connection restored')).toBeNull();
      expect(screen.getByText('Keep this notice')).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Dismiss notice' })).toBeNull();
      expect(screen.getByRole('status').textContent).toBe('Not submitted');
    },
  );
});
