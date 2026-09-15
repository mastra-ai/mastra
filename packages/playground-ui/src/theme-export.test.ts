import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { compile } from 'tailwindcss';
import { describe, expect, it } from 'vitest';
import { BorderColors, Colors } from './ds/tokens/colors';

// Guards the @mastra/playground-ui/theme.css contract: it must ship as RAW,
// uncompiled CSS (with the `@theme {}` directive intact) so a consumer's own
// Tailwind v4 compiler can read the tokens and generate the design-system
// utilities. If it were compiled (e.g. pointed at dist/style.css), the @theme
// directive would be stripped and consumers could no longer generate utilities.
const pkgRoot = resolve(__dirname, '..');
const pkg = JSON.parse(readFileSync(resolve(pkgRoot, 'package.json'), 'utf8'));

const semanticTokens = [
  'background',
  'sidebar',
  'card',
  'popover',
  'muted',
  'foreground',
  'muted-foreground',
  'border',
  'ring',
  'sidebar-accent',
] as const;

const deferredSemanticTokens = [
  'card-foreground',
  'popover-foreground',
  'tertiary-foreground',
  'disabled-foreground',
  'contrast-foreground',
  'secondary',
  'secondary-foreground',
  'accent',
  'accent-foreground',
  'selected',
  'input',
  'sidebar-foreground',
  'sidebar-accent-foreground',
  'sidebar-border',
  'sidebar-ring',
] as const;

const darkAliases = {
  background: 'background-2',
  sidebar: 'background-1',
  card: 'background-3',
  popover: 'background-3',
  muted: 'gray-1',
  foreground: 'gray-10',
  'muted-foreground': 'gray-9',
  border: 'gray-alpha-2',
  ring: 'gray-8',
  'sidebar-accent': 'gray-alpha-2',
} as const;

const lightAliases = {
  ...darkAliases,
  border: 'gray-alpha-3',
} as const;

const parseVariables = (css: string) => {
  const variables = new Map<string, string>();

  for (const match of css.matchAll(/--([\w-]+):\s*([^;]+);/g)) {
    const name = match[1];
    const value = match[2]?.trim();
    if (name && value) variables.set(name, value);
  }

  return variables;
};

const resolveToken = (token: string, variables: Map<string, string>, seen: string[] = []): string => {
  if (seen.includes(token)) throw new Error(`Token cycle: ${[...seen, token].join(' -> ')}`);
  const value = variables.get(token);
  if (!value) throw new Error(`Missing token: ${token}`);
  const reference = value.match(/^var\(--([\w-]+)\)$/)?.[1];
  return reference ? resolveToken(reference, variables, [...seen, token]) : value;
};

const oklchLightness = (value: string) => {
  const lightness = value.match(/^oklch\(([\d.]+)%?\s+0(?:\.0+)?(?:%|\s)/)?.[1];
  if (!lightness) throw new Error(`Expected an achromatic oklch value, received ${value}`);
  const parsed = Number(lightness);
  return value.startsWith(`oklch(${lightness}%`) ? parsed / 100 : parsed;
};

const luminance = (lightness: number) => lightness ** 3;

const wcagContrast = (foreground: number, background: number) => {
  const [lighter = 0, darker = 0] = [luminance(foreground), luminance(background)].sort((left, right) => right - left);
  return (lighter + 0.05) / (darker + 0.05);
};

const apcaContrast = (foreground: number, background: number) => {
  const clamp = (value: number) => (value < 0.022 ? value + (0.022 - value) ** 1.414 : value);
  const foregroundY = clamp(luminance(foreground));
  const backgroundY = clamp(luminance(background));

  if (backgroundY > foregroundY) {
    const contrast = (backgroundY ** 0.56 - foregroundY ** 0.57) * 1.14;
    return contrast < 0.1 ? 0 : (contrast - 0.027) * 100;
  }

  const contrast = (backgroundY ** 0.65 - foregroundY ** 0.62) * 1.14;
  return contrast > -0.1 ? 0 : (contrast + 0.027) * 100;
};

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
      ['background-3', 'oklch(0.1913 0 0)'],
      ['gray-1', 'oklch(0.2178 0 0)'],
      ['gray-2', 'oklch(0.2435 0 0)'],
      ['gray-3', 'oklch(0.2686 0 0)'],
      ['gray-4', 'oklch(0.3092 0 0)'],
      ['gray-5', 'oklch(0.3715 0 0)'],
      ['gray-6', 'oklch(0.4495 0 0)'],
      ['gray-7', 'oklch(0.5208 0 0)'],
      ['gray-8', 'oklch(0.65 0 0)'],
      ['gray-9', 'oklch(0.7699 0 0)'],
      ['gray-10', 'oklch(0.9851 0 0)'],
    ];
    const lightColors = [
      ['background-1', 'oklch(0.9642 0 0)'],
      ['background-2', 'oklch(0.9851 0 0)'],
      ['background-3', 'oklch(1 0 0)'],
      ['gray-1', 'oklch(0.9431 0 0)'],
      ['gray-2', 'oklch(0.9189 0 0)'],
      ['gray-3', 'oklch(0.8945 0 0)'],
      ['gray-4', 'oklch(0.8452 0 0)'],
      ['gray-5', 'oklch(0.7604 0 0)'],
      ['gray-6', 'oklch(0.6201 0 0)'],
      ['gray-7', 'oklch(0.5486 0 0)'],
      ['gray-8', 'oklch(0.4459 0 0)'],
      ['gray-9', 'oklch(0.3092 0 0)'],
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

  it('defines the approved semantic alias graph in both themes', () => {
    const rootBlock = themeCss.slice(themeCss.indexOf(':root {'), themeCss.indexOf('html.light'));
    const lightStart = themeCss.indexOf('html.light');
    const lightBlock = themeCss.slice(lightStart, themeCss.indexOf('\n}\n\n@theme', lightStart) + 2);
    const rootVariables = parseVariables(rootBlock);
    const lightVariables = new Map([...rootVariables, ...parseVariables(lightBlock)]);

    for (const [token, reference] of Object.entries(darkAliases)) {
      expect(rootVariables.get(token)).toBe(`var(--${reference})`);
    }

    for (const [token, reference] of Object.entries(lightAliases)) {
      expect(lightVariables.get(token)).toBe(`var(--${reference})`);
    }

    for (const token of semanticTokens) {
      expect(() => resolveToken(token, rootVariables)).not.toThrow();
      expect(() => resolveToken(token, lightVariables)).not.toThrow();
      expect(themeCss).toContain(`--color-${token}: var(--${token});`);
    }
  });

  it('exports semantic tokens to TypeScript consumers', () => {
    const exportedColors = { ...Colors, ...BorderColors };

    for (const token of semanticTokens) {
      expect(exportedColors[token]).toBe(`var(--${token})`);
    }
  });

  it('keeps unproven semantic roles out of the contract', () => {
    const exportedColors = { ...Colors, ...BorderColors };

    for (const token of deferredSemanticTokens) {
      expect(themeCss).not.toContain(`--${token}:`);
      expect(themeCss).not.toContain(`--color-${token}:`);
      expect(Object.hasOwn(exportedColors, token)).toBe(false);
    }
  });

  it('keeps foundations out of TypeScript and Tailwind exports', () => {
    const colorSource = readFileSync(resolve(pkgRoot, 'src/ds/tokens/colors.ts'), 'utf8');

    for (const token of [
      'background-1',
      'background-2',
      'background-3',
      ...Array.from({ length: 10 }, (_, index) => `gray-${index + 1}`),
      ...Array.from({ length: 10 }, (_, index) => `gray-alpha-${index + 1}`),
    ]) {
      expect(themeCss).not.toContain(`--color-${token}:`);
      expect(colorSource).not.toContain(`var(--${token})`);
    }
  });

  it('compiles utilities for every semantic token', async () => {
    const compiler = await compile(`${themeCss}\n@tailwind utilities;`);
    const candidates = semanticTokens.flatMap(token => [
      `bg-${token}`,
      `text-${token}`,
      `border-${token}`,
      `ring-${token}`,
    ]);
    const output = compiler.build(candidates);

    for (const token of semanticTokens) {
      expect(output).toContain(`var(--${token})`);
    }
  });

  it('keeps the focus ring visible on every neutral product surface', () => {
    const rootBlock = themeCss.slice(themeCss.indexOf(':root {'), themeCss.indexOf('html.light'));
    const lightStart = themeCss.indexOf('html.light');
    const lightBlock = themeCss.slice(lightStart, themeCss.indexOf('\n}\n\n@theme', lightStart) + 2);
    const darkVariables = parseVariables(rootBlock);
    const lightVariables = new Map([...darkVariables, ...parseVariables(lightBlock)]);

    for (const variables of [darkVariables, lightVariables]) {
      const ringLightness = oklchLightness(resolveToken('ring', variables));
      for (const background of ['sidebar', 'background', 'card', 'muted']) {
        const backgroundLightness = oklchLightness(resolveToken(background, variables));
        expect(wcagContrast(ringLightness, backgroundLightness)).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it('meets text contrast gates on every neutral product surface', () => {
    const rootBlock = themeCss.slice(themeCss.indexOf(':root {'), themeCss.indexOf('html.light'));
    const lightStart = themeCss.indexOf('html.light');
    const lightBlock = themeCss.slice(lightStart, themeCss.indexOf('\n}\n\n@theme', lightStart) + 2);
    const darkVariables = parseVariables(rootBlock);
    const lightVariables = new Map([...darkVariables, ...parseVariables(lightBlock)]);

    for (const variables of [darkVariables, lightVariables]) {
      for (const foreground of ['foreground', 'muted-foreground']) {
        const foregroundLightness = oklchLightness(resolveToken(foreground, variables));

        for (const background of ['sidebar', 'background', 'card', 'muted']) {
          const backgroundLightness = oklchLightness(resolveToken(background, variables));
          expect(wcagContrast(foregroundLightness, backgroundLightness)).toBeGreaterThanOrEqual(4.5);
          expect(Math.abs(apcaContrast(foregroundLightness, backgroundLightness))).toBeGreaterThanOrEqual(60);
        }
      }
    }
  });

  it('is exported from the package root, not the compiled dist bundle', () => {
    expect(pkg.exports['./theme.css']).toBe('./theme.css');
    expect(pkg.exports['./theme.css']).not.toContain('dist');
    expect(pkg.files).toContain('theme.css');
  });
});
