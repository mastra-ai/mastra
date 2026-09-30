// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { registerCustomTheme, resolveTheme, getSharedHighlighter } from '@pierre/diffs';

const PIERRE_THEMES = [
  'pierre-light',
  'pierre-dark',
  'pierre-light-soft',
  'pierre-dark-soft',
  'pierre-light-vibrant',
  'pierre-dark-vibrant',
  'pierre-light-protanopia-deuteranopia',
  'pierre-dark-protanopia-deuteranopia',
  'pierre-light-tritanopia',
  'pierre-dark-tritanopia',
] as const;

const loaders: Record<string, () => Promise<unknown>> = {
  'pierre-light': () => import('@pierre/theme/pierre-light'),
  'pierre-dark': () => import('@pierre/theme/pierre-dark'),
  'pierre-light-soft': () => import('@pierre/theme/pierre-light-soft'),
  'pierre-dark-soft': () => import('@pierre/theme/pierre-dark-soft'),
  'pierre-light-vibrant': () => import('@pierre/theme/pierre-light-vibrant'),
  'pierre-dark-vibrant': () => import('@pierre/theme/pierre-dark-vibrant'),
  'pierre-light-protanopia-deuteranopia': () =>
    import('@pierre/theme/pierre-light-protanopia-deuteranopia'),
  'pierre-dark-protanopia-deuteranopia': () =>
    import('@pierre/theme/pierre-dark-protanopia-deuteranopia'),
  'pierre-light-tritanopia': () => import('@pierre/theme/pierre-light-tritanopia'),
  'pierre-dark-tritanopia': () => import('@pierre/theme/pierre-dark-tritanopia'),
};

// Matches the shape PierreFileSurface.tsx now uses in production: hand Pierre
// the whole module and let its `createTheme` do unwrapDefault + normalizeTheme.
for (const name of PIERRE_THEMES) {
  registerCustomTheme(name, (() => loaders[name]!()) as never);
}

describe('EXACT production theme wiring (module-return loader)', () => {
  it.each(PIERRE_THEMES)('resolves "%s" without throwing', async themeName => {
    let err: unknown;
    try {
      await resolveTheme(themeName);
    } catch (e) {
      err = e;
    }
    // eslint-disable-next-line no-console
    if (err) console.log(`[probe] FAIL ${themeName} -> ${(err as Error).message}`);
    expect(err).toBeUndefined();
  });

  it('highlights TypeScript with pierre-light and returns multiple colours', async () => {
    const highlighter = await getSharedHighlighter({
      themes: ['pierre-light'] as unknown as never,
      langs: ['typescript'] as unknown as never,
    });
    const result = highlighter.codeToTokens(
      "const x: number = 42;\nfunction foo(): string { return 'hi'; }",
      { lang: 'typescript', theme: 'pierre-light' as unknown as never },
    );
    const colours = [...new Set(result.tokens.flat().map(t => t.color).filter(Boolean))];
    // eslint-disable-next-line no-console
    console.log('[probe] TS token colours:', colours);
    expect(colours.length).toBeGreaterThan(2);
  });
});
