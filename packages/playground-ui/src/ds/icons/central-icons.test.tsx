// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import * as centralIcons from './central';
import manifest from './central/central-icons.json';

afterEach(() => {
  cleanup();
});

function viewBoxOf(name: string) {
  const Glyph = Object.entries(centralIcons).find(([key]) => key === name)?.[1];
  if (!Glyph) throw new Error(`No Central icon named ${name}`);
  const { container } = render(<Glyph />);
  return container.querySelector('svg')?.getAttribute('viewBox');
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

  it('only insets icons that are in the generated set', () => {
    const missing = Object.keys(manifest.opticalInset).filter(name => !manifest.icons.includes(name));
    expect(missing).toEqual([]);
  });
});
