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

  it('keeps the concentric frame and inset when a later class overrides the visible radius or padding', () => {
    expect(cn('concentric-frame-xl concentric-inset-1', 'rounded-none p-0')).toBe(
      'concentric-frame-xl concentric-inset-1 rounded-none p-0',
    );
  });
});
