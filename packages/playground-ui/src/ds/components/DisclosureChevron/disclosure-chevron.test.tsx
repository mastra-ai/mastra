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
  it('points down and bends up while its trigger or details element is open by default', () => {
    const svg = renderChevron(<DisclosureChevron />);

    expect(svg.classList.contains('[--disclosure-chevron-bend:-1]')).toBe(false);
    expect(svg.classList.contains('in-aria-expanded:[--disclosure-chevron-bend:-1]')).toBe(true);
    expect(svg.classList.contains('in-[details[open]>summary]:[--disclosure-chevron-bend:-1]')).toBe(true);
  });

  it('points up and bends down while its trigger or details element is open', () => {
    const svg = renderChevron(<DisclosureChevron direction="up" />);

    expect(svg.classList.contains('[--disclosure-chevron-bend:-1]')).toBe(true);
    expect(svg.classList.contains('in-aria-expanded:[--disclosure-chevron-bend:1]')).toBe(true);
    expect(svg.classList.contains('in-[details[open]>summary]:[--disclosure-chevron-bend:1]')).toBe(true);
  });

  it('points right and turns 90° while its trigger is expanded', () => {
    const svg = renderChevron(<DisclosureChevron direction="right" />);

    expect(svg.dataset.centralIcon).toBe('IconChevronRightMedium');
    expect(svg.classList.contains('in-aria-expanded:rotate-90')).toBe(true);
  });

  it.each([
    { direction: 'down', closed: undefined, opened: '[--disclosure-chevron-bend:-1]' },
    { direction: 'up', closed: '[--disclosure-chevron-bend:-1]', opened: '[--disclosure-chevron-bend:1]' },
  ] as const)(
    'follows an explicit open state instead of the trigger when pointing $direction',
    ({ direction, closed, opened }) => {
      const bends = (ui: React.ReactElement) =>
        [...renderChevron(ui).classList].filter(name => name.includes('--disclosure-chevron-bend:'));

      expect(bends(<DisclosureChevron direction={direction} open={false} />)).toEqual(closed ? [closed] : []);
      cleanup();
      expect(bends(<DisclosureChevron direction={direction} open />)).toEqual([opened]);
    },
  );

  it('is hidden from assistive technology', () => {
    const svg = renderChevron(<DisclosureChevron />);

    expect(svg.getAttribute('aria-hidden')).toBe('true');
  });
});
