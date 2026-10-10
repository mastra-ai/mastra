// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { DisclosureChevron } from './disclosure-chevron';

afterEach(() => {
  cleanup();
});

function renderChevron(ui: React.ReactElement) {
  const { container } = render(<button type="button">{ui}</button>);
  const svg = container.querySelector('svg');
  if (!svg) throw new Error('DisclosureChevron rendered no svg');
  return svg;
}

describe('DisclosureChevron', () => {
  it('points down and flips 180° while its trigger is expanded by default', () => {
    const svg = renderChevron(<DisclosureChevron />);

    expect(svg.classList.contains('lucide-chevron-down')).toBe(true);
    expect(svg.classList.contains('in-aria-expanded:rotate-180')).toBe(true);
  });

  it('points up and flips 180° while its trigger is expanded', () => {
    const svg = renderChevron(<DisclosureChevron direction="up" />);

    expect(svg.classList.contains('lucide-chevron-up')).toBe(true);
    expect(svg.classList.contains('in-aria-expanded:rotate-180')).toBe(true);
  });

  it('points right and turns 90° while its trigger is expanded', () => {
    const svg = renderChevron(<DisclosureChevron direction="right" />);

    expect(svg.classList.contains('lucide-chevron-right')).toBe(true);
    expect(svg.classList.contains('in-aria-expanded:rotate-90')).toBe(true);
  });

  it('follows an explicit open state instead of the trigger when given one', () => {
    const closed = renderChevron(<DisclosureChevron open={false} />);
    expect(closed.classList.contains('rotate-180')).toBe(false);
    expect(closed.classList.contains('in-aria-expanded:rotate-180')).toBe(false);
    cleanup();

    const open = renderChevron(<DisclosureChevron open />);
    expect(open.classList.contains('rotate-180')).toBe(true);
  });

  it('is hidden from assistive technology', () => {
    const svg = renderChevron(<DisclosureChevron />);

    expect(svg.getAttribute('aria-hidden')).toBe('true');
  });
});
