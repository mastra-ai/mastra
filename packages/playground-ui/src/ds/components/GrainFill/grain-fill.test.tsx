// @vitest-environment jsdom

import { cleanup, render } from '@testing-library/react';
import { afterEach, assert, describe, expect, it } from 'vitest';

import { GrainFill } from './grain-fill';

afterEach(cleanup);

describe('GrainFill', () => {
  it('renders a decorative layer that stays empty when the browser cannot draw it', async () => {
    const { container } = render(<GrainFill tone="warning" width={464} height={200} className="my-fill" />);

    const layer = container.firstElementChild;
    assert(layer instanceof HTMLElement, 'Expected the fill layer');
    expect(layer.getAttribute('aria-hidden')).toBe('true');
    expect(layer.className).toBe('my-fill');

    await new Promise(resolve => setTimeout(resolve, 0));
    expect(layer.hasAttribute('data-ready')).toBe(false);
    expect(layer.style.backgroundImage).toBe('');
  });

  it('keeps the tuned ramp for status tones', () => {
    const { container } = render(<GrainFill tone="warning" width={464} height={200} />);
    const layer = container.firstElementChild;
    assert(layer instanceof HTMLElement, 'Expected the fill layer');
    expect(layer.dataset.grainTone).toBe('warning');
    expect(layer.style.getPropertyValue('--grain-ink')).toBe('');
  });

  it('derives the ramp from any color token', () => {
    const { container } = render(<GrainFill tone="chart-purple" width={464} height={200} />);
    const layer = container.firstElementChild;
    assert(layer instanceof HTMLElement, 'Expected the fill layer');
    expect(layer.dataset.grainTone).toBe('color');
    expect(layer.style.getPropertyValue('--grain-ink')).toBe('var(--chart-purple)');
  });
});
