import { describe, expect, it } from 'vitest';
import { extractWorkspaceId } from '../extract-workspace-id';

describe('extractWorkspaceId', () => {
  it('returns undefined for an undefined workspace', () => {
    expect(extractWorkspaceId(undefined)).toBeUndefined();
  });

  it('returns undefined when workspace is not an "id" type', () => {
    expect(extractWorkspaceId({ type: 'inline', config: {} } as never)).toBeUndefined();
  });

  it('returns the workspaceId when type is "id" and workspaceId is a string', () => {
    expect(extractWorkspaceId({ type: 'id', workspaceId: 'ws-123' } as never)).toBe('ws-123');
  });

  it('returns undefined when type is "id" but workspaceId is not a string', () => {
    expect(extractWorkspaceId({ type: 'id', workspaceId: 42 } as never)).toBeUndefined();
  });
});
