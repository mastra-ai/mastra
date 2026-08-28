import { readdirSync, readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const componentsDir = resolve(__dirname, '../components');

const collectComponentSources = (directory: string): string[] =>
  readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) return collectComponentSources(path);
    const isSource = entry.name.endsWith('.tsx') && !entry.name.includes('.test.') && !entry.name.includes('.stories.');
    return isSource ? [path] : [];
  });

describe('floating positioning contract', () => {
  it('defaults every Base UI Positioner to the shared FLOATING_POSITION_METHOD', () => {
    const positionerSources = collectComponentSources(componentsDir)
      .map(file => ({ file, source: readFileSync(file, 'utf8') }))
      .filter(({ source }) => source.includes('.Positioner'));

    expect(positionerSources.length).toBeGreaterThanOrEqual(7);

    const missing = positionerSources
      .filter(({ source }) => !source.includes('FLOATING_POSITION_METHOD'))
      .map(({ file }) => relative(componentsDir, file));
    expect(missing).toEqual([]);
  });
});
