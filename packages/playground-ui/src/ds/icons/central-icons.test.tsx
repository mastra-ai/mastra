// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import * as centralIcons from './central';
import manifest from './central/central-icons.json';

afterEach(() => {
  cleanup();
});

function renderIcon(name: string) {
  const Glyph = Object.entries(centralIcons).find(([key]) => key === name)?.[1];
  if (!Glyph) throw new Error(`No Central icon named ${name}`);
  const { container } = render(<Glyph />);
  const svg = container.querySelector('svg');
  if (!svg) throw new Error(`${name} rendered no svg`);
  return svg;
}

function viewBoxOf(name: string) {
  return renderIcon(name).getAttribute('viewBox');
}

function heaviestStrokeOf(name: string) {
  const widths = [...renderIcon(name).querySelectorAll('[stroke-width]')].map(node =>
    Number(node.getAttribute('stroke-width')),
  );
  return Math.max(...widths);
}

describe('Central icons', () => {
  it('draws an icon on the full 24-unit grid by default', () => {
    expect(viewBoxOf('IconPlusMedium')).toBe('0 0 24 24');
  });

  it('draws every icon in the optical inset table inside a padded grid', () => {
    for (const [name, inset] of Object.entries(manifest.opticalInset)) {
      expect(viewBoxOf(name), name).toBe(`${-inset} ${-inset} ${24 + 2 * inset} ${24 + 2 * inset}`);
    }
  });

  it('keeps the line weight of an inset icon at the 2-unit stroke the rest of the set draws', () => {
    expect(heaviestStrokeOf('IconPlusMedium')).toBe(2);
    for (const [name, inset] of Object.entries(manifest.opticalInset)) {
      expect(heaviestStrokeOf(name) * (24 / (24 + 2 * inset)), name).toBeCloseTo(2, 3);
    }
  });

  it('only insets icons that are in the generated set', () => {
    const missing = Object.keys(manifest.opticalInset).filter(name => !manifest.icons.includes(name));
    expect(missing).toEqual([]);
  });
});
