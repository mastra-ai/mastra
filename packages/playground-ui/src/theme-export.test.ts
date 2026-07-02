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

  it('is exported from the package root, not the compiled dist bundle', () => {
    expect(pkg.exports['./theme.css']).toBe('./theme.css');
    expect(pkg.exports['./theme.css']).not.toContain('dist');
    expect(pkg.files).toContain('theme.css');
  });
});
