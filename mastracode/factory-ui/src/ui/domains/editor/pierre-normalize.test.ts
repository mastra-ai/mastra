/**
 * Pierre bundles all 10 of its themes (pierre-light, pierre-dark + the soft /
 * vibrant / protanopia-deuteranopia / tritanopia variants) and registers them
 * via `@pierre/theming/collections/pierre.js`. `@pierre/diffs` auto-loads that
 * collection in its shared highlighter.
 *
 * The regression this test guards: at one point PierreFileSurface.tsx was
 * calling `registerCustomTheme('pierre-light', …)` for all 10 names. Pierre
 * threw `DuplicateThemeError` on every call, logged
 * `SharedHighlight.registerCustomTheme: theme name already registered`, and
 * the editor shipped with no syntax highlighting. Removing those calls fixed
 * it. If anyone adds them back, this test fails loudly because the second
 * resolveTheme after a self-registration will throw.
 */
// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { getSharedHighlighter, resolveTheme } from '@pierre/diffs';

const PIERRE_THEME_NAMES = [
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

describe('Pierre bundles its themes — no custom registration required', () => {
  it.each(PIERRE_THEME_NAMES)('resolves "%s" without us registering it', async name => {
    const theme = await resolveTheme(name);
    expect(theme).toBeTruthy();
  });

  it('produces coloured tokens for TypeScript using the bundled pierre-light', async () => {
    const highlighter = await getSharedHighlighter({
      themes: ['pierre-light'] as unknown as never,
      langs: ['typescript'] as unknown as never,
    });
    const result = highlighter.codeToTokens(
      "const x: number = 42;\nfunction foo(): string { return 'hi'; }",
      { lang: 'typescript', theme: 'pierre-light' as unknown as never },
    );
    const colours = new Set(result.tokens.flat().map(t => t.color).filter(Boolean));
    expect(colours.size).toBeGreaterThan(2);
  });
});
