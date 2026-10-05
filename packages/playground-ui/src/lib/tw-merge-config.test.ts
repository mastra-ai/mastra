import { describe, expect, it } from 'vitest';
import { cn } from './utils';

describe('cn', () => {
  it('lets a concentric frame replace the radius and padding it overrides', () => {
    expect(cn('rounded-xl py-3', 'concentric-frame-xl concentric-inset-1')).toBe(
      'concentric-frame-xl concentric-inset-1',
    );
  });

  it('lets rounded-concentric replace another radius', () => {
    expect(cn('rounded-lg', 'rounded-concentric')).toBe('rounded-concentric');
  });
});
