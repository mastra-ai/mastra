import { beforeEach, describe, expect, it, vi } from 'vitest';

const codeToHtml = vi.hoisted(() =>
  vi.fn((value: string = '') => {
    const lines = value
      .split('\n')
      .map(line => `<span class="line">${line}</span>`)
      .join('\n');
    return `<pre><code>${lines}</code></pre>`;
  }),
);

vi.mock('shiki/core', () => ({
  createHighlighterCoreSync: () => ({ codeToHtml }),
}));

import { highlightCodeLines, languageForPath } from './tool-call-highlight';

describe('tool call highlighting', () => {
  beforeEach(() => codeToHtml.mockClear());

  it('highlights a multiline diff side in one Shiki call', () => {
    expect(highlightCodeLines('const a = 1;\nconst b = 2;', 'typescript')).toEqual(['const a = 1;', 'const b = 2;']);
    expect(codeToHtml).toHaveBeenCalledTimes(1);
  });

  it('ignores file extensions inherited from the prototype chain', () => {
    expect(languageForPath('file.Object')).toBeUndefined();
  });
});
