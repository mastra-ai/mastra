import { readFileSync } from 'node:fs';
import { composeStories } from '@storybook/react-vite';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import * as colorStories from './color-foundations.stories';
import { BorderColors, Colors } from './colors';
import * as elevationStories from './elevation-foundations.stories';
import * as statusStories from './status-foundations.stories';
import * as surfaceStories from './surface-foundations.stories';

const themeFiles = ['theme.css', 'theme/colors.css', 'theme/status.css', 'theme/data-viz.css', 'theme/surfaces.css'];

const themeVariables = themeFiles.flatMap(file =>
  [...readFileSync(new URL(`../../../${file}`, import.meta.url), 'utf8').matchAll(/^\s*--([\w-]+)\s*:/gm)].map(
    match => match[1],
  ),
);

const isBrandColor = (token: string) => token.startsWith('color-brand-') && !themeVariables.includes(token.slice(6));

const themeColorTokens = themeVariables.filter(token => {
  if (!token) return false;
  if (token.startsWith('color-')) return isBrandColor(token);
  return !token.startsWith('elevation-') && !token.startsWith('shadow-') && token !== 'fill-tint';
});

const foundationPages = [
  ...Object.values(composeStories(colorStories)),
  ...Object.values(composeStories(statusStories)),
  ...Object.values(composeStories(surfaceStories)),
  ...Object.values(composeStories(elevationStories)),
];

describe('color foundations coverage', () => {
  it('names every shared theme color in its existing Foundations page', () => {
    const markup = foundationPages.map(Page => renderToStaticMarkup(<Page />)).join('');
    const namedTokens = [...markup.matchAll(/title="(--[\w-]+)"/g)].map(match => match[1]?.slice(2));

    expect(new Set(namedTokens)).toEqual(new Set(themeColorTokens));
    expect(namedTokens.length).toBe(new Set(namedTokens).size);
  });

  it('exposes every Tailwind color from the shared theme', () => {
    const exportedVariables = new Set([...Object.values(Colors), ...Object.values(BorderColors)]);
    const exposedVariables = themeVariables
      .filter(token => token?.startsWith('color-'))
      .map(token => `var(--${token && isBrandColor(token) ? token : token?.slice(6)})`);

    expect(exportedVariables).toEqual(new Set(exposedVariables));
  });
});
