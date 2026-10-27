// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { SeriesMark } from './series-mark';

describe('SeriesMark', () => {
  afterEach(() => cleanup());

  it('draws a color square without an icon, and the icon in the series color with one', () => {
    const { container, rerender } = render(<SeriesMark color="rgb(1, 2, 3)" />);
    const square = container.querySelector<HTMLElement>('[data-slot="series-mark"]');
    expect(square?.style.background).toBe('rgb(1, 2, 3)');
    expect(square?.childElementCount).toBe(0);

    rerender(<SeriesMark color="rgb(1, 2, 3)" icon={<svg data-testid="logo" />} />);
    const box = container.querySelector<HTMLElement>('[data-slot="series-mark"]');
    expect(box?.style.color).toBe('rgb(1, 2, 3)');
    expect(box?.querySelector('[data-testid="logo"]')).not.toBeNull();
  });
});
