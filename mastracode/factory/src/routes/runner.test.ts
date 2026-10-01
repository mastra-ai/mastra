import { describe, expect, it } from 'vitest';

import { normalizePtyArtifacts } from './runner.js';

describe('normalizePtyArtifacts', () => {
  it('passes plain output through unchanged', () => {
    expect(normalizePtyArtifacts('first\nsecond')).toBe('first\nsecond');
  });

  it('keeps only the final repaint of \\r-rewritten progress lines', () => {
    expect(normalizePtyArtifacts('progress 10%\rprogress 50%\rprogress 100%\ndone')).toBe('progress 100%\ndone');
  });

  it("erases BSD script's literal ^D + backspace echo from the stdin EOF", () => {
    expect(normalizePtyArtifacts('^D\b\bfirst\nsecond')).toBe('first\nsecond');
  });

  it('applies backspace erasure within a line', () => {
    expect(normalizePtyArtifacts('abcd\b\bXY')).toBe('abXY');
  });

  it('does not let backspaces eat across line boundaries', () => {
    expect(normalizePtyArtifacts('first\n\b\bsecond')).toBe('first\nsecond');
  });
});
