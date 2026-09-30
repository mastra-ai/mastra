/**
 * Verifies the invariant Pierre's `resolveTheme` actually enforces:
 *   registered theme name === theme.name inside the theme JSON.
 *
 * If any registered ↔ JSON name pair mismatches, `resolveTheme` throws and
 * Shiki silently falls back to plain text — no syntax highlighting at all.
 * This test enumerates every Pierre theme we register in production so any
 * mismatch fails loudly instead of shipping as a broken editor.
 */
// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import {
  getSharedHighlighter,
  registerCustomTheme,
  resolveTheme,
} from '@pierre/diffs';

// Mirrors the PRODUCTION import map in PierreFileSurface.tsx.
const THEME_LOADERS: Record<string, () => Promise<{ default: unknown }>> = {
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

describe('Pierre theme name invariant', () => {
  it.each(Object.entries(THEME_LOADERS))(
    'registered "%s" matches theme.name inside the JSON',
    async (registeredName, loader) => {
      const mod = await loader();
      const theme = mod.default as { name?: string };
      // eslint-disable-next-line no-console
      console.log(`[probe] "${registeredName}" -> theme.name="${theme.name}"`);
      expect(theme.name).toBe(registeredName);
    },
  );

  it('each theme resolves through Pierre without throwing', async () => {
    // Register everything the way PierreFileSurface does.
    for (const [name, loader] of Object.entries(THEME_LOADERS)) {
      registerCustomTheme(name, async () => {
        const mod = await loader();
        return mod.default as never;
      });
    }
    const outcomes: Array<{ name: string; ok: boolean; error?: string }> = [];
    for (const name of Object.keys(THEME_LOADERS)) {
      try {
        await resolveTheme(name);
        outcomes.push({ name, ok: true });
      } catch (e) {
        outcomes.push({ name, ok: false, error: (e as Error).message });
      }
    }
    // eslint-disable-next-line no-console
    console.log('[probe] resolveTheme outcomes:', outcomes);
    const failed = outcomes.filter(o => !o.ok);
    expect(failed).toEqual([]);
  });

  it('highlighter produces distinct token colors for a JSON snippet', async () => {
    const highlighter = await getSharedHighlighter({
      themes: ['pierre-light'] as unknown as never,
      langs: ['json'] as unknown as never,
    });
    const result = highlighter.codeToTokens('{"foo": "bar"}', {
      lang: 'json',
      theme: 'pierre-light' as unknown as never,
    });
    const distinct = new Set(result.tokens.flat().map(t => t.color).filter(Boolean));
    // eslint-disable-next-line no-console
    console.log('[probe] distinct colors:', [...distinct]);
    expect(distinct.size).toBeGreaterThan(1);
  });
});
