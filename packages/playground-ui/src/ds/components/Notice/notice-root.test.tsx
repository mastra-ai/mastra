// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, assert, describe, expect, it } from 'vitest';

import { Notice } from './Notice';

// Wrapping, truncation, the surface rim and grain are verified in Storybook
// with browser layout measurements; jsdom cannot prove those visual behaviors.

afterEach(cleanup);

describe('NoticeRoot', () => {
  it('renders numeric content in a row instead of leaking falsy values into the layout', () => {
    const { container } = render(
      <Notice variant="info" title={0} action={0}>
        {0}
      </Notice>,
    );

    expect(screen.getAllByText('0')).toHaveLength(3);
    expect(container.querySelector('svg')?.parentElement?.parentElement?.textContent).toBe('0');
  });

  it('places the icon beside the message when the action contains only empty children', () => {
    const { container } = render(
      <Notice variant="info" title="Heads up" action={[false, undefined, '']}>
        A message
      </Notice>,
    );

    expect(container.querySelector('svg')?.parentElement?.parentElement?.textContent).toBe('A message');
    expect(container.textContent).toBe('Heads upA message');
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

    assert(container.firstElementChild, 'Expected the notice');
    expect(container.firstElementChild.classList.contains('my-own-class')).toBe(true);
  });

  describe('the icon follows the last row', () => {
    const rowOfIcon = (container: HTMLElement) => container.querySelector('svg')?.parentElement?.parentElement;

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
