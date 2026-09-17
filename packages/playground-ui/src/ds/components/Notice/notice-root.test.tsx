// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, assert, describe, expect, it } from 'vitest';

import { Notice } from './Notice';

// jsdom has no layout engine, so scrollWidth cannot prove the overflow here.
// These assert the guards that keep an unbreakable token inside the box:
// `min-w-0` down the flex chain and `wrap-anywhere` on the text.
const gitRemoteFailure =
  "could not set 'remote.origin.url' to 'https://x-access-token:ghs_EXAMPLEtokenaGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9@github.com/mastra-ai/mastra.git'";

const classesOf = (element: Element | null, label: string) => {
  assert(element, `Expected ${label}`);
  return [...element.classList];
};

afterEach(cleanup);

describe('NoticeRoot', () => {
  it('lets a message with no break opportunity wrap inside the box', () => {
    render(<Notice variant="destructive">{gitRemoteFailure}</Notice>);

    const message = screen.getByText(gitRemoteFailure);
    expect(classesOf(message, 'the message')).toEqual(expect.arrayContaining(['wrap-anywhere', 'min-w-0']));
    expect(classesOf(message.parentElement, 'the icon/message row')).toContain('min-w-0');
  });

  it('applies the same guard to the titled variant', () => {
    render(
      <Notice variant="destructive" title="Workspace unavailable">
        <Notice.Message>{gitRemoteFailure}</Notice.Message>
      </Notice>,
    );

    const body = screen.getByText(gitRemoteFailure).parentElement;
    expect(classesOf(body, 'the message body')).toEqual(expect.arrayContaining(['wrap-anywhere', 'min-w-0']));
  });

  it('truncates a long title instead of wrapping it out of the fixed-height row', () => {
    const title = 'A title long enough to outgrow the notice width on its own';
    render(<Notice variant="warning" title={title} />);

    const titleElement = screen.getByText(title);
    expect(classesOf(titleElement, 'the title')).toContain('truncate');
    expect(classesOf(titleElement.parentElement, 'the title row')).toContain('min-w-0');
  });

  it.each([
    ['success', 'bg-notice-success/20', 'text-notice-success-fg'],
    ['destructive', 'bg-notice-destructive/20', 'text-notice-destructive-fg'],
    ['warning', 'bg-notice-warning/20', 'text-notice-warning-fg'],
    ['info', 'bg-notice-info/20', 'text-notice-info-fg'],
    ['note', 'bg-notice-note', 'text-notice-note-fg'],
  ] as const)('tints a %s notice with its own tokens', (variant, background, foreground) => {
    const { container } = render(<Notice variant={variant}>A message</Notice>);

    const classes = classesOf(container.firstElementChild, 'the notice');
    expect(classes).toContain(background);
    expect(classes).toContain(foreground);
  });

  it('gives each variant its own icon', () => {
    const iconOf = (variant: 'success' | 'destructive' | 'warning' | 'info' | 'note') => {
      const { container, unmount } = render(<Notice variant={variant}>A message</Notice>);
      const name = container.querySelector('svg')?.getAttribute('class') ?? '';
      unmount();
      return name;
    };

    const icons = (['success', 'destructive', 'warning', 'info', 'note'] as const).map(iconOf);

    expect(icons.every(Boolean)).toBe(true);
    expect(new Set(icons).size).toBe(icons.length);
  });

  it('lets the caller replace the icon', () => {
    render(
      <Notice variant="info" icon={<span data-testid="my-icon">!</span>}>
        A message
      </Notice>,
    );

    expect(screen.getByTestId('my-icon')).toBeTruthy();
    // The variant icon steps aside rather than doubling up.
    expect(document.querySelectorAll('svg')).toHaveLength(0);
  });

  it('keeps a caller class alongside its own', () => {
    const { container } = render(
      <Notice variant="info" className="my-own-class">
        A message
      </Notice>,
    );

    const classes = classesOf(container.firstElementChild, 'the notice');
    expect(classes).toContain('my-own-class');
    expect(classes).toContain('rounded-2xl');
  });

  describe('without a title', () => {
    it('renders nothing where the message would be when it has none', () => {
      const { container } = render(<Notice variant="info" />);

      expect(container.textContent).toBe('');
    });

    it('places the action beside the message', () => {
      render(
        <Notice variant="info" action={<button type="button">Retry</button>}>
          A message
        </Notice>,
      );

      // One action only — the untitled layout has a single slot for it.
      const actions = screen.getAllByRole('button', { name: 'Retry' });
      expect(actions).toHaveLength(1);
      // Its own slot, so it can go full width when the row stacks.
      expect(actions[0]?.parentElement?.className).toContain('[&>button]:w-full');
    });

    it('leaves no empty action slot behind when there is no action', () => {
      const { container } = render(<Notice variant="info">A message</Notice>);

      expect(container.querySelector('[class*="[&>button]:w-full"]')).toBeNull();
    });
  });

  describe('with a title', () => {
    it('shows the action twice so one is visible at every width', () => {
      render(
        <Notice variant="info" title="Heads up" action={<button type="button">Retry</button>}>
          <Notice.Message>A message</Notice.Message>
        </Notice>,
      );

      // The titled layout corners the action on wide screens and stacks it on
      // narrow ones; each copy is hidden at the other width.
      const actions = screen.getAllByRole('button', { name: 'Retry' });
      expect(actions).toHaveLength(2);
      expect(actions[0]?.parentElement?.className).toContain('@md:block');
      expect(actions[1]?.parentElement?.className).toContain('@md:hidden');
    });

    it('leaves out the body entirely when there is neither message nor action', () => {
      const { container } = render(<Notice variant="info" title="Heads up" />);

      expect(screen.getByText('Heads up')).toBeTruthy();
      expect(screen.queryByRole('button')).toBeNull();
      // No empty body div under the title row, which would add its own gap.
      expect(container.querySelector('.wrap-anywhere')).toBeNull();
    });
  });
});
