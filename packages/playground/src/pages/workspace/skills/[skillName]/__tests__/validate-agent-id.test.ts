import { describe, it, expect } from 'vitest';
import { validateAgentId } from '../validate-agent-id';

describe('validateAgentId', () => {
  it('returns agentId when it exists in the cached agents', () => {
    const cached = { 'agent-1': { name: 'Agent One' }, 'agent-2': { name: 'Agent Two' } };
    expect(validateAgentId('agent-1', cached)).toBe('agent-1');
  });

  it('returns null when agentId is not in the cached agents', () => {
    const cached = { 'agent-1': { name: 'Agent One' } };
    expect(validateAgentId('fake-agent', cached)).toBeNull();
  });

  it('returns null when agentId is null', () => {
    const cached = { 'agent-1': { name: 'Agent One' } };
    expect(validateAgentId(null, cached)).toBeNull();
  });

  it('returns null when cache is null (cold cache / direct link)', () => {
    expect(validateAgentId('agent-1', null)).toBeNull();
  });

  it('returns null when cache is undefined', () => {
    expect(validateAgentId('agent-1', undefined)).toBeNull();
  });

  it('returns null when both agentId and cache are null', () => {
    expect(validateAgentId(null, null)).toBeNull();
  });

  it('returns null for empty cache object', () => {
    expect(validateAgentId('agent-1', {})).toBeNull();
  });
});
