import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { colorFoundationTokens } from './color-foundations-catalog';
import { BorderColors, Colors } from './colors';

const themeFiles = ['theme.css', 'theme/colors.css', 'theme/status.css', 'theme/data-viz.css', 'theme/surfaces.css'];

const themeVariables = themeFiles
  .flatMap(file =>
    [...readFileSync(new URL(`../../../${file}`, import.meta.url), 'utf8').matchAll(/^\s*--([\w-]+)\s*:/gm)].map(
      match => match[1],
    ),
  )
  .filter((token): token is string => token !== undefined);

const themeColorTokens = themeVariables.filter(token => {
  if (token.startsWith('color-')) return token.startsWith('color-brand-');
  return !token.startsWith('elevation-') && !token.startsWith('shadow-') && token !== 'fill-tint';
});

describe('color foundations catalog', () => {
  it('lists every color variable defined by the shared theme exactly once', () => {
    expect(new Set(colorFoundationTokens)).toEqual(new Set(themeColorTokens));
    expect(new Set(colorFoundationTokens).size).toBe(colorFoundationTokens.length);
  });

  it('includes every Tailwind color exposed by the shared theme', () => {
    const exportedVariables = new Set([...Object.values(Colors), ...Object.values(BorderColors)]);
    const exposedVariables = themeVariables
      .filter(token => token.startsWith('color-'))
      .map(token => `var(--${token.startsWith('color-brand-') ? token : token.slice(6)})`);

    expect(exportedVariables).toEqual(new Set(exposedVariables));
  });
});
