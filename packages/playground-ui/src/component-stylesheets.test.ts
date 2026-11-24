import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const LAYER_ORDER = '@layer properties, theme, base, components, utilities;';

const firstLayerRule = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '').match(/@layer[^;{]*[;{]/)?.[0];

describe('component stylesheets', () => {
  it('declare the full layer order before opening a layer, so preflight never outranks them', () => {
    const misordered = readdirSync(__dirname, { recursive: true, encoding: 'utf8' })
      .filter(path => path.endsWith('.css'))
      .filter(path => {
        const first = firstLayerRule(readFileSync(join(__dirname, path), 'utf8'));
        return first !== undefined && first !== LAYER_ORDER;
      });

    expect(misordered).toEqual([]);
  });
});
