// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cleanup, render } from '@testing-library/react';
import { createElement } from 'react';
import type { ComponentType } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

type ArtProps = { id: string };

const modules = import.meta.glob<Record<string, ComponentType<ArtProps>>>(
  ['./components/EmptyState/illustrations/*.tsx', './components/EmptyStateArt/art/*-scene.tsx'],
  { eager: true },
);
const drawings = Object.entries(modules).flatMap(([file, exports]) =>
  Object.entries(exports).map(([name, Art]) => ({ name, Art, scene: file.endsWith('-scene.tsx') })),
);

/** Steps of ink the `line-art` utility paints with an opaque color. */
const lineArtSteps = { 'stroke-opacity': ['0.35', '0.5', '0.7', '0.75'], opacity: ['0.5', '0.75'] };
/** The colors `empty-state-art.css` defines, all opaque. */
const sceneColor = 'var\\(--(?:line|face|detail|hole|packet|logo|smoke|muted|brand)\\)';
const scenePaint = new RegExp(
  `^(none|url\\(.*\\)|${sceneColor}|color-mix\\(in \\w+, ${sceneColor} \\d+%, ${sceneColor}\\))$`,
);

function paintedShapes(Art: ComponentType<ArtProps>) {
  const { container } = render(createElement('svg', null, createElement(Art, { id: 'art' })));
  const shapes = [...container.querySelectorAll('path, rect, circle, ellipse, line, polygon, polyline')];
  return shapes.filter(shape => !shape.closest('defs, mask, pattern, clipPath'));
}

// Two translucent lines add up to a brighter spot where they meet, so a drawing paints its lines opaque.
describe('illustration paint', () => {
  afterEach(cleanup);

  it.each(drawings.filter(({ scene }) => scene))('$name paints with the opaque scene colors only', ({ Art }) => {
    for (const shape of paintedShapes(Art)) {
      for (const attribute of ['opacity', 'stroke-opacity', 'fill-opacity']) {
        expect(shape.getAttribute(attribute), shape.outerHTML).toBeNull();
      }
      for (const attribute of ['stroke', 'fill']) {
        expect(shape.getAttribute(attribute) ?? 'none', shape.outerHTML).toMatch(scenePaint);
      }
    }
  });

  it.each(drawings.filter(({ scene }) => !scene))('$name dims its lines only in line-art steps', ({ Art }) => {
    for (const shape of paintedShapes(Art)) {
      for (const [attribute, steps] of Object.entries(lineArtSteps)) {
        expect([null, ...steps], shape.outerHTML).toContain(shape.getAttribute(attribute));
      }
      expect(shape.getAttribute('fill-opacity'), shape.outerHTML).toBeNull();
      // `line-art` repaints only a shape's own stroke or fill, not an inherited one.
      if (shape.hasAttribute('stroke-opacity')) expect(shape.hasAttribute('stroke'), shape.outerHTML).toBe(true);
      if (shape.hasAttribute('opacity')) {
        expect(shape.hasAttribute('stroke') || shape.getAttribute('fill') === 'currentColor', shape.outerHTML).toBe(
          true,
        );
      }
    }
  });

  it('keeps the scene line colors opaque when the stylesheet is generated again', () => {
    const css = readFileSync(resolve(import.meta.dirname, 'components/EmptyStateArt/empty-state-art.css'), 'utf8');
    const tokens = /\] \.art \{([^}]*)\}/.exec(css)?.[1];

    expect(tokens).toContain('--line:');
    expect(tokens).not.toMatch(/--(line|detail|smoke): var\(--color-/);
  });
});
