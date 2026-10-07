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

  describe('the icon follows the last row', () => {
    const rowOfIcon = (container: HTMLElement) => container.querySelector('svg')?.closest('[class*="gap-2"]');

    it('sits beside the action when there is one', () => {
      const { container } = render(
        <Notice variant="info" title="Heads up" action={<button type="button">Retry</button>}>
          <Notice.Message>A message</Notice.Message>
        </Notice>,
      );

      expect(screen.getAllByRole('button', { name: 'Retry' })).toHaveLength(1);
      expect(rowOfIcon(container)?.textContent).toBe('Retry');
    });

    it('drops onto the message when the action slot is empty', () => {
      const { container } = render(
        <Notice variant="info" title="Heads up">
          <Notice.Message>A message</Notice.Message>
        </Notice>,
      );

      expect(screen.queryByRole('button')).toBeNull();
      expect(rowOfIcon(container)?.textContent).toBe('A message');
    });

    it('sits beside the title when the title is all there is', () => {
      const { container } = render(<Notice variant="warning" title="Action required" />);

      expect(rowOfIcon(container)?.textContent).toBe('Action required');
      expect(container.querySelector('.wrap-anywhere')).toBeNull();
    });

    it('renders no text when there is nothing to say', () => {
      const { container } = render(<Notice variant="info" />);

      expect(container.textContent).toBe('');
    });
  });

  it('glows in the notice tone, except on a note', () => {
    const glowOf = (variant: 'warning' | 'note') => {
      const { container, unmount } = render(<Notice variant={variant}>A message</Notice>);
      const tone = container.querySelector('[data-grain-tone]')?.getAttribute('data-grain-tone') ?? null;
      unmount();
      return tone;
    };

    expect(glowOf('warning')).toBe('warning');
    expect(glowOf('note')).toBeNull();
  });
});
