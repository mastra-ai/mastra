import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BorderRadius } from './ds/tokens/borders';
import { FontSizes, LetterSpacings, LineHeights } from './ds/tokens/fonts';
import { Spacings } from './ds/tokens/spacings';

// Guards the @mastra/playground-ui/theme.css contract: it must ship as RAW,
// uncompiled CSS (with the `@theme {}` directive intact) so a consumer's own
// Tailwind v4 compiler can read the tokens and generate the design-system
// utilities. If it were compiled (e.g. pointed at dist/style.css), the @theme
// directive would be stripped and consumers could no longer generate utilities.
const pkgRoot = resolve(__dirname, '..');
const pkg = JSON.parse(readFileSync(resolve(pkgRoot, 'package.json'), 'utf8'));

describe('theme.css export', () => {
  const themeCss = readFileSync(resolve(pkgRoot, 'theme.css'), 'utf8');
  const tokensCss = readFileSync(resolve(pkgRoot, 'tokens.css'), 'utf8');

  it('ships raw (uncompiled) with the @theme directive intact', () => {
    expect(themeCss).toMatch(/@theme\s*\{/);
    expect(themeCss).toMatch(/:root\s*\{/);
    // A compiled Tailwind stylesheet opens with the version banner — this must not.
    expect(themeCss).not.toMatch(/^\/\*!\s*tailwindcss/);
    // Token definitions only — no generated utility classes.
    expect(themeCss).not.toMatch(/\.bg-surface-primary\b/);
  });

  it('overrides the green palette the native v4 way (initial + remap)', () => {
    expect(themeCss).toContain('--color-green-500: initial;');
    expect(themeCss).toContain('--color-green-500: var(--brand-green-500);');
  });

  it('is exported from the package root, not the compiled dist bundle', () => {
    expect(pkg.exports['./theme.css']).toBe('./theme.css');
    expect(pkg.exports['./theme.css']).not.toContain('dist');
    expect(pkg.files).toContain('tokens.css');
    expect(pkg.files).toContain('theme.css');
  });

  it('loads the generated foundation and semantic colors', () => {
    expect(themeCss).toContain("@import './tokens.css'");
    expect(tokensCss).toContain('--background-2: oklch(0.1591 0 0)');
    expect(tokensCss).toContain('--surface-primary: var(--background-1)');
    expect(tokensCss).toContain('--text-secondary: var(--gray-9)');
    expect(tokensCss).toContain('--color-success: var(--green-9)');
    expect(tokensCss).toContain('--chart-6: var(--yellow-7)');
    expect(tokensCss).toContain('--color-chart-6: var(--chart-6)');
  });

  it('keeps Paper dimensions identical in CSS and TypeScript', () => {
    expect(BorderRadius).toMatchObject({ sm: '4px', md: '6px', lg: '10px', xl: '14px', full: '999px' });
    expect(Spacings).toMatchObject({ '1': '0.25rem', '2': '0.5rem', '4': '1rem', '8': '2rem', '16': '4rem' });
    expect(FontSizes).toMatchObject({ 'ui-xs': '0.625rem', 'ui-md': '0.875rem', 'header-xl': '1.75rem' });
    expect(LineHeights).toMatchObject({ 'ui-xs': '1rem', 'ui-md': '1.25rem', 'header-xl': '2.25rem' });
    expect(LetterSpacings).toEqual({ tight: '-0.01em', normal: '0em', caps: '0.08em' });
    expect(tokensCss).toContain('--space-16: 4rem');
    expect(tokensCss).toContain('--radius-lg: 10px');
    expect(tokensCss).toContain('--leading-ui-md: 1.25rem');
    expect(tokensCss).toContain('--tracking-caps: 0.08em');
  });
});
