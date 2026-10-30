import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const ORDER = '@layer properties, theme, base, components, utilities;';

function cssFiles(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return cssFiles(path);
    return name.endsWith('.css') ? [path] : [];
  });
}

// Each component sheet ships as its own file in dist and can load before the host's Tailwind
// entry. The first sheet to open a layer fixes the layer ranks, so one that opens
// `@layer components {` first puts components below Tailwind's preflight in every host.
describe('component stylesheets', () => {
  const layered = cssFiles(here).filter(path => /@layer\s+\w+\s*\{/.test(readFileSync(path, 'utf8')));

  it.each(layered.map(path => [relative(here, path), path]))('%s states the full layer order first', (_name, path) => {
    const css = readFileSync(path, 'utf8');
    const order = css.indexOf(ORDER);
    expect(order).toBeGreaterThanOrEqual(0);
    expect(order).toBeLessThan(css.search(/@layer\s+\w+\s*\{/));
  });
});
