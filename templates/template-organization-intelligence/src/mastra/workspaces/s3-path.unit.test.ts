import { describe, expect, it } from 'vitest';
import { trimEdgeSlashes } from './s3-path.js';

describe('S3 workspace paths', () => {
  it('treats a slash-only path as the bucket root and keeps interior slashes', () => {
    expect(trimEdgeSlashes('/reports/2024/')).toBe('reports/2024');
    expect(trimEdgeSlashes('///')).toBe('');
    expect(trimEdgeSlashes('reports')).toBe('reports');
  });

  it('trims a very long slash run without stalling', () => {
    const slashes = '/'.repeat(100_000);
    const started = Date.now();
    expect(trimEdgeSlashes(`${slashes}reports/2024${slashes}`)).toBe('reports/2024');
    expect(Date.now() - started).toBeLessThan(500);
  });
});
