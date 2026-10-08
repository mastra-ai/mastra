import { describe, expect, it } from 'vitest';
import { stageTintClass } from './components/BoardIcons';
import { stageTone } from './stages';

describe('stage tones', () => {
  it('matches open and merged pull request colors for Reviewing and Done', () => {
    expect(stageTone('review')).toBe('green');
    expect(stageTone('done')).toBe('purple');
  });

  it('tints built-in Reviewing and Done stages with the matching badge tokens', () => {
    expect(stageTintClass('review')).toBe('bg-badge-green-subtle');
    expect(stageTintClass('done')).toBe('bg-badge-purple-subtle');
  });

  it('keeps custom terminal phases on the success tint', () => {
    expect(stageTintClass('shipped', 'terminal')).toBe('bg-success-subtle');
  });
});
