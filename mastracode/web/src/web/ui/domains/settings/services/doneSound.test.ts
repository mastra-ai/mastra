// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';

import { loadDoneSound, playDoneSound, saveDoneSound } from './doneSound';

afterEach(() => {
  localStorage.clear();
});

describe('doneSound', () => {
  it('defaults to the chime when nothing is stored', () => {
    expect(loadDoneSound()).toBe('chime');
  });

  it('round-trips a saved preference', () => {
    saveDoneSound('fanfare');
    expect(loadDoneSound()).toBe('fanfare');
    saveDoneSound('none');
    expect(loadDoneSound()).toBe('none');
  });

  it('ignores unknown stored values', () => {
    localStorage.setItem('mastracode.doneSound', 'airhorn');
    expect(loadDoneSound()).toBe('chime');
  });

  it('never throws when audio is unavailable', () => {
    // jsdom has no AudioContext; playback must stay a silent no-op.
    expect(() => playDoneSound('chime')).not.toThrow();
    expect(() => playDoneSound('arcade')).not.toThrow();
    expect(() => playDoneSound('fanfare')).not.toThrow();
    expect(() => playDoneSound('none')).not.toThrow();
  });
});
