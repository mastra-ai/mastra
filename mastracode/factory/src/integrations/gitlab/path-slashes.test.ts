import { describe, expect, it } from 'vitest';
import { trimEdgeSlashes } from './path-slashes';

describe('GitLab project path trimming', () => {
  it('keeps the namespace and drops only the slashes around it', () => {
    expect(trimEdgeSlashes('/group/project/')).toBe('group/project');
    expect(trimEdgeSlashes('group/project')).toBe('group/project');
    expect(trimEdgeSlashes('//')).toBe('');
  });

  it('trims a very long slash run without stalling', () => {
    const slashes = '/'.repeat(100_000);
    const started = Date.now();
    expect(trimEdgeSlashes(`${slashes}group/project${slashes}`)).toBe('group/project');
    expect(Date.now() - started).toBeLessThan(500);
  });
});