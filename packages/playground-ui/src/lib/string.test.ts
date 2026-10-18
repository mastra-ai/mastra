import { describe, expect, it } from 'vitest';
import { pluralize } from './string';

describe('pluralize', () => {
  it.each([
    [0, 'deploy', undefined, '0 deploys'],
    [1, 'deploy', undefined, '1 deploy'],
    [2, 'deploy', undefined, '2 deploys'],
    [1204, 'line', undefined, '1,204 lines'],
    [1, 'entry', 'entries', '1 entry'],
    [3, 'entry', 'entries', '3 entries'],
  ])('pluralize(%d, %s, %s) is %s', (amount, singular, plural, expected) => {
    expect(pluralize(amount, singular, plural)).toBe(expected);
  });
});
