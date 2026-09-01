import { describe, expect, it } from 'vitest';

import { formatResumeHint, parseResumeThreadId, shouldRunHeadless } from './resume-command.js';

describe('resume command', () => {
  it('reads an explicit thread ID', () => {
    expect(parseResumeThreadId(['resume', 'thread-123'])).toBe('thread-123');
  });

  it('rejects an incomplete command', () => {
    expect(() => parseResumeThreadId(['resume'])).toThrow('Usage: mastracode resume <thread-id>');
  });

  it('keeps resume commands out of headless mode', () => {
    const argv = ['node', 'mastracode', 'resume', 'thread-123'];
    expect(shouldRunHeadless(argv, 'thread-123', true)).toBe(false);
    expect(shouldRunHeadless(['node', 'mastracode', '--prompt', 'hello'], undefined, true)).toBe(true);
  });

  it('formats the exit hint', () => {
    expect(formatResumeHint('thread-123')).toBe('To continue this session, run mastracode resume thread-123');
    expect(formatResumeHint("thread 'quoted'")).toBe(
      "To continue this session, run mastracode resume 'thread '\\''quoted'\\'''",
    );
  });

  it('escapes terminal control characters in the exit hint', () => {
    const hint = formatResumeHint("thread-\u001b[31m'\\name");

    expect(hint).toBe("To continue this session, run mastracode resume $'thread-\\x1b[31m\\'\\\\name'");
    expect(hint).not.toContain('\u001b');
  });
});
