import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { compile } from 'tailwindcss';
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

  it('ships raw (uncompiled) with the @theme directive intact', () => {
    expect(themeCss).toMatch(/@theme\s*\{/);
    expect(themeCss).toMatch(/:root\s*\{/);
    // A compiled Tailwind stylesheet opens with the version banner — this must not.
    expect(themeCss).not.toMatch(/^\/\*!\s*tailwindcss/);
    // Token definitions only — no generated utility classes.
    expect(themeCss).not.toMatch(/\.bg-background-1\b/);
  });

  it('overrides the green palette the native v4 way (initial + remap)', () => {
    expect(themeCss).toContain('--color-green-500: initial;');
    expect(themeCss).toContain('--color-green-500: var(--brand-green-500);');
  });

  it('is exported from the package root, not the compiled dist bundle', () => {
    expect(pkg.exports['./theme.css']).toBe('./theme.css');
    expect(pkg.exports['./theme.css']).not.toContain('dist');
    expect(pkg.files).not.toContain('tokens.css');
    expect(pkg.files).toContain('theme.css');
  });

  it('contains the generated foundation and derived interaction colors directly', () => {
    expect(themeCss).not.toContain("@import './tokens.css'");
    expect(themeCss).toContain('--background-2: oklch(0.1591 0 0)');
    expect(themeCss).toContain('--gray-alpha-3: rgb(255 255 255 / 10%)');
    expect(themeCss).toContain('--color-gray-10: var(--gray-10)');
    expect(themeCss).toContain('--surface-hover: color-mix(in oklch, var(--gray-9) 5%, transparent)');
    expect(themeCss).toContain('--surface-active: color-mix(in oklch, var(--gray-9) 10%, transparent)');
    expect(themeCss).not.toContain('--surface-primary:');
    expect(themeCss).not.toContain('--text-primary:');
    expect(themeCss).not.toContain('--border-subtle:');
  });

  it('generates Tailwind utilities from foundation and derived interaction colors', async () => {
    const compiler = await compile(`${themeCss}\n@tailwind utilities;`);
    const output = compiler.build(['border-gray-alpha-3', 'text-gray-10', 'hover:bg-surface-hover']);

    expect(output).toContain('.border-gray-alpha-3');
    expect(output).toContain('border-color: var(--gray-alpha-3)');
    expect(output).toContain('.text-gray-10');
    expect(output).toContain('color: var(--gray-10)');
    expect(output).toContain('.hover\\:bg-surface-hover');
    expect(output).toContain('background-color: var(--surface-hover)');
  });

  it('keeps Paper dimensions identical in CSS and TypeScript', () => {
    expect(BorderRadius).toMatchObject({ sm: '4px', md: '6px', lg: '10px', xl: '14px', full: '999px' });
    expect(Spacings).toMatchObject({ '1': '0.25rem', '2': '0.5rem', '4': '1rem', '8': '2rem', '16': '4rem' });
    expect(FontSizes).toMatchObject({ 'ui-xs': '0.625rem', 'ui-md': '0.875rem', 'header-xl': '1.75rem' });
    expect(LineHeights).toMatchObject({ 'ui-xs': '1rem', 'ui-md': '1.25rem', 'header-xl': '2.25rem' });
    expect(LetterSpacings).toEqual({ tight: '-0.01em', normal: '0em', caps: '0.08em' });
    expect(themeCss).toContain('--space-16: 4rem');
    expect(themeCss).toContain('--radius-lg: 10px');
    expect(themeCss).toContain('--leading-ui-md: 1.25rem');
    expect(themeCss).toContain('--tracking-caps: 0.08em');
  });
});
