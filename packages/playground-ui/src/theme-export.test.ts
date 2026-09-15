import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Guards the @mastra/playground-ui/theme.css contract: it must ship as RAW,
// uncompiled CSS (with the `@theme {}` directive intact) so a consumer's own
// Tailwind v4 compiler can read the tokens and generate the design-system
// utilities. If it were compiled (e.g. pointed at dist/style.css), the @theme
// directive would be stripped and consumers could no longer generate utilities.
const pkgRoot = resolve(__dirname, '..');
const pkg = JSON.parse(readFileSync(resolve(pkgRoot, 'package.json'), 'utf8'));

describe('theme.css export', () => {
  const themeCss = readFileSync(resolve(pkgRoot, 'theme.css'), 'utf8');

  it('ships raw (uncompiled) with the @theme directive intact', () => {
    expect(themeCss).toMatch(/@theme\s*\{/);
    expect(themeCss).toMatch(/:root\s*\{/);
    // A compiled Tailwind stylesheet opens with the version banner — this must not.
    expect(themeCss).not.toMatch(/^\/\*!\s*tailwindcss/);
    // Token definitions only — no generated utility classes.
    expect(themeCss).not.toMatch(/\.bg-surface1\b/);
  });

  it('overrides the green palette the native v4 way (initial + remap)', () => {
    expect(themeCss).toContain('--color-green-*: initial;');
    expect(themeCss).toContain('--color-green-500: var(--brand-green-500);');
  });

  it('exposes the background and gray foundation scales', () => {
    const [darkTheme, lightTheme] = themeCss.split('html.light');
    const darkColors = [
      ['background-1', 'oklch(0 0 0)'],
      ['background-2', 'oklch(0.1591 0 0)'],
      ['gray-1', 'oklch(0.1913 0 0)'],
      ['gray-2', 'oklch(0.2178 0 0)'],
      ['gray-3', 'oklch(0.2435 0 0)'],
      ['gray-4', 'oklch(0.2686 0 0)'],
      ['gray-5', 'oklch(0.3092 0 0)'],
      ['gray-6', 'oklch(0.3715 0 0)'],
      ['gray-7', 'oklch(0.4495 0 0)'],
      ['gray-8', 'oklch(0.5208 0 0)'],
      ['gray-9', 'oklch(0.7699 0 0)'],
      ['gray-10', 'oklch(0.9851 0 0)'],
    ];
    const lightColors = [
      ['background-1', 'oklch(1 0 0)'],
      ['background-2', 'oklch(0.9851 0 0)'],
      ['gray-1', 'oklch(0.9642 0 0)'],
      ['gray-2', 'oklch(0.9431 0 0)'],
      ['gray-3', 'oklch(0.9189 0 0)'],
      ['gray-4', 'oklch(0.8945 0 0)'],
      ['gray-5', 'oklch(0.8452 0 0)'],
      ['gray-6', 'oklch(0.7604 0 0)'],
      ['gray-7', 'oklch(0.6201 0 0)'],
      ['gray-8', 'oklch(0.5486 0 0)'],
      ['gray-9', 'oklch(0.4459 0 0)'],
      ['gray-10', 'oklch(0.1286 0 0)'],
    ];

    for (const [token, value] of darkColors) {
      expect(darkTheme).toContain(`--${token}: ${value};`);
      expect(themeCss).not.toContain(`--color-${token}:`);
    }

    for (const [token, value] of lightColors) {
      expect(lightTheme).toContain(`--${token}: ${value};`);
    }

    const alphaTokens = [
      'gray-alpha-1',
      'gray-alpha-2',
      'gray-alpha-3',
      'gray-alpha-4',
      'gray-alpha-5',
      'gray-alpha-6',
      'gray-alpha-7',
      'gray-alpha-8',
      'gray-alpha-9',
      'gray-alpha-10',
    ];

    for (const token of alphaTokens) {
      expect(darkTheme).toContain(`--${token}: rgb(255 255 255 /`);
      expect(lightTheme).toContain(`--${token}: rgb(0 0 0 /`);
      expect(themeCss).not.toContain(`--color-${token}:`);
    }
  });

  it('is exported from the package root, not the compiled dist bundle', () => {
    expect(pkg.exports['./theme.css']).toBe('./theme.css');
    expect(pkg.exports['./theme.css']).not.toContain('dist');
    expect(pkg.files).toContain('theme.css');
  });
});
