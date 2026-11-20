import { describe, expect, it } from 'vitest';

import { chatSessionPhase } from '../sessionStatus';

const idle = {
  sessionError: false,
  threadError: false,
  hasThread: true,
  running: false,
  initializing: false,
  pending: false,
};

describe('chatSessionPhase', () => {
  it('reports a live run as working even while history still loads', () => {
    expect(chatSessionPhase({ ...idle, running: true, initializing: true })).toBe('working');
  });

  it('holds an optimistic pending send below initialization', () => {
    expect(chatSessionPhase({ ...idle, pending: true, initializing: true })).toBe('initializing');
    expect(chatSessionPhase({ ...idle, pending: true })).toBe('working');
  });

  it('reports nothing before a thread exists, unless the session is initializing', () => {
    expect(chatSessionPhase({ ...idle, hasThread: false })).toBeUndefined();
    expect(chatSessionPhase({ ...idle, hasThread: false, initializing: true })).toBe('initializing');
  });

  it('lets a session error outrank everything, and a thread error outrank activity', () => {
    expect(chatSessionPhase({ ...idle, sessionError: true, running: true })).toBe('error');
    expect(chatSessionPhase({ ...idle, threadError: true, pending: true })).toBe('error');
  });

  it('settles to awaiting when nothing is happening', () => {
    expect(chatSessionPhase(idle)).toBe('awaiting');
  });
});
