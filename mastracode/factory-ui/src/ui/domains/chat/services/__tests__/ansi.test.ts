import { describe, expect, it } from 'vitest';

import { stripAnsi, stripSerializedAnsi } from '../ansi';

describe('stripAnsi', () => {
  it('removes color escape sequences from PTY output', () => {
    expect(stripAnsi('\u001b[1;38m{\u001b[m\n  \u001b[1;34m"title"\u001b[m: \u001b[32m"Fix bug"\u001b[m')).toBe(
      '{\n  "title": "Fix bug"',
    );
  });

  it('removes cursor and erase sequences', () => {
    expect(stripAnsi('progress\u001b[2K\u001b[1Gdone')).toBe('progressdone');
  });

  it('leaves plain text untouched', () => {
    expect(stripAnsi('plain output with [brackets] and 100% signs')).toBe(
      'plain output with [brackets] and 100% signs',
    );
  });
});

describe('stripSerializedAnsi', () => {
  it('removes JSON-escaped escape sequences from serialized results', () => {
    expect(stripSerializedAnsi('"\\u001b[32mok\\u001b[m all good"')).toBe('"ok all good"');
  });
});
