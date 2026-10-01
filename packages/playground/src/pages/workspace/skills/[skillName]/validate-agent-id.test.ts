import { describe, expect, it } from 'vitest';
import { validateAgentId } from './validate-agent-id';

describe('validateAgentId', () => {
  const agents = { weatherAgent: {} };

  it('returns the id of a cached agent', () => {
    expect(validateAgentId('weatherAgent', agents)).toBe('weatherAgent');
  });

  it('rejects unknown ids', () => {
    expect(validateAgentId('missing', agents)).toBeNull();
  });

  it('rejects inherited Object.prototype names', () => {
    for (const id of ['constructor', 'toString', 'hasOwnProperty', '__proto__']) {
      expect(validateAgentId(id, agents)).toBeNull();
    }
  });
});
