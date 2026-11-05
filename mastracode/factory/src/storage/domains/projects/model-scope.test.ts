import { describe, expect, it } from 'vitest';

import { effectiveModelScope } from './base.js';

describe('effectiveModelScope', () => {
  it.each([
    ['factory', 'run', 'factory'],
    ['factory', 'session', 'factory'],
    ['user', 'run', 'user'],
    ['user', 'session', 'user'],
    ['hybrid', 'run', 'factory'],
    ['hybrid', 'session', 'user'],
  ] as const)('%s scope in a %s resolves %s', (scope, context, expected) => {
    expect(effectiveModelScope(scope, context)).toBe(expected);
  });
});
