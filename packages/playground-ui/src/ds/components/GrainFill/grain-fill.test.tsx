// @vitest-environment jsdom

import { cleanup, render } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { afterEach, assert, describe, expect, it } from 'vitest';

import { GrainFill } from './grain-fill';

afterEach(cleanup);

describe('GrainFill', () => {
  it('renders on the server without a theme provider or drawing API', () => {
    const markup = renderToString(<GrainFill tone="warning" width={464} height={200} />);

    expect(markup).toContain('aria-hidden="true"');
    expect(markup).toContain('data-grain-tone="warning"');
  });

  it('forwards the caller class and hides the decorative layer from assistive technology', () => {
    const { container } = render(<GrainFill tone="warning" width={464} height={200} className="my-fill" />);
    const layer = container.firstElementChild;
    assert(layer instanceof HTMLElement, 'Expected the fill layer');

    expect(layer.getAttribute('aria-hidden')).toBe('true');
    expect(layer.classList.contains('my-fill')).toBe(true);
  });

  it('resolves fixed brand colors in the Tailwind namespace', () => {
    const { container } = render(<GrainFill tone="brand-purple" width={464} height={200} />);
    const layer = container.firstElementChild;
    assert(layer instanceof HTMLElement, 'Expected the fill layer');

    expect(layer.style.getPropertyValue('--grain-ink')).toBe('var(--color-brand-purple)');
  });

  it('updates the color token and dimensions when the props change', () => {
    const { container, rerender } = render(<GrainFill tone="warning" width={464} height={200} />);
    const layer = container.firstElementChild;
    assert(layer instanceof HTMLElement, 'Expected the fill layer');

    rerender(<GrainFill tone="chart-purple" width={800} height={240} />);
    expect(layer.dataset.grainTone).toBe('color');
    expect(layer.style.getPropertyValue('--grain-ink')).toBe('var(--chart-purple)');
    expect(layer.style.getPropertyValue('--grain-width')).toBe('800px');
    expect(layer.style.getPropertyValue('--grain-height')).toBe('240px');

    rerender(<GrainFill tone="success" width={464} height={200} />);
    expect(layer.dataset.grainTone).toBe('success');
    expect(layer.style.getPropertyValue('--grain-ink')).toBe('');
  });
});
