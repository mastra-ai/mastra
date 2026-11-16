import { expect, it } from 'vitest';
import { effectiveTextSearch } from './text-search';
it.each([
  ['', undefined],
  ['  ', undefined],
  ['ab', undefined],
  [' ABC ', 'abc'],
  ['ÄPFEL', 'Äpfel'],
  ['😀😀😀', '😀😀😀'],
  ['😀'.repeat(256), '😀'.repeat(256)],
  ['😀'.repeat(257), undefined],
  ['a%b_c', 'a%b_c'],
])('normalizes the existing search chip draft %j', (value, expected) => {
  expect(effectiveTextSearch(value)).toBe(expected);
});
