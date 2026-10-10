import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { summarize } from './total.mjs';

// Run these original tests after the agent edits total.mjs. Keep the tests unchanged.
test('sums all three orders', () => {
  assert.deepEqual(summarize(readFileSync(new URL('./orders.csv', import.meta.url), 'utf8')), {
    total: 42,
    row_count: 3,
  });
});
test('handles a single order', () => {
  assert.deepEqual(summarize('amount\n7\n'), { total: 7, row_count: 1 });
});
test('handles an empty file with a header', () => {
  assert.deepEqual(summarize('amount\n'), { total: 0, row_count: 0 });
});
test('includes refunds', () => {
  assert.deepEqual(summarize('amount\n9\n-2\n'), { total: 7, row_count: 2 });
});
