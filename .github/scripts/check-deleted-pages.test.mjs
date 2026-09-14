import assert from 'node:assert/strict';
import test from 'node:test';

import { getDeletedMdxFiles } from './check-deleted-pages.js';

const BASE_COMMIT = '1111111111111111111111111111111111111111';

test('passes the base ref as a literal revision argument and diffs the resolved commit', () => {
  const baseRef = '--output=$(touch${IFS}/tmp/mastra-pwn)';
  const calls = [];
  const outputs = [
    `${BASE_COMMIT}\n`,
    ['D\tdocs/src/content/en/removed.mdx', 'M\tdocs/src/content/en/changed.mdx', 'D\tdocs/other.txt'].join('\n'),
  ];
  const execute = (...args) => {
    calls.push(args);
    return outputs.shift();
  };

  assert.deepEqual(getDeletedMdxFiles(baseRef, execute), ['docs/src/content/en/removed.mdx']);
  assert.deepEqual(calls, [
    ['git', ['rev-parse', '--verify', '--end-of-options', `${baseRef}^{commit}`], { encoding: 'utf-8' }],
    ['git', ['diff', '--name-status', `${BASE_COMMIT}...HEAD`, '--', 'docs/src/content'], { encoding: 'utf-8' }],
  ]);
});

test('returns no deleted files when the base ref cannot be resolved', () => {
  const originalError = console.error;
  const errors = [];
  console.error = (...args) => errors.push(args);

  try {
    const execute = () => {
      throw new Error('unknown revision');
    };

    assert.deepEqual(getDeletedMdxFiles('missing', execute), []);
    assert.deepEqual(errors, [['Error getting deleted files:', 'unknown revision']]);
  } finally {
    console.error = originalError;
  }
});
