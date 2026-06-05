import { describe, it, expect } from 'vitest';
import { resolveWorkspaceId } from './workspace';

describe('resolveWorkspaceId', () => {
  it('returns the id when provided', () => {
    expect(resolveWorkspaceId('ws_123')).toBe('ws_123');
  });

  it('trims surrounding whitespace', () => {
    expect(resolveWorkspaceId('  ws_123  ')).toBe('ws_123');
  });

  it('returns undefined for undefined input', () => {
    expect(resolveWorkspaceId(undefined)).toBeUndefined();
  });

  it('returns undefined for an empty string', () => {
    expect(resolveWorkspaceId('')).toBeUndefined();
  });

  it('returns undefined for whitespace-only input', () => {
    expect(resolveWorkspaceId('   ')).toBeUndefined();
  });
});
