import { describe, expect, it, beforeEach } from 'vitest';
import {
  luminance,
  contrastRatio,
  ensureContrast,
  getContrastText,
  mastraBrand,
  mastra,
  applyThemeMode,
} from '../theme.js';

describe('luminance', () => {
  it('returns 0 for black', () => {
    expect(luminance('#000000')).toBeCloseTo(0, 5);
  });

  it('returns 1 for white', () => {
    expect(luminance('#ffffff')).toBeCloseTo(1, 5);
  });

  it('returns ~0.2159 for mid-grey (#808080)', () => {
    // sRGB mid-grey has luminance ~0.2159
    expect(luminance('#808080')).toBeCloseTo(0.2159, 2);
  });
});

describe('contrastRatio', () => {
  it('returns 21:1 for black and white', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 0);
  });

  it('returns 1:1 for same color', () => {
    expect(contrastRatio('#ff0000', '#ff0000')).toBeCloseTo(1, 5);
  });

  it('is symmetric', () => {
    const r1 = contrastRatio('#2563eb', '#020202');
    const r2 = contrastRatio('#020202', '#2563eb');
    expect(r1).toBeCloseTo(r2, 5);
  });
});

describe('ensureContrast', () => {
  it('returns original color when contrast is sufficient', () => {
    // White on black: 21:1, way above 4.5
    expect(ensureContrast('#ffffff', '#000000')).toBe('#ffffff');
  });

  it('adjusts color when contrast is insufficient on dark bg', () => {
    const darkBg = '#020202';
    const original = '#2563eb'; // blue, low contrast on dark
    const adjusted = ensureContrast(original, darkBg);

    expect(adjusted).not.toBe(original);
    expect(contrastRatio(adjusted, darkBg)).toBeGreaterThanOrEqual(4.5);
  });

  it('adjusts color when contrast is insufficient on light bg', () => {
    const lightBg = '#ffffff';
    const original = '#e7e67b'; // yellow, low contrast on white
    const adjusted = ensureContrast(original, lightBg);

    expect(adjusted).not.toBe(original);
    expect(contrastRatio(adjusted, lightBg)).toBeGreaterThanOrEqual(4.5);
  });

  it('preserves hue direction (lightened result is brighter)', () => {
    const darkBg = '#020202';
    const original = '#2563eb'; // blue
    const adjusted = ensureContrast(original, darkBg);

    // Adjusted should be brighter (higher luminance) than original
    expect(luminance(adjusted)).toBeGreaterThan(luminance(original));
  });

  it('preserves hue direction (darkened result is dimmer)', () => {
    const lightBg = '#ffffff';
    const original = '#fdac53'; // orange
    const adjusted = ensureContrast(original, lightBg);

    // Adjusted should be dimmer (lower luminance) than original
    expect(luminance(adjusted)).toBeLessThan(luminance(original));
  });

  it('respects custom minimum ratio', () => {
    const darkBg = '#020202';
    const original = '#DC5663'; // red
    const adjusted = ensureContrast(original, darkBg, 7.0);
    expect(contrastRatio(adjusted, darkBg)).toBeGreaterThanOrEqual(7.0);
  });
});

describe('getContrastText', () => {
  it('returns white text for dark backgrounds', () => {
    expect(getContrastText('#000000')).toBe('#ffffff');
    expect(getContrastText('#020202')).toBe('#ffffff');
    expect(getContrastText('#1a1a1a')).toBe('#ffffff');
  });

  it('returns black text for light backgrounds', () => {
    expect(getContrastText('#ffffff')).toBe('#000000');
    expect(getContrastText('#f0f0f0')).toBe('#000000');
    expect(getContrastText('#cccccc')).toBe('#000000');
  });
});

describe('dark theme brand colors have sufficient contrast', () => {
  const darkBg = '#020202';

  beforeEach(() => {
    applyThemeMode('dark');
  });

  for (const [name, rawHex] of Object.entries(mastraBrand)) {
    it(`mastra.${name} (${rawHex}) has ≥4.5:1 contrast against dark bg`, () => {
      const adapted = (mastra as unknown as Record<string, string>)[name]!;
      const ratio = contrastRatio(adapted, darkBg);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });
  }
});

describe('light theme brand colors have sufficient contrast', () => {
  const lightBg = '#ffffff';

  beforeEach(() => {
    applyThemeMode('light');
  });

  for (const [name, rawHex] of Object.entries(mastraBrand)) {
    it(`mastra.${name} (${rawHex}) has ≥4.5:1 contrast against light bg`, () => {
      const adapted = (mastra as unknown as Record<string, string>)[name]!;
      const ratio = contrastRatio(adapted, lightBg);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });
  }
});

describe('mid-grey terminal background contrast', () => {
  const midGreyBg = '#4a4a5a';

  it('brand colors have ≥4.5:1 contrast against mid-grey bg in dark mode', () => {
    applyThemeMode('dark', midGreyBg);
    for (const [name] of Object.entries(mastraBrand)) {
      const adapted = (mastra as unknown as Record<string, string>)[name]!;
      const ratio = contrastRatio(adapted, midGreyBg);
      expect(ratio, `mastra.${name} = ${adapted}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('surface text colors have ≥4.5:1 contrast against mid-grey bg in dark mode', () => {
    applyThemeMode('dark', midGreyBg);
    for (const key of ['white', 'specialGray', 'mainGray', 'darkGray'] as const) {
      const adapted = (mastra as unknown as Record<string, string>)[key]!;
      const ratio = contrastRatio(adapted, midGreyBg);
      expect(ratio, `mastra.${key} = ${adapted}`).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe('surface greys have sufficient contrast', () => {
  it('dark mode darkGray has ≥4.5:1 contrast against dark bg', () => {
    applyThemeMode('dark');
    const ratio = contrastRatio(mastra.darkGray, '#020202');
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  it('dark mode mainGray has ≥4.5:1 contrast against dark bg', () => {
    applyThemeMode('dark');
    const ratio = contrastRatio(mastra.mainGray, '#020202');
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  it('light mode darkGray has ≥4.5:1 contrast against light bg', () => {
    applyThemeMode('light');
    const ratio = contrastRatio(mastra.darkGray, '#ffffff');
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  it('light mode mainGray has ≥4.5:1 contrast against light bg', () => {
    applyThemeMode('light');
    const ratio = contrastRatio(mastra.mainGray, '#ffffff');
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });
});
