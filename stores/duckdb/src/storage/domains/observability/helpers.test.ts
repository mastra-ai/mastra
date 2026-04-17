import { describe, expect, it } from 'vitest';
import { toDate } from './helpers';

describe('observability helpers', () => {
  it('toDate throws for invalid dates', () => {
    expect(() => toDate('not-a-date')).toThrow('Expected valid date but received invalid date');
  });
});
