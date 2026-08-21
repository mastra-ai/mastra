import { describe, expect, it } from 'vitest';
import { getAbortedTextAtSaveTime } from './map-results-step';

describe('getAbortedTextAtSaveTime', () => {
  it('keeps output observed after the abort signal but before persistence', () => {
    expect(getAbortedTextAtSaveTime('chunk-1 ', 'chunk-1 chunk-2 ')).toBe('chunk-1 chunk-2 ');
  });

  it('keeps a more complete terminal payload when it is ahead of streamed text', () => {
    expect(getAbortedTextAtSaveTime('chunk-1 chunk-2 ', 'chunk-1 ')).toBe('chunk-1 chunk-2 ');
  });
});
