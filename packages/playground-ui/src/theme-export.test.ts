import { readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { compile } from 'tailwindcss';
import { resolveConfig } from 'vite';
import { describe, expect, it } from 'vitest';
import { BorderColors, Colors } from './ds/tokens/colors';
import { FontSizes } from './ds/tokens/fonts';
import { Shadows } from './ds/tokens/shadows';
import { Sizes } from './ds/tokens/sizes';

const pkgRoot = resolve(__dirname, '..');
const pkg = JSON.parse(readFileSync(resolve(pkgRoot, 'package.json'), 'utf8'));

const compileStylesheet = async (css: string, base: string) => {
  const config = await resolveConfig({ configFile: false, root: pkgRoot }, 'build');
  const resolveCss = config.createResolver({ conditions: ['style'], mainFields: ['style'] });
  return compile(css, {
    base,
    loadStylesheet: async (id, base) => {
      const path = await resolveCss(id, resolve(base, 'index.css'));
      if (!path) throw new Error(`Cannot resolve stylesheet: ${id}`);
      return { path, base: dirname(path), content: readFileSync(path, 'utf8') };
    },
    loadModule: async (id, base) => {
      const require = createRequire(resolve(base, 'package.json'));
      const path = require.resolve(id);
      return { path, base: dirname(path), module: require(path) };
    },
  });
};

const semanticTokens = [
  'background',
  'sidebar',
  'card',
  'popover',
  'muted',
  'foreground',
  'muted-foreground',
  'placeholder',
  'border',
  'ring',
  // The only chromatic pair in the contract. Everything else here is neutral.
  'destructive',
  'destructive-foreground',
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
  'input',
  'sidebar-foreground',
  'sidebar-accent',
  'sidebar-accent-foreground',
  'sidebar-border',
  'sidebar-ring',
  'sidebar-divider',
  'selected',
] as const;

const semanticAliases = {
  background: 'background-2',
  sidebar: 'background-1',
  card: 'background-3',
  popover: 'background-3',
  muted: 'gray-1',
  foreground: 'gray-10',
  'muted-foreground': 'gray-8',
  placeholder: 'gray-7',
  ring: 'border-focus',
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

const getThemeVariables = (themeCss: string) => {
  const themeRootBlock = themeCss.slice(themeCss.indexOf(':root {'), themeCss.indexOf('html.light'));
  const themeLightStart = themeCss.indexOf('html.light');
  const themeLightBlock = themeCss.slice(themeLightStart, themeCss.indexOf('\n}\n\n@theme', themeLightStart) + 2);
  const darkVariables = parseVariables(themeRootBlock);
  const lightVariables = new Map([...darkVariables, ...parseVariables(themeLightBlock)]);

  return { darkVariables, lightVariables };
};

const resolveToken = (token: string, variables: Map<string, string>, seen: string[] = []): string => {
  if (seen.includes(token)) throw new Error(`Token cycle: ${[...seen, token].join(' -> ')}`);
  const value = variables.get(token);
  if (!value) throw new Error(`Missing token: ${token}`);

  return value.replace(/var\(--([\w-]+)\)/g, (_, reference: string) =>
    resolveToken(reference, variables, [...seen, token]),
  );
};

const oklchLightness = (value: string) => {
  const lightness = value.match(/^oklch\(([\d.]+)%?\s+0(?:\.0+)?(?:%|\s)/)?.[1];
  if (!lightness) throw new Error(`Expected an achromatic oklch value, received ${value}`);
  const parsed = Number(lightness);
  return value.startsWith(`oklch(${lightness}%`) ? parsed / 100 : parsed;
};

const oklchAlpha = (value: string) => {
  const alpha = value.match(/\/\s*([\d.]+)(%?)\s*\)/);
  if (!alpha) return 1;
  return alpha[2] === '%' ? Number(alpha[1]) / 100 : Number(alpha[1]);
};

const toSrgb = (lightness: number) => {
  const linear = lightness ** 3;
  return linear <= 0.0031308 ? linear * 12.92 : 1.055 * linear ** (1 / 2.4) - 0.055;
};

const fromSrgb = (channel: number) =>
  (channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4) ** (1 / 3);

// A translucent edge has no lightness of its own: it composites in sRGB over
// whatever it sits on, so its contrast has to be measured per surface.
const compositeLightness = (value: string, backgroundLightness: number) => {
  const alpha = oklchAlpha(value);
  if (alpha === 1) return oklchLightness(value);

  return fromSrgb(toSrgb(oklchLightness(value)) * alpha + toSrgb(backgroundLightness) * (1 - alpha));
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
  const productionCss = readFileSync(resolve(pkgRoot, 'src/index.css'), 'utf8');

  it('ships raw (uncompiled) with the @theme directive intact', () => {
    expect(themeCss).toMatch(/@theme\s*\{/);
    expect(themeCss).toMatch(/:root\s*\{/);
    expect(themeCss).not.toMatch(/^\/\*!\s*tailwindcss/);
    expect(themeCss).not.toMatch(/\.bg-sidebar\b/);
  });

  it('overrides the green palette the native v4 way (initial + remap)', () => {
    expect(themeCss).toContain('--color-green-*: initial;');
    expect(themeCss).toContain('--color-green-500: var(--brand-green-500);');
  });

  it('exposes the background and gray foundation scales', () => {
    const [darkTheme, lightTheme] = themeCss.split('html.light');
    const darkColors = [
      ['background-1', 'oklch(0.1382 0 0)'],
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
    const { darkVariables, lightVariables } = getThemeVariables(themeCss);

    for (const [token, reference] of Object.entries(semanticAliases)) {
      expect(darkVariables.get(token)).toBe(`var(--${reference})`);
      expect(lightVariables.get(token)).toBe(`var(--${reference})`);
    }

    for (const token of semanticTokens) {
      expect(() => resolveToken(token, darkVariables)).not.toThrow();
      expect(() => resolveToken(token, lightVariables)).not.toThrow();
      expect(themeCss).toContain(`--color-${token}: var(--${token});`);
    }
  });

  it('declares one interaction ladder for both themes, flipped by the tint alone', () => {
    const [darkTheme, lightTheme] = themeCss.split('html.light');
    const ladder = ['fill-subtle', 'fill', 'fill-hover', 'fill-active', 'fill-strong'];
    const boundaries = ['border', 'border-strong', 'border-hover'];

    for (const token of [...ladder, ...boundaries]) {
      expect(darkTheme).toContain(`--${token}: oklch(var(--fill-tint)`);
      expect(lightTheme).not.toContain(`--${token}:`);
    }

    expect(darkTheme).toContain('--fill-tint: 100%');
    expect(lightTheme).toContain('--fill-tint: 20.5%');

    // Focus is the one rung that may not follow the tint: it is pinned to a
    // contrast floor, and shade at dark's alpha falls under it (see below).
    expect(darkTheme).toContain('--border-focus: oklch(var(--fill-tint) 0 0 / 40%)');
    expect(lightTheme).toContain('--border-focus: oklch(var(--fill-tint) 0 0 / 50%)');
  });

  // Two token sets that feed the same utility prefix cannot share a key. `overlay`
  // lived in both `Colors` and `Shadows`, so tailwind-merge read `shadow-overlay` as
  // a shadow *colour* and no call site could replace or cancel it — a `shadow-none`
  // beside it survived the merge and lost on source order instead.
  it('keeps one meaning per utility prefix across token namespaces', () => {
    const colorNames = new Set(Object.keys({ ...Colors, ...BorderColors }));

    expect(Object.keys(Shadows).filter(name => colorNames.has(name))).toEqual([]);
    expect(Object.keys(FontSizes).filter(name => colorNames.has(name))).toEqual([]);
  });

  // The rim has to be assembled by the utility, on the element. A custom property
  // holding `var(--surface-rim)` is substituted once where it is declared — the
  // root — so every descendant inherits a finished string and a focused field
  // could never repaint its own edge.
  it('assembles both elevations on the element, rim from its own token', async () => {
    const compiler = await compileStylesheet(productionCss, resolve(pkgRoot, 'src'));
    const output = compiler.build(['shadow-raised', 'shadow-overlay']);
    const [darkTheme, lightTheme] = themeCss.split('html.light');

    for (const elevation of ['raised', 'overlay']) {
      const rim = 'inset 0 0 0 1px var(--surface-rim)';
      const tint = 'inset 0 0 0 9999px var(--surface-tint)';
      expect(output).toContain(`box-shadow: var(--elevation-lip), ${rim}, ${tint}, var(--elevation-${elevation});`);
      for (const theme of [darkTheme, lightTheme]) {
        expect(theme).toMatch(new RegExp(`--elevation-${elevation}:`));
      }
    }

    // The rim sits below the divider in both themes: a boundary between two
    // surfaces needs less than a line drawn inside one.
    for (const theme of [darkTheme, lightTheme]) {
      expect(theme).toMatch(/--surface-rim:/);
      expect(theme).toMatch(/--surface-rim-focus:/);
      expect(theme).toMatch(/--elevation-lip:/);
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

  it('compiles utilities that resolve semantic tokens on the styled element', async () => {
    const compiler = await compileStylesheet(productionCss, resolve(pkgRoot, 'src'));
    const candidates = semanticTokens.flatMap(token => [
      `bg-${token}`,
      `text-${token}`,
      `border-${token}`,
      `ring-${token}`,
    ]);
    const output = compiler.build(candidates);

    for (const token of semanticTokens) {
      for (const [prefix, property] of [
        ['bg', 'background-color'],
        ['text', 'color'],
        ['border', 'border-color'],
        ['ring', '--tw-ring-color'],
      ]) {
        expect(output).toMatch(new RegExp(`\\.${prefix}-${token} \\{\\s*${property}: var\\(--${token}\\)`));
      }
    }
  });

  it('registers semantic utilities and their :root defaults in the shared bundle', async () => {
    const compiler = await compileStylesheet(productionCss, resolve(pkgRoot, 'src'));
    const output = compiler.build(semanticTokens.map(token => `bg-${token}`));

    for (const token of semanticTokens) {
      expect(output).toContain(`.bg-${token} {`);
      expect(output).toContain(`--${token}:`);
    }
  });

  it('keeps the focus ring over its 3:1 floor on every neutral product surface', () => {
    const { darkVariables, lightVariables } = getThemeVariables(themeCss);

    for (const variables of [darkVariables, lightVariables]) {
      const ring = resolveToken('ring', variables);
      for (const background of ['sidebar', 'background', 'card', 'muted']) {
        const backgroundLightness = oklchLightness(resolveToken(background, variables));
        const ringLightness = compositeLightness(ring, backgroundLightness);
        expect(wcagContrast(ringLightness, backgroundLightness)).toBeGreaterThanOrEqual(3);
      }
    }
  });

  // `sizes.ts` is the TypeScript mirror of the named spacing rungs, and
  // `tw-merge-config.ts` uses it as the whole named spacing scale: a rung
  // missing here silently stops `h-<rung>` from merging. Nothing derived the
  // two from one another, which is how `control-lg` came to say 1.75rem while the
  // CSS said 2rem, and how `icon-smd` existed only in CSS.
  it('mirrors every size rung between theme.css and the TypeScript scale', () => {
    const themeBlock = themeCss.slice(themeCss.indexOf('@theme'));

    for (const [rung, value] of Object.entries(Sizes)) {
      expect(themeBlock).toContain(`--spacing-${rung}: ${value};`);
    }

    for (const [, rung = ''] of themeBlock.matchAll(/--spacing-([a-z][\w-]*):/g)) {
      expect(Object.hasOwn(Sizes, rung), `--spacing-${rung} is declared but missing from sizes.ts`).toBe(true);
    }
  });

  // A rung declared in a per-utility namespace resolves for that utility only, so
  // `h-icon-md` would work while `w-icon-md` silently dropped. Every size utility
  // reads `--spacing-*`, so one declaration per rung serves all of them.
  it('declares every size rung in the spacing namespace alone', () => {
    const strayNamespaces = [
      ...themeCss.matchAll(/^\s*(--(?:min-|max-)?(?:height|width)-[\w-]+|--container-[\w-]+):/gm),
    ];

    expect(strayNamespaces.map(([, declaration]) => declaration)).toEqual([]);
  });

  // A `var()` inside an arbitrary value (`max-h-[min(var(--spacing-dropdown),60dvh)]`) is opaque
  // to Tailwind: nothing resolves it against the token registry, and an undefined custom property
  // with no fallback invalidates the whole declaration at computed-value time — the style vanishes
  // in silence. Renaming `--max-height-dropdown` did exactly that to every popup's height cap while
  // typecheck, the whole suite and the rendered stories all stayed green. Only fallback-less
  // references can fail this way: `var(--x, 60dvh)` degrades to its fallback by construction.
  it('declares every custom property the source references without a fallback', () => {
    // Base UI writes these on the element it owns, so no declaration exists to find here.
    const runtimeProperties = new Set([
      '--available-height',
      '--anchor-width',
      '--transform-origin',
      '--active-tab-left',
      '--active-tab-width',
      '--active-tab-height',
      '--collapsible-panel-height',
    ]);

    const stripComments = (source: string) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

    const sourceRoot = resolve(pkgRoot, 'src');
    const sources = readdirSync(sourceRoot, { recursive: true, encoding: 'utf8' })
      .filter(entry => /\.(css|ts|tsx)$/.test(entry))
      .map(entry => stripComments(readFileSync(resolve(sourceRoot, entry), 'utf8')));

    const declared = new Set<string>();
    const references = new Map<string, number>();

    for (const source of [stripComments(themeCss), ...sources]) {
      for (const [, property = ''] of source.matchAll(/(--[a-zA-Z][\w-]*)\s*:/g)) declared.add(property);
      // Written from JS as a style key: `style={{ '--bar-width': width }}`.
      for (const [, property = ''] of source.matchAll(/['"`](--[a-zA-Z][\w-]*)['"`]/g)) declared.add(property);
      for (const [, property = '', terminator] of source.matchAll(/var\((--[a-zA-Z][\w-]*)\s*([,)])/g)) {
        if (terminator === ')') references.set(property, (references.get(property) ?? 0) + 1);
      }
    }

    const undeclared = [...references.keys()].filter(
      // Tailwind declares its own `--tw-*` internals in the compiled output, not in source.
      property => !declared.has(property) && !runtimeProperties.has(property) && !property.startsWith('--tw-'),
    );

    expect(undeclared).toEqual([]);
    expect(references.size).toBeGreaterThan(100);
  });

  // Two tiers, because the two tones do different jobs. Ink carries the content and is held
  // to APCA's body-text level (Lc 60). Supporting text is a deliberate step back from ink —
  // at Lc 60 it reads as a second ink and the hierarchy collapses — so it is gated at Lc 40:
  // `--gray-8` measures Lc 45.0 on light and 43.7 on dark. That is under APCA's Lc 45 spot
  // reading for 13px text and is accepted knowingly: it clears WCAG AA for normal text on
  // every product surface, and it is the level Linear's own sidebar label sits at
  // (`lch(37.78)` light, `oklch(0.647)` dark). Supporting text never carries a fact that is
  // not also in the ink beside it.
  const apcaFloor: Record<string, number> = { foreground: 60, 'muted-foreground': 40 };

  it('meets text contrast gates on every neutral product surface', () => {
    const { darkVariables, lightVariables } = getThemeVariables(themeCss);

    for (const variables of [darkVariables, lightVariables]) {
      for (const [foreground, floor] of Object.entries(apcaFloor)) {
        const foregroundLightness = oklchLightness(resolveToken(foreground, variables));

        for (const background of ['sidebar', 'background', 'card', 'muted']) {
          const backgroundLightness = oklchLightness(resolveToken(background, variables));
          expect(wcagContrast(foregroundLightness, backgroundLightness)).toBeGreaterThanOrEqual(4.5);
          expect(Math.abs(apcaContrast(foregroundLightness, backgroundLightness))).toBeGreaterThanOrEqual(floor);
        }
      }
    }
  });

  it('keeps placeholder text perceivable on every neutral product surface', () => {
    const { darkVariables, lightVariables } = getThemeVariables(themeCss);

    for (const variables of [darkVariables, lightVariables]) {
      const placeholderLightness = oklchLightness(resolveToken('placeholder', variables));

      for (const background of ['sidebar', 'background', 'card', 'muted']) {
        const backgroundLightness = oklchLightness(resolveToken(background, variables));
        expect(wcagContrast(placeholderLightness, backgroundLightness)).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it('registers every @theme color with tailwind-merge, so cn() can resolve a conflict between two of them', () => {
    const exported = new Set(Object.keys({ ...Colors, ...BorderColors }));
    const themed = [...themeCss.matchAll(/--color-([\w-]+):/g)]
      .map(([, name = '']) => name)
      .filter(name => !name.endsWith('*'));

    expect(themed.length).toBeGreaterThan(50);
    expect(themed.filter(name => !exported.has(name))).toEqual([]);
  });

  it('ships the theme layer as a raw stylesheet', () => {
    expect(pkg.exports['./theme.css']).toBe('./theme.css');
    expect(pkg.exports['./theme.css']).not.toContain('dist');
    expect(pkg.files).toContain('theme.css');
  });
});
