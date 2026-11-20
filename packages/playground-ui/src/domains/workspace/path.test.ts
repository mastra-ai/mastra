import { describe, expect, it } from 'vitest';
import { trimDotSlashPath, trimEdgeSlashes } from './path';

describe('workspace path trimming', () => {
  it('keeps a folder name and drops only the slashes around it', () => {
    expect(trimEdgeSlashes('/docs/guides/')).toBe('docs/guides');
    expect(trimEdgeSlashes('docs/guides')).toBe('docs/guides');
    expect(trimEdgeSlashes('./docs/')).toBe('./docs');
    expect(trimEdgeSlashes('//')).toBe('');
  });

  it('treats a leading ./ as part of the slash trim in the new-folder dialog', () => {
    expect(trimDotSlashPath('./docs/guides/')).toBe('docs/guides');
    expect(trimDotSlashPath('/docs/')).toBe('docs');
    expect(trimDotSlashPath('../docs')).toBe('../docs');
    expect(trimDotSlashPath('././docs/')).toBe('./docs');
    expect(trimDotSlashPath('./')).toBe('');
    expect(trimDotSlashPath('.../docs')).toBe('.../docs');
  });

  it('trims a very long slash run without stalling', () => {
    const slashes = '/'.repeat(100_000);
    const started = Date.now();
    expect(trimEdgeSlashes(`${slashes}docs/guides${slashes}`)).toBe('docs/guides');
    expect(trimDotSlashPath(`.${slashes}docs${slashes}`)).toBe('docs');
    expect(Date.now() - started).toBeLessThan(500);
  });
});
