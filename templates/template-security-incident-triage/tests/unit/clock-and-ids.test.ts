import { describe, expect, it } from 'vitest';

import { fixedClock, systemClock } from '../../src/domain/clock.js';
import { sequenceIdGenerator, uuidGenerator } from '../../src/domain/id-generator.js';

describe('deterministic domain dependencies', () => {
  it('supports fixed clocks and finite ID sequences', () => {
    expect(fixedClock('2026-08-27T12:00:00.000Z').now()).toBe('2026-08-27T12:00:00.000Z');
    const ids = sequenceIdGenerator(['one', 'two']);
    expect([ids.next(), ids.next()]).toEqual(['one', 'two']);
    expect(() => ids.next()).toThrow('ID sequence exhausted');
  });

  it('uses UTC and UUID defaults', () => {
    const now = systemClock.now();
    expect(new Date(now).toISOString()).toBe(now);
    expect(uuidGenerator.next()).toMatch(/^[0-9a-f-]{36}$/u);
  });
});
