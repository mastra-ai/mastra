import { describe, it } from 'vitest';
import transformer from '../codemods/v1/agent-abort-signal';
import { testTransform } from './test-utils';

describe('agent-abort-signal', () => {
  it('transforms correctly', () => {
    testTransform(transformer, 'agent-abort-signal');
  });
});
