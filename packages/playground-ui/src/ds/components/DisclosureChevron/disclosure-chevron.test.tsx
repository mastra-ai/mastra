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
  it('points right and turns 90° while its trigger is expanded', () => {
    const svg = renderChevron(<DisclosureChevron direction="right" />);

    expect(svg.dataset.centralIcon).toBe('IconChevronRightMedium');
    expect(svg.classList.contains('in-aria-expanded:rotate-90')).toBe(true);
  });

  it('is hidden from assistive technology', () => {
    const svg = renderChevron(<DisclosureChevron />);

    expect(svg.getAttribute('aria-hidden')).toBe('true');
  });
});
