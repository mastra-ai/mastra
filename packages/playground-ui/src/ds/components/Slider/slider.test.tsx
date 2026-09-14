// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Slider } from './slider';

afterEach(cleanup);

describe('Slider accessible focus targets', () => {
  it('names the actual keyboard focus target', () => {
    render(<Slider aria-label="Temperature" defaultValue={[40]} />);
    expect(screen.getByLabelText('Temperature').getAttribute('aria-valuenow')).toBe('40');
  });

  it('labels both vertical range thumbs through the visible label', () => {
    render(
      <>
        <span id="range-label">Range</span>
        <Slider aria-labelledby="range-label" defaultValue={[25, 75]} orientation="vertical" />
      </>,
    );
    const thumbs = screen.getAllByLabelText('Range');
    expect(thumbs.map(thumb => thumb.getAttribute('aria-valuenow'))).toEqual(['25', '75']);
    expect(thumbs.every(thumb => thumb.getAttribute('aria-orientation') === 'vertical')).toBe(true);
  });
});
