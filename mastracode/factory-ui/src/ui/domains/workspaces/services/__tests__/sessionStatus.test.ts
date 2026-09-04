import { describe, expect, it } from 'vitest';

import { chatSessionPhase, sessionRowStatus } from '../sessionStatus';

const idle = {
  sessionError: false,
  threadError: false,
  hasThread: true,
  running: false,
  initializing: false,
  pending: false,
};

describe('sessionRowStatus', () => {
  it('shows a sandbox still coming up over the run already registered on it', () => {
    expect(sessionRowStatus({ running: true, initializing: true })).toBe('initializing');
    expect(sessionRowStatus({ running: true, initializing: false })).toBe('working');
  });

  it('lets a live run outrank a card waiting on a person, and runs no marker when idle', () => {
    expect(sessionRowStatus({ running: true, initializing: false, attention: true })).toBe('working');
    expect(sessionRowStatus({ running: false, initializing: false, attention: true })).toBe('ready');
    expect(sessionRowStatus({ running: false, initializing: false })).toBeUndefined();
  });
});

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
