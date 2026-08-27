// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { MessageRow } from '../message-row';

afterEach(() => cleanup());

describe('MessageRow', () => {
  it('keeps the assistant and its steps on the left', () => {
    render(<MessageRow testId="row">answer</MessageRow>);

    expect(screen.getByTestId('row').getAttribute('data-side')).toBe('left');
  });

  it('sends the user to the right', () => {
    render(
      <MessageRow side="right" testId="row">
        question
      </MessageRow>,
    );

    expect(screen.getByTestId('row').getAttribute('data-side')).toBe('right');
  });

  it('states time, duration and usage below the message', () => {
    render(
      <MessageRow testId="row" meta={['10:00:00', '1.5 s', '120 ↑ / 30 ↓ tokens']}>
        answer
      </MessageRow>,
    );

    const row = screen.getByTestId('row');
    const meta = screen.getByTestId('message-row-meta');

    expect(meta.textContent).toBe('10:00:00 · 1.5 s · 120 ↑ / 30 ↓ tokens');
    // Quiet by default: it keeps its space, but only shows on hover or focus.
    expect(meta.className).toContain('opacity-0');
    expect(meta.className).toContain('group-hover/message-row:opacity-100');
    // Below, so the message is read before it is measured.
    expect(row.textContent?.indexOf('answer')).toBeLessThan(row.textContent?.indexOf('10:00:00') ?? -1);
  });

  it('omits the meta line when there is nothing to measure', () => {
    render(
      <MessageRow testId="row" meta={[]}>
        answer
      </MessageRow>,
    );

    expect(screen.queryByTestId('message-row-meta')).toBeNull();
  });

  it('renders the trailing action beside the message', () => {
    render(
      <MessageRow testId="row" action={<button type="button">comment</button>}>
        answer
      </MessageRow>,
    );

    expect(screen.getByRole('button', { name: 'comment' })).toBeDefined();
  });
});
