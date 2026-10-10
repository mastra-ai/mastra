import { describe, expect, it } from 'vitest';

import {
  computeAvatarRouteUrl,
  normalizeIncomingAvatarMetadata,
  normalizeIncomingAvatarUrl,
  rewriteMastraAvatarUrl,
  rewriteStoredAgentAvatar,
} from './rewrite-avatar-url';
import { validateMetadataAvatarUrl } from './validate-avatar';

describe('computeAvatarRouteUrl', () => {
  it('defaults to /api when no prefix is provided', () => {
    expect(computeAvatarRouteUrl('agent-1')).toBe('/api/agents/agent-1/avatar');
  });

  it('respects a custom prefix', () => {
    expect(computeAvatarRouteUrl('agent-1', '/mastra')).toBe('/mastra/agents/agent-1/avatar');
  });

  it('strips a trailing slash from the prefix', () => {
    expect(computeAvatarRouteUrl('agent-1', '/mastra/')).toBe('/mastra/agents/agent-1/avatar');
  });

  it('prepends a leading slash when missing', () => {
    expect(computeAvatarRouteUrl('agent-1', 'mastra')).toBe('/mastra/agents/agent-1/avatar');
  });

  it('URL-encodes the agent id', () => {
    expect(computeAvatarRouteUrl('agent one', '/api')).toBe('/api/agents/agent%20one/avatar');
  });
});

describe('rewriteMastraAvatarUrl', () => {
  it('rewrites mastra-avatar URLs matching the agent id', () => {
    expect(rewriteMastraAvatarUrl('mastra-avatar:agent-1', 'agent-1', '/api')).toBe('/api/agents/agent-1/avatar');
  });

  it('leaves other URL shapes unchanged', () => {
    expect(rewriteMastraAvatarUrl('data:image/png;base64,xxx', 'agent-1')).toBe('data:image/png;base64,xxx');
    expect(rewriteMastraAvatarUrl('https://cdn/x.png', 'agent-1')).toBe('https://cdn/x.png');
  });

  it('leaves non-string values unchanged', () => {
    expect(rewriteMastraAvatarUrl(undefined, 'agent-1')).toBeUndefined();
    expect(rewriteMastraAvatarUrl(null, 'agent-1')).toBeNull();
  });

  it('does not rewrite when the mastra-avatar id does not match', () => {
    expect(rewriteMastraAvatarUrl('mastra-avatar:other', 'agent-1', '/api')).toBe('mastra-avatar:other');
  });
});

describe('rewriteStoredAgentAvatar', () => {
  it('rewrites the metadata avatarUrl when it matches', () => {
    const record = { id: 'agent-1', metadata: { avatarUrl: 'mastra-avatar:agent-1', foo: 'bar' } };
    const out = rewriteStoredAgentAvatar(record, '/api');
    expect(out).not.toBe(record);
    expect(out.metadata).toEqual({ avatarUrl: '/api/agents/agent-1/avatar', foo: 'bar' });
  });

  it('returns the same record when metadata avatarUrl is unset', () => {
    const record = { id: 'agent-1', metadata: { foo: 'bar' } };
    expect(rewriteStoredAgentAvatar(record)).toBe(record);
  });

  it('returns the same record when metadata is missing', () => {
    const record = { id: 'agent-1' };
    expect(rewriteStoredAgentAvatar(record)).toBe(record);
  });

  it('does not rewrite data: URLs', () => {
    const record = { id: 'agent-1', metadata: { avatarUrl: 'data:image/png;base64,xxx' } };
    expect(rewriteStoredAgentAvatar(record)).toBe(record);
  });

  it('does not rewrite absolute http URLs', () => {
    const record = { id: 'agent-1', metadata: { avatarUrl: 'https://cdn/x.png' } };
    expect(rewriteStoredAgentAvatar(record)).toBe(record);
  });
});

describe('normalizeIncomingAvatarUrl', () => {
  it('maps a server-relative avatar route back to mastra-avatar:<id>', () => {
    expect(normalizeIncomingAvatarUrl('/api/agents/agent-1/avatar', 'agent-1', '/api')).toBe('mastra-avatar:agent-1');
  });

  it('accepts the configured route prefix', () => {
    expect(normalizeIncomingAvatarUrl('/mastra/agents/agent-1/avatar', 'agent-1', '/mastra')).toBe(
      'mastra-avatar:agent-1',
    );
  });

  it('falls back to the default /api prefix when a different prefix is configured', () => {
    expect(normalizeIncomingAvatarUrl('/api/agents/agent-1/avatar', 'agent-1', '/mastra')).toBe(
      'mastra-avatar:agent-1',
    );
  });

  it('accepts a bare /agents/:id/avatar path (no prefix)', () => {
    expect(normalizeIncomingAvatarUrl('/agents/agent-1/avatar', 'agent-1', '/api')).toBe('mastra-avatar:agent-1');
  });

  it('accepts an absolute URL whose pathname matches', () => {
    expect(normalizeIncomingAvatarUrl('https://host.example.com/api/agents/agent-1/avatar', 'agent-1', '/api')).toBe(
      'mastra-avatar:agent-1',
    );
  });

  it('leaves non-matching URLs unchanged', () => {
    expect(normalizeIncomingAvatarUrl('https://cdn/x.png', 'agent-1', '/api')).toBe('https://cdn/x.png');
    expect(normalizeIncomingAvatarUrl('data:image/png;base64,aa', 'agent-1', '/api')).toBe('data:image/png;base64,aa');
  });

  it('leaves mastra-avatar: URLs unchanged', () => {
    expect(normalizeIncomingAvatarUrl('mastra-avatar:agent-1', 'agent-1', '/api')).toBe('mastra-avatar:agent-1');
  });

  it('does not normalize a path that references a different agent id', () => {
    expect(normalizeIncomingAvatarUrl('/api/agents/other/avatar', 'agent-1', '/api')).toBe('/api/agents/other/avatar');
  });
});

describe('normalizeIncomingAvatarMetadata', () => {
  it('returns the same metadata reference when avatarUrl is absent', () => {
    const md = { foo: 'bar' };
    expect(normalizeIncomingAvatarMetadata(md, 'agent-1', '/api')).toBe(md);
  });

  it('returns the same metadata reference when avatarUrl is already canonical', () => {
    const md = { avatarUrl: 'mastra-avatar:agent-1' };
    expect(normalizeIncomingAvatarMetadata(md, 'agent-1', '/api')).toBe(md);
  });

  it('normalizes a server-relative URL back to mastra-avatar:<id>', () => {
    const md = { avatarUrl: '/api/agents/agent-1/avatar', other: 1 };
    const out = normalizeIncomingAvatarMetadata(md, 'agent-1', '/api');
    expect(out).not.toBe(md);
    expect(out).toEqual({ avatarUrl: 'mastra-avatar:agent-1', other: 1 });
  });

  it('handles undefined and null metadata', () => {
    expect(normalizeIncomingAvatarMetadata(undefined, 'agent-1')).toBeUndefined();
    expect(normalizeIncomingAvatarMetadata(null, 'agent-1')).toBeNull();
  });
});

describe('GET → PATCH round-trip', () => {
  it('a validator accepts metadata produced by rewriteStoredAgentAvatar after normalization', () => {
    const stored = { id: 'agent-1', metadata: { avatarUrl: 'mastra-avatar:agent-1', title: 'x' } };
    // Simulate GET: server rewrites to the route URL for the UI.
    const rewritten = rewriteStoredAgentAvatar(stored, '/api');
    expect(rewritten.metadata?.avatarUrl).toBe('/api/agents/agent-1/avatar');
    // Simulate PATCH: client sends back the rewritten metadata unchanged.
    const normalized = normalizeIncomingAvatarMetadata(rewritten.metadata, 'agent-1', '/api');
    // The validator must accept the result (no HTTPException thrown).
    expect(() => validateMetadataAvatarUrl(normalized, 'agent-1')).not.toThrow();
    expect(normalized?.avatarUrl).toBe('mastra-avatar:agent-1');
  });
});
